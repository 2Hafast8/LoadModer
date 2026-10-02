import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import figlet from 'figlet';
import Table from 'cli-table3';
import { formatNumber } from '../utils/format.js';

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
