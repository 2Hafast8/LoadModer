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

export interface DownloadUpdateOptions {
  expectedSha256?: string;
  expectedSize?: number;
  minBytes?: number;
  onProgress?: (progress: UpdateDownloadProgress) => void;
}

export interface DownloadUpdateResult {
  success: boolean;
  filePath?: string;
  sha256?: string;
  error?: string;
}

/**
 * Minimum executable size guard for LoadModer Windows binaries (default: 30 MB).
 */
export const MIN_EXE_BYTES = 30 * 1024 * 1024;

/**
 * Downloads a release asset to a temporary directory with multi-layer integrity verification.
 */
export async function downloadReleaseAsset(
  assetUrl: string,
  fileName: string,
  options?: DownloadUpdateOptions
): Promise<DownloadUpdateResult> {
  const tempDir = path.join(os.tmpdir(), "loadmoder-update");
  await fs.mkdir(tempDir, { recursive: true });

  const targetPath = path.join(tempDir, fileName);
  const partPath = `${targetPath}.part`;

  // Pre-cleanup stale or partial files before starting fresh download
  await fs.rm(partPath, { force: true }).catch(() => {});
  await fs.rm(targetPath, { force: true }).catch(() => {});

  let writeStream: ReturnType<typeof createWriteStream> | null = null;

  try {
    const response = await fetch(assetUrl, {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok || !response.body) {
      throw new Error(`Failed to download update: HTTP ${response.status} ${response.statusText}`);
    }

    const headerLength = parseInt(response.headers.get("content-length") || "0", 10);
    const expectedSize = options?.expectedSize && options.expectedSize > 0 ? options.expectedSize : undefined;
    const totalBytes = expectedSize ?? headerLength;

    let downloadedBytes = 0;
    let lastTime = Date.now();
    let bytesSinceLastCheck = 0;
    let currentSpeed = "0 B/s";

    const hash = crypto.createHash("sha256");
    const stream = createWriteStream(partPath);
    writeStream = stream;

    // Convert Web ReadableStream to Node Readable
    const nodeReadable = Readable.fromWeb(response.body as any);

    await new Promise<void>((resolve, reject) => {
      let isSettled = false;

      const safeReject = (err: any) => {
        if (!isSettled) {
          isSettled = true;
          reject(err);
        }
      };

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

          const percent = totalBytes > 0 ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
          options?.onProgress?.({
            percent,
            speed: currentSpeed,
            downloadedBytes,
            totalBytes,
          });
        }
      });

      nodeReadable.on("error", (err) => {
        stream.destroy();
        safeReject(err);
      });

      stream.on("error", (err) => {
        nodeReadable.destroy();
        safeReject(err);
      });

      // Wait for 'close' event to ensure file descriptor and OS disk buffers are flushed
      stream.on("close", () => {
        if (!isSettled) {
          isSettled = true;
          resolve();
        }
      });

      nodeReadable.pipe(stream);
    });

    // Multi-Layer Integrity Verifications:
    // 1. Content-Length header verification
    if (headerLength > 0 && downloadedBytes !== headerLength) {
      await fs.unlink(partPath).catch(() => {});
      throw new Error(
        `Unduhan terputus: Hanya menerima ${formatBytes(downloadedBytes)} dari total ${formatBytes(headerLength)}. Berkas tidak lengkap.`
      );
    }

    // 2. Authoritative metadata size verification (from GitHub Release API)
    if (expectedSize && downloadedBytes !== expectedSize) {
      await fs.unlink(partPath).catch(() => {});
      throw new Error(
        `Ukuran berkas tidak sesuai: Menerima ${formatBytes(downloadedBytes)}, diharapkan ${formatBytes(expectedSize)}.`
      );
    }

    // 3. Minimum binary size threshold (reject truncated downloads or HTML error payloads)
    const isExe = fileName.toLowerCase().endsWith(".exe");
    const minBytes = options?.minBytes ?? (isExe ? MIN_EXE_BYTES : 0);
    if (minBytes > 0 && downloadedBytes < minBytes) {
      await fs.unlink(partPath).catch(() => {});
      throw new Error(
        `Ukuran biner tidak valid: Hanya ${formatBytes(downloadedBytes)} (minimum ${formatBytes(minBytes)}). Berkas rusak atau terpotong.`
      );
    }

    // 4. SHA-256 hash verification
    const calculatedSha256 = hash.digest("hex").toLowerCase();
    if (options?.expectedSha256) {
      const cleanExpected = options.expectedSha256.trim().toLowerCase();
      if (calculatedSha256 !== cleanExpected) {
        await fs.unlink(partPath).catch(() => {});
        throw new Error(
          `Integritas berkas gagal (SHA-256 mismatch).\nDiharapkan: ${cleanExpected}\nDihitung: ${calculatedSha256}`
        );
      }
    }

    // 5. Windows PE Executable magic bytes sanity check (MZ = 0x4D, 0x5A)
    if (isExe) {
      const handle = await fs.open(partPath, "r");
      try {
        const headerBuf = Buffer.alloc(2);
        await handle.read(headerBuf, 0, 2, 0);
        if (headerBuf.toString("ascii") !== "MZ") {
          throw new Error("Format berkas rusak: Berkas bukan biner eksekutabel Windows (MZ magic missing).");
        }
      } finally {
        await handle.close().catch(() => {});
      }
    }

    // Final progress callback at 100%
    options?.onProgress?.({
      percent: 100,
      speed: "0 B/s",
      downloadedBytes,
      totalBytes: downloadedBytes,
    });

    // Atomic move to target path
    await fs.rename(partPath, targetPath);

    return {
      success: true,
      filePath: targetPath,
      sha256: calculatedSha256,
    };
  } catch (err: any) {
    if (writeStream && !writeStream.destroyed) {
      writeStream.destroy();
    }
    await fs.unlink(partPath).catch(() => {});
    return {
      success: false,
      error: err?.message || "Failed to download update",
    };
  }
}

