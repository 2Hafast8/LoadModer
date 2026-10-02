import path from "node:path";
import {readFile, readdir} from "node:fs/promises";
import writeFileAtomic from "write-file-atomic";
import {
  LockfileDataSchema,
  type LockfileData,
  type LockModEntry,
  type AssetEntry,
} from "../../types/lockfile.js";

export class DependencyGraph {
  public readonly instanceDir: string;
  public lockfilePath: string;
  public data: LockfileData;

  constructor(instanceDir: string, gameVersion = "", loader = "") {
    this.instanceDir = instanceDir;
    this.lockfilePath = path.join(instanceDir, "loadmoder.lock.json");
    this.data = {
      $schema: "https://loadmoder.dev/schema/v1/lock.json",
      version: 1,
      gameVersion,
      loader,
      environment: "client",
      updatedAt: new Date().toISOString(),
      mods: {},
      resourcepacks: {},
      shaderpacks: {},
    };
  }

  async load(): Promise<void> {
    try {
      const content = await readFile(this.lockfilePath, "utf8");
      const parsed = JSON.parse(content);
      const validated = LockfileDataSchema.safeParse(parsed);
      if (validated.success) {
        this.data = validated.data;
      } else {
        await writeFileAtomic(`${this.lockfilePath}.corrupt.${Date.now()}.bak`, Buffer.from(content));
      }
    } catch (err: any) {
      if (err?.code === "ENOENT") {
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
    await writeFileAtomic(this.lockfilePath, JSON.stringify(this.data, null, 2) + "\n", "utf8");
  }

  findMod(idOrSlug: string): {slug: string; entry: LockModEntry} | undefined {
    const clean = idOrSlug.toLowerCase();
    if (this.data.mods[clean]) {
      return {slug: clean, entry: this.data.mods[clean]};
    }
    for (const [slug, entry] of Object.entries(this.data.mods)) {
      const fn = entry.filename.toLowerCase();
      if (
        entry.projectId.toLowerCase() === clean ||
        fn === clean ||
        `${fn}.disabled` === clean ||
        fn.replace(/\.disabled$/, "") === clean
      ) {
        return {slug, entry};
      }
    }
    return undefined;
  }

  getMod(slug: string): LockModEntry | undefined {
    return this.findMod(slug)?.entry;
  }

  registerMod(slug: string, entry: Omit<LockModEntry, "dependedBy" | "installedAt">): void {
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

  removeMod(slugOrId: string): {removedMod: LockModEntry | null; orphanedSlugs: string[]} {
    const match = this.findMod(slugOrId);
    if (!match) return {removedMod: null, orphanedSlugs: []};

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

    return {removedMod: target, orphanedSlugs};
  }

  registerAsset(type: "shader" | "resourcepack", slug: string, entry: AssetEntry): void {
    const key = slug.toLowerCase();
    if (type === "shader") {
      this.data.shaderpacks = this.data.shaderpacks ?? {};
      this.data.shaderpacks[key] = entry;
    } else {
      this.data.resourcepacks = this.data.resourcepacks ?? {};
      this.data.resourcepacks[key] = entry;
    }
  }

  removeAsset(type: "shader" | "resourcepack", slug: string): boolean {
    const key = slug.toLowerCase();
    if (type === "shader" && this.data.shaderpacks?.[key]) {
      delete this.data.shaderpacks[key];
      return true;
    }
    if (type === "resourcepack" && this.data.resourcepacks?.[key]) {
      delete this.data.resourcepacks[key];
      return true;
    }
    return false;
  }

  findAsset(
    type: "shader" | "resourcepack",
    slugOrFilename: string,
  ): {slug: string; entry: AssetEntry} | undefined {
    const collection = type === "shader" ? this.data.shaderpacks : this.data.resourcepacks;
    if (!collection) return undefined;
    const clean = slugOrFilename.toLowerCase();
    if (collection[clean]) {
      return {slug: clean, entry: collection[clean]};
    }
    for (const [slug, entry] of Object.entries(collection)) {
      if (entry.filename.toLowerCase() === clean) {
        return {slug, entry};
      }
    }
    return undefined;
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

  async reconcileWithDisk(
    modsDir: string,
    instanceDir?: string,
  ): Promise<{unregistered: string[]; orphanedSlugs: string[]}> {
    const baseInstanceDir = instanceDir ?? this.instanceDir;
    try {
      const files = await readdir(modsDir);
      const activeFilenames = new Set(files);

      const unregistered: string[] = [];
      const allOrphaned: string[] = [];

      for (const [slug, entry] of Object.entries(this.data.mods)) {
        const isPresent =
          activeFilenames.has(entry.filename) ||
          activeFilenames.has(`${entry.filename}.disabled`) ||
          activeFilenames.has(entry.filename.replace(".disabled", ""));

        if (!isPresent) {
          const {orphanedSlugs} = this.removeMod(slug);
          unregistered.push(slug);
          allOrphaned.push(...orphanedSlugs);
        }
      }

      let assetsChanged = false;
      if (baseInstanceDir) {
        const shaderDir = path.join(baseInstanceDir, "shaderpacks");
        try {
          const shaderFiles = new Set(await readdir(shaderDir));
          for (const [slug, entry] of Object.entries(this.data.shaderpacks ?? {})) {
            if (!shaderFiles.has(entry.filename)) {
              delete this.data.shaderpacks![slug];
              assetsChanged = true;
            }
          }
        } catch {}

        const rpDir = path.join(baseInstanceDir, "resourcepacks");
        try {
          const rpFiles = new Set(await readdir(rpDir));
          for (const [slug, entry] of Object.entries(this.data.resourcepacks ?? {})) {
            if (!rpFiles.has(entry.filename)) {
              delete this.data.resourcepacks![slug];
              assetsChanged = true;
            }
          }
        } catch {}
      }

      if (unregistered.length > 0 || assetsChanged) {
        await this.save();
      }

      return {unregistered, orphanedSlugs: allOrphaned};
    } catch {
      return {unregistered: [], orphanedSlugs: []};
    }
  }
}
