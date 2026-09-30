import { instanceDetector } from '../core/instance/detector.js';
import { instanceConfig } from '../core/instance/config.js';
import { p, pc, exitIfCancel, showBanner } from '../ui/prompts.js';

export async function initCommand() {
  showBanner();
  p.log.info(pc.cyan('Memindai instance launcher Minecraft di komputer Anda...'));

  const s = p.spinner();
  s.start('Mendeteksi Prism, MultiMC, Modrinth App, CurseForge, dan Vanilla...');
  const instances = await instanceDetector.scanAll();
  s.stop(pc.green(`Ditemukan ${instances.length} instance!`));

  if (instances.length === 0) {
    p.log.warn('Tidak ada instance otomatis yang ditemukan.');
    const customDir = await p.text({
      message: 'Masukkan path folder .minecraft atau instance secara manual:',
      validate: (v) => (!v ? 'Path tidak boleh kosong' : undefined),
    });
    exitIfCancel(customDir);

    await instanceConfig.load();
    instanceConfig.saveInstance('custom-instance', {
      name: 'Custom Instance',
      launcher: 'Custom',
      rootDir: customDir,
      modsDir: `${customDir}/mods`,
    });
    await instanceConfig.save();
    p.outro(pc.green('Instance kustom berhasil disimpan sebagai default!'));
    return;
  }

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

  const target = instances.find((i) => i.id === selectedId)!;

  let gameVersion = target.gameVersion;
  let loader = target.loader;

  if (!gameVersion) {
    const inputVersion = await p.text({
      message: 'Versi Minecraft belum terdeteksi. Masukkan versi game target:',
      placeholder: 'misal: 1.21.1 atau 26.2',
      validate: (v) => (!v ? 'Versi tidak boleh kosong' : undefined),
    });
    exitIfCancel(inputVersion);
    gameVersion = inputVersion.trim();
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
    loader = inputLoader as any;
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
