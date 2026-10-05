import chalk from 'chalk';
import { modrinthClient, type SearchIndex } from '../api/client.js';
import { instanceConfig } from '../core/instance/config.js';
import { InstalledAssetsIndex } from '../core/instance/installedIndex.js';
import { createSearchTable } from '../ui/tables.js';
import { p, pc } from '../ui/prompts.js';
import { theme } from '../ui/theme.js';
import { formatNumber } from '../utils/format.js';
import type { ProjectType } from '../types/modrinth.js';

interface SearchOptions {
  type?: string;
  mcVersion?: string;
  loader?: string;
  category?: string;
  env?: 'client' | 'server';
  limit?: string;
  sort?: string;
  json?: boolean;
}

export async function searchCommand(query: string, opts: SearchOptions) {
  await instanceConfig.load();
  const activeInst = instanceConfig.getActiveInstance();

  const gameVersion = opts.mcVersion ?? activeInst?.gameVersion;
  const loader = opts.loader ?? activeInst?.loader;
  const projectType = (opts.type as ProjectType) ?? 'mod';
  const category = opts.category;
  const environment = opts.env;
  const rawLimit = Number(opts.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 10;
  const sort = (opts.sort as SearchIndex) ?? 'relevance';

  const s = opts.json ? null : p.spinner();
  s?.start(chalk.hex(theme.textMuted)(`Mencari "${query}" (${projectType}) di Modrinth & mengecek instalasi...`));

  const [response, installedIndex] = await Promise.all([
    modrinthClient.search(
      query,
      { gameVersion, loader, projectType, category, environment },
      limit,
      sort
    ),
    InstalledAssetsIndex.load(activeInst),
  ]);
  s?.stop(chalk.hex(theme.success)(`Ditemukan ${response.total_hits} hasil (menampilkan ${response.hits.length}):`));

  if (opts.json) {
    const enrichedHits = response.hits.map((hit) => ({
      ...hit,
      installed:
        installedIndex.isInstalled(hit.slug) ||
        (hit.project_id ? installedIndex.isInstalled(hit.project_id) : false),
    }));
    console.log(JSON.stringify(enrichedHits, null, 2));
    return;
  }

  if (response.hits.length === 0) {
    p.log.warn(`Tidak ditemukan aset untuk "${query}". Coba periksa versi game (${gameVersion ?? 'semua'}) atau loader.`);
    return;
  }

  const table = createSearchTable();
  response.hits.forEach((hit, idx) => {
    const isInstalled =
      installedIndex.isInstalled(hit.slug) ||
      (hit.project_id ? installedIndex.isInstalled(hit.project_id) : false);

    const statusBadge = isInstalled
      ? chalk.hex(theme.success).bold('✔ Terpasang')
      : chalk.hex(theme.muted)('—');

    const checkMark = isInstalled ? chalk.hex(theme.success)('✔ ') : '';

    table.push([
      chalk.hex(theme.muted)((idx + 1).toString()),
      `${checkMark}${chalk.bold.hex(theme.text)(hit.title)}\n${chalk.hex(theme.primary)(hit.slug)}`,
      statusBadge,
      chalk.hex(theme.textMuted)(hit.author),
      chalk.hex(theme.success)(`⬇ ${formatNumber(hit.downloads)}`),
      chalk.hex(theme.textMuted)(hit.categories.slice(0, 3).join(', ')),
    ]);
  });

  console.log(table.toString());
  p.log.info(chalk.hex(theme.muted)(`Gunakan "lm install <slug>" untuk memasang aset.`));
}
