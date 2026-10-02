import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import { modrinthClient } from '../api/client.js';
import { instanceConfig } from '../core/instance/config.js';
import { DependencyGraph } from '../core/dependency/graph.js';
import { createModsTable } from '../ui/tables.js';
import chalk from 'chalk';
import { theme } from '../ui/theme.js';
import { p, pc } from '../ui/prompts.js';
import { hashFile } from '../utils/crypto.js';
import { formatBytes } from '../utils/format.js';
import pLimit from 'p-limit';

interface ListOptions {
  dir?: string;
  json?: boolean;
}

export async function listCommand(opts: ListOptions) {
  await instanceConfig.load();
  const activeInst = instanceConfig.getActiveInstance();

  const modsDir = opts.dir ?? activeInst?.modsDir;
  if (!modsDir) {
    p.log.error('Folder mods belum ditentukan. Jalankan "loadmoder init" terlebih dahulu.');
    process.exit(1);
  }

  const s = p.spinner();
  s.start(`Memindai folder mods: ${modsDir}...`);

  let entries: string[] = [];
  try {
    entries = await readdir(modsDir);
  } catch {
    s.stop(pc.yellow('Folder mods belum ada atau masih kosong.'));
    return;
  }

  const modFiles = entries.filter((f) => f.endsWith('.jar') || f.endsWith('.jar.disabled'));
  if (modFiles.length === 0) {
    s.stop(pc.yellow('Tidak ada mod yang terpasang di folder ini.'));
    return;
  }

  const instanceDir = activeInst?.rootDir ?? path.dirname(modsDir);
  const graph = new DependencyGraph(instanceDir);
  await graph.load();
  await graph.reconcileWithDisk(modsDir);

  const limit = pLimit(8);
  const fileDetails = await Promise.all(
    modFiles.map((filename) =>
      limit(async () => {
        const filePath = path.join(modsDir, filename);
        const fileStat = await stat(filePath);
        const sha1 = await hashFile(filePath, 'sha1');
        const isDisabled = filename.endsWith('.disabled');
        return { filename, filePath, size: fileStat.size, sha1, isDisabled };
      })
    )
  );

  const knownMap = await modrinthClient.getVersionsByHashes(fileDetails.map((f) => f.sha1));
  s.stop(pc.green(`Ditemukan ${modFiles.length} berkas mod:`));

  if (opts.json) {
    console.log(JSON.stringify(fileDetails, null, 2));
    return;
  }

  const table = createModsTable();

  for (const item of fileDetails) {
    const known = knownMap[item.sha1];
    const lockEntry = Object.values(graph.data.mods).find((m) => m.filename === item.filename);

    const title = known ? chalk.hex(theme.text).bold(known.name) : chalk.hex(theme.text)(item.filename);
    const version = known ? chalk.hex(theme.primary)(known.version_number) : chalk.hex(theme.muted)('-');
    const status = item.isDisabled ? chalk.hex(theme.error)('○ Nonaktif') : chalk.hex(theme.success)('● Aktif');
    const type = lockEntry
      ? (lockEntry.isRoot ? chalk.hex(theme.secondary)('Root') : chalk.hex(theme.textMuted)('Dependensi'))
      : chalk.hex(theme.muted)('Manual');

    table.push([title, version, status, type, chalk.hex(theme.info)(formatBytes(item.size))]);
  }

  console.log(table.toString());
  p.log.info(chalk.hex(theme.muted)(`Total: ${modFiles.length} mod (${modFiles.filter((m) => !m.endsWith('.disabled')).length} aktif)`));
}
