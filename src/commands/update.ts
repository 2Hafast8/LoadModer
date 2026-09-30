import path from 'node:path';
import { readdir, rm } from 'node:fs/promises';
import { modrinthClient } from '../api/client.js';
import { instanceConfig } from '../core/instance/config.js';
import { DependencyGraph } from '../core/dependency/graph.js';
import { p, pc, exitIfCancel, showBanner } from '../ui/prompts.js';
import { hashFile } from '../utils/crypto.js';
import { formatBytes } from '../utils/format.js';
import type { VersionType } from '../types/modrinth.js';

interface UpdateOptions {
  dir?: string;
  mcVersion?: string;
  loader?: string;
  prerelease?: boolean;
  yes?: boolean;
  targetFile?: string;
  skipBanner?: boolean;
}

export async function updateCommand(opts: UpdateOptions) {
  if (!opts.skipBanner) {
    showBanner();
  }
  await instanceConfig.load();
  const activeInst = instanceConfig.getActiveInstance();

  const modsDir = opts.dir ?? activeInst?.modsDir;
  if (!modsDir) {
    p.log.error('Folder mods belum ditentukan. Jalankan "loadmoder init" terlebih dahulu.');
    process.exit(1);
  }

  const gameVersion = opts.mcVersion ?? activeInst?.gameVersion;
  const loader = opts.loader ?? activeInst?.loader;

  if (!gameVersion || !loader) {
    p.log.error('Versi Minecraft atau loader belum ditentukan. Gunakan -v dan -l.');
    process.exit(1);
  }

  const s = p.spinner();
  s.start(pc.cyan('Memindai mod lokal dan mencari pembaruan di Modrinth...'));

  const instanceDir = activeInst?.rootDir ?? path.dirname(modsDir);
  const graph = new DependencyGraph(instanceDir);
  await graph.load();
  await graph.reconcileWithDisk(modsDir);

  const entries = await readdir(modsDir);
  const activeJars = entries.filter((f) => f.endsWith('.jar') && (!opts.targetFile || f === opts.targetFile));

  if (activeJars.length === 0) {
    s.stop(pc.yellow('Tidak ada mod aktif (.jar) yang terpasang di folder ini.'));
    return;
  }

  const fileHashes: { filename: string; sha1: string; filePath: string }[] = [];
  for (const jar of activeJars) {
    const filePath = path.join(modsDir, jar);
    const sha1 = await hashFile(filePath, 'sha1');
    fileHashes.push({ filename: jar, sha1, filePath });
  }

  const versionTypes: VersionType[] = opts.prerelease ? ['release', 'beta', 'alpha'] : ['release'];
  const latestMap = await modrinthClient.getLatestByHashes(
    fileHashes.map((f) => f.sha1),
    { gameVersion, loader },
    versionTypes
  );

  const updates: { current: string; currentPath: string; nextVersion: any; nextFile: any }[] = [];

  for (const item of fileHashes) {
    const nextVer = latestMap[item.sha1];
    if (nextVer) {
      const nextFile = nextVer.files.find((f) => f.primary) ?? nextVer.files[0];
      if (nextFile && nextFile.hashes.sha1 !== item.sha1) {
        updates.push({
          current: item.filename,
          currentPath: item.filePath,
          nextVersion: nextVer,
          nextFile,
        });
      }
    }
  }

  s.stop();

  if (updates.length === 0) {
    p.outro(pc.green('Semua mod sudah berada pada versi terbaru yang kompatibel! ✨'));
    return;
  }

  p.log.info(pc.cyan(`Ditemukan ${updates.length} pembaruan:`));
  for (const up of updates) {
    console.log(`  • ${pc.yellow(up.current)} -> ${pc.green(up.nextFile.filename)} (${formatBytes(up.nextFile.size)})`);
  }

  if (!opts.yes) {
    const confirm = await p.confirm({
      message: `Lanjutkan pembaruan ${updates.length} mod ini?`,
      initialValue: true,
    });
    exitIfCancel(confirm);
    if (!confirm) {
      p.cancel('Pembaruan dibatalkan.');
      return;
    }
  }

  for (const up of updates) {
    p.log.step(`Memperbarui ${pc.bold(up.nextFile.filename)}...`);
    const newDest = path.join(modsDir, up.nextFile.filename);

    await modrinthClient.download(up.nextFile.url, newDest, {
      sha512: up.nextFile.hashes.sha512,
      size: up.nextFile.size,
    });

    if (up.currentPath !== newDest) {
      await rm(up.currentPath, { force: true });
      p.log.message(pc.dim(`Versi lama dihapus: ${up.current}`));
    }
  }

  p.outro(pc.green(`Berhasil memperbarui ${updates.length} mod!`));
}
