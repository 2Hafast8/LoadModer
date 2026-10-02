import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import chalk from 'chalk';
import { showBanner, clearScreen, logger, theme } from '../theme.js';
import { askInteractiveMenu, askSearchMenu, ask, type InteractiveChoice } from '../interactive.js';
import { DependencyGraph } from '../../core/dependency/graph.js';
import { formatBytes } from '../../utils/format.js';
import { runInstalledModDetailRoute } from './detail.js';
import { instanceConfig } from '../../core/instance/config.js';
import type { SavedInstanceConfig } from '../../types/instance.js';

export async function runInteractiveManager(activeInstance: SavedInstanceConfig | undefined): Promise<void> {
  let managing = true;

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
        showBanner(currentInstance?.name, true);
      }
    );

    if (picked === '__quick_filter__') {
      const searchable = choicesWithStats.filter(
        (c) => c.value !== '__quick_filter__' && c.value !== 'sep' && c.value !== 'back'
      );
      picked = await askSearchMenu(
        'Ketik nama mod yang ingin dicari (geser dengan panah):',
        searchable,
        () => showBanner(currentInstance?.name, true)
      );
    }

    if (!picked || picked === 'back' || picked === 'sep') {
      managing = false;
      break;
    }

    await runInstalledModDetailRoute(picked, currentInstance, modsDir);
  }
}
