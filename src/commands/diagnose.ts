import path from 'node:path';
import { instanceConfig } from '../core/instance/config.js';
import { logAnalyzer } from '../core/troubleshoot/logAnalyzer.js';
import { toggleModFile } from '../core/instance/modToggle.js';
import { p, pc, showBanner } from '../ui/prompts.js';
import { formatBadge, theme } from '../ui/theme.js';
import chalk from 'chalk';

export interface DiagnoseOptions {
  dir?: string;
  raw?: boolean;
  json?: boolean;
  skipBanner?: boolean;
}

export async function diagnoseCommand(opts: DiagnoseOptions = {}) {
  await instanceConfig.load();
  const activeInst = instanceConfig.getActiveInstance();

  const instanceDir = opts.dir ?? activeInst?.rootDir ?? (activeInst?.modsDir ? path.dirname(activeInst.modsDir) : undefined);
  if (!instanceDir) {
    if (opts.json) {
      console.log(JSON.stringify({ error: 'Folder instance belum ditentukan.' }, null, 2));
      return;
    }
    p.log.error('Folder instance belum ditentukan. Jalankan "loadmoder init" terlebih dahulu.');
    process.exitCode = 1;
    return;
  }

  if (opts.raw) {
    const rawLog = await logAnalyzer.getLatestLog(instanceDir);
    if (opts.json) {
      console.log(JSON.stringify({ log: rawLog }, null, 2));
    } else {
      if (rawLog) {
        console.log(rawLog);
      } else {
        p.log.warn('Tidak ada berkas log atau crash report yang ditemukan.');
      }
    }
    return;
  }

  const report = await logAnalyzer.analyze(instanceDir);

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (!opts.skipBanner) {
    showBanner();
  }

  p.log.step(`Memeriksa berkas log & crash report pada: ${pc.cyan(instanceDir)}`);

  if (!report.hasCrash) {
    p.note(
      chalk.hex(theme.success)('● Tidak terdeteksi crash report atau error fatal pada instance aktif.\n') +
        chalk.hex(theme.textMuted)(`Berkas sumber: ${report.sourceFile ?? 'Tidak ada log baru'}`),
      'STATUS LOG: BERSIH'
    );
    p.outro(chalk.hex(theme.success)('Instance Minecraft dalam kondisi siap.'));
    return;
  }

  const badgeVariant = report.category === 'out_of_memory' || report.category === 'incompatible_mod' ? 'error' : 'warning';
  const categoryLabel = (report.category ?? 'UNKNOWN').toUpperCase().replace(/_/g, ' ');

  const contentLines: string[] = [
    `${chalk.bold('Berkas Sumber')} : ${chalk.hex(theme.info)(report.sourceFile ?? '-')} ${formatBadge(report.sourceType ?? 'log', 'muted')}`,
    `${chalk.bold('Kategori')}      : ${formatBadge(categoryLabel, badgeVariant)}`,
    `${chalk.bold('Penyebab')}      : ${chalk.hex(theme.error).bold(report.culprit ?? 'Tidak teridentifikasi')}`,
    '',
    `${chalk.bold('Ringkasan')}     : ${chalk.hex(theme.text)(report.summary ?? '-')}`,
    `${chalk.bold('Solusi')}        : ${chalk.hex(theme.success)(report.solution ?? '-')}`,
  ];

  if (report.rawExcerpt) {
    contentLines.push('');
    contentLines.push(chalk.bold('Cuplikan Stack Trace / Log Error:'));
    const excerptLines = report.rawExcerpt.split(/\r?\n/).slice(-15);
    for (const line of excerptLines) {
      contentLines.push(chalk.hex(theme.textMuted)(`  ${line}`));
    }
  }

  p.note(contentLines.join('\n'), '🎯 HASIL DIAGNOSTIK CRASH');

  if (report.action && report.action.type === 'disable' && report.action.target && activeInst?.modsDir) {
    const shouldDisable = await p.confirm({
      message: `Apakah Anda ingin langsung menonaktifkan mod "${report.action.target}"?`,
      initialValue: true,
    });

    if (shouldDisable && !p.isCancel(shouldDisable)) {
      try {
        const disabledName = await toggleModFile(activeInst.modsDir, report.action.target, false);
        p.log.success(`Mod berhasil dinonaktifkan: ${pc.green(disabledName)}`);
      } catch (err: any) {
        p.log.error(`Gagal menonaktifkan mod: ${err.message}`);
      }
    }
  }

  p.outro(chalk.hex(theme.primary)('Diagnostik selesai. Jalankan "lm bisect start" jika ingin mengisolasi lebih lanjut.'));
}

