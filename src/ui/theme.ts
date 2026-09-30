import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import figlet from 'figlet';
import Table from 'cli-table3';
import { formatNumber } from '../utils/format.js';

// === Nordic Minimalist Clean Palette ===
export const theme = {
  primary: '#38bdf8',     // Frost Ice Blue (Fokus utama / aksi)
  secondary: '#818cf8',   // Soft Lavender Indigo (Aksen judul & kategori)
  success: '#34d399',     // Nordic Mint Green (Status aktif & terpasang)
  warning: '#fbbf24',     // Amber Warm Gold (Peringatan & update)
  error: '#f87171',       // Soft Coral Rose (Error & nonaktif)
  info: '#67e8f9',        // Polar Cyan (Informasi detail & metadata)
  text: '#f1f5f9',        // Light Slate Text (Teks utama)
  textMuted: '#94a3b8',   // Slate Gray (Teks sekunder)
  muted: '#64748b',       // Deep Slate (Redup / separator)
  border: '#334155',      // Slate 700 (Border halus)
  activeBg: '#1e293b',    // Slate 800 (Highlight baris terpilih)
  pointer: '❯',           // Modern minimal pointer
};

export const tableChars = {
  top: '─',
  'top-mid': '┬',
  'top-left': '┌',
  'top-right': '┐',
  bottom: '─',
  'bottom-mid': '┴',
  'bottom-left': '└',
  'bottom-right': '┘',
  left: '│',
  'left-mid': '├',
  mid: '─',
  'mid-mid': '┼',
  right: '│',
  'right-mid': '┤',
  middle: '│',
};

export const clearScreen = () => {
  process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
  console.clear();
};

export const showBanner = (
  instanceName?: string,
  compact = false,
  showInstanceBox = false,
  extraInfo?: string
) => {
  if (compact) {
    const extra = extraInfo ? chalk.hex(theme.muted)(` • ${extraInfo}`) : '';
    console.log(
      chalk.bgHex(theme.border).hex(theme.primary).bold(' LOADMODER ') +
        chalk.hex(theme.muted)(' v2.0.0 ') +
        (instanceName ? chalk.hex(theme.secondary)(`• [${instanceName}]`) : '') +
        extra +
        '\n'
    );
    return;
  }

  const cols = process.stdout.columns || 80;
  const nordicGradient = gradient(['#38bdf8', '#818cf8']);

  if (cols < 60) {
    console.log(
      chalk.bgHex(theme.border).hex(theme.primary).bold(' LOADMODER ') +
        chalk.hex(theme.muted)(' v2.0.0 ') +
        chalk.hex(theme.muted)('• Minecraft Mod & Modpack Manager\n')
    );
  } else {
    const font = cols >= 105 ? 'ANSI Shadow' : 'Slant';
    try {
      const banner = figlet.textSync('LOADMODER', {
        font,
        horizontalLayout: 'fitted',
      });
      console.log(nordicGradient.multiline(banner));
    } catch {
      console.log(
        chalk.bgHex(theme.border).hex(theme.primary).bold(' LOADMODER ') +
          chalk.hex(theme.muted)(' v2.0.0\n')
      );
    }
  }

  console.log(
    chalk.hex(theme.muted)('  v2.0.0  •  ') +
      chalk.hex(theme.primary).bold('Minecraft Mod & Modpack Manager') +
      chalk.hex(theme.muted)('  •  Nordic Clean TUI\n')
  );

  if (instanceName && showInstanceBox) {
    const statusContent =
      chalk.hex(theme.textMuted)('Instance Aktif : ') +
      chalk.hex(theme.primary).bold(instanceName) +
      chalk.hex(theme.muted)('  •  Modrinth API v2');

    console.log(
      boxen(statusContent, {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        margin: { top: 0, bottom: 1, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: theme.border,
        dimBorder: true,
      })
    );
  }
};

export const renderInstanceHeader = (info: {
  instanceName?: string;
  gameVersion?: string;
  loader?: string;
  modsCount?: number;
  activeCount?: number;
  storageUsage?: string;
}) => {
  const line1 =
    chalk.hex(theme.textMuted)('Instance : ') +
    chalk.hex(theme.primary).bold(info.instanceName ?? 'Belum dipilih') +
    '  ' +
    chalk.hex(theme.muted)('│') +
    '  ' +
    chalk.hex(theme.textMuted)('Mod Loader : ') +
    chalk.hex(theme.secondary).bold(`${info.loader ?? 'Fabric'} (${info.gameVersion ?? '1.21'})`);

  const line2 =
    chalk.hex(theme.textMuted)('Total Mod: ') +
    chalk.hex(theme.success).bold(`${info.activeCount ?? 0} Aktif`) +
    chalk.hex(theme.muted)(` / ${info.modsCount ?? 0} Total`) +
    '  ' +
    chalk.hex(theme.muted)('│') +
    '  ' +
    chalk.hex(theme.textMuted)('Penyimpanan: ') +
    chalk.hex(theme.info)(info.storageUsage ?? '0 MB');

  console.log(
    boxen(`${line1}\n${line2}`, {
      padding: { top: 0, bottom: 0, left: 2, right: 2 },
      margin: { top: 0, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: theme.border,
      title: chalk.hex(theme.primary).bold(' ❖ STATUS INSTANCE '),
      titleAlignment: 'left',
    })
  );
};

export const createBox = (content: string, title?: string, color: string = theme.primary) => {
  return boxen(content, {
    padding: 1,
    margin: { top: 0, bottom: 1, left: 0, right: 0 },
    borderStyle: 'round',
    borderColor: color,
    title: title ? chalk.bold.hex(color)(` ${title} `) : undefined,
    titleAlignment: 'left',
  });
};

export const createHeader = (text: string, color: string = theme.primary) => {
  const box = boxen(chalk.bold.hex(theme.text)(text), {
    padding: { top: 0, bottom: 0, left: 2, right: 2 },
    margin: { top: 0, bottom: 1, left: 0, right: 0 },
    borderStyle: 'round',
    borderColor: color,
    dimBorder: false,
  });
  console.log(box);
};

export const logger = {
  info: (msg: string) => console.log(chalk.hex(theme.info)('  ●'), chalk.hex(theme.text)(msg)),
  success: (msg: string) => console.log(chalk.hex(theme.success)('  ✔'), chalk.hex(theme.text)(msg)),
  warn: (msg: string) => console.log(chalk.hex(theme.warning)('  ▲'), chalk.hex(theme.text)(msg)),
  error: (msg: string) => console.log(chalk.hex(theme.error)('  ✖'), chalk.hex(theme.text)(msg)),
  plain: (msg: string) => console.log(chalk.hex(theme.text)(msg)),
  muted: (msg: string) => console.log(chalk.hex(theme.muted)(msg)),
  br: () => console.log(''),
};

export const showModDetails = (project: any, versions: any[] = []) => {
  const metaTable = new Table({
    colWidths: [18, 56],
    wordWrap: true,
    chars: tableChars,
    style: { head: [], border: [theme.border] },
  });

  metaTable.push(
    [chalk.hex(theme.secondary)('Judul'), chalk.bold.hex(theme.text)(project.title)],
    [chalk.hex(theme.secondary)('Slug'), chalk.hex(theme.primary)(project.slug)],
    [chalk.hex(theme.secondary)('Penulis'), chalk.hex(theme.textMuted)(project.author || '-')],
    [chalk.hex(theme.secondary)('Tipe'), chalk.hex(theme.info)(project.project_type ?? 'mod')],
    [chalk.hex(theme.secondary)('Unduhan'), chalk.hex(theme.success)(`⬇ ${formatNumber(project.downloads)}`)],
    [chalk.hex(theme.secondary)('Kategori'), chalk.hex(theme.textMuted)(project.categories?.join(', ') || '-')],
    [chalk.hex(theme.secondary)('Versi Terbaru'), chalk.hex(theme.primary)(versions[0]?.version_number || '-')]
  );

  console.log(metaTable.toString());
  logger.br();

  if (project.description) {
    const descBox = boxen(chalk.hex(theme.text)(project.description), {
      padding: 1,
      margin: { top: 0, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: theme.border,
      title: chalk.hex(theme.textMuted)(' Ringkasan Deskripsi '),
      titleAlignment: 'left',
    });
    console.log(descBox);
  }
};

export interface InstalledModMeta {
  title: string;
  filename: string;
  status: 'active' | 'disabled';
  fileSize: string;
  filePath: string;
  slug?: string;
  projectId?: string;
  versionNumber?: string;
  isRoot?: boolean;
  dependencies?: string[];
  dependedBy?: string[];
  installedAt?: string;
  author?: string;
  description?: string;
  downloads?: number;
}

export const showInstalledModDetails = (meta: InstalledModMeta) => {
  const statusBadge =
    meta.status === 'active'
      ? chalk.hex(theme.success).bold('● Aktif')
      : chalk.hex(theme.error).bold('○ Nonaktif (.disabled)');

  const typeBadge =
    meta.isRoot === undefined
      ? chalk.hex(theme.muted)('Lokal / Manual')
      : meta.isRoot
        ? chalk.hex(theme.secondary).bold('Root Mod (Pilihan User)')
        : chalk.hex(theme.textMuted)('Dependensi Pustaka');

  const metaTable = new Table({
    colWidths: [20, 56],
    wordWrap: true,
    chars: tableChars,
    style: { head: [], border: [theme.border] },
  });

  metaTable.push(
    [chalk.hex(theme.secondary)('Judul Mod'), chalk.bold.hex(theme.text)(meta.title)],
    [chalk.hex(theme.secondary)('Status'), statusBadge],
    [chalk.hex(theme.secondary)('Nama Berkas'), chalk.hex(theme.primary)(meta.filename)],
    [chalk.hex(theme.secondary)('Ukuran Berkas'), chalk.hex(theme.info)(meta.fileSize)],
    [chalk.hex(theme.secondary)('Versi Terpasang'), chalk.hex(theme.text)(meta.versionNumber || '-')],
    [chalk.hex(theme.secondary)('Tipe Instalasi'), typeBadge]
  );

  if (meta.slug) {
    metaTable.push([
      chalk.hex(theme.secondary)('Mod Slug / ID'),
      chalk.hex(theme.primary)(`${meta.slug}${meta.projectId ? ` (${meta.projectId})` : ''}`),
    ]);
  }
  if (meta.author) {
    metaTable.push([chalk.hex(theme.secondary)('Penulis / Author'), chalk.hex(theme.textMuted)(meta.author)]);
  }

  const depsText =
    meta.dependencies && meta.dependencies.length > 0
      ? meta.dependencies.map((d) => chalk.hex(theme.primary)(d)).join(', ')
      : chalk.hex(theme.muted)('Tidak ada');
  metaTable.push([chalk.hex(theme.secondary)('Dependensi Wajib'), depsText]);

  const dependedByText =
    meta.dependedBy && meta.dependedBy.length > 0
      ? meta.dependedBy.map((d) => chalk.hex(theme.warning)(d)).join(', ')
      : chalk.hex(theme.muted)('Tidak ada (Aman dihapus)');
  metaTable.push([chalk.hex(theme.secondary)('Dibutuhkan Oleh'), dependedByText]);

  if (meta.installedAt) {
    try {
      const dateFormatted = new Date(meta.installedAt).toLocaleString();
      metaTable.push([chalk.hex(theme.secondary)('Tanggal Pasang'), chalk.hex(theme.muted)(dateFormatted)]);
    } catch {}
  }

  metaTable.push([chalk.hex(theme.secondary)('Lokasi Berkas'), chalk.hex(theme.muted)(meta.filePath)]);

  console.log(metaTable.toString());
  logger.br();

  if (meta.description) {
    const descBox = boxen(chalk.hex(theme.text)(meta.description), {
      padding: 1,
      margin: { top: 0, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: theme.border,
      title: chalk.hex(theme.textMuted)(' Ringkasan Deskripsi '),
      titleAlignment: 'left',
    });
    console.log(descBox);
  }
};

export const printFAQ = () => {
  createHeader('❓ PANDUAN PENGGUNAAN & PUSAT BANTUAN', theme.primary);
  logger.br();

  const faqs = [
    {
      q: 'Bagaimana cara memilih instance Minecraft?',
      a: 'Gunakan opsi [Pilih / Ganti Instance] di menu utama atau perintah "lm init". LoadModer mendukung Prism Launcher, Modrinth App, MultiMC, CurseForge, dan Vanilla Launcher.',
    },
    {
      q: 'Bagaimana cara memasang modpack (.mrpack)?',
      a: 'Pilih [Eksplorasi Modpack] di dashboard atau ketik "lm install <slug> --type modpack". File modpack diekstrak otomatis beserta config dan overrides.',
    },
    {
      q: 'Bagaimana cara menggunakan Bisect untuk mengatasi crash?',
      a: 'Pilih [Diagnostik & Bisect] atau ketik "lm bisect start". Sistem akan menonaktifkan 50% mod secara cerdas hingga mod penyebab crash terisolasi dalam hitungan menit.',
    },
    {
      q: 'Apakah dependensi wajib ikut terpasang otomatis?',
      a: 'Ya, resolver dependensi LoadModer secara otomatis mengunduh library wajib (seperti Fabric API) dan mencatatnya ke "loadmoder.lock.json".',
    },
    {
      q: 'Apa saja shortcut cepat (alias) yang tersedia?',
      a: 'Anda bisa menggunakan perintah cepat "lm" untuk seluruh operasi, contoh: "lm search sodium", "lm install iris", "lm update", atau "lm home".',
    },
  ];

  faqs.forEach((item, idx) => {
    console.log(chalk.hex(theme.primary).bold(`  ${idx + 1}. ${item.q}`));
    console.log(chalk.hex(theme.textMuted)(`     ${item.a}\n`));
  });
};
