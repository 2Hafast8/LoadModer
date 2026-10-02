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
  type?: string;
}

export async function listCommand(opts: ListOptions) {
  await instanceConfig.load();
  const activeInst = instanceConfig.getActiveInstance();

  const modsDir = opts.dir ?? activeInst?.modsDir;
  if (!modsDir) {
    p.log.error('Folder mods belum ditentukan. Jalankan "loadmoder init" terlebih dahulu.');
    process.exit(1);
  }

  const instanceDir = activeInst?.rootDir ?? path.dirname(modsDir);
  const graph = new DependencyGraph(instanceDir);
  await graph.load();
  await graph.reconcileWithDisk(modsDir, instanceDir);

  const contentType = (opts.type ?? 'all').toLowerCase();

  if (contentType === 'shader') {
    await listPackAssets('shaderpacks', 'Shader Pack', graph.data.shaderpacks ?? {}, instanceDir, opts.json);
    return;
  }

  if (contentType === 'resourcepack') {
    await listPackAssets('resourcepacks', 'Resource Pack', graph.data.resourcepacks ?? {}, instanceDir, opts.json);
    return;
  }

  const s = opts.json ? null : p.spinner();
  s?.start(`Memindai folder mods: ${modsDir}...`);

  let entries: string[] = [];
  try {
    entries = await readdir(modsDir);
  } catch {
    if (opts.json) {
      console.log('[]');
      return;
    }
    s?.stop(pc.yellow('Folder mods belum ada atau masih kosong.'));
    return;
  }

  const modFiles = entries.filter((f) => f.endsWith('.jar') || f.endsWith('.jar.disabled'));
  if (modFiles.length === 0) {
    if (opts.json) {
      console.log('[]');
      return;
    }
    s?.stop(pc.yellow('Tidak ada mod yang terpasang di folder ini.'));
  } else {
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

    if (opts.json) {
      console.log(JSON.stringify(fileDetails, null, 2));
      return;
    }

    const knownMap = await modrinthClient.getVersionsByHashes(fileDetails.map((f) => f.sha1));
    s?.stop(pc.green(`Ditemukan ${modFiles.length} berkas mod:`));

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

  if (contentType === 'all') {
    const shaderCount = Object.keys(graph.data.shaderpacks ?? {}).length;
    const rpCount = Object.keys(graph.data.resourcepacks ?? {}).length;
    if (shaderCount > 0 || rpCount > 0) {
      p.log.message(
        chalk.hex(theme.textMuted)(
          `Aset lain terdeteksi: ${shaderCount} shader pack ("lm list -t shader"), ${rpCount} resource pack ("lm list -t resourcepack")`
        )
      );
    }
  }
}

async function listPackAssets(
  subfolder: string,
  label: string,
  records: Record<string, { filename: string; sha512: string }>,
  instanceDir: string,
  jsonOutput?: boolean
) {
  const dir = path.join(instanceDir, subfolder);
  let files: string[] = [];
  try {
    const all = await readdir(dir);
    files = all.filter((f) => f.endsWith('.zip'));
  } catch {}

  if (files.length === 0) {
    if (jsonOutput) {
      console.log('[]');
      return;
    }
    p.log.info(pc.yellow(`Tidak ada ${label} yang terpasang di ${dir}.`));
    return;
  }

  const items = await Promise.all(
    files.map(async (f) => {
      const s = await stat(path.join(dir, f)).catch(() => null);
      const size = s?.size ?? 0;
      const matchedSlug = Object.entries(records).find(([, r]) => r.filename === f)?.[0];
      return { filename: f, slug: matchedSlug ?? '-', size, sizeStr: formatBytes(size) };
    })
  );

  if (jsonOutput) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }

  p.log.info(pc.green(`Ditemukan ${items.length} berkas ${label}:`));
  items.forEach((item, idx) => {
    console.log(
      `  ${chalk.hex(theme.primary).bold(`${idx + 1}.`)} ${chalk.hex(theme.text).bold(item.filename)} ${chalk.hex(theme.muted)(`[${item.slug}]`)} • ${chalk.hex(theme.info)(item.sizeStr)}`
    );
  });
}
