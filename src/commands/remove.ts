import path from 'node:path';
import { readdir, rm } from 'node:fs/promises';
import { instanceConfig } from '../core/instance/config.js';
import { DependencyGraph } from '../core/dependency/graph.js';
import { p, pc, exitIfCancel, showBanner } from '../ui/prompts.js';

interface RemoveOptions {
  dir?: string;
  prune?: boolean;
  yes?: boolean;
  skipBanner?: boolean;
}

export async function removeCommand(targets: string[], opts: RemoveOptions) {
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

  const instanceDir = activeInst?.rootDir ?? path.dirname(modsDir);
  const graph = new DependencyGraph(instanceDir);
  await graph.load();

  const filesInFolder = await readdir(modsDir);

  for (const target of targets) {
    p.log.step(`Mencari mod "${target}"...`);
    const q = target.toLowerCase();

    const matchedFiles = filesInFolder.filter(
      (f) => f.toLowerCase().includes(q) && (f.endsWith('.jar') || f.endsWith('.jar.disabled'))
    );

    if (matchedFiles.length === 0) {
      p.log.warn(`Tidak ditemukan file yang cocok dengan "${target}".`);
      continue;
    }

    for (const match of matchedFiles) {
      if (!opts.yes) {
        const confirm = await p.confirm({
          message: `Hapus file "${match}" dari folder mods?`,
          initialValue: true,
        });
        exitIfCancel(confirm);
        if (!confirm) continue;
      }

      await rm(path.join(modsDir, match), { force: true });
      p.log.success(pc.green(`Berkas dihapus: ${match}`));

      const matchClean = match.replace(/\.disabled$/, '');
      const lockEntry = Object.entries(graph.data.mods).find(
        ([slug, m]) =>
          m.filename === match ||
          m.filename === matchClean ||
          slug.toLowerCase() === target.toLowerCase()
      );
      const targetSlug = lockEntry ? lockEntry[0] : target;

      const { orphanedSlugs } = graph.removeMod(targetSlug);

      if (orphanedSlugs.length > 0) {
        p.log.warn(
          `Dependensi yatim terdeteksi (tidak lagi digunakan): ${pc.yellow(orphanedSlugs.join(', '))}`
        );

        let doPrune = opts.prune || opts.yes;
        if (!doPrune) {
          const pruneConfirm = await p.confirm({
            message: `Hapus ${orphanedSlugs.length} dependensi yatim ini agar folder mods tetap bersih?`,
            initialValue: true,
          });
          exitIfCancel(pruneConfirm);
          doPrune = pruneConfirm;
        }

        if (doPrune) {
          const freshFiles = await readdir(modsDir).catch(() => filesInFolder);
          for (const orphan of orphanedSlugs) {
            const orphanEntry = graph.getMod(orphan);
            const orphanFilename = orphanEntry?.filename;
            const orphanFiles = freshFiles.filter(
              (f) =>
                (orphanFilename && (f === orphanFilename || f === `${orphanFilename}.disabled`)) ||
                (f.toLowerCase().includes(orphan) && (f.endsWith('.jar') || f.endsWith('.disabled')))
            );
            for (const ofile of orphanFiles) {
              await rm(path.join(modsDir, ofile), { force: true });
              p.log.message(pc.dim(`Dependensi yatim dihapus: ${ofile}`));
            }
            graph.removeMod(orphan);
          }
        }
      }
    }
  }

  await graph.save();
  p.outro(pc.green('Operasi penghapusan selesai!'));
}
