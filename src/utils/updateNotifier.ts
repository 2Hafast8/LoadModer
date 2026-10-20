import path from "node:path";
import { promises as fs } from "node:fs";
import writeFileAtomic from "write-file-atomic";
import boxen from "boxen";
import chalk from "chalk";
import { APP_VERSION, GLOBAL_CONFIG_DIR, USER_AGENT } from "../constants.js";
import { isNewerVersion } from "../core/updater/semver.js";

const CACHE_PATH = path.join(GLOBAL_CONFIG_DIR, "cache", "cli_update_check.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface UpdateCheckCache {
  lastChecked: number;
  latestVersion: string;
}

/**
 * Checks npm registry asynchronously for the latest version of loadmoder.
 * Caches results locally for 24 hours to prevent network overhead on every CLI invocation.
 */
export async function checkCliUpdate(): Promise<string | null> {
  try {
    let cached: UpdateCheckCache | null = null;
    try {
      const data = await fs.readFile(CACHE_PATH, "utf-8");
      cached = JSON.parse(data) as UpdateCheckCache;
    } catch {
      // Cache does not exist or is invalid
    }

    const now = Date.now();
    let latestVersion = cached?.latestVersion;

    if (!cached || now - cached.lastChecked > CACHE_TTL_MS) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      try {
        const res = await fetch("https://registry.npmjs.org/loadmoder/latest", {
          signal: controller.signal,
          headers: { "User-Agent": USER_AGENT },
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const pkg = (await res.json()) as { version?: string };
          if (pkg.version) {
            latestVersion = pkg.version;
            await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
            await writeFileAtomic(
              CACHE_PATH,
              JSON.stringify({ lastChecked: now, latestVersion }, null, 2),
              "utf-8"
            );
          }
        }
      } catch {
        // Network failure / timeout - ignore silently to keep CLI fast
      }
    }

    if (latestVersion && isNewerVersion(APP_VERSION, latestVersion)) {
      return latestVersion;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Displays a formatted terminal update banner if a newer version is available.
 */
export async function displayCliUpdateNotice(): Promise<void> {
  try {
    const latest = await checkCliUpdate();
    if (!latest) return;

    const message = [
      chalk.bold("Pembaruan LoadModer Tersedia!"),
      `${chalk.dim("Versi saat ini:")} ${chalk.red(APP_VERSION)}  ${chalk.dim("→")}  ${chalk.dim("Versi terbaru:")} ${chalk.green(latest)}`,
      "",
      `${chalk.dim("Jalankan:")} ${chalk.cyanBright("npm install -g loadmoder")} ${chalk.dim("untuk memperbarui")}`,
    ].join("\n");

    const boxed = boxen(message, {
      padding: 1,
      margin: { top: 1, bottom: 0 },
      borderColor: "green",
      borderStyle: "round",
      textAlignment: "center",
    });

    console.log(boxed);
  } catch {
    // Ignore error silently
  }
}

