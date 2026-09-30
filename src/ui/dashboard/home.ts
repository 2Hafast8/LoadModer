import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { showBanner, renderInstanceHeader, printFAQ, clearScreen } from '../theme.js';
import { askInteractiveMenu, ask, type InteractiveChoice } from '../interactive.js';
import { instanceConfig } from '../../core/instance/config.js';
import { runInteractiveBrowser } from './browser.js';
import { runInteractiveManager } from './manager.js';
import { updateCommand } from '../../commands/update.js';
import { initCommand } from '../../commands/init.js';
import { bisectCommand } from '../../commands/bisect.js';
import { watchCommand } from '../../commands/watch.js';
import { DependencyGraph } from '../../core/dependency/graph.js';
import { formatBytes } from '../../utils/format.js';

async function getInstanceStats(modsDir?: string) {
  if (!modsDir) return { modsCount: 0, activeCount: 0, storageUsage: '0 B' };
  try {
    const files = await readdir(modsDir);
    const modFiles = files.filter((f) => f.endsWith('.jar') || f.endsWith('.jar.disabled'));
    const activeCount = modFiles.filter((f) => !f.endsWith('.disabled')).length;

    let totalBytes = 0;
    for (const f of modFiles) {
      try {
        const s = await stat(path.join(modsDir, f));
        totalBytes += s.size;
      } catch {}
    }

    return {
      modsCount: modFiles.length,
      activeCount,
      storageUsage: formatBytes(totalBytes),
    };
  } catch {
    return { modsCount: 0, activeCount: 0, storageUsage: '0 B' };
  }
}

export async function launchHomeDashboard(): Promise<void> {
  let isRunning = true;

  while (isRunning) {
    await instanceConfig.load();
    const active = instanceConfig.getActiveInstance();

    // Rekonsiliasi otomatis jika ada mod yang dihapus manual oleh pengguna dari disk
    if (active?.modsDir) {
      const instanceDir = active.rootDir ?? path.dirname(active.modsDir);
      const graph = new DependencyGraph(instanceDir);
      await graph.load();
      await graph.reconcileWithDisk(active.modsDir);
    }

    const stats = await getInstanceStats(active?.modsDir);

    const homeChoices: InteractiveChoice[] = [
      { name: '🔍  Cari Mod & Modpack di Modrinth', value: 'search', hint: 'Ketik nama / slug' },
      { name: '⭐  Mod Esensial & Populer', value: 'popular', hint: 'Sodium, Iris, Lithium...' },
      { name: '📦  Eksplorasi Modpack Rekomendasi', value: 'modpacks', hint: '.mrpack siap pakai' },
      { name: '🗃️   Kelola Mod Terpasang', value: 'manage', hint: `${stats.modsCount} berkas mod` },
      { name: '🔄  Periksa & Update Mod', value: 'update', hint: 'Deteksi versi baru' },
      { name: '👁️   Pantau Folder Mods (Real-Time)', value: 'watch', hint: 'Auto-sync live monitor' },
      { name: '🩺  Diagnostik Crash & Bisect Tool', value: 'bisect', hint: 'Binary crash locator' },
      { name: '⚙️   Ganti Profil Instance Minecraft', value: 'switch_instance', hint: active?.name ?? 'Pilih' },
      { name: '❓  Pusat Bantuan & Panduan', value: 'faq', hint: 'Dokumentasi' },
      { name: '──────────────────', value: 'sep' },
      { name: '[Keluar dari LoadModer]', value: 'exit' },
    ];

    const selected = await askInteractiveMenu(
      'DASHBOARD UTAMA',
      homeChoices,
      () => {
        showBanner(active?.name);
        renderInstanceHeader({
          instanceName: active?.name,
          gameVersion: active?.gameVersion,
          loader: active?.loader,
          modsCount: stats.modsCount,
          activeCount: stats.activeCount,
          storageUsage: stats.storageUsage,
        });
      }
    );

    switch (selected) {
      case 'search': {
        clearScreen();
        showBanner(active?.name);
        const query = await ask('Ketik kata kunci mod yang ingin dicari:');
        if (query) {
          await runInteractiveBrowser(active, query, 'mod');
        }
        break;
      }

      case 'popular': {
        await runInteractiveBrowser(active, '', 'mod');
        break;
      }

      case 'modpacks': {
        await runInteractiveBrowser(active, '', 'modpack');
        break;
      }

      case 'manage': {
        await runInteractiveManager(active);
        break;
      }

      case 'update': {
        clearScreen();
        showBanner(active?.name);
        await updateCommand({
          dir: active?.modsDir,
          mcVersion: active?.gameVersion,
          loader: active?.loader,
        });
        await ask('Tekan Enter untuk kembali ke dashboard...');
        break;
      }

      case 'watch': {
        await watchCommand({ dir: active?.modsDir });
        break;
      }

      case 'switch_instance': {
        clearScreen();
        await initCommand();
        await ask('Tekan Enter untuk kembali ke dashboard...');
        break;
      }

      case 'bisect': {
        clearScreen();
        showBanner(active?.name);
        const bisectChoice = await askInteractiveMenu('SESI BISECT TROUBLESHOOTING', [
          { name: '1. Mulai Sesi Bisect (Nonaktifkan 50% mod kandidat)', value: 'start' },
          { name: '2. Lapor: Game BERHASIL Terbuka (Good step)', value: 'good' },
          { name: '3. Lapor: Game MASIH Crash (Bad step)', value: 'bad' },
          { name: '4. Reset / Kembalikan Seluruh Mod ke Aktif', value: 'reset' },
          { name: '──────────────────', value: 'sep' },
          { name: '[Kembali ke Dashboard]', value: 'back' },
        ]);

        if (bisectChoice && bisectChoice !== 'back' && bisectChoice !== 'sep') {
          await bisectCommand(bisectChoice, { dir: active?.modsDir });
          await ask('Tekan Enter untuk melanjutkan...');
        }
        break;
      }

      case 'faq': {
        clearScreen();
        showBanner(active?.name);
        printFAQ();
        await ask('Tekan Enter untuk kembali ke dashboard...');
        break;
      }

      case 'exit': {
        clearScreen();
        console.log('Sampai jumpa! Terima kasih telah menggunakan LoadModer.\n');
        isRunning = false;
        break;
      }
    }
  }
}
