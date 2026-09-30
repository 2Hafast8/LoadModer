import path from 'node:path';
import { readdir, rm } from 'node:fs/promises';
import { modrinthClient } from '../api/client.js';
import { instanceConfig } from '../core/instance/config.js';
import { ModpackUnpacker } from '../core/modpack/unpacker.js';
import { DependencyGraph } from '../core/dependency/graph.js';
import { p, pc, showBanner } from '../ui/prompts.js';
import { formatBytes } from '../utils/format.js';

interface InstallOptions {
  type?: string;
  mcVersion?: string;
  loader?: string;
  dir?: string;
  env?: 'client' | 'server';
  dryRun?: boolean;
  yes?: boolean;
  noDeps?: boolean;
}

export async function installCommand(targets: string[], opts: InstallOptions) {
  showBanner();
  await instanceConfig.load();
  const activeInst = instanceConfig.getActiveInstance();

  const modsDir = opts.dir ?? activeInst?.modsDir;
  if (!modsDir) {
    p.log.error('Folder mods belum ditentukan. Jalankan "loadmoder init" terlebih dahulu.');
    process.exit(1);
  }

  const gameVersion = opts.mcVersion ?? activeInst?.gameVersion;
  const loader = opts.loader ?? activeInst?.loader;
  const targetEnv = opts.env ?? 'client';

  p.log.info(
    `Instance: ${pc.bold(activeInst?.name ?? 'Kustom')} | MC: ${pc.cyan(gameVersion ?? 'Auto')} | Loader: ${pc.cyan(loader ?? 'Auto')} | Env: ${pc.cyan(targetEnv)}`
  );

  const instanceDir = activeInst?.rootDir ?? path.dirname(modsDir);
  const graph = new DependencyGraph(instanceDir, gameVersion ?? '', loader ?? '');
  await graph.load();

  for (const target of targets) {
    // 1. Cek apakah target adalah file modpack .mrpack
    if (target.endsWith('.mrpack') || opts.type === 'modpack') {
      p.log.step(pc.magenta(`Memproses modpack: ${target}`));
      const unpacker = new ModpackUnpacker(modrinthClient);

      let mrpackFile = target;
      if (!target.endsWith('.mrpack')) {
        const s = p.spinner();
        s.start(`Mencari modpack "${target}" di Modrinth...`);
        const versions = await modrinthClient.getProjectVersions(target, { gameVersion, loader });
        s.stop();
        if (versions.length === 0) {
          p.log.error(`Modpack "${target}" tidak ditemukan untuk MC ${gameVersion}/${loader}.`);
          continue;
        }
        const bestVer = versions[0];
        const packFile = bestVer.files.find((f) => f.filename.endsWith('.mrpack')) ?? bestVer.files[0];
        mrpackFile = path.join(instanceDir, packFile.filename);

        p.log.info(`Mengunduh berkas modpack ${packFile.filename}...`);
        await modrinthClient.download(packFile.url, mrpackFile, { sha512: packFile.hashes.sha512 });
      }

      const s = p.spinner();
      s.start('Mengekstrak dan mengunduh seluruh berkas modpack...');
      const index = await unpacker.install(mrpackFile, {
        instanceDir,
        targetEnv,
        onProgress: (done, total, file) => {
          s.message(`Mengunduh [${done}/${total}] ${path.basename(file)}...`);
        },
      });
      s.stop(pc.green(`Modpack "${index.name}" (${index.versionId}) berhasil dipasang!`));
      continue;
    }

    // 2. Mod Biasa
    let slug = target;
    if (slug.includes('modrinth.com/mod/')) {
      slug = slug.split('modrinth.com/mod/')[1].split('/')[0];
    }

    p.log.step(`Mencari mod: ${pc.bold(slug)}...`);
    const versions = await modrinthClient.getProjectVersions(slug, { gameVersion, loader });
    if (versions.length === 0) {
      p.log.error(`Tidak ada versi yang cocok untuk "${slug}" di Minecraft ${gameVersion ?? ''} / ${loader ?? ''}`);
      continue;
    }

    const best = versions.find((v) => v.version_type === 'release') ?? versions[0];
    const file = best.files.find((f) => f.primary) ?? best.files[0];
    if (!file) {
      p.log.error(`Tidak ada file unduhan untuk mod "${slug}".`);
      continue;
    }

    if (opts.dryRun) {
      p.log.info(`[dry-run] Akan memasang: ${file.filename} (${formatBytes(file.size)})`);
      continue;
    }

    p.log.info(`⬇️  Mengunduh ${pc.cyan(file.filename)} (${formatBytes(file.size)})...`);
    const dest = path.join(modsDir, file.filename);

    await modrinthClient.download(file.url, dest, {
      sha512: file.hashes.sha512,
      size: file.size,
    });

    // Hapus versi lama dari mod yang sama agar tidak duplikat
    try {
      const existingFiles = await readdir(modsDir);
      for (const ex of existingFiles) {
        if (ex !== file.filename && ex.toLowerCase().startsWith(slug.toLowerCase()) && ex.endsWith('.jar')) {
          await rm(path.join(modsDir, ex), { force: true });
          p.log.message(pc.dim(`Versi lama dihapus: ${ex}`));
        }
      }
    } catch {}

    graph.registerMod(slug, {
      projectId: best.project_id,
      versionId: best.id,
      versionNumber: best.version_number,
      filename: file.filename,
      sha512: file.hashes.sha512,
      isRoot: true,
      dependencies: best.dependencies
        .filter((d) => d.dependency_type === 'required' && d.project_id)
        .map((d) => d.project_id!),
    });

    // Pasang dependensi wajib
    if (!opts.noDeps && best.dependencies.length > 0) {
      for (const dep of best.dependencies) {
        if (dep.dependency_type === 'required' && dep.project_id) {
          try {
            const depProj = await modrinthClient.getProject(dep.project_id);
            const depVersions = await modrinthClient.getProjectVersions(depProj.slug, { gameVersion, loader });
            const depBest = depVersions.find((v) => v.version_type === 'release') ?? depVersions[0];
            const depFile = depBest?.files.find((f) => f.primary) ?? depBest?.files[0];

            if (depFile) {
              const depDest = path.join(modsDir, depFile.filename);
              p.log.info(`⬇️  Mengunduh dependensi wajib: ${pc.cyan(depFile.filename)}`);
              await modrinthClient.download(depFile.url, depDest, {
                sha512: depFile.hashes.sha512,
                size: depFile.size,
              });

              graph.registerMod(depProj.slug, {
                projectId: depBest.project_id,
                versionId: depBest.id,
                versionNumber: depBest.version_number,
                filename: depFile.filename,
                sha512: depFile.hashes.sha512,
                isRoot: false,
                dependencies: [],
              });
            }
          } catch (depErr) {
            p.log.warn(`Gagal memproses dependensi ${dep.project_id}: ${(depErr as Error).message}`);
          }
        }
      }
    }

    await graph.save();
    p.log.success(pc.green(`Berhasil dipasang: ${file.filename}`));
  }

  p.outro(pc.green('Semua aset selesai diproses! Selamat bermain 🎮'));
}
