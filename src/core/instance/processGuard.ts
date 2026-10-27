import { execFile } from "node:child_process";

export type ProcessChecker = () => Promise<boolean>;

/**
 * Standard command execution wrapper for process detection.
 */
function defaultExec(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 3000 }, (error, stdout) => {
      if (error) {
        // Many command line tools return exit code 1 when no matching process is found
        resolve(stdout || "");
        return;
      }
      resolve(stdout || "");
    });
  });
}

let customChecker: ProcessChecker | null = null;
let lastCheckTime = 0;
let cachedResult = false;
const CACHE_TTL_MS = 1000;

export function invalidateProcessCache(): void {
  lastCheckTime = 0;
}

/**
 * Allows overriding process checker for unit tests.
 */
export function setProcessCheckerForTest(checker: ProcessChecker | null): void {
  customChecker = checker;
  lastCheckTime = 0;
}

/**
 * Detects whether a Minecraft client process (javaw.exe / Minecraft) is currently active.
 */
export async function isMinecraftRunning(
  executor: (cmd: string, args: string[]) => Promise<string> = defaultExec,
  platform: NodeJS.Platform = process.platform
): Promise<boolean> {
  if (customChecker) {
    return customChecker();
  }

  const now = Date.now();
  if (now - lastCheckTime < CACHE_TTL_MS) {
    return cachedResult;
  }

  const isWindows = platform === "win32";

  try {
    if (isWindows) {
      // On Windows, Minecraft client runs as javaw.exe
      const stdout = await executor("tasklist", [
        "/FI",
        "IMAGENAME eq javaw.exe",
        "/FO",
        "CSV",
        "/NH",
      ]);

      const lower = stdout.toLowerCase();
      cachedResult = lower.includes("javaw.exe");
      lastCheckTime = Date.now();
      return cachedResult;
    } else {
      // Unix / macOS: Check for Minecraft client process
      const stdout = await executor("pgrep", ["-l", "-f", "minecraft"]);
      const lines = stdout
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      cachedResult = lines.some((line) => {
        const lower = line.toLowerCase();
        // Ignore test runners, development tools, editors, or loadmoder itself
        if (
          lower.includes("vitest") ||
          lower.includes("jest") ||
          lower.includes("node") ||
          lower.includes("loadmoder") ||
          lower.includes(".test.") ||
          lower.includes(".spec.")
        ) {
          return false;
        }

        // Must be actual Minecraft client process (Java game or official launcher)
        return (
          lower.includes("net.minecraft") ||
          (lower.includes("java") && lower.includes("minecraft")) ||
          lower.includes("minecraft-launcher")
        );
      });
      lastCheckTime = Date.now();
      return cachedResult;
    }
  } catch {
    // If process listing fails, fail-safe to false to avoid blocking legitimate operations
    cachedResult = false;
    lastCheckTime = Date.now();
    return false;
  }
}

/**
 * Asserts that Minecraft is not running. Throws a user-friendly error if active.
 */
export async function assertMinecraftNotRunning(actionName?: string): Promise<void> {
  const running = await isMinecraftRunning();
  if (running) {
    const actionDesc = actionName ? ` ${actionName}` : " melakukan perubahan mod/profil";
    throw new Error(
      `Minecraft sedang berjalan. Harap tutup game Minecraft terlebih dahulu sebelum${actionDesc} demi mencegah kerusakan atau file lock (EBUSY).`
    );
  }
}
