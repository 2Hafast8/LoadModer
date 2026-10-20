export interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

/**
 * Parses a semantic version string (e.g., "v2.7.0", "2.8.1-beta.1").
 */
export function parseSemver(version: string): ParsedSemver | null {
  if (!version || typeof version !== "string") return null;

  const cleaned = version.trim().replace(/^v/i, "");
  const [corePart, prerelease] = cleaned.split("-");
  const parts = corePart.split(".").map((p) => parseInt(p, 10));

  if (parts.length < 1 || parts.some((p) => isNaN(p))) {
    return null;
  }

  return {
    major: parts[0] ?? 0,
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0,
    prerelease: prerelease ? prerelease.trim() : undefined,
  };
}

/**
 * Compares two semantic version strings.
 * Returns:
 *  - negative number if v1 < v2
 *  - 0 if v1 === v2
 *  - positive number if v1 > v2
 */
export function compareSemver(v1: string, v2: string): number {
  const parsed1 = parseSemver(v1);
  const parsed2 = parseSemver(v2);

  if (!parsed1 && !parsed2) return 0;
  if (!parsed1) return -1;
  if (!parsed2) return 1;

  if (parsed1.major !== parsed2.major) {
    return parsed1.major - parsed2.major;
  }
  if (parsed1.minor !== parsed2.minor) {
    return parsed1.minor - parsed2.minor;
  }
  if (parsed1.patch !== parsed2.patch) {
    return parsed1.patch - parsed2.patch;
  }

  // Handle prereleases: standard versions are higher precedence than prereleases
  // (e.g., 2.8.0 > 2.8.0-beta.1)
  if (!parsed1.prerelease && parsed2.prerelease) return 1;
  if (parsed1.prerelease && !parsed2.prerelease) return -1;
  if (parsed1.prerelease && parsed2.prerelease) {
    return parsed1.prerelease.localeCompare(parsed2.prerelease);
  }

  return 0;
}

/**
 * Checks if targetVersion is strictly newer than currentVersion.
 */
export function isNewerVersion(currentVersion: string, targetVersion: string): boolean {
  return compareSemver(currentVersion, targetVersion) < 0;
}

