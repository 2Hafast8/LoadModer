import { app, shell } from "electron";
import { spawn } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import { checkForAppUpdate, type AppUpdateInfo } from "../../core/updater/githubRelease.js";
import {
  downloadReleaseAsset,
  MIN_EXE_BYTES,
  type UpdateDownloadProgress,
  type DownloadUpdateResult,
} from "../../core/updater/downloader.js";

export class DesktopUpdaterService {
  /**
   * Checks for updates against GitHub Releases.
   */
  async check(): Promise<AppUpdateInfo> {
    return checkForAppUpdate();
  }

  /**
   * Downloads an update asset with real-time progress and multi-layer verification.
   */
  async download(
    assetUrl: string,
    fileName: string,
    expectedSha256?: string,
    expectedSize?: number,
    expectedSha512?: string,
    onProgress?: (progress: UpdateDownloadProgress) => void
  ): Promise<DownloadUpdateResult> {
    return downloadReleaseAsset(assetUrl, fileName, {
      expectedSha256,
      expectedSha512,
      expectedSize,
      maxRetries: 1,
      onProgress,
    });
  }

  /**
   * Verifies the physical size and PE executable header of a file before execution.
   */
  async verifyExecutableSanity(filePath: string): Promise<{ valid: boolean; error?: string }> {
    if (!existsSync(filePath)) {
      return { valid: false, error: `Berkas tidak ditemukan: ${filePath}` };
    }

    try {
      const stat = await fs.stat(filePath);
      if (filePath.toLowerCase().endsWith(".exe") && stat.size < MIN_EXE_BYTES) {
        return {
          valid: false,
          error: `Ukuran biner terlalu kecil (${stat.size} bytes). Kemungkinan unduhan terputus atau rusak.`,
        };
      }

      // Check PE executable magic bytes (MZ = 0x4D, 0x5A)
      const handle = await fs.open(filePath, "r");
      try {
        const headerBuf = Buffer.alloc(2);
        await handle.read(headerBuf, 0, 2, 0);
        if (headerBuf.toString("ascii") !== "MZ") {
          return {
            valid: false,
            error: "Format berkas rusak: Berkas bukan biner eksekutabel Windows (MZ magic missing).",
          };
        }
      } finally {
        await handle.close().catch(() => {});
      }

      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: err?.message || "Gagal memverifikasi integritas berkas" };
    }
  }

  /**
   * Spawns the Windows installer/executable and shuts down the current Electron app.
   */
  async install(filePath: string, silent: boolean = false): Promise<{ success: boolean; error?: string }> {
    const sanity = await this.verifyExecutableSanity(filePath);
    if (!sanity.valid) {
      return { success: false, error: sanity.error };
    }

    try {
      if (!silent) {
        // Preferred Windows method: shell.openPath uses ShellExecuteExW which natively handles UAC elevation prompts
        const openError = await shell.openPath(filePath);
        if (!openError) {
          try {
            app.releaseSingleInstanceLock();
          } catch {}
          setTimeout(() => {
            app.quit();
          }, 800);
          return { success: true };
        }
      }

      const args = silent ? ["/S"] : [];
      const child = spawn(filePath, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      });

      child.unref();

      try {
        app.releaseSingleInstanceLock();
      } catch {}

      // Gracefully terminate the current application after spawning installer
      setTimeout(() => {
        app.quit();
      }, 800);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to launch update installer" };
    }
  }
}

export const desktopUpdater = new DesktopUpdaterService();

