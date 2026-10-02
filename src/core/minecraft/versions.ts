import path from "node:path";
import {readFile, mkdir} from "node:fs/promises";
import writeFileAtomic from "write-file-atomic";
import {modrinthClient} from "../../api/client.js";
import {GLOBAL_CONFIG_DIR} from "../../constants.js";

const CACHE_FILE_PATH = path.join(GLOBAL_CONFIG_DIR, "cache", "minecraft_versions.json");
const CACHE_TTL_MS = 60 * 60 * 1000;

export const FALLBACK_MINECRAFT_VERSIONS: string[] = [
  "26.3",
  "26.2",
  "26.1",
  "1.21.4",
  "1.21.3",
  "1.21.2",
  "1.21.1",
  "1.21",
  "1.20.6",
  "1.20.5",
  "1.20.4",
  "1.20.3",
  "1.20.2",
  "1.20.1",
  "1.20",
  "1.19.4",
  "1.19.3",
  "1.19.2",
  "1.19.1",
  "1.19",
  "1.18.2",
  "1.18.1",
  "1.18",
  "1.17.1",
  "1.17",
  "1.16.5",
  "1.16.4",
  "1.16.3",
  "1.16.2",
  "1.16.1",
  "1.16",
];

interface DiskVersionCache {
  updatedAt: number;
  versions: string[];
}

let inMemoryVersions: string[] | null = null;
let lastFetchTime = 0;

export function isMinecraftVersionAtLeast1_16(version: string): boolean {
  if (!version || typeof version !== "string") return false;
  const clean = version.trim().split("-")[0];
  const parts = clean.split(".").map((p) => parseInt(p, 10));

  if (isNaN(parts[0])) return false;

  if (parts[0] > 1) return true;

  if (parts[0] === 1) {
    if (isNaN(parts[1])) return false;
    return parts[1] >= 16;
  }

  return false;
}

export function compareMinecraftVersionsDesc(a: string, b: string): number {
  const partsA = a.split(".").map((p) => parseInt(p, 10) || 0);
  const partsB = b.split(".").map((p) => parseInt(p, 10) || 0);

  const maxLen = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLen; i++) {
    const valA = partsA[i] ?? 0;
    const valB = partsB[i] ?? 0;
    if (valA !== valB) {
      return valB - valA;
    }
  }

  return b.localeCompare(a);
}

export async function getMinecraftReleaseVersions(options?: {
  forceRefresh?: boolean;
}): Promise<string[]> {
  const now = Date.now();

  if (
    !options?.forceRefresh &&
    inMemoryVersions &&
    inMemoryVersions.length > 0 &&
    now - lastFetchTime < CACHE_TTL_MS
  ) {
    return inMemoryVersions;
  }

  if (!options?.forceRefresh) {
    const diskData = await loadFromDiskCache();
    if (
      diskData &&
      diskData.versions &&
      diskData.versions.length > 0 &&
      now - (diskData.updatedAt || 0) < CACHE_TTL_MS
    ) {
      inMemoryVersions = diskData.versions;
      lastFetchTime = diskData.updatedAt || now;
      return diskData.versions;
    }
  }

  try {
    const tags = await modrinthClient.getGameVersions();
    const releases = tags
      .filter((t) => t.version_type === "release")
      .map((t) => t.version)
      .filter(isMinecraftVersionAtLeast1_16);

    const uniqueVersions = Array.from(new Set(releases)).sort(compareMinecraftVersionsDesc);

    if (uniqueVersions.length > 0) {
      inMemoryVersions = uniqueVersions;
      lastFetchTime = now;
      saveToDiskCache({updatedAt: now, versions: uniqueVersions}).catch(() => {});
      return uniqueVersions;
    }
  } catch {
    // Network failure: proceed to disk cache or static fallback
  }

  const diskData = await loadFromDiskCache();
  if (diskData && diskData.versions && diskData.versions.length > 0) {
    inMemoryVersions = diskData.versions;
    lastFetchTime = diskData.updatedAt || now;
    return diskData.versions;
  }

  inMemoryVersions = FALLBACK_MINECRAFT_VERSIONS;
  lastFetchTime = now;
  return FALLBACK_MINECRAFT_VERSIONS;
}

async function loadFromDiskCache(): Promise<DiskVersionCache | null> {
  try {
    const raw = await readFile(CACHE_FILE_PATH, "utf8");
    return JSON.parse(raw) as DiskVersionCache;
  } catch {
    return null;
  }
}

async function saveToDiskCache(data: DiskVersionCache): Promise<void> {
  try {
    await mkdir(path.dirname(CACHE_FILE_PATH), {recursive: true});
    await writeFileAtomic(CACHE_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch {}
}
