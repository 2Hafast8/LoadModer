import chalk from 'chalk';
import { modrinthClient } from '../../api/client.js';
import { showBanner, showModDetails, clearScreen, logger, theme } from '../theme.js';
import { askInteractiveMenu, ask, type InteractiveChoice } from '../interactive.js';
import { installCommand } from '../../commands/install.js';
import type { SavedInstanceConfig } from '../../types/instance.js';
import type { ProjectType } from '../../types/modrinth.js';
import { formatNumber } from '../../utils/format.js';

export async function runInteractiveBrowser(
  activeInstance: SavedInstanceConfig | undefined,
  initialQuery = '',
  projectType: ProjectType = 'mod'
): Promise<void> {
  let query = initialQuery;
  let offset = 0;
  const limit = 10;
  let browsing = true;

  while (browsing) {
    clearScreen();
    showBanner(activeInstance?.name, true);

    logger.muted(`  Mengambil data ${projectType} dari Modrinth API...`);
    const res = await modrinthClient.search(
      query,
      {
        gameVersion: activeInstance?.gameVersion,
        loader: activeInstance?.loader,
        projectType,
      },
      limit,
      'downloads',
      offset
    );

    if (res.hits.length === 0) {
      clearScreen();
      showBanner(activeInstance?.name, true);
      logger.warn(`Tidak ditemukan hasil untuk "${query}".`);
      await ask('Tekan Enter untuk mencari kata kunci lain...');
      const retryQuery = await ask('Ketik kata kunci baru (kosongkan untuk batal):');
      if (retryQuery) {
        query = retryQuery;
        offset = 0;
        continue;
      } else {
        return;
      }
    }

    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(res.total_hits / limit);

    const choices: InteractiveChoice[] = res.hits.map((hit) => ({
      name: `${hit.title} [${hit.slug}]`,
      value: hit.slug,
      hint: `⬇ ${formatNumber(hit.downloads)}  •  ${hit.categories?.slice(0, 2).join(', ') ?? '-'}`,
    }));

    choices.push({ name: '──────────────────', value: 'sep' });
    if (offset + limit < res.total_hits) {
      choices.push({ name: `[Halaman Berikutnya (Hal ${currentPage + 1}/${totalPages})]`, value: 'next_page' });
    }
    if (offset > 0) {
      choices.push({ name: `[Halaman Sebelumnya (Hal ${currentPage - 1}/${totalPages})]`, value: 'prev_page' });
    }
    choices.push({ name: '[🔍 Cari dengan Kata Kunci Baru]', value: 'new_search' });
    choices.push({ name: '[Kembali ke Dashboard Utama]', value: 'back' });

    const picked = await askInteractiveMenu(
      `EKSPLORASI ${projectType.toUpperCase()} (Halaman ${currentPage}/${totalPages}  •  Total ${res.total_hits} Item)`,
      choices,
      () => {
        showBanner(activeInstance?.name, true);
      }
    );

    if (picked === 'back') {
      browsing = false;
      break;
    } else if (picked === 'next_page') {
      offset += limit;
    } else if (picked === 'prev_page') {
      offset = Math.max(0, offset - limit);
    } else if (picked === 'new_search') {
      const newQuery = await ask('Ketik kata kunci pencarian baru:');
      if (newQuery) {
        query = newQuery;
        offset = 0;
      }
    } else if (picked !== 'sep') {
      await showModDetailScreen(picked, activeInstance, projectType);
    }
  }
}

async function showModDetailScreen(
  slug: string,
  activeInstance: SavedInstanceConfig | undefined,
  projectType: ProjectType
): Promise<void> {
  clearScreen();
  showBanner(activeInstance?.name, true);

  logger.info(`Mengambil detail untuk "${slug}"...`);
  const [project, versions] = await Promise.all([
    modrinthClient.getProject(slug),
    modrinthClient.getProjectVersions(slug, {
      gameVersion: activeInstance?.gameVersion,
      loader: activeInstance?.loader,
    }),
  ]);

  clearScreen();
  showBanner(activeInstance?.name, true);
  showModDetails(project, versions);

  const detailChoices: InteractiveChoice[] = [
    {
      name: `1. ⬇ Pasang Versi Terbaru (${versions[0]?.version_number ?? 'Auto'})`,
      value: 'install_latest',
      hint: versions[0]?.loaders?.join(', ') ?? '',
    },
    { name: '2. 📋 Pilih Versi Tertentu', value: 'list_versions' },
    { name: '──────────────────', value: 'sep' },
    { name: '[Kembali ke Hasil Pencarian]', value: 'back' },
  ];

  const action = await askInteractiveMenu(
    `AKSI UNTUK "${project.title}"`,
    detailChoices,
    () => {
      showBanner(activeInstance?.name, true);
    }
  );

  if (action === 'install_latest') {
    clearScreen();
    showBanner(activeInstance?.name, true);
    await installCommand([slug], {
      type: projectType,
      mcVersion: activeInstance?.gameVersion,
      loader: activeInstance?.loader,
      dir: activeInstance?.modsDir,
    });
    await ask('Tekan Enter untuk melanjutkan...');
  } else if (action === 'list_versions') {
    clearScreen();
    showBanner(activeInstance?.name, true);

    const versionChoices: InteractiveChoice[] = versions.slice(0, 15).map((v) => {
      const tagColor = v.version_type === 'release' ? chalk.hex(theme.success)('[rel]') : chalk.hex(theme.warning)(`[${v.version_type}]`);
      return {
        name: `${tagColor} ${v.version_number}  (${v.game_versions.slice(0, 3).join(', ')})`,
        value: v.id,
        hint: v.date_published.split('T')[0],
      };
    });

    versionChoices.push({ name: '──────────────────', value: 'sep' });
    versionChoices.push({ name: '[Kembali]', value: 'back' });

    const pickedVersionId = await askInteractiveMenu(
      `PILIH VERSI UNTUK "${project.title}"`,
      versionChoices
    );

    if (pickedVersionId && pickedVersionId !== 'back' && pickedVersionId !== 'sep') {
      clearScreen();
      showBanner(activeInstance?.name, true);
      await installCommand([slug], {
        type: projectType,
        mcVersion: activeInstance?.gameVersion,
        loader: activeInstance?.loader,
        dir: activeInstance?.modsDir,
      });
      await ask('Tekan Enter untuk melanjutkan...');
    }
  }
}
