import path from 'node:path';
import { instanceDetector } from '../core/instance/detector.js';
import { instanceConfig } from '../core/instance/config.js';
import { p, pc, exitIfCancel, showBanner } from '../ui/prompts.js';
import { getMinecraftVersionChoices } from '../ui/interactive.js';
import type { LoaderType } from '../types/instance.js';

export async function initCommand() {
  showBanner();
  p.log.info(pc.cyan('Memindai instance launcher Minecraft di komputer Anda...'));

  const s = p.spinner();
  s.start('Mendeteksi Prism, MultiMC, Modrinth App, CurseForge, dan Vanilla...');
  const instances = await instanceDetector.scanAll();
  s.stop(pc.green(`Ditemukan ${instances.length} instance!`));

  let target: {
    id: string;
    name: string;
    launcher: string;
    rootDir: string;
    modsDir: string;
    gameVersion?: string;
    loader?: LoaderType;
  };

  if (instances.length === 0) {
    p.log.warn('Tidak ada instance otomatis yang ditemukan.');
    const customDir = await p.text({
      message: 'Masukkan path folder .minecraft atau instance secara manual:',
      validate: (v) => (!v ? 'Path tidak boleh kosong' : undefined),
    });
    exitIfCancel(customDir);

    const normalizedDir = path.resolve(customDir.trim());
    target = {
      id: 'custom-instance',
      name: 'Custom Instance',
      launcher: 'Custom',
      rootDir: normalizedDir,
      modsDir: path.join(normalizedDir, 'mods'),
    };
  } else {
    const choices = instances.map((inst) => ({
      value: inst.id,
      label: `[${inst.launcher}] ${inst.name}`,
      hint: `${inst.loader ? inst.loader + ' ' : ''}${inst.gameVersion ?? ''} (${inst.rootDir})`,
    }));

    const selectedId = await p.select({
      message: 'Pilih instance Minecraft target yang ingin dikelola:',
      options: choices,
    });
    exitIfCancel(selectedId);

    target = instances.find((i) => i.id === selectedId)!;
  }

  let gameVersion = target.gameVersion;
  let loader = target.loader;

  if (!gameVersion) {
    const vChoices = await getMinecraftVersionChoices();
    const selectOptions: Array<{ value: string; label: string; hint?: string }> = vChoices.map((c) => ({
      value: c.value,
      label: c.name,
      hint: c.hint,
    }));
    selectOptions.push({
      value: '__custom__',
      label: '✏️   Ketik Versi Minecraft Lainnya...',
      hint: 'Masukkan versi manual',
    });

    const selectedVer = await p.select({
      message: 'Versi Minecraft belum terdeteksi. Pilih versi game target:',
      options: selectOptions,
    });
    exitIfCancel(selectedVer);

    if (selectedVer === '__custom__') {
      const inputVersion = await p.text({
        message: 'Masukkan versi Minecraft game target:',
        placeholder: 'misal: 1.20.6 atau 26.2',
        validate: (v) => (!v ? 'Versi tidak boleh kosong' : undefined),
      });
      exitIfCancel(inputVersion);
      gameVersion = inputVersion.trim();
    } else {
      gameVersion = selectedVer as string;
    }
  }

  if (!loader) {
    const inputLoader = await p.select({
      message: 'Mod loader belum terdeteksi. Pilih mod loader yang Anda gunakan:',
      options: [
        { value: 'fabric', label: 'Fabric (Direkomendasikan)' },
        { value: 'neoforge', label: 'NeoForge' },
        { value: 'forge', label: 'Forge' },
        { value: 'quilt', label: 'Quilt' },
      ],
    });
    exitIfCancel(inputLoader);
    loader = inputLoader as LoaderType;
  }

  await instanceConfig.load();
  instanceConfig.saveInstance(target.id, {
    name: target.name,
    launcher: target.launcher,
    rootDir: target.rootDir,
    modsDir: target.modsDir,
    gameVersion,
    loader,
  });
  await instanceConfig.save();

  p.note(
    `Instance Terpilih : ${pc.bold(target.name)} (${target.launcher})\n` +
      `Folder Mods       : ${pc.dim(target.modsDir)}\n` +
      `Minecraft         : ${pc.green(gameVersion ?? '-')}\n` +
      `Mod Loader        : ${pc.cyan(loader ?? '-')}`,
    'Inisialisasi Berhasil'
  );

  p.outro(pc.green('LoadModer siap digunakan! Ketik "lm" untuk membuka menu interaktif.'));
}
