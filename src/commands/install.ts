import path from 'node:path';
import { readdir, rm } from 'node:fs/promises';
import { modrinthClient } from '../api/client.js';
import { instanceConfig } from '../core/instance/config.js';
import { ModpackUnpacker } from '../core/modpack/unpacker.js';
import { DependencyGraph } from '../core/dependency/graph.js';
import { resolveAndInstallDependencies } from '../core/dependency/resolver.js';
import { p, pc, showBanner } from '../ui/prompts.js';
import { formatBytes } from '../utils/format.js';
import type { ModVersion } from '../types/modrinth.js';

interface InstallOptions {
  type?: string;
  mcVersion?: string;
  loader?: string;
  versionId?: string;
  dir?: string;
  env?: 'client' | 'server';
  dryRun?: boolean;
  yes?: boolean;
  noDeps?: boolean;
  skipBanner?: boolean;
}

export async function installCommand(targets: string[], opts: InstallOptions) {
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
        if (!bestVer) continue;
        const packFile = bestVer.files.find((f) => f.filename.endsWith('.mrpack')) ?? bestVer.files[0];
        if (!packFile) {
          p.log.error(`Tidak ada berkas .mrpack yang ditemukan untuk "${target}".`);
          continue;
        }
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
    let best: ModVersion | undefined;
    if (opts.versionId) {
      try {
        best = await modrinthClient.getVersion(opts.versionId);
      } catch {}
    }

    if (!best) {
      const versions = await modrinthClient.getProjectVersions(slug, { gameVersion, loader });
      if (versions.length === 0) {
        p.log.error(`Tidak ada versi yang cocok untuk "${slug}" di Minecraft ${gameVersion ?? ''} / ${loader ?? ''}`);
        continue;
      }
      best = versions.find((v) => v.version_type === 'release') ?? versions[0];
    }

    if (!best) {
      p.log.error(`Tidak dapat menemukan versi yang valid untuk mod "${slug}".`);
      continue;
    }

    const file = best.files.find((f) => f.primary) ?? best.files[0];
    if (!file) {
      p.log.error(`Tidak ada file unduhan untuk mod "${slug}".`);
      continue;
    }

    let projectMeta: any;
    try {
      projectMeta = await modrinthClient.getProject(best.project_id || slug);
    } catch {}

    const projectType = opts.type || projectMeta?.project_type || 'mod';
    let destDir = modsDir;
    if (projectType === 'shader') {
      destDir = path.join(instanceDir, 'shaderpacks');
    } else if (projectType === 'resourcepack') {
      destDir = path.join(instanceDir, 'resourcepacks');
    }

    if (opts.dryRun) {
      p.log.info(`[dry-run] Akan memasang ${projectType}: ${file.filename} (${formatBytes(file.size)}) ke ${destDir}`);
      continue;
    }

    p.log.info(`⬇️  Mengunduh ${projectType} ${pc.cyan(file.filename)} (${formatBytes(file.size)})...`);
    const dest = path.join(destDir, file.filename);

    await modrinthClient.download(file.url, dest, {
      sha512: file.hashes.sha512,
      size: file.size,
    });

    // Hapus versi lama dari aset yang sama agar tidak duplikat
    try {
      const existingFiles = await readdir(destDir);
      for (const ex of existingFiles) {
        if (
          ex !== file.filename &&
          ex.toLowerCase().startsWith(slug.toLowerCase()) &&
          (ex.endsWith('.jar') || ex.endsWith('.zip'))
        ) {
          await rm(path.join(destDir, ex), { force: true });
          p.log.message(pc.dim(`Versi lama dihapus: ${ex}`));
        }
      }
    } catch {}

    const reqDeps = (best.dependencies || [])
      .filter((d): d is typeof d & { project_id: string } => d.dependency_type === 'required' && Boolean(d.project_id))
      .map((d) => d.project_id);

    graph.registerMod(slug, {
      projectId: best.project_id,
      versionId: best.id,
      versionNumber: best.version_number,
      filename: file.filename,
      sha512: file.hashes.sha512,
      isRoot: true,
      dependencies: reqDeps,
    });

    // Pasang dependensi mod library otomatis hanya untuk mod
    if (!opts.noDeps && projectType === 'mod') {
      const depResult = await resolveAndInstallDependencies({
        mainModSlug: slug,
        mainVersion: best,
        project: projectMeta,
        modsDir,
        gameVersion: gameVersion ?? '1.21.1',
        loader: loader ?? 'fabric',
        graph,
        dryRun: opts.dryRun,
      });

      if (depResult.installed.length > 0) {
        p.log.success(
          pc.green(
            `✔ Berhasil memasang ${depResult.installed.length} library tambahan yang sesuai untuk ${loader?.toUpperCase() ?? 'FABRIC'} ${gameVersion ?? '1.21.1'}!`
          )
        );
      }
    }

    await graph.save();
    p.log.success(pc.green(`Berhasil dipasang: ${file.filename}`));
  }

  p.outro(pc.green('Semua aset selesai diproses! Selamat bermain 🎮'));
}
