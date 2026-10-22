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

/**
 * Allows overriding process checker for unit tests.
 */
export function setProcessCheckerForTest(checker: ProcessChecker | null): void {
  customChecker = checker;
}

/**
 * Detects whether a Minecraft client process (javaw.exe / Minecraft) is currently active.
 */
export async function isMinecraftRunning(
  executor: (cmd: string, args: string[]) => Promise<string> = defaultExec
): Promise<boolean> {
  if (customChecker) {
    return customChecker();
  }

  const isWindows = process.platform === "win32";

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
      if (lower.includes("javaw.exe")) {
        return true;
      }

      return false;
    } else {
      // Unix / macOS
      const stdout = await executor("pgrep", ["-l", "-f", "minecraft"]);
      return stdout.trim().length > 0;
    }
  } catch {
    // If process listing fails, fail-safe to false to avoid blocking legitimate operations
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
