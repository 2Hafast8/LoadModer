import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import chalk from 'chalk';
import { showBanner, clearScreen, logger, theme } from '../theme.js';
import { askInteractiveMenu, askSearchMenu, ask, type InteractiveChoice } from '../interactive.js';
import { toggleCommand } from '../../commands/toggle.js';
import { removeCommand } from '../../commands/remove.js';
import { updateCommand } from '../../commands/update.js';
import { formatBytes } from '../../utils/format.js';
import type { SavedInstanceConfig } from '../../types/instance.js';

export async function runInteractiveManager(activeInstance: SavedInstanceConfig | undefined): Promise<void> {
  const modsDir = activeInstance?.modsDir;
  if (!modsDir) {
    logger.error('Folder mods belum terdaftar. Jalankan "loadmoder init" terlebih dahulu.');
    await ask('Tekan Enter untuk kembali...');
    return;
  }

  let managing = true;

  while (managing) {
    clearScreen();
    showBanner(activeInstance?.name, true);

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
      logger.warn('Tidak ada berkas mod di folder instance ini.');
      await ask('Tekan Enter untuk kembali...');
      return;
    }

    const choicesWithStats: InteractiveChoice[] = [];
    let totalActive = 0;

    for (const file of modFiles) {
      const isDisabled = file.endsWith('.disabled');
      if (!isDisabled) totalActive++;

      let sizeStr = '';
      try {
        const s = await stat(path.join(modsDir, file));
        sizeStr = formatBytes(s.size);
      } catch {}

      const cleanFileName = file.replace('.disabled', '');
      const badge = isDisabled
        ? chalk.hex(theme.error)('○ Nonaktif')
        : chalk.hex(theme.success)('● Aktif   ');

      choicesWithStats.push({
        name: `${badge}  ${cleanFileName}`,
        value: file,
        hint: sizeStr,
      });
    }

    if (modFiles.length > 5) {
      choicesWithStats.unshift({
        name: '[🔍 Filter Cepat dengan Mengetik]',
        value: '__quick_filter__',
        hint: 'Cari mod secara instan',
      });
    }

    choicesWithStats.push({ name: '──────────────────', value: 'sep' });
    choicesWithStats.push({ name: '[Kembali ke Dashboard Utama]', value: 'back' });

    let picked = await askInteractiveMenu(
      `MANAJER MOD INSTANCE (${totalActive} Aktif / ${modFiles.length} Total Berkas)`,
      choicesWithStats,
      () => {
        showBanner(activeInstance?.name, true);
      }
    );

    if (picked === '__quick_filter__') {
      const searchable = choicesWithStats.filter(
        (c) => c.value !== '__quick_filter__' && c.value !== 'sep' && c.value !== 'back'
      );
      picked = await askSearchMenu(
        'Ketik nama mod yang ingin dicari (geser dengan panah):',
        searchable,
        () => showBanner(activeInstance?.name, true)
      );
    }

    if (!picked || picked === 'back' || picked === 'sep') {
      managing = false;
      break;
    }

    const isDisabled = picked.endsWith('.disabled');
    const cleanName = picked.replace('.disabled', '');

    const actionChoices: InteractiveChoice[] = [
      {
        name: isDisabled
          ? '1. 🟢 Aktifkan Mod Ini (.jar.disabled -> .jar)'
          : '1. 🔴 Nonaktifkan Mod Ini (.jar -> .jar.disabled)',
        value: 'toggle',
        hint: 'Instan tanpa unduh ulang',
      },
      {
        name: '2. 🔄 Periksa Update untuk Mod Ini',
        value: 'update_single',
        hint: 'Cek versi Modrinth',
      },
      {
        name: '3. 🗑️  Hapus Mod Ini (beserta pembersihan dependensi yatim)',
        value: 'remove',
        hint: 'Hapus berkas permanen',
      },
      { name: '──────────────────', value: 'sep' },
      { name: '[Kembali ke Daftar Mod]', value: 'back' },
    ];

    const action = await askInteractiveMenu(
      `AKSI UNTUK "${cleanName}"`,
      actionChoices,
      () => {
        showBanner(activeInstance?.name, true);
      }
    );

    if (action === 'toggle') {
      clearScreen();
      showBanner(activeInstance?.name, true);
      await toggleCommand(picked, isDisabled, { dir: modsDir });
      await ask('Tekan Enter untuk melanjutkan...');
    } else if (action === 'remove') {
      clearScreen();
      showBanner(activeInstance?.name, true);
      await removeCommand([picked], { dir: modsDir });
      await ask('Tekan Enter untuk melanjutkan...');
    } else if (action === 'update_single') {
      clearScreen();
      showBanner(activeInstance?.name, true);
      await updateCommand({
        dir: modsDir,
        mcVersion: activeInstance?.gameVersion,
        loader: activeInstance?.loader,
      });
      await ask('Tekan Enter untuk melanjutkan...');
    }
  }
}
