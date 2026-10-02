import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
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
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        return;
      }
      try {
        const raw = await readFile(this.lockfilePath);
        await writeFileAtomic(`${this.lockfilePath}.corrupt.${Date.now()}.bak`, raw);
      } catch {}
    }
  }

  async save(): Promise<void> {
    this.data.updatedAt = new Date().toISOString();
    await writeFileAtomic(this.lockfilePath, JSON.stringify(this.data, null, 2) + '\n', 'utf8');
  }

  findMod(idOrSlug: string): { slug: string; entry: LockModEntry } | undefined {
    const clean = idOrSlug.toLowerCase();
    if (this.data.mods[clean]) {
      return { slug: clean, entry: this.data.mods[clean] };
    }
    for (const [slug, entry] of Object.entries(this.data.mods)) {
      if (entry.projectId.toLowerCase() === clean) {
        return { slug, entry };
      }
    }
    return undefined;
  }

  getMod(slug: string): LockModEntry | undefined {
    return this.findMod(slug)?.entry;
  }

  registerMod(slug: string, entry: Omit<LockModEntry, 'dependedBy' | 'installedAt'>): void {
    const key = slug.toLowerCase();
    const existing = this.data.mods[key];
    const projectIdClean = entry.projectId.toLowerCase();

    const dependedBy = existing ? [...existing.dependedBy] : [];
    for (const [modKey, modEntry] of Object.entries(this.data.mods)) {
      const depList = (modEntry.dependencies || []).map((d) => d.toLowerCase());
      if (
        (depList.includes(key) || depList.includes(projectIdClean)) &&
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

    for (const depIdentifier of entry.dependencies) {
      const target = this.findMod(depIdentifier);
      if (target && !target.entry.dependedBy.includes(key)) {
        target.entry.dependedBy.push(key);
      }
    }
  }

  removeMod(slugOrId: string): { removedMod: LockModEntry | null; orphanedSlugs: string[] } {
    const match = this.findMod(slugOrId);
    if (!match) return { removedMod: null, orphanedSlugs: [] };

    const key = match.slug;
    const target = match.entry;
    delete this.data.mods[key];
    const orphanedSlugs: string[] = [];

    for (const depIdentifier of target.dependencies) {
      const child = this.findMod(depIdentifier);
      if (child) {
        child.entry.dependedBy = child.entry.dependedBy.filter((parent) => parent !== key);
        if (!child.entry.isRoot && child.entry.dependedBy.length === 0) {
          orphanedSlugs.push(child.slug);
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

  /**
   * Rekonsiliasi data lockfile dengan file fisik yang ada di folder mods.
   * Jika ada mod yang dihapus secara manual dari disk, mod tersebut otomatis
   * di-unregister dari lockfile dan dependensi yatim (orphan) akan terdeteksi.
   */
  async reconcileWithDisk(modsDir: string): Promise<{ unregistered: string[]; orphanedSlugs: string[] }> {
    try {
      const files = await readdir(modsDir);
      const activeFilenames = new Set(files);

      const unregistered: string[] = [];
      const allOrphaned: string[] = [];

      for (const [slug, entry] of Object.entries(this.data.mods)) {
        const isPresent =
          activeFilenames.has(entry.filename) ||
          activeFilenames.has(`${entry.filename}.disabled`) ||
          activeFilenames.has(entry.filename.replace('.disabled', ''));

        if (!isPresent) {
          const { orphanedSlugs } = this.removeMod(slug);
          unregistered.push(slug);
          allOrphaned.push(...orphanedSlugs);
        }
      }

      if (unregistered.length > 0) {
        await this.save();
      }

      return { unregistered, orphanedSlugs: allOrphaned };
    } catch {
      return { unregistered: [], orphanedSlugs: [] };
    }
  }
}
