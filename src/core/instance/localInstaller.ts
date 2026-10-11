import path from 'node:path';
import { copyFile, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import unzipper from 'unzipper';
import { ModpackUnpacker } from '../modpack/unpacker.js';
import { modrinthClient } from '../../api/client.js';

export interface InstalledLocalResult {
  file: string;
  fileName: string;
  type: 'mod' | 'mrpack' | 'shader' | 'resourcepack' | 'unknown';
  success: boolean;
  error?: string;
}

export async function installLocalFiles(
  filePaths: string[],
  instanceDir: string,
  modsDir: string,
  unpackerInstance?: ModpackUnpacker
): Promise<InstalledLocalResult[]> {
  const results: InstalledLocalResult[] = [];
  const unpacker = unpackerInstance ?? new ModpackUnpacker(modrinthClient);

  for (const filePath of filePaths) {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    try {
      if (ext === '.jar') {
        await mkdir(modsDir, { recursive: true });
        const destPath = path.join(modsDir, fileName);
        await copyFile(filePath, destPath);
        results.push({ file: filePath, fileName, type: 'mod', success: true });
      } else if (ext === '.mrpack') {
        await unpacker.install(filePath, {
          instanceDir,
          targetEnv: 'client',
        });
        results.push({ file: filePath, fileName, type: 'mrpack', success: true });
      } else if (ext === '.zip') {
        let zipHasShaders = false;
        let zipHasMcmeta = false;
        let zipHasModrinthIndex = false;
        const zipJarEntries: any[] = [];

        try {
          const zip = await unzipper.Open.file(filePath);
          for (const entry of zip.files) {
            const entryPath = entry.path.toLowerCase();
            if (entryPath === 'modrinth.index.json') {
              zipHasModrinthIndex = true;
              break;
            }
            if (entryPath.startsWith('shaders/') || entryPath.includes('/shaders/')) {
              zipHasShaders = true;
            }
            if (entryPath === 'pack.mcmeta' || entryPath.endsWith('/pack.mcmeta')) {
              zipHasMcmeta = true;
            }
            if (entryPath.endsWith('.jar') && !entryPath.startsWith('meta-inf/')) {
              zipJarEntries.push(entry);
            }
          }
        } catch {}

        if (zipHasModrinthIndex) {
          await unpacker.install(filePath, {
            instanceDir,
            targetEnv: 'client',
          });
          results.push({ file: filePath, fileName, type: 'mrpack', success: true });
        } else if (zipHasShaders) {
          const shadersDir = path.join(instanceDir, 'shaderpacks');
          await mkdir(shadersDir, { recursive: true });
          await copyFile(filePath, path.join(shadersDir, fileName));
          results.push({ file: filePath, fileName, type: 'shader', success: true });
        } else if (zipJarEntries.length > 0 && !zipHasMcmeta) {
          await mkdir(modsDir, { recursive: true });
          for (const jarEntry of zipJarEntries) {
            const jarName = path.basename(jarEntry.path);
            const outStream = createWriteStream(path.join(modsDir, jarName));
            await pipeline(jarEntry.stream(), outStream);
          }
          results.push({ file: filePath, fileName, type: 'mod', success: true });
        } else {
          const rpDir = path.join(instanceDir, 'resourcepacks');
          await mkdir(rpDir, { recursive: true });
          await copyFile(filePath, path.join(rpDir, fileName));
          results.push({ file: filePath, fileName, type: 'resourcepack', success: true });
        }
      } else {
        results.push({
          file: filePath,
          fileName,
          type: 'unknown',
          success: false,
          error: 'Format berkas tidak didukung (harus .jar, .mrpack, atau .zip)',
        });
      }
    } catch (err: any) {
      results.push({
        file: filePath,
        fileName,
        type: 'unknown',
        success: false,
        error: err.message,
      });
    }
  }

  return results;
}
