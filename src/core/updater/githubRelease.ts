import { APP_VERSION, USER_AGENT } from "../../constants.js";
import { isNewerVersion } from "./semver.js";

export const DEFAULT_GITHUB_REPO = "2Hafast8/LoadModer";

export interface ReleaseAssetInfo {
  name: string;
  downloadUrl: string;
  size: number;
  sha256?: string;
  sha512?: string;
}

export interface AppUpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  tagName: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  htmlUrl: string;
  setupAsset?: ReleaseAssetInfo;
  portableAsset?: ReleaseAssetInfo;
  checksumsAsset?: ReleaseAssetInfo;
  latestYmlAsset?: ReleaseAssetInfo;
  error?: string;
}

export interface GitHubReleasePayload {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  assets?: Array<{
    name: string;
    browser_download_url: string;
    size: number;
    content_type?: string;
  }>;
}

export interface LatestYmlFileInfo {
  url: string;
  sha512: string;
  size?: number;
}

/**
 * Parses SHA-512 hashes and file sizes from electron-builder's latest.yml.
 */
export function parseLatestYmlContent(content: string): Record<string, LatestYmlFileInfo> {
  const result: Record<string, LatestYmlFileInfo> = {};
  if (!content) return result;

  const lines = content.split(/\r?\n/);
  let currentFile: Partial<LatestYmlFileInfo> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const urlMatch = /^(?:-\s*)?url:\s*([^\s]+)/i.exec(trimmed);
    if (urlMatch) {
      if (currentFile?.url && currentFile.sha512) {
        result[currentFile.url.toLowerCase()] = currentFile as LatestYmlFileInfo;
      }
      currentFile = { url: urlMatch[1] };
      continue;
    }

    const sha512Match = /^sha512:\s*([^\s]+)/i.exec(trimmed);
    if (sha512Match) {
      if (currentFile) {
        currentFile.sha512 = sha512Match[1];
      }
      continue;
    }

    const sizeMatch = /^size:\s*(\d+)/i.exec(trimmed);
    if (sizeMatch && currentFile) {
      currentFile.size = parseInt(sizeMatch[1], 10);
      continue;
    }

    const pathMatch = /^path:\s*([^\s]+)/i.exec(trimmed);
    if (pathMatch) {
      const p = pathMatch[1].toLowerCase();
      if (!result[p] && currentFile?.sha512) {
        result[p] = { url: pathMatch[1], sha512: currentFile.sha512, size: currentFile.size };
      }
    }
  }

  if (currentFile?.url && currentFile.sha512) {
    result[currentFile.url.toLowerCase()] = currentFile as LatestYmlFileInfo;
  }

  return result;
}

/**
 * Parses SHA-256 hashes from a SHA256SUMS.txt content.
 * Supports both standard unix format (hash  filename) and PowerShell Format-Table.
 */
export function parseChecksumsContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!content) return result;

  const lines = content.split(/\r?\n/);
  const hashRegex = /([a-fA-F0-9]{64})/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("Algorithm") || trimmed.startsWith("----")) {
      continue;
    }

    const match = hashRegex.exec(trimmed);
    if (match) {
      const hash = match[1].toLowerCase();
      // Look for .exe or any filename in the line
      const afterHash = trimmed.substring(match.index + 64).trim();
      const beforeHash = trimmed.substring(0, match.index).trim();
      const fileCandidate = afterHash || beforeHash;
      
      const fileMatch = /([^\s\\/]+\.(?:exe|zip|mrpack|txt))/i.exec(fileCandidate);
      if (fileMatch) {
        result[fileMatch[1].toLowerCase()] = hash;
      }
    }
  }

  return result;
}

/**
 * Checks GitHub Releases for the latest version of LoadModer.
 */
export async function checkForAppUpdate(
  currentVersion: string = APP_VERSION,
  repo: string = DEFAULT_GITHUB_REPO
): Promise<AppUpdateInfo> {
  const fallbackResult: AppUpdateInfo = {
    updateAvailable: false,
    currentVersion,
    latestVersion: currentVersion,
    tagName: `v${currentVersion}`,
    releaseName: `LoadModer v${currentVersion}`,
    releaseNotes: "",
    publishedAt: "",
    htmlUrl: `https://github.com/${repo}/releases`,
  };

  try {
    const url = `https://api.github.com/repos/${repo}/releases/latest`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        return {
          ...fallbackResult,
          error: "Batas kuota pemeriksaan GitHub API tercapai (Rate Limit 60 req/jam). Silakan coba lagi beberapa saat lagi.",
        };
      }
      return {
        ...fallbackResult,
        error: `GitHub API responded with status ${response.status}`,
      };
    }

    const release = (await response.json()) as GitHubReleasePayload;
    if (!release || !release.tag_name) {
      return fallbackResult;
    }

    const cleanLatest = release.tag_name.replace(/^v/i, "").trim();
    const updateAvailable = isNewerVersion(currentVersion, cleanLatest);

    let setupAsset: ReleaseAssetInfo | undefined;
    let portableAsset: ReleaseAssetInfo | undefined;
    let checksumsAsset: ReleaseAssetInfo | undefined;
    let latestYmlAsset: ReleaseAssetInfo | undefined;

    for (const asset of release.assets ?? []) {
      const lower = asset.name.toLowerCase();
      const assetInfo: ReleaseAssetInfo = {
        name: asset.name,
        downloadUrl: asset.browser_download_url,
        size: asset.size,
      };

      if (lower.endsWith(".exe") && lower.includes("setup")) {
        setupAsset = assetInfo;
      } else if (lower.endsWith(".exe") && lower.includes("portable")) {
        portableAsset = assetInfo;
      } else if (lower === "latest.yml" || lower.endsWith("/latest.yml")) {
        latestYmlAsset = assetInfo;
      } else if (lower.includes("sha256") || lower.endsWith("sums.txt")) {
        checksumsAsset = assetInfo;
      }
    }

    // Try to fetch checksums from latest.yml (official electron-builder metadata with sha512)
    if (latestYmlAsset) {
      try {
        const ymlResp = await fetch(latestYmlAsset.downloadUrl, {
          headers: { "User-Agent": USER_AGENT },
        });
        if (ymlResp.ok) {
          const ymlText = await ymlResp.text();
          const ymlMap = parseLatestYmlContent(ymlText);
          if (setupAsset && ymlMap[setupAsset.name.toLowerCase()]) {
            const entry = ymlMap[setupAsset.name.toLowerCase()];
            setupAsset.sha512 = entry.sha512;
            if (entry.size && !setupAsset.size) {
              setupAsset.size = entry.size;
            }
          }
        }
      } catch {
        // Silently continue if latest.yml fetch fails; SHA256SUMS.txt may still succeed
      }
    }

    // Try to fetch checksums from SHA256SUMS.txt
    if (checksumsAsset) {
      try {
        const sumResp = await fetch(checksumsAsset.downloadUrl, {
          headers: { "User-Agent": USER_AGENT },
        });
        if (sumResp.ok) {
          const sumText = await sumResp.text();
          const checksumMap = parseChecksumsContent(sumText);
          if (setupAsset && checksumMap[setupAsset.name.toLowerCase()]) {
            setupAsset.sha256 = checksumMap[setupAsset.name.toLowerCase()];
          }
          if (portableAsset && checksumMap[portableAsset.name.toLowerCase()]) {
            portableAsset.sha256 = checksumMap[portableAsset.name.toLowerCase()];
          }
        }
      } catch {
        // Silently continue if checksum download fails; download will still proceed
      }
    }

    return {
      updateAvailable,
      currentVersion,
      latestVersion: cleanLatest,
      tagName: release.tag_name,
      releaseName: release.name || `LoadModer ${release.tag_name}`,
      releaseNotes: release.body || "",
      publishedAt: release.published_at,
      htmlUrl: release.html_url,
      setupAsset,
      portableAsset,
      checksumsAsset,
      latestYmlAsset,
    };
  } catch (err: any) {
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    return {
      ...fallbackResult,
      error: isTimeout
        ? "Koneksi ke GitHub melebihi batas waktu (timeout). Periksa jaringan internet Anda."
        : err?.message || "Failed to check GitHub releases",
    };
  }
}
