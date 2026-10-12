import path from 'node:path';
import { stat } from 'node:fs/promises';
import chalk from 'chalk';
import boxen from 'boxen';
import { showBanner, clearScreen, logger, theme, formatBadge } from '../theme.js';
import { askInteractiveMenu, ask, type InteractiveChoice } from '../interactive.js';
import { logAnalyzer } from '../../core/troubleshoot/logAnalyzer.js';
import { toggleModFile } from '../../core/instance/modToggle.js';
import { bisectCommand } from '../../commands/bisect.js';
import { instanceConfig } from '../../core/instance/config.js';
import type { SavedInstanceConfig } from '../../types/instance.js';

export async function runInteractiveDiagnostics(activeInstance: SavedInstanceConfig | undefined): Promise<void> {
  let running = true;

  while (running) {
    await instanceConfig.load();
    const currentInstance = instanceConfig.getActiveInstance() ?? activeInstance;
    const instanceDir = currentInstance?.rootDir ?? (currentInstance?.modsDir ? path.dirname(currentInstance.modsDir) : undefined);
    const modsDir = currentInstance?.modsDir;

    if (!instanceDir || !modsDir) {
      clearScreen();
      logger.error('Folder instance/mods belum terdaftar. Jalankan "loadmoder init" terlebih dahulu.');
      await ask('Tekan Enter untuk kembali...');
      return;
    }

    const bisectStateFile = path.join(modsDir, '.loadmoder_bisect.json');
    let isBisectActive = false;
    try {
      const s = await stat(bisectStateFile);
      isBisectActive = s.isFile();
    } catch {}

    clearScreen();
    showBanner(currentInstance?.name, true);

    const menuChoices: InteractiveChoice[] = [
      {
        name: '🔍  Analisis Log Crash Otomatis',
        value: 'analyze',
        hint: 'Pindai crash-reports & latest.log untuk mendeteksi penyebab crash',
        badge: formatBadge('Log Analyzer', 'primary'),
      },
      {
        name: '🎯  Binary Search Bisect Tool',
        value: 'bisect',
        hint: 'Isolasi mod penyebab crash secara eliminasi biner bertahap',
        badge: isBisectActive ? formatBadge('Sesi Aktif', 'warning') : formatBadge('Bisect', 'secondary'),
      },
      {
        name: '📋  Lihat Berkas Log Mentah (Raw latest.log)',
        value: 'raw_log',
        hint: 'Buka dan baca isi teks berkas log/crash report terbaru',
      },
      { name: '──────────────────', value: 'sep' },
      { name: '[Kembali ke Dashboard Utama]', value: 'back' },
    ];

    const choice = await askInteractiveMenu(
      'DIAGNOSTIK & TROUBLESHOOTING CRASH',
      menuChoices,
      () => showBanner(currentInstance?.name, true)
    );

    if (!choice || choice === 'back' || choice === 'sep') {
      running = false;
      break;
    }

    switch (choice) {
      case 'analyze': {
        await runAnalyzeSubmenu(currentInstance, instanceDir, modsDir);
        break;
      }

      case 'bisect': {
        await runBisectSubmenu(currentInstance, modsDir);
        break;
      }

      case 'raw_log': {
        await runRawLogSubmenu(currentInstance, instanceDir);
        break;
      }
    }
  }
}

async function runAnalyzeSubmenu(
  instance: SavedInstanceConfig | undefined,
  instanceDir: string,
  modsDir: string
): Promise<void> {
  clearScreen();
  showBanner(instance?.name, true);
  logger.info('Sedang menganalisis berkas log dan crash report...');

  const report = await logAnalyzer.analyze(instanceDir);

  clearScreen();
  showBanner(instance?.name, true);

  if (!report.hasCrash) {
    const cleanContent =
      chalk.hex(theme.success).bold('● Tidak Terdeteksi Crash Report atau Error Fatal\n\n') +
      chalk.hex(theme.textMuted)(`Berkas sumber : ${report.sourceFile ?? 'Tidak ada log baru'}\n`) +
      chalk.hex(theme.textMuted)('Kondisi instance : Bersih & Siap dimainkan');

    console.log(
      boxen(cleanContent, {
        padding: { top: 0, bottom: 0, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: theme.success,
        title: chalk.hex(theme.success).bold(' ❖ STATUS DIAGNOSTIK: AMAN '),
      })
    );
    console.log('');
    await ask('Tekan Enter untuk kembali ke menu diagnostik...');
    return;
  }

  const badgeVariant =
    report.category === 'out_of_memory' || report.category === 'incompatible_mod' || report.category === 'corrupted_file'
      ? 'error'
      : 'warning';
  const categoryLabel = (report.category ?? 'UNKNOWN').toUpperCase().replace(/_/g, ' ');

  const content = [
    `${chalk.bold('Berkas Sumber')} : ${chalk.hex(theme.info)(report.sourceFile ?? '-')} ${formatBadge(report.sourceType ?? 'log', 'muted')}`,
    `${chalk.bold('Kategori')}      : ${formatBadge(categoryLabel, badgeVariant)}`,
    `${chalk.bold('Penyebab')}      : ${chalk.hex(theme.error).bold(report.culprit ?? 'Tidak teridentifikasi')}`,
    '',
    `${chalk.bold('Ringkasan')}     : ${chalk.hex(theme.text)(report.summary ?? '-')}`,
    `${chalk.bold('Solusi')}        : ${chalk.hex(theme.success)(report.solution ?? '-')}`,
  ].join('\n');

  console.log(
    boxen(content, {
      padding: { top: 1, bottom: 1, left: 2, right: 2 },
      borderStyle: 'round',
      borderColor: theme.error,
      title: chalk.hex(theme.error).bold(' ❖ HASIL ANALISIS CRASH REPORT '),
    })
  );

  let stayInAnalysis = true;
  while (stayInAnalysis) {
    const analysisChoices: InteractiveChoice[] = [];

    if (report.action && report.action.type === 'disable' && report.action.target) {
      analysisChoices.push({
        name: `⚡  Tindakan Cepat: Nonaktifkan Mod "${report.action.target}"`,
        value: 'quick_fix',
        hint: 'Nonaktifkan mod yang terdeteksi menyebabkan crash',
        badge: formatBadge('Rekomendasi', 'success'),
      });
    }

    if (report.rawExcerpt) {
      analysisChoices.push({
        name: '📄  Lihat Cuplikan Stack Trace / Log Error',
        value: 'view_excerpt',
        hint: 'Tampilkan 20 baris pesan error terakhir dari crash log',
      });
    }

    analysisChoices.push(
      {
        name: '🎯  Buka Bisect Tool (Jika Error Masih Berlanjut)',
        value: 'open_bisect',
        hint: 'Jalankan binary search jika mod penyebab belum sepenuhnya tuntas',
      },
      { name: '──────────────────', value: 'sep' },
      { name: '[Kembali ke Menu Diagnostik]', value: 'back' }
    );

    const subChoice = await askInteractiveMenu(
      'OPSI TINDAKAN DIAGNOSTIK',
      analysisChoices,
      () => showBanner(instance?.name, true)
    );

    if (!subChoice || subChoice === 'back' || subChoice === 'sep') {
      stayInAnalysis = false;
      break;
    }

    switch (subChoice) {
      case 'quick_fix': {
        if (report.action?.target) {
          try {
            const disabledFile = await toggleModFile(modsDir, report.action.target, false);
            logger.success(`Mod "${report.action.target}" berhasil dinonaktifkan: ${disabledFile}`);
            await ask('Tekan Enter untuk melanjutkan...');
            stayInAnalysis = false;
          } catch (err: any) {
            logger.error(`Gagal menonaktifkan mod: ${err.message}`);
            await ask('Tekan Enter untuk melanjutkan...');
          }
        }
        break;
      }

      case 'view_excerpt': {
        clearScreen();
        showBanner(instance?.name, true);
        const excerptLines = report.rawExcerpt.split(/\r?\n/).slice(-25).join('\n');
        console.log(
          boxen(chalk.hex(theme.textMuted)(excerptLines), {
            padding: { top: 1, bottom: 1, left: 2, right: 2 },
            borderStyle: 'round',
            borderColor: theme.border,
            title: chalk.hex(theme.primary).bold(' ❖ CUPLIKAN LOG ERROR TERAKHIR '),
          })
        );
        console.log('');
        await ask('Tekan Enter untuk kembali ke opsi tindakan...');
        break;
      }

      case 'open_bisect': {
        await runBisectSubmenu(instance, modsDir);
        stayInAnalysis = false;
        break;
      }
    }
  }
}

async function runBisectSubmenu(
  instance: SavedInstanceConfig | undefined,
  modsDir: string
): Promise<void> {
  let stayBisect = true;

  while (stayBisect) {
    clearScreen();
    showBanner(instance?.name, true);

    const bisectStateFile = path.join(modsDir, '.loadmoder_bisect.json');
    let stateInfo: any = null;
    try {
      const { readFile } = await import('node:fs/promises');
      const raw = await readFile(bisectStateFile, 'utf8');
      stateInfo = JSON.parse(raw);
    } catch {}

    const isRunning = Boolean(stateInfo);
    if (isRunning) {
      const remaining = Array.isArray(stateInfo.candidates) ? stateInfo.candidates.length : '?';
      const step = stateInfo.step ?? 1;
      console.log(
        boxen(
          `${chalk.bold('Status')}     : ${formatBadge('SESI AKTIF BERJALAN', 'warning')}\n` +
            `${chalk.bold('Langkah')}    : ${chalk.hex(theme.info)(`#${step}`)}\n` +
            `${chalk.bold('Kandidat')}   : ${chalk.hex(theme.warning)(`${remaining} mod tersisa`)}`,
          {
            padding: { top: 0, bottom: 0, left: 2, right: 2 },
            borderStyle: 'round',
            borderColor: theme.warning,
            title: chalk.hex(theme.warning).bold(' ❖ STATUS SESI BISECT '),
          }
        )
      );
      console.log('');
    }

    const bisectChoice = await askInteractiveMenu(
      'BINARY SEARCH BISECT ENGINE',
      [
        {
          name: isRunning
            ? '1. Mulai Ulang Sesi Bisect dari Awal (Reset & Start Baru)'
            : '1. Mulai Sesi Bisect (Nonaktifkan 50% Mod Kandidat)',
          value: 'start',
          hint: 'Bagi dua mod aktif untuk mempersempit kandidat crash',
        },
        {
          name: '2. Lapor: Game BERHASIL Terbuka (Good Step)',
          value: 'good',
          hint: 'Mod penyebab crash berada pada kelompok yang dinonaktifkan',
        },
        {
          name: '3. Lapor: Game MASIH Crash (Bad Step)',
          value: 'bad',
          hint: 'Mod penyebab crash berada pada kelompok yang sedang aktif',
        },
        {
          name: '4. Batalkan & Pulihkan Seluruh Mod (Reset)',
          value: 'reset',
          hint: 'Pulihkan seluruh mod ke status aktif semula',
        },
        { name: '──────────────────', value: 'sep' },
        { name: '[Kembali ke Menu Diagnostik]', value: 'back' },
      ],
      () => showBanner(instance?.name, true)
    );

    if (!bisectChoice || bisectChoice === 'back' || bisectChoice === 'sep') {
      stayBisect = false;
      break;
    }

    clearScreen();
    showBanner(instance?.name, true);
    await bisectCommand(bisectChoice, { dir: modsDir, skipBanner: true });
    await ask('Tekan Enter untuk melanjutkan...');
  }
}

async function runRawLogSubmenu(
  instance: SavedInstanceConfig | undefined,
  instanceDir: string
): Promise<void> {
  clearScreen();
  showBanner(instance?.name, true);
  logger.info('Membaca berkas log terbaru...');

  const rawLog = await logAnalyzer.getLatestLog(instanceDir);

  clearScreen();
  showBanner(instance?.name, true);

  if (!rawLog) {
    logger.warn('Tidak ditemukan berkas crash report atau logs/latest.log pada instance aktif.');
    await ask('Tekan Enter untuk kembali ke menu diagnostik...');
    return;
  }

  const lines = rawLog.split(/\r?\n/);
  const totalLines = lines.length;
  const recentLines = lines.slice(-60).join('\n');

  console.log(
    boxen(
      chalk.hex(theme.textMuted)(
        `[Menampilkan 60 baris terakhir dari total ${totalLines} baris log]\n\n${recentLines}`
      ),
      {
        padding: { top: 1, bottom: 1, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: theme.border,
        title: chalk.hex(theme.primary).bold(' ❖ BERKAS LOG TERBARU (RAW LOG) '),
      }
    )
  );
  console.log('');
  await ask('Tekan Enter untuk kembali ke menu diagnostik...');
}

