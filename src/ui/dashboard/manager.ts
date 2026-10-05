import path from 'node:path';
import { readdir, stat, rename } from 'node:fs/promises';
import chalk from 'chalk';
import boxen from 'boxen';
import { showBanner, clearScreen, logger, theme, formatBadge } from '../theme.js';
import { askInteractiveMenu, askSearchMenu, ask, type InteractiveChoice } from '../interactive.js';
import { DependencyGraph } from '../../core/dependency/graph.js';
import { formatBytes } from '../../utils/format.js';
import { runInstalledModDetailRoute } from './detail.js';
import { instanceConfig } from '../../core/instance/config.js';
import type { SavedInstanceConfig } from '../../types/instance.js';

export async function runInteractiveManager(activeInstance: SavedInstanceConfig | undefined): Promise<void> {
  let managing = true;
  let viewFilter: 'all' | 'active' | 'disabled' = 'all';

  while (managing) {
    await instanceConfig.load();
    const currentInstance = instanceConfig.getActiveInstance() ?? activeInstance;
    const modsDir = currentInstance?.modsDir;
    if (!modsDir) {
      logger.error('Folder mods belum terdaftar. Jalankan "loadmoder init" terlebih dahulu.');
      await ask('Tekan Enter untuk kembali...');
      return;
    }

    const instanceDir = currentInstance?.rootDir ?? path.dirname(modsDir);
    const graph = new DependencyGraph(instanceDir);
    await graph.load();
    await graph.reconcileWithDisk(modsDir);

    clearScreen();

    let entries: string[] = [];
    try {
      entries = await readdir(modsDir);
    } catch {
      logger.warn('Folder mods tidak ditemukan atau belum dapat diakses.');
      await ask('Tekan Enter untuk kembali...');
      return;
    }

    const modFiles = entries.filter((f) => f.endsWith('.jar') || f.endsWith('.jar.disabled'));
    if (modFiles.length === 0) {
      clearScreen();
      showBanner(currentInstance?.name, true);
      logger.warn('Tidak ada berkas mod di folder instance ini.');
      await ask('Tekan Enter untuk kembali...');
      return;
    }

    let totalBytes = 0;
    let totalActiveCount = 0;
    let totalDisabledCount = 0;

    const filesWithStats = await Promise.all(
      modFiles.map(async (file) => {
        const isDisabled = file.endsWith('.disabled');
        if (isDisabled) totalDisabledCount++;
        else totalActiveCount++;

        let size = 0;
        try {
          const s = await stat(path.join(modsDir, file));
          size = s.size;
          totalBytes += size;
        } catch {}

        return {
          file,
          isDisabled,
          cleanName: file.replace('.disabled', ''),
          sizeStr: formatBytes(size),
        };
      })
    );

    const percentActive = modFiles.length > 0 ? Math.round((totalActiveCount / modFiles.length) * 100) : 0;

    const filteredFiles = filesWithStats.filter((f) => {
      if (viewFilter === 'active') return !f.isDisabled;
      if (viewFilter === 'disabled') return f.isDisabled;
      return true;
    });

    const renderHeader = () => {
      showBanner(currentInstance?.name, true);

      const chipAll = viewFilter === 'all'
        ? chalk.hex(theme.primary).bold(`[● Semua (${modFiles.length})]`)
        : chalk.hex(theme.muted)(`[Semua (${modFiles.length})]`);
      const chipActive = viewFilter === 'active'
        ? chalk.hex(theme.success).bold(`[● Aktif (${totalActiveCount})]`)
        : chalk.hex(theme.muted)(`[Aktif (${totalActiveCount})]`);
      const chipDisabled = viewFilter === 'disabled'
        ? chalk.hex(theme.warning).bold(`[● Nonaktif (${totalDisabledCount})]`)
        : chalk.hex(theme.muted)(`[Nonaktif (${totalDisabledCount})]`);

      const line1 =
        chalk.hex(theme.textMuted)('Instance : ') +
        chalk.hex(theme.primary).bold(currentInstance?.name ?? 'Default') +
        '   •   ' +
        chalk.hex(theme.textMuted)('Penyimpanan : ') +
        chalk.hex(theme.info)(formatBytes(totalBytes));

      const line2 =
        chalk.hex(theme.textMuted)('Status   : ') +
        chalk.hex(theme.success).bold(`${totalActiveCount} Aktif`) +
        chalk.hex(theme.muted)(` / ${modFiles.length} Total (${percentActive}% Aktif)`) +
        '   •   ' +
        chalk.hex(theme.success)(totalDisabledCount === 0 ? '● Semua Siap' : `▲ ${totalDisabledCount} Nonaktif`);

      const line3 =
        chalk.hex(theme.textMuted)('Filter   : ') +
        `${chipAll}  ${chipActive}  ${chipDisabled}`;

      console.log(
        boxen(`${line1}\n${line2}\n${line3}`, {
          padding: { top: 0, bottom: 0, left: 2, right: 2 },
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
          borderStyle: 'round',
          borderColor: theme.border,
          title: chalk.hex(theme.primary).bold(' ❖ RINGKASAN MOD TERPASANG '),
          titleAlignment: 'left',
        })
      );
    };

    const choicesWithStats: InteractiveChoice[] = [];

    const nextFilterLabel =
      viewFilter === 'all'
        ? 'Hanya Aktif'
        : viewFilter === 'active'
          ? 'Hanya Nonaktif'
          : 'Semua';

    choicesWithStats.push({
      name: `🏷️   [Ganti Filter Tampilan: ${viewFilter.toUpperCase()}]`,
      value: '__cycle_filter__',
      hint: `Klik untuk beralih ke: ${nextFilterLabel}`,
    });

    if (modFiles.length > 5) {
      choicesWithStats.push({
        name: '[🔍 Filter Cepat dengan Mengetik]',
        value: '__quick_filter__',
        hint: 'Cari mod secara instan dalam daftar',
      });
    }

    choicesWithStats.push({
      name: '[⚡ Aksi Massal (Bulk Actions)]',
      value: '__bulk_actions__',
      hint: 'Aktifkan atau nonaktifkan semua mod sekaligus',
    });

    choicesWithStats.push({ name: '──────────────────', value: 'sep' });

    for (const item of filteredFiles) {
      const statusIcon = item.isDisabled
        ? chalk.hex(theme.muted)('○ ')
        : chalk.hex(theme.success)('✔ ');
      const statusBadge = item.isDisabled
        ? formatBadge(`${item.sizeStr} (Nonaktif)`, 'warning')
        : formatBadge(item.sizeStr, 'info');

      choicesWithStats.push({
        name: `${statusIcon} ${item.cleanName}`,
        value: item.file,
        hint: item.isDisabled ? 'Status: Dinonaktifkan (.jar.disabled)' : 'Status: Aktif (.jar)',
        badge: statusBadge,
      });
    }

    choicesWithStats.push({ name: '──────────────────', value: 'sep' });
    choicesWithStats.push({ name: '[Kembali ke Dashboard Utama]', value: 'back' });

    let picked = await askInteractiveMenu(
      `MANAJER MOD INSTANCE (${totalActiveCount} Aktif / ${modFiles.length} Total)`,
      choicesWithStats,
      renderHeader
    );

    if (picked === '__cycle_filter__') {
      if (viewFilter === 'all') viewFilter = 'active';
      else if (viewFilter === 'active') viewFilter = 'disabled';
      else viewFilter = 'all';
      continue;
    }

    if (picked === '__bulk_actions__') {
      const bulkChoice = await askInteractiveMenu(
        'AKSI MASSAL (BULK ACTIONS)',
        [
          {
            name: '✔  Aktifkan Seluruh Mod yang Dinonaktifkan',
            value: 'enable_all',
            hint: `Mengaktifkan ${totalDisabledCount} mod nonaktif`,
            disabled: totalDisabledCount === 0 ? 'Semua mod sudah aktif' : undefined,
          },
          {
            name: '○  Nonaktifkan Seluruh Mod',
            value: 'disable_all',
            hint: `Menonaktifkan ${totalActiveCount} mod aktif`,
            disabled: totalActiveCount === 0 ? 'Semua mod sudah nonaktif' : undefined,
          },
          { name: '──────────────────', value: 'sep' },
          { name: '[Batal / Kembali]', value: 'back' },
        ],
        renderHeader
      );

      if (bulkChoice === 'enable_all') {
        let count = 0;
        for (const f of modFiles.filter((m) => m.endsWith('.jar.disabled'))) {
          await rename(path.join(modsDir, f), path.join(modsDir, f.slice(0, -9)));
          count++;
        }
        await graph.reconcileWithDisk(modsDir);
        logger.success(`Berhasil mengaktifkan ${count} mod.`);
        await ask('Tekan Enter untuk melanjutkan...');
      } else if (bulkChoice === 'disable_all') {
        let count = 0;
        for (const f of modFiles.filter((m) => m.endsWith('.jar') && !m.endsWith('.disabled'))) {
          await rename(path.join(modsDir, f), path.join(modsDir, `${f}.disabled`));
          count++;
        }
        await graph.reconcileWithDisk(modsDir);
        logger.warn(`Berhasil menonaktifkan ${count} mod.`);
        await ask('Tekan Enter untuk melanjutkan...');
      }
      continue;
    }

    if (picked === '__quick_filter__') {
      const searchable = choicesWithStats.filter(
        (c) =>
          !c.value.startsWith('__') &&
          c.value !== 'sep' &&
          c.value !== 'back'
      );
      picked = await askSearchMenu(
        'Ketik nama mod yang ingin dicari (geser dengan panah):',
        searchable,
        renderHeader
      );
    }

    if (!picked || picked === 'back' || picked === 'sep') {
      managing = false;
      break;
    }

    await runInstalledModDetailRoute(picked, currentInstance, modsDir);
  }
}
