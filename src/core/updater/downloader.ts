import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createWriteStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";
import { USER_AGENT } from "../../constants.js";
import { formatBytes } from "../../utils/format.js";

export interface UpdateDownloadProgress {
  percent: number;
  speed: string;
  downloadedBytes: number;
  totalBytes: number;
}

export interface DownloadUpdateResult {
  success: boolean;
  filePath?: string;
  sha256?: string;
  error?: string;
}

/**
 * Downloads a release asset to a temporary directory with real-time progress and SHA-256 verification.
 */
export async function downloadReleaseAsset(
  assetUrl: string,
  fileName: string,
  options?: {
    expectedSha256?: string;
    onProgress?: (progress: UpdateDownloadProgress) => void;
  }
): Promise<DownloadUpdateResult> {
  const tempDir = path.join(os.tmpdir(), "loadmoder-update");
  await fs.mkdir(tempDir, { recursive: true });

  const targetPath = path.join(tempDir, fileName);
  const partPath = `${targetPath}.part`;

  try {
    const response = await fetch(assetUrl, {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok || !response.body) {
      throw new Error(`Failed to download update: HTTP ${response.status} ${response.statusText}`);
    }

    const totalBytes = parseInt(response.headers.get("content-length") || "0", 10);
    let downloadedBytes = 0;
    let lastTime = Date.now();
    let bytesSinceLastCheck = 0;
    let currentSpeed = "0 B/s";

    const hash = crypto.createHash("sha256");
    const writeStream = createWriteStream(partPath);

    // Convert Web ReadableStream to Node Readable
    const nodeReadable = Readable.fromWeb(response.body as any);

    await new Promise<void>((resolve, reject) => {
      nodeReadable.on("data", (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        bytesSinceLastCheck += chunk.length;
        hash.update(chunk);

        const now = Date.now();
        const elapsedMs = now - lastTime;
        if (elapsedMs >= 250) {
          const speedBps = (bytesSinceLastCheck / elapsedMs) * 1000;
          currentSpeed = `${formatBytes(speedBps)}/s`;
          lastTime = now;
          bytesSinceLastCheck = 0;

          const percent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
          options?.onProgress?.({
            percent,
            speed: currentSpeed,
            downloadedBytes,
            totalBytes,
          });
        }
      });

      nodeReadable.on("error", (err) => {
        writeStream.destroy();
        reject(err);
      });

      writeStream.on("error", (err) => {
        nodeReadable.destroy();
        reject(err);
      });

      writeStream.on("finish", () => {
        resolve();
      });

      nodeReadable.pipe(writeStream);
    });

    // Final progress callback at 100%
    options?.onProgress?.({
      percent: 100,
      speed: "0 B/s",
      downloadedBytes,
      totalBytes: downloadedBytes,
    });

    const calculatedSha256 = hash.digest("hex").toLowerCase();

    // Verify SHA-256 if expected hash was provided
    if (options?.expectedSha256) {
      const cleanExpected = options.expectedSha256.trim().toLowerCase();
      if (calculatedSha256 !== cleanExpected) {
        await fs.unlink(partPath).catch(() => {});
        throw new Error(
          `Integrity error: SHA-256 mismatch.\nExpected: ${cleanExpected}\nCalculated: ${calculatedSha256}`
        );
      }
    }

    // Atomic move to target path
    await fs.rename(partPath, targetPath);

    return {
      success: true,
      filePath: targetPath,
      sha256: calculatedSha256,
    };
  } catch (err: any) {
    await fs.unlink(partPath).catch(() => {});
    return {
      success: false,
      error: err?.message || "Failed to download update",
    };
  }
}

