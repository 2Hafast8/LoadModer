import { app } from "electron";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { checkForAppUpdate, type AppUpdateInfo } from "../../core/updater/githubRelease.js";
import { downloadReleaseAsset, type UpdateDownloadProgress, type DownloadUpdateResult } from "../../core/updater/downloader.js";

export class DesktopUpdaterService {
  /**
   * Checks for updates against GitHub Releases.
   */
  async check(): Promise<AppUpdateInfo> {
    return checkForAppUpdate();
  }

  /**
   * Downloads an update asset with real-time progress.
   */
  async download(
    assetUrl: string,
    fileName: string,
    expectedSha256?: string,
    onProgress?: (progress: UpdateDownloadProgress) => void
  ): Promise<DownloadUpdateResult> {
    return downloadReleaseAsset(assetUrl, fileName, {
      expectedSha256,
      onProgress,
    });
  }

  /**
   * Spawns the Windows installer/executable and shuts down the current Electron app.
   */
  async install(filePath: string, silent: boolean = false): Promise<{ success: boolean; error?: string }> {
    if (!existsSync(filePath)) {
      return { success: false, error: `Update installer file not found at: ${filePath}` };
    }

    try {
      const args = silent ? ["/S"] : [];
      const child = spawn(filePath, args, {
        detached: true,
        stdio: "ignore",
      });

      child.unref();

      // Gracefully terminate the current application after spawning installer
      setTimeout(() => {
        app.quit();
      }, 500);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to launch update installer" };
    }
  }
}

export const desktopUpdater = new DesktopUpdaterService();

