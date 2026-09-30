import path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import writeFileAtomic from 'write-file-atomic';
import { modrinthClient } from '../../api/client.js';
import { GLOBAL_CONFIG_DIR } from '../../constants.js';
import type { InteractiveChoice } from '../../ui/interactive.js';

const CACHE_FILE_PATH = path.join(GLOBAL_CONFIG_DIR, 'cache', 'minecraft_versions.json');
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 jam TTL cache

// Cadangan daftar versi komprehensif (>= 1.16) jika perangkat offline
export const FALLBACK_MINECRAFT_VERSIONS: string[] = [
  '26.3',
  '26.2',
  '26.1',
  '1.21.4',
  '1.21.3',
  '1.21.2',
  '1.21.1',
  '1.21',
  '1.20.6',
  '1.20.5',
  '1.20.4',
  '1.20.3',
  '1.20.2',
  '1.20.1',
  '1.20',
  '1.19.4',
  '1.19.3',
  '1.19.2',
  '1.19.1',
  '1.19',
  '1.18.2',
  '1.18.1',
  '1.18',
  '1.17.1',
  '1.17',
  '1.16.5',
  '1.16.4',
  '1.16.3',
  '1.16.2',
  '1.16.1',
  '1.16',
];

interface DiskVersionCache {
  updatedAt: number;
  versions: string[];
}

let inMemoryVersions: string[] | null = null;
let lastFetchTime = 0;

/**
 * Filter logika numerik untuk memastikan versi Minecraft adalah >= 1.16
 * Mengizinkan format 1.16+, 1.20+, 1.21+, serta penomoran tahun/modern seperti 26.x
 */
export function isMinecraftVersionAtLeast1_16(version: string): boolean {
  if (!version || typeof version !== 'string') return false;
  const clean = version.trim().split('-')[0]; // buang suffix snapshot jika ada
  const parts = clean.split('.').map((p) => parseInt(p, 10));

  if (isNaN(parts[0])) return false;

  // Major version > 1 (seperti 26.x, 2.x)
  if (parts[0] > 1) return true;

  // Versi 1.x: minor harus >= 16 (1.16, 1.16.5, 1.20.1, 1.21.1, dst.)
  if (parts[0] === 1) {
    if (isNaN(parts[1])) return false;
    return parts[1] >= 16;
  }

  return false;
}

/**
 * Membandingkan 2 string versi Minecraft secara semantik (terbaru ke terlama)
 */
export function compareMinecraftVersionsDesc(a: string, b: string): number {
  const partsA = a.split('.').map((p) => parseInt(p, 10) || 0);
  const partsB = b.split('.').map((p) => parseInt(p, 10) || 0);

  const maxLen = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLen; i++) {
    const valA = partsA[i] ?? 0;
    const valB = partsB[i] ?? 0;
    if (valA !== valB) {
      return valB - valA; // descending (terbesar/terbaru di atas)
    }
  }

  return b.localeCompare(a);
}

/**
 * Mengambil seluruh versi resmi (release) Minecraft >= 1.16 langsung dari Modrinth API,
 * dengan cache cerdas memori & disk, serta auto-update bila ada versi baru dirilis.
 */
export async function getMinecraftReleaseVersions(options?: {
  forceRefresh?: boolean;
}): Promise<string[]> {
  const now = Date.now();

  // 1. Cek memory cache jika masih fresh
  if (!options?.forceRefresh && inMemoryVersions && inMemoryVersions.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return inMemoryVersions;
  }

  // 2. Coba fetch dari Modrinth API /tag/game_version
  try {
    const tags = await modrinthClient.getGameVersions();
    const releases = tags
      .filter((t) => t.version_type === 'release')
      .map((t) => t.version)
      .filter(isMinecraftVersionAtLeast1_16);

    // Hilangkan duplikasi dan urutkan
    const uniqueVersions = Array.from(new Set(releases)).sort(compareMinecraftVersionsDesc);

    if (uniqueVersions.length > 0) {
      inMemoryVersions = uniqueVersions;
      lastFetchTime = now;

      // Simpan ke disk cache secara asinkron di latar belakang
      saveToDiskCache({ updatedAt: now, versions: uniqueVersions }).catch(() => {});
      return uniqueVersions;
    }
  } catch {
    // Abaikan error jaringan dan lanjutkan ke cache disk / fallback
  }

  // 3. Coba baca dari disk cache lokal
  const diskData = await loadFromDiskCache();
  if (diskData && diskData.versions && diskData.versions.length > 0) {
    inMemoryVersions = diskData.versions;
    lastFetchTime = diskData.updatedAt || now;
    return diskData.versions;
  }

  // 4. Fallback statis jika benar-benar offline tanpa cache
  inMemoryVersions = FALLBACK_MINECRAFT_VERSIONS;
  lastFetchTime = now;
  return FALLBACK_MINECRAFT_VERSIONS;
}

/**
 * Menghasilkan daftar InteractiveChoice yang rapi dan siap pakai di antarmuka menu (Inquirer)
 * dengan highlight versi populer dan versi aktif pengguna saat ini.
 */
export async function getMinecraftVersionChoices(
  currentVersion?: string
): Promise<InteractiveChoice[]> {
  const versions = await getMinecraftReleaseVersions();
  const cleanCurrent = currentVersion?.toLowerCase().trim();

  const choices: InteractiveChoice[] = [];

  for (let i = 0; i < versions.length; i++) {
    const ver = versions[i];
    const isCurrent = cleanCurrent === ver.toLowerCase();

    let tagHint = '';
    if (isCurrent) {
      tagHint = '● Aktif Saat Ini';
    } else if (i === 0) {
      tagHint = 'Versi Terkini';
    } else if (ver === '1.21.1') {
      tagHint = 'Paling Populer & Stabil';
    } else if (ver === '1.20.1') {
      tagHint = 'Koleksi Mod Terbesar';
    } else if (ver === '1.16.5') {
      tagHint = 'Klasik Modern';
    }

    choices.push({
      name: `${isCurrent ? '● ' : '○ '}Minecraft ${ver}`,
      value: ver,
      hint: tagHint || undefined,
    });
  }

  return choices;
}

async function loadFromDiskCache(): Promise<DiskVersionCache | null> {
  try {
    const raw = await readFile(CACHE_FILE_PATH, 'utf8');
    return JSON.parse(raw) as DiskVersionCache;
  } catch {
    return null;
  }
}

async function saveToDiskCache(data: DiskVersionCache): Promise<void> {
  try {
    await mkdir(path.dirname(CACHE_FILE_PATH), { recursive: true });
    await writeFileAtomic(CACHE_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}
