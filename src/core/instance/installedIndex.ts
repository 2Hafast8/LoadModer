import path from "node:path";
import {readdir} from "node:fs/promises";
import {DependencyGraph} from "../dependency/graph.js";
import type {SavedInstanceConfig} from "../../types/instance.js";

export interface InstalledModStatus {
  isInstalled: boolean;
  version?: string;
  filename?: string;
  isDisabled?: boolean;
  assetType?: "mod" | "shader" | "resourcepack";
}

export class InstalledAssetsIndex {
  private slugMap = new Map<string, InstalledModStatus>();
  private idMap = new Map<string, InstalledModStatus>();

  static async load(instance?: SavedInstanceConfig): Promise<InstalledAssetsIndex> {
    const index = new InstalledAssetsIndex();
    if (!instance?.modsDir) return index;

    const instanceDir = instance.rootDir ?? path.dirname(instance.modsDir);

    let diskFiles: string[] = [];
    try {
      diskFiles = await readdir(instance.modsDir);
    } catch {}
    const diskFileSet = new Set(diskFiles.map((f) => f.toLowerCase()));

    try {
      const graph = new DependencyGraph(instanceDir);
      await graph.load();

      for (const [slug, entry] of Object.entries(graph.data.mods)) {
        const lowerName = entry.filename.toLowerCase();
        const isDisabled =
          diskFileSet.has(`${lowerName}.disabled`) || lowerName.endsWith(".disabled");
        const actualFilename =
          isDisabled && !entry.filename.endsWith(".disabled")
            ? `${entry.filename}.disabled`
            : entry.filename;

        const info: InstalledModStatus = {
          isInstalled: true,
          version: entry.versionNumber,
          filename: actualFilename,
          isDisabled,
          assetType: "mod",
        };
        index.slugMap.set(slug.toLowerCase().trim(), info);
        if (entry.projectId) {
          index.idMap.set(entry.projectId.toLowerCase().trim(), info);
        }
      }

      for (const [slug, entry] of Object.entries(graph.data.resourcepacks)) {
        index.slugMap.set(slug.toLowerCase().trim(), {
          isInstalled: true,
          filename: entry.filename,
          assetType: "resourcepack",
        });
      }

      for (const [slug, entry] of Object.entries(graph.data.shaderpacks)) {
        index.slugMap.set(slug.toLowerCase().trim(), {
          isInstalled: true,
          filename: entry.filename,
          assetType: "shader",
        });
      }
    } catch {}

    for (const file of diskFiles) {
      if (file.endsWith(".jar") || file.endsWith(".jar.disabled")) {
        const isDisabled = file.endsWith(".disabled");
        const cleanFile = file.toLowerCase().replace(/\.disabled$/, "");
        const rawName = cleanFile.replace(/\.jar$/, "").trim();

        const candidateSlugs = new Set<string>();
        candidateSlugs.add(rawName);

        const withoutVersion = rawName.replace(/[-_]v?\d.*$/, "").trim();
        if (withoutVersion) candidateSlugs.add(withoutVersion);

        const withoutLoader = withoutVersion.replace(/[-_](fabric|forge|neoforge|quilt).*$/i, "").trim();
        if (withoutLoader) candidateSlugs.add(withoutLoader);

        const firstToken = rawName.split(/[-_v0-9]/)[0].trim();
        if (firstToken) candidateSlugs.add(firstToken);

        const diskInfo: InstalledModStatus = {
          isInstalled: true,
          filename: file,
          isDisabled,
          assetType: "mod",
        };

        for (const candidate of candidateSlugs) {
          if (candidate && !index.slugMap.has(candidate)) {
            index.slugMap.set(candidate, diskInfo);
          }
        }
      }
    }

    return index;
  }

  isInstalled(slugOrId: string): boolean {
    if (!slugOrId) return false;
    const clean = slugOrId.toLowerCase().trim();
    return this.slugMap.has(clean) || this.idMap.has(clean);
  }

  getStatus(slugOrId: string): InstalledModStatus | undefined {
    if (!slugOrId) return undefined;
    const clean = slugOrId.toLowerCase().trim();
    return this.slugMap.get(clean) ?? this.idMap.get(clean);
  }
}
