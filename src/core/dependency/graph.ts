import path from 'node:path';
import { readFile } from 'node:fs/promises';
import writeFileAtomic from 'write-file-atomic';
import type { LockfileData, LockModEntry } from '../../types/lockfile.js';

export class DependencyGraph {
  public lockfilePath: string;
  public data: LockfileData;

  constructor(instanceDir: string, gameVersion = '', loader = '') {
    this.lockfilePath = path.join(instanceDir, 'loadmoder.lock.json');
    this.data = {
      $schema: 'https://loadmoder.dev/schema/v1/lock.json',
      version: 1,
      gameVersion,
      loader,
      environment: 'client',
      updatedAt: new Date().toISOString(),
      mods: {},
    };
  }

  async load(): Promise<void> {
    try {
      const content = await readFile(this.lockfilePath, 'utf8');
      this.data = JSON.parse(content);
      if (!this.data.mods) this.data.mods = {};
    } catch {
      // Inisialisasi lockfile baru jika belum ada
    }
  }

  async save(): Promise<void> {
    this.data.updatedAt = new Date().toISOString();
    await writeFileAtomic(this.lockfilePath, JSON.stringify(this.data, null, 2) + '\n', 'utf8');
  }

  getMod(slug: string): LockModEntry | undefined {
    return this.data.mods[slug.toLowerCase()];
  }

  registerMod(slug: string, entry: Omit<LockModEntry, 'dependedBy' | 'installedAt'>): void {
    const key = slug.toLowerCase();
    const existing = this.data.mods[key];

    // Cari mod apa saja yang sudah terdaftar yang bergantung pada mod ini
    const dependedBy = existing ? [...existing.dependedBy] : [];
    for (const [modKey, modEntry] of Object.entries(this.data.mods)) {
      if (
        modEntry.dependencies.map((d) => d.toLowerCase()).includes(key) &&
        !dependedBy.includes(modKey)
      ) {
        dependedBy.push(modKey);
      }
    }

    this.data.mods[key] = {
      ...entry,
      dependedBy,
      installedAt: existing?.installedAt ?? new Date().toISOString(),
    };

    // Tambahkan relasi dependedBy ke anak dependensi yang sudah ada
    for (const depSlug of entry.dependencies) {
      const depKey = depSlug.toLowerCase();
      if (this.data.mods[depKey] && !this.data.mods[depKey].dependedBy.includes(key)) {
        this.data.mods[depKey].dependedBy.push(key);
      }
    }
  }

  removeMod(slug: string): { removedMod: LockModEntry | null; orphanedSlugs: string[] } {
    const key = slug.toLowerCase();
    const target = this.data.mods[key];
    if (!target) return { removedMod: null, orphanedSlugs: [] };

    delete this.data.mods[key];
    const orphanedSlugs: string[] = [];

    // Kurangi referensi dari dependensinya
    for (const depSlug of target.dependencies) {
      const depKey = depSlug.toLowerCase();
      const dep = this.data.mods[depKey];
      if (dep) {
        dep.dependedBy = dep.dependedBy.filter((parent) => parent !== key);
        if (!dep.isRoot && dep.dependedBy.length === 0) {
          orphanedSlugs.push(depKey);
        }
      }
    }

    return { removedMod: target, orphanedSlugs };
  }

  checkIncompatibilities(incompatibleProjectIds: string[]): string[] {
    const conflicts: string[] = [];
    for (const mod of Object.values(this.data.mods)) {
      if (incompatibleProjectIds.includes(mod.projectId)) {
        conflicts.push(mod.filename);
      }
    }
    return conflicts;
  }
}
