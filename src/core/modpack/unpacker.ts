import path from 'node:path';
import { createHash } from 'node:crypto';
import { createWriteStream, createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import unzipper from 'unzipper';
import pLimit from 'p-limit';
import { MrpackIndexSchema, type MrpackFileEntry, type MrpackIndex } from '../../types/mrpack.js';
import type { ModrinthClient } from '../../api/client.js';

export interface ModpackInstallOptions {
  instanceDir: string;
  targetEnv?: 'client' | 'server';
  concurrency?: number;
  modsOnly?: boolean;
  onProgress?: (completed: number, total: number, currentFile: string, isCached?: boolean) => void;
}

export interface ModpackInstallResult {
  index: MrpackIndex;
  installedFiles: string[];
  failedFiles?: string[];
}

export class ModpackUnpacker {
  constructor(private readonly api: ModrinthClient) {}

  async inspect(mrpackFilePath: string, existingZip?: any): Promise<MrpackIndex> {
    const zip = existingZip ?? (await unzipper.Open.file(mrpackFilePath));
    const indexEntry = zip.files.find((f: any) => f.path === 'modrinth.index.json');
    if (!indexEntry) {
      throw new Error('Berkas tidak valid: "modrinth.index.json" tidak ditemukan di dalam .mrpack');
    }

    const buffer = await indexEntry.buffer();
    const rawJson = JSON.parse(buffer.toString('utf8'));
    return MrpackIndexSchema.parse(rawJson);
  }

  async getPotentialOverwrites(
    mrpackFilePath: string,
    opts: { instanceDir: string; targetEnv?: 'client' | 'server'; modsOnly?: boolean },
  ): Promise<string[]> {
    const zip = await unzipper.Open.file(mrpackFilePath);
    const index = await this.inspect(mrpackFilePath, zip);
    const overwrites: string[] = [];
    const targetEnv = opts.targetEnv ?? 'client';

    if (!opts.modsOnly) {
      for (const entry of zip.files) {
        let relPath: string | null = null;
        if (entry.path.startsWith('overrides/')) {
          relPath = entry.path.replace(/^overrides\//, '');
        } else if (targetEnv === 'client' && entry.path.startsWith('client-overrides/')) {
          relPath = entry.path.replace(/^client-overrides\//, '');
        } else if (targetEnv === 'server' && entry.path.startsWith('server-overrides/')) {
          relPath = entry.path.replace(/^server-overrides\//, '');
        }
        if (relPath && entry.type !== 'Directory') {
          overwrites.push(relPath);
        }
      }
    }

    for (const file of index.files) {
      if (opts.modsOnly && !file.path.startsWith('mods/') && !file.path.endsWith('.jar')) continue;
      overwrites.push(file.path);
    }

    return overwrites;
  }

  async install(mrpackFilePath: string, opts: ModpackInstallOptions): Promise<ModpackInstallResult> {
    const zip = await unzipper.Open.file(mrpackFilePath);
    const index = await this.inspect(mrpackFilePath, zip);

    const rootResolved = path.resolve(opts.instanceDir);
    const installedFiles: string[] = [];
    const targetEnv = opts.targetEnv ?? 'client';

    if (!opts.modsOnly) {
      for (const entry of zip.files) {
        let relPath: string | null = null;
        if (entry.path.startsWith('overrides/')) {
          relPath = entry.path.replace(/^overrides\//, '');
        } else if (targetEnv === 'client' && entry.path.startsWith('client-overrides/')) {
          relPath = entry.path.replace(/^client-overrides\//, '');
        } else if (targetEnv === 'server' && entry.path.startsWith('server-overrides/')) {
          relPath = entry.path.replace(/^server-overrides\//, '');
        }

        if (!relPath) continue;

        const safeDest = path.resolve(opts.instanceDir, relPath);
        if (!safeDest.startsWith(rootResolved + path.sep) && safeDest !== rootResolved) {
          throw new Error(`Path traversal terdeteksi dalam arsip .mrpack: ${entry.path}`);
        }

        try {
          await this.extractZipEntry(entry, safeDest);
          if (
            entry.type !== 'Directory' &&
            !entry.path.endsWith('/') &&
            !entry.path.endsWith('\\')
          ) {
            installedFiles.push(relPath);
          }
        } catch (extractErr: any) {
          const isAsset =
            relPath.startsWith('mods/') ||
            relPath.startsWith('shaderpacks/') ||
            relPath.startsWith('resourcepacks/');

          if (isAsset) {
            try {
              await this.recoverAssetFromModrinth(relPath, safeDest);
              installedFiles.push(relPath);
              continue;
            } catch {}
          }
        }
      }
    }

    const filesToDownload = index.files.filter((file) => {
      if (targetEnv === 'server' && file.env?.server === 'unsupported') return false;
      if (targetEnv === 'client' && file.env?.client === 'unsupported') return false;
      if (opts.modsOnly && !file.path.startsWith('mods/') && !file.path.endsWith('.jar')) return false;
      return true;
    });

    const limit = pLimit(opts.concurrency ?? 3);
    let completedCount = 0;
    const failedFiles: MrpackFileEntry[] = [];

    // FASE 1: Unduh paralel dengan Smart Resume (skip berkas yang sudah ada di disk)
    const phase1Tasks = filesToDownload.map((modFile) =>
      limit(async () => {
        const fullDest = path.resolve(opts.instanceDir, modFile.path);
        const wasExisting = await this.isExistingFileValid(
          fullDest,
          modFile.hashes.sha512,
          modFile.fileSize,
        );

        if (wasExisting) {
          installedFiles.push(modFile.path);
          completedCount++;
          opts.onProgress?.(completedCount, filesToDownload.length, modFile.path, true);
          return;
        }

        try {
          await this.downloadModFile(modFile, opts.instanceDir, 2);
          installedFiles.push(modFile.path);
          completedCount++;
          opts.onProgress?.(completedCount, filesToDownload.length, modFile.path, false);
        } catch {
          failedFiles.push(modFile);
        }
      }),
    );

    await Promise.all(phase1Tasks);

    // FASE 2: Pemulihan Khusus untuk Berkas yang Gagal (Sequential 1 per 1 tanpa rebutan bandwidth)
    if (failedFiles.length > 0) {
      const stillFailed: string[] = [];
      for (const failedFile of failedFiles) {
        opts.onProgress?.(completedCount, filesToDownload.length, failedFile.path, false);
        try {
          await this.downloadModFile(failedFile, opts.instanceDir, 3);
          installedFiles.push(failedFile.path);
          completedCount++;
          opts.onProgress?.(completedCount, filesToDownload.length, failedFile.path, false);
        } catch {
          stillFailed.push(failedFile.path);
        }
      }

      if (stillFailed.length > 0 && installedFiles.length === 0) {
        throw new Error('Gagal mengunduh seluruh berkas modpack. Periksa koneksi internet Anda.');
      }

      return {index, installedFiles, failedFiles: stillFailed};
    }

    return {index, installedFiles, failedFiles: []};
  }

  private async isExistingFileValid(
    filePath: string,
    expectedSha512: string,
    expectedSize?: number,
  ): Promise<boolean> {
    try {
      const s = await stat(filePath);
      if (!s.isFile()) return false;
      if (expectedSize !== undefined && s.size !== expectedSize) return false;

      const hasher = createHash('sha512');
      const stream = createReadStream(filePath);
      for await (const chunk of stream) {
        hasher.update(chunk);
      }
      return hasher.digest('hex').toLowerCase() === expectedSha512.toLowerCase();
    } catch {
      return false;
    }
  }

  private async extractZipEntry(entry: unzipper.File, destPath: string): Promise<void> {
    const isDir =
      entry.type === 'Directory' ||
      entry.path.endsWith('/') ||
      entry.path.endsWith('\\');

    if (isDir) {
      await mkdir(destPath, { recursive: true });
      return;
    }

    await mkdir(path.dirname(destPath), { recursive: true });
    try {
      await pipeline(entry.stream(), createWriteStream(destPath));
    } catch (err: any) {
      if (err.code !== 'EISDIR') {
        throw err;
      }
    }
  }

  private async recoverAssetFromModrinth(relPath: string, destPath: string): Promise<void> {
    const filename = path.basename(relPath);
    const slugCandidate = filename.replace(/\.(jar|zip)$/i, '').replace(/[-_.]v?\d.*$/i, '').trim();
    if (!slugCandidate) return;

    try {
      const searchRes = await this.api.search(slugCandidate, {}, 3);
      if (searchRes.hits.length > 0) {
        const hit = searchRes.hits[0];
        const versions = await this.api.getProjectVersions(hit.project_id);
        if (versions.length > 0) {
          const fileToDownload = versions[0].files.find((f) => f.primary) ?? versions[0].files[0];
          if (fileToDownload?.url) {
            await this.api.download(fileToDownload.url, destPath);
          }
        }
      }
    } catch {}
  }

  private async downloadModFile(
    file: MrpackFileEntry,
    instanceDir: string,
    maxRetries = 3,
  ): Promise<void> {
    const rootResolved = path.resolve(instanceDir);
    const finalDest = path.resolve(instanceDir, file.path);
    if (!finalDest.startsWith(rootResolved + path.sep) && finalDest !== rootResolved) {
      throw new Error(`Path traversal terdeteksi pada berkas modpack: ${file.path}`);
    }

    // Cek apakah berkas sudah valid di disk (Smart Resume)
    const alreadyValid = await this.isExistingFileValid(
      finalDest,
      file.hashes.sha512,
      file.fileSize,
    );
    if (alreadyValid) {
      return;
    }

    const tempDest = `${finalDest}.part`;
    await mkdir(path.dirname(finalDest), { recursive: true });

    let lastError: Error | null = null;
    const urlsToTry: string[] = [...file.downloads];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      for (const downloadUrl of urlsToTry) {
        const controller = new AbortController();
        let streamTimer: NodeJS.Timeout | null = null;
        const resetWatchdog = (ms = 40000) => {
          if (streamTimer) clearTimeout(streamTimer);
          streamTimer = setTimeout(() => {
            controller.abort(new Error("Unduhan terhenti: tidak ada aliran data selama 40 detik."));
          }, ms);
        };

        try {
          resetWatchdog(30000);
          const attemptRes = await fetch(downloadUrl, {
            headers: { 'User-Agent': this.api.userAgent },
            signal: controller.signal,
          });

          if (attemptRes.ok && attemptRes.body) {
            resetWatchdog(40000);
            const hasher = createHash('sha512');
            const hashStream = new Transform({
              transform(chunk: Buffer, _enc, cb) {
                resetWatchdog(40000);
                hasher.update(chunk);
                cb(null, chunk);
              },
            });

            await pipeline(
              Readable.fromWeb(attemptRes.body as any),
              hashStream,
              createWriteStream(tempDest),
            );
            if (streamTimer) clearTimeout(streamTimer);

            const actualSha512 = hasher.digest('hex');
            if (actualSha512.toLowerCase() !== file.hashes.sha512.toLowerCase()) {
              try {
                await rm(tempDest, { force: true });
              } catch {}
              throw new Error(`Checksum SHA-512 tidak cocok untuk ${file.path}`);
            }

            await rename(tempDest, finalDest);
            return;
          }
        } catch (err: any) {
          if (streamTimer) clearTimeout(streamTimer);
          lastError = err;
          try {
            await rm(tempDest, { force: true });
          } catch {}
        }
      }

      // Jika mirror bawaan gagal, cari link segar via Modrinth API hash lookup
      if (attempt === 1) {
        try {
          const directVersion =
            (await this.api.getVersionFileByHash(file.hashes.sha512, 'sha512')) ??
            (file.hashes.sha1 ? await this.api.getVersionFileByHash(file.hashes.sha1, 'sha1') : null);

          if (directVersion && directVersion.files) {
            const matchedFile =
              directVersion.files.find(
                (f) => f.hashes.sha512?.toLowerCase() === file.hashes.sha512.toLowerCase(),
              ) ??
              directVersion.files.find(
                (f) => f.hashes.sha1?.toLowerCase() === file.hashes.sha1?.toLowerCase(),
              ) ??
              directVersion.files[0];

            if (matchedFile?.url && !urlsToTry.includes(matchedFile.url)) {
              urlsToTry.unshift(matchedFile.url);
            }
          }
        } catch (fallbackErr: any) {
          lastError = fallbackErr;
        }
      }

      // Backoff delay sebelum mencoba lagi
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 1500));
      }
    }

    throw new Error(
      `Gagal mengunduh berkas ${file.path} setelah ${maxRetries} percobaan: ${lastError?.message ?? 'Koneksi timeout / mirror tidak dapat diakses'}`,
    );
  }
}
