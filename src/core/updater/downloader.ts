import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
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
  expectedSha512?: string;
  expectedSize?: number;
  minBytes?: number;
  maxRetries?: number;
  onProgress?: (progress: UpdateDownloadProgress) => void;
}

export interface DownloadUpdateResult {
  success: boolean;
  filePath?: string;
  sha256?: string;
  sha512?: string;
  error?: string;
}

/**
 * Minimum executable size guard for LoadModer Windows binaries (default: 30 MB).
 */
export const MIN_EXE_BYTES = 30 * 1024 * 1024;

/**
 * Calculates physical hashes directly from file on disk to prevent stream desync.
 */
export async function calculateFileHashes(filePath: string): Promise<{
  sha256: string;
  sha512Hex: string;
  sha512Base64: string;
  size: number;
}> {
  const hash256 = crypto.createHash("sha256");
  const hash512 = crypto.createHash("sha512");
  let size = 0;

  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    hash256.update(buf);
    hash512.update(buf);
  }

  const sha512Buf = hash512.digest();
  return {
    sha256: hash256.digest("hex").toLowerCase(),
    sha512Hex: sha512Buf.toString("hex").toLowerCase(),
    sha512Base64: sha512Buf.toString("base64"),
    size,
  };
}

/**
 * Internal single-attempt download worker using Transform stream and pipeline.
 */
async function downloadReleaseAssetOnce(
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

    const streamSha256 = crypto.createHash("sha256");
    const streamSha512 = crypto.createHash("sha512");
    writeStream = createWriteStream(partPath);

    // Transform stream enforces strict backpressure control between network and disk
    const progressTransform = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        downloadedBytes += buf.length;
        bytesSinceLastCheck += buf.length;
        streamSha256.update(buf);
        streamSha512.update(buf);

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

        callback(null, buf);
      },
    });

    // Native Node.js pipeline handles backpressure, flow pausing, and error teardown end-to-end
    const nodeReadable = Readable.fromWeb(response.body as any);
    await pipeline(nodeReadable, progressTransform, writeStream);

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

    // 4. Windows PE Executable magic bytes sanity check (MZ = 0x4D, 0x5A)
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

    // 5. Post-Write On-Disk Re-verification (reads physical file on disk to catch disk write or antivirus desync)
    const onDisk = await calculateFileHashes(partPath);
    const calculatedSha256 = streamSha256.digest("hex").toLowerCase();

    if (onDisk.sha256 !== calculatedSha256) {
      await fs.unlink(partPath).catch(() => {});
      throw new Error(
        `Integritas disk gagal: Hash berkas pada disk (${onDisk.sha256}) berbeda dengan hash data yang diterima (${calculatedSha256}).`
      );
    }

    // 6. SHA-256 hash verification
    if (options?.expectedSha256) {
      const cleanExpected = options.expectedSha256.trim().toLowerCase();
      if (onDisk.sha256 !== cleanExpected) {
        await fs.unlink(partPath).catch(() => {});
        throw new Error(
          `Integritas berkas gagal (SHA-256 mismatch).\nDiharapkan: ${cleanExpected}\nDihitung: ${onDisk.sha256}`
        );
      }
    }

    // 7. SHA-512 hash verification (supports hex or base64 from latest.yml)
    if (options?.expectedSha512) {
      const cleanExpected = options.expectedSha512.trim();
      const isBase64 = cleanExpected.endsWith("=") || cleanExpected.length === 88;
      const matches = isBase64
        ? onDisk.sha512Base64 === cleanExpected
        : onDisk.sha512Hex === cleanExpected.toLowerCase();

      if (!matches) {
        await fs.unlink(partPath).catch(() => {});
        throw new Error(
          `Integritas berkas gagal (SHA-512 mismatch).\nDiharapkan: ${cleanExpected}\nDihitung: ${isBase64 ? onDisk.sha512Base64 : onDisk.sha512Hex}`
        );
      }
    }

    // Final progress callback at 100%
    options?.onProgress?.({
      percent: 100,
      speed: "0 B/s",
      downloadedBytes: onDisk.size,
      totalBytes: onDisk.size,
    });

    // Atomic move to target path only after 100% verified
    await fs.rename(partPath, targetPath);

    return {
      success: true,
      filePath: targetPath,
      sha256: onDisk.sha256,
      sha512: onDisk.sha512Hex,
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

/**
 * Downloads a release asset to a temporary directory with multi-layer integrity verification and auto-retry.
 */
export async function downloadReleaseAsset(
  assetUrl: string,
  fileName: string,
  options?: DownloadUpdateOptions
): Promise<DownloadUpdateResult> {
  const maxRetries = options?.maxRetries ?? 0;
  let lastResult: DownloadUpdateResult = { success: false, error: "Download not started" };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    lastResult = await downloadReleaseAssetOnce(assetUrl, fileName, options);
    if (lastResult.success) {
      return lastResult;
    }
    // If not successful and we have retries left, wait briefly before next attempt
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return lastResult;
}
