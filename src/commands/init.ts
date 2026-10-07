import path from 'node:path';
import {
  instanceDetector,
  deduplicateInstances,
  detectLauncherFromPath,
} from '../core/instance/detector.js';
import {
  instanceIdFromPath,
  resolveManualMinecraftPath,
} from '../core/instance/driveScanner.js';
import { instanceConfig } from '../core/instance/config.js';
import { p, pc, exitIfCancel, showBanner, clearScreen } from '../ui/prompts.js';
import { getMinecraftVersionChoices } from '../ui/interactive.js';
import type { LoaderType, MinecraftInstance } from '../types/instance.js';

export interface InitOptions {
  scan?: boolean;
  path?: string;
  skipBanner?: boolean;
  allowCancel?: boolean;
}

const SCAN_OPTION = '__scan_drives__';
const MANUAL_OPTION = '__manual_path__';
const PROGRESS_THROTTLE_MS = 120;

function shortenPath(dir: string, max = 56): string {
  return dir.length <= max ? dir : `…${dir.slice(dir.length - max + 1)}`;
}

async function runDriveScan(
  known: MinecraftInstance[],
  includeSystemDrive: boolean
): Promise<MinecraftInstance[]> {
  const s = p.spinner();
  s.start('Mendeteksi drive lokal...');
  let lastUpdate = 0;

  const excludePaths = known.flatMap((i) => [
    i.rootDir,
    path.join(i.rootDir, '.minecraft'),
    path.join(i.rootDir, 'minecraft'),
    i.modsDir,
    path.dirname(i.modsDir),
  ]);

  const { instances, drives, result } = await instanceDetector.scanOtherDrives({
    includeSystemDrive,
    exclude: excludePaths,
    onProgress: (dir, visited) => {
      const now = Date.now();
      if (now - lastUpdate < PROGRESS_THROTTLE_MS) return;
      lastUpdate = now;
      s.message(`Memindai ${shortenPath(dir)} (${visited} folder)`);
    },
  });

  if (drives.length === 0) {
    s.stop(pc.yellow('Tidak ada drive lain yang terdeteksi.'));
    return [];
  }

  const driveList = drives.map((d) => d.replace(/[\\/]+$/, '')).join(', ');
  s.stop(
    instances.length > 0
      ? pc.green(`Ditemukan ${instances.length} folder Minecraft di ${driveList}.`)
      : pc.yellow(`Tidak ada folder .minecraft / minecraft di ${driveList}.`)
  );
  if (result.timedOut) {
    p.log.warn(
      'Batas waktu scan tercapai, hasil mungkin belum lengkap. Gunakan input path manual jika folder Anda belum muncul.'
    );
  }
  return instances;
}

async function resolveManualTarget(input: string): Promise<MinecraftInstance | undefined> {
  const res = await resolveManualMinecraftPath(input);
  let rootDir: string;

  if (res.ok) {
    rootDir = res.rootDir;
    if (res.adjusted) p.log.info(`Menggunakan folder game: ${pc.cyan(rootDir)}`);
  } else if (res.code === 'not_game_dir') {
    p.log.warn(res.reason);
    const useAnyway = await p.confirm({
      message: 'Folder ini belum terlihat seperti folder game Minecraft. Tetap gunakan?',
      initialValue: false,
    });
    exitIfCancel(useAnyway);
    if (!useAnyway) return undefined;
    rootDir = res.resolvedPath;
  } else {
    p.log.error(res.reason);
    return undefined;
  }

  const detected = detectLauncherFromPath(rootDir);
  return instanceDetector.inspectGameDir(rootDir, {
    id: detected.id,
    name: detected.name,
    launcher: detected.launcher,
  });
}

async function promptManualPath(): Promise<MinecraftInstance | undefined> {
  for (;;) {
    const input = await p.text({
      message: 'Masukkan path folder .minecraft / minecraft:',
      placeholder: 'D:\\Games\\.minecraft  (kosongkan untuk kembali)',
    });
    exitIfCancel(input);
    if (!input || !input.trim()) return undefined;

    const target = await resolveManualTarget(input);
    if (target) return target;
  }
}

async function pickTarget(
  initialInstances: MinecraftInstance[],
  allowCancel = false,
  activeInstanceId?: string
): Promise<MinecraftInstance | undefined> {
  let instances = deduplicateInstances(initialInstances);

  for (;;) {
    if (instances.length === 0) {
      p.log.warn('Belum ada folder Minecraft yang ditemukan. Scan ulang atau masukkan path secara manual.');
    }

    const options = [
      ...instances.map((inst) => {
        const isActive = Boolean(activeInstanceId && inst.id === activeInstanceId);
        const activeTag = isActive ? ' (Sedang Aktif)' : '';
        return {
          value: inst.id,
          label: `${isActive ? '● ' : '○ '}[${inst.launcher}] ${inst.name}${activeTag}`,
          hint: `${inst.loader ? inst.loader + ' ' : ''}${inst.gameVersion ?? ''} (${inst.rootDir})`,
        };
      }),
      {
        value: SCAN_OPTION,
        label: '🔍  Scan ulang semua drive lokal',
        hint: 'Cari folder .minecraft / minecraft di semua drive',
      },
      {
        value: MANUAL_OPTION,
        label: '✏️   Masukkan path folder secara manual',
        hint: 'misal: D:\\Games\\.minecraft',
      },
    ];

    if (allowCancel) {
      options.push({
        value: '__cancel__',
        label: '↩️   [Kembali]',
        hint: 'Batal dan kembali ke menu sebelumnya',
      });
    }

    const selected = await p.select({
      message: 'Pilih instance Minecraft target yang ingin dikelola:',
      options,
    });
    exitIfCancel(selected);

    if (selected === '__cancel__') {
      return undefined;
    }

    if (selected === SCAN_OPTION) {
      const more = await runDriveScan(instances, true);
      instances = deduplicateInstances([...instances, ...more]);
      continue;
    }
    if (selected === MANUAL_OPTION) {
      const manual = await promptManualPath();
      if (manual) return manual;
      continue;
    }

    const match = instances.find((i) => i.id === selected);
    if (match) return match;
  }
}

export async function initCommand(opts: InitOptions = {}) {
  if (!opts.skipBanner) {
    clearScreen();
    showBanner();
  }

  let target: MinecraftInstance | undefined;

  if (opts.path) {
    target = await resolveManualTarget(opts.path);
    if (!target) p.log.warn('Path dari --path tidak dapat digunakan. Melanjutkan ke deteksi otomatis.');
  }

  if (!target) {
    await instanceConfig.load();
    const activeKey = instanceConfig.get().activeInstance;

    p.log.info(pc.cyan('Memindai instance launcher Minecraft di komputer Anda...'));
    const s = p.spinner();
    s.start('Mendeteksi Prism, MultiMC, Modrinth App, CurseForge, dan Vanilla...');
    const detected = await instanceDetector.scanAll();
    s.stop(pc.green(`Ditemukan ${detected.length} instance di lokasi standar.`));

    let instances = deduplicateInstances(detected);

    const hasDefaultVanilla = instances.some((i) => i.id === 'vanilla-default');
    if (!hasDefaultVanilla || opts.scan) {
      if (!hasDefaultVanilla) {
        p.log.info('Folder .minecraft tidak ada di lokasi default. Memindai drive lain...');
      }
      const driveInstances = await runDriveScan(instances, Boolean(opts.scan));
      instances = deduplicateInstances([...instances, ...driveInstances]);
    }

    target = await pickTarget(instances, Boolean(opts.allowCancel), activeKey);
    if (!target) {
      return;
    }
  }

  let gameVersion = target.gameVersion;
  let loader = target.loader;

  await instanceConfig.load();
  const existingConfig = instanceConfig.get().instances[target.id];
  if (existingConfig) {
    if (!gameVersion && existingConfig.gameVersion) gameVersion = existingConfig.gameVersion;
    if (!loader && existingConfig.loader) loader = existingConfig.loader as LoaderType;
  }

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

  if (!opts.skipBanner) {
    p.outro(pc.green('LoadModer siap digunakan! Ketik "lm" untuk membuka menu interaktif.'));
  }
}
