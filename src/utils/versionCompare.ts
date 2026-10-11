import type { ModVersion } from '../types/modrinth.js';

/**
 * Extracts normalized version string from filename or version string,
 * removing Minecraft prefixes (mc1.20.1-, mc26.3-) and build metadata (+mc26.3).
 */
export function extractVersionString(raw: string): string {
  if (!raw) return '';
  let s = raw.trim();

  // Strip file extensions (.jar, .jar.disabled, .zip)
  s = s.replace(/\.(jar|zip)(?:\.disabled)?$/i, '');

  // Strip build metadata after '+' (standard semver, e.g. +mc26.3, +1.20.1)
  s = s.replace(/\+.*$/, '');

  // Strip Minecraft version indicators with 'mc' prefix (e.g. mc26.3-, -mc1.20.1-, mc1.20.1)
  s = s.replace(/(?:^|[-_])mc\d+(?:\.\d+)*[-_]?/gi, '-');

  // Strip loader names
  s = s.replace(/(?:^|[-_])(fabric|forge|neoforge|quilt)(?:[-_]|$)/gi, '-');

  // Match version pattern: digits.digits with optional .digits and optional -tag.digits
  const match = s.match(/(\d+\.\d+(?:\.\d+)?(?:[-_.]?(?:alpha|beta|rc|pre)[-_.]?\d*)?)/i);
  return match ? match[1] : s;
}

export interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prereleaseRank: number; // 0 = alpha, 1 = beta, 2 = rc/pre, 3 = release
  prereleaseNum: number;
}

/**
 * Parses numeric major, minor, patch and prerelease rank from version string.
 */
export function parseSemverParts(versionStr: string): ParsedSemver {
  const clean = extractVersionString(versionStr);
  const match = clean.match(/v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-_.]?(alpha|beta|rc|pre)[-_.]?(\d+)?)?/i);
  if (!match) {
    return { major: 0, minor: 0, patch: 0, prereleaseRank: 3, prereleaseNum: 0 };
  }

  const major = parseInt(match[1] || '0', 10);
  const minor = parseInt(match[2] || '0', 10);
  const patch = parseInt(match[3] || '0', 10);
  const tag = (match[4] || '').toLowerCase();
  const prereleaseNum = parseInt(match[5] || '0', 10);

  let prereleaseRank = 3; // default: full release
  if (tag.includes('alpha')) prereleaseRank = 0;
  else if (tag.includes('beta')) prereleaseRank = 1;
  else if (tag.includes('rc') || tag.includes('pre')) prereleaseRank = 2;

  return { major, minor, patch, prereleaseRank, prereleaseNum };
}

/**
 * Returns:
 *  > 0 if versionA is strictly newer than versionB
 *  < 0 if versionA is strictly older than versionB
 *  = 0 if versions are identical
 */
export function compareModVersions(versionA: string, versionB: string): number {
  const pA = parseSemverParts(versionA);
  const pB = parseSemverParts(versionB);

  if (pA.major !== pB.major) return pA.major - pB.major;
  if (pA.minor !== pB.minor) return pA.minor - pB.minor;
  if (pA.patch !== pB.patch) return pA.patch - pB.patch;
  if (pA.prereleaseRank !== pB.prereleaseRank) return pA.prereleaseRank - pB.prereleaseRank;
  if (pA.prereleaseNum !== pB.prereleaseNum) return pA.prereleaseNum - pB.prereleaseNum;

  return 0;
}

/**
 * Determines whether candidate `nextVer` is a genuine, verified update for `currentFile`.
 * Prevents downgrades, older releases, and duplicate builds from being suggested as updates.
 */
export function isTrueUpdate(
  currentFile: { filename: string; sha1: string },
  currentVer: ModVersion | undefined | null,
  nextVer: ModVersion | undefined | null
): boolean {
  if (!nextVer) return false;

  const nextFile = nextVer.files.find((f: any) => f.primary) ?? nextVer.files[0];
  if (!nextFile) return false;

  // 1. Identical hash or identical version ID is not an update
  if (nextFile.hashes?.sha1 === currentFile.sha1) {
    return false;
  }
  if (currentVer && nextVer.id === currentVer.id) {
    return false;
  }

  // 2. Publication date validation:
  // If nextVer was published on or before currentVer, it cannot be a newer release.
  if (currentVer?.date_published && nextVer.date_published) {
    const currentDate = new Date(currentVer.date_published).getTime();
    const nextDate = new Date(nextVer.date_published).getTime();
    if (nextDate <= currentDate) {
      return false;
    }
  }

  // 3. SemVer comparison:
  const currentVersionStr = currentVer?.version_number || currentFile.filename;
  const nextVersionStr = nextVer.version_number;

  const cmp = compareModVersions(nextVersionStr, currentVersionStr);
  if (cmp <= 0) {
    return false;
  }

  // 4. Stability guard:
  // If current installed version is a stable full release, don't propose alpha downgrade
  if (currentVer?.version_type === 'release' && nextVer.version_type === 'alpha') {
    return false;
  }

  return true;
}
