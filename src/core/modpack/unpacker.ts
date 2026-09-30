import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import unzipper from 'unzipper';
import pLimit from 'p-limit';
import { MrpackIndexSchema, type MrpackFileEntry, type MrpackIndex } from '../../types/mrpack.js';
import type { ModrinthClient } from '../../api/client.js';
import { hashFile } from '../../utils/crypto.js';

export interface ModpackInstallOptions {
  instanceDir: string;
  targetEnv: 'client' | 'server';
  concurrency?: number;
  onProgress?: (completed: number, total: number, currentFile: string) => void;
}

export class ModpackUnpacker {
  constructor(private readonly api: ModrinthClient) {}

  async inspect(mrpackFilePath: string): Promise<MrpackIndex> {
    const zip = await unzipper.Open.file(mrpackFilePath);
    const indexEntry = zip.files.find((f) => f.path === 'modrinth.index.json');
    if (!indexEntry) {
      throw new Error('Berkas tidak valid: "modrinth.index.json" tidak ditemukan di dalam .mrpack');
    }

    const buffer = await indexEntry.buffer();
    const rawJson = JSON.parse(buffer.toString('utf8'));
    return MrpackIndexSchema.parse(rawJson);
  }

  async install(mrpackFilePath: string, opts: ModpackInstallOptions): Promise<MrpackIndex> {
    const index = await this.inspect(mrpackFilePath);
    const zip = await unzipper.Open.file(mrpackFilePath);

    // 1. Ekstraksi Overrides
    for (const entry of zip.files) {
      if (entry.path.startsWith('overrides/')) {
        const relPath = entry.path.replace(/^overrides\//, '');
        if (!relPath) continue;
        await this.extractZipEntry(entry, path.join(opts.instanceDir, relPath));
      } else if (opts.targetEnv === 'client' && entry.path.startsWith('client-overrides/')) {
        const relPath = entry.path.replace(/^client-overrides\//, '');
        if (!relPath) continue;
        await this.extractZipEntry(entry, path.join(opts.instanceDir, relPath));
      } else if (opts.targetEnv === 'server' && entry.path.startsWith('server-overrides/')) {
        const relPath = entry.path.replace(/^server-overrides\//, '');
        if (!relPath) continue;
        await this.extractZipEntry(entry, path.join(opts.instanceDir, relPath));
      }
    }

    // 2. Filter Berkas
    const filesToDownload = index.files.filter((file) => {
      if (opts.targetEnv === 'server' && file.env?.server === 'unsupported') return false;
      if (opts.targetEnv === 'client' && file.env?.client === 'unsupported') return false;
      return true;
    });

    // 3. Unduh Paralel
    const limit = pLimit(opts.concurrency ?? 4);
    let completedCount = 0;

    const downloadTasks = filesToDownload.map((modFile) =>
      limit(async () => {
        await this.downloadModFile(modFile, opts.instanceDir);
        completedCount++;
        opts.onProgress?.(completedCount, filesToDownload.length, modFile.path);
      })
    );

    await Promise.all(downloadTasks);
    return index;
  }

  private async extractZipEntry(entry: unzipper.File, destPath: string): Promise<void> {
    if (entry.type === 'Directory') {
      await mkdir(destPath, { recursive: true });
    } else {
      await mkdir(path.dirname(destPath), { recursive: true });
      await pipeline(entry.stream(), createWriteStream(destPath));
    }
  }

  private async downloadModFile(file: MrpackFileEntry, instanceDir: string): Promise<void> {
    const finalDest = path.join(instanceDir, file.path);
    const tempDest = `${finalDest}.part`;
    await mkdir(path.dirname(finalDest), { recursive: true });

    const downloadUrl = file.downloads[0];
    if (!downloadUrl) throw new Error(`Tidak ada URL unduhan untuk berkas: ${file.path}`);

    const res = await fetch(downloadUrl, {
      headers: { 'User-Agent': this.api.userAgent },
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Gagal mengunduh file ${file.path}: HTTP ${res.status}`);
    }

    try {
      await pipeline(Readable.fromWeb(res.body as any), createWriteStream(tempDest));

      const actualSha512 = await hashFile(tempDest, 'sha512');
      if (actualSha512.toLowerCase() !== file.hashes.sha512.toLowerCase()) {
        throw new Error(`Checksum SHA-512 tidak cocok untuk ${file.path}. File dibatalkan.`);
      }

      await rename(tempDest, finalDest);
    } catch (err) {
      await rm(tempDest, { force: true });
      throw err;
    }
  }
}
