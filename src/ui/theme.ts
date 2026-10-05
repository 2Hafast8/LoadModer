import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import figlet from 'figlet';
import Table from 'cli-table3';
import { formatNumber } from '../utils/format.js';
import { APP_VERSION } from '../constants.js';

export function isLightTerminal(): boolean {
  if (process.env.LOADMODER_THEME === 'light') return true;
  if (process.env.LOADMODER_THEME === 'dark') return false;
  const colorfgbg = process.env.COLORFGBG;
  if (colorfgbg) {
    const parts = colorfgbg.split(';');
    const bg = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(bg) && (bg === 7 || bg === 15 || bg > 8)) {
      return true;
    }
  }
  return false;
}

const darkTheme = {
  primary: '#38bdf8',     // Frost Ice Blue (Fokus utama / aksi)
  secondary: '#818cf8',   // Soft Lavender Indigo (Aksen judul & kategori)
  success: '#34d399',     // Nordic Mint Green (Status aktif & terpasang)
  warning: '#fbbf24',     // Amber Warm Gold (Peringatan & update)
  error: '#f87171',       // Soft Coral Rose (Error & nonaktif)
  info: '#67e8f9',        // Polar Cyan (Informasi detail & metadata)
  text: '#f1f5f9',        // Light Slate Text (Teks utama)
  textMuted: '#94a3b8',   // Slate Gray (Teks sekunder)
  muted: '#94a3b8',       // Slate 400 (8.19:1 contrast, elevated from #64748b)
  border: '#334155',      // Slate 700 (Border halus)
  activeBg: '#1e293b',    // Slate 800 (Highlight baris terpilih)
  chipBg: '#1e293b',      // Slate 800 (Latar belakang filter chip)
  chipActive: '#0c4a6e',  // Ocean Dark Blue (Chip filter terpilih/aktif)
  pointer: '❯',           // Modern minimal pointer
};

const lightTheme = {
  primary: '#0369a1',     // Sky 700 (5.93:1 contrast on white)
  secondary: '#4338ca',   // Indigo 700 (7.90:1 contrast on white)
  success: '#047857',     // Emerald 700 (5.48:1 contrast on white)
  warning: '#92400e',     // Amber 800 (7.07:1 contrast on white)
  error: '#b91c1c',       // Red 700 (6.47:1 contrast on white)
  info: '#0e7490',        // Cyan 700 (5.36:1 contrast on white)
  text: '#0f172a',        // Slate 900 (17.85:1 contrast on white)
  textMuted: '#334155',   // Slate 700 (10.35:1 contrast on white)
  muted: '#475569',       // Slate 600 (7.58:1 contrast on white)
  border: '#64748b',      // Slate 500 (4.76:1 contrast on white)
  activeBg: '#e2e8f0',    // Slate 200 (Highlight baris terpilih)
  chipBg: '#e2e8f0',      // Slate 200 (Latar belakang filter chip)
  chipActive: '#bae6fd',  // Sky 200 (Chip filter aktif)
  pointer: '❯',           // Modern minimal pointer
};

export type ThemeTokens = typeof darkTheme;

export const theme: ThemeTokens = new Proxy(darkTheme, {
  get(target, prop: keyof ThemeTokens) {
    const active = isLightTerminal() ? lightTheme : darkTheme;
    return active[prop] ?? target[prop];
  },
});

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
  const isAccessible = Boolean(process.env.ACCESSIBLE || process.env.NO_COLOR || process.env.CI);
  if (isAccessible) {
    process.stdout.write('\x1B[2J\x1B[H');
    return;
  }
  try {
    console.clear();
  } catch {}
  process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
};

export const showBanner = (
  instanceName?: string,
  compact = false,
  showInstanceBox = false,
  extraInfo?: string
) => {
  const isAccessible = Boolean(process.env.ACCESSIBLE || process.env.NO_COLOR || process.env.CI);
  if (compact || isAccessible) {
    const extra = extraInfo ? chalk.hex(theme.muted)(` • ${extraInfo}`) : '';
    console.log(
      chalk.bgHex(theme.border).hex(theme.primary).bold(' LOADMODER ') +
        chalk.hex(theme.muted)(` v${APP_VERSION} `) +
        (instanceName ? chalk.hex(theme.secondary)(`• [${instanceName}]`) : '') +
        extra +
        '\n'
    );
    return;
  }

  const cols = process.stdout.columns || 80;
  const isLight = isLightTerminal();
  const bannerGradient = isLight
    ? gradient(['#0369a1', '#4338ca'])
    : gradient(['#38bdf8', '#818cf8']);

  if (cols < 60) {
    console.log(
      chalk.bgHex(theme.border).hex(theme.primary).bold(' LOADMODER ') +
        chalk.hex(theme.muted)(` v${APP_VERSION} `) +
        chalk.hex(theme.muted)('• Minecraft Mod & Modpack Manager\n')
    );
  } else {
    const font = cols >= 105 ? 'ANSI Shadow' : 'Slant';
    try {
      const banner = figlet.textSync('LOADMODER', {
        font,
        horizontalLayout: 'fitted',
      });
      console.log(bannerGradient.multiline(banner));
    } catch {
      console.log(
        chalk.bgHex(theme.border).hex(theme.primary).bold(' LOADMODER ') +
          chalk.hex(theme.muted)(` v${APP_VERSION}\n`)
      );
    }
  }

  console.log(
    chalk.hex(theme.muted)(`  v${APP_VERSION}  •  `) +
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

export interface CommandCenterInfo {
  instanceName?: string;
  gameVersion?: string;
  loader?: string;
  modsCount?: number;
  activeCount?: number;
  storageUsage?: string;
  statusText?: string;
  showAscii?: boolean;
}

export const formatBadge = (
  text: string,
  variant: 'success' | 'warning' | 'error' | 'info' | 'muted' | 'primary' | 'secondary' = 'muted'
): string => {
  const color = (theme as Record<string, string>)[variant] ?? theme.muted;
  return chalk.hex(color)(`[${text}]`);
};

export const renderCommandCenterHeader = (info: CommandCenterInfo) => {
  const isAccessible = Boolean(process.env.ACCESSIBLE || process.env.NO_COLOR || process.env.CI);
  const loaderVersionText =
    info.loader || info.gameVersion
      ? `${info.loader ?? '-'} ${info.gameVersion ?? ''}`.trim()
      : 'Belum ditentukan';

  if (isAccessible) {
    console.log(
      chalk.bold(`LOADMODER v${APP_VERSION}`) +
        ` | Instance: ${info.instanceName ?? 'Default'} | Loader: ${loaderVersionText} | Mods: ${info.activeCount ?? 0}/${info.modsCount ?? 0} (${info.storageUsage ?? '0 B'})\n`
    );
    return;
  }

  const cols = process.stdout.columns || 80;
  const isLight = isLightTerminal();
  const bannerGradient = isLight
    ? gradient(['#0369a1', '#4338ca'])
    : gradient(['#38bdf8', '#818cf8']);

  const showAscii = info.showAscii ?? true;

  if (showAscii) {
    if (cols < 60) {
      console.log(
        chalk.bgHex(theme.border).hex(theme.primary).bold(' LOADMODER ') +
          chalk.hex(theme.muted)(` v${APP_VERSION} `) +
          chalk.hex(theme.muted)('• Minecraft Mod & Modpack Manager\n')
      );
    } else {
      const font = cols >= 80 ? 'ANSI Shadow' : 'Slant';
      try {
        const banner = figlet.textSync('LOADMODER', {
          font,
          horizontalLayout: 'fitted',
        });
        console.log(bannerGradient.multiline(banner.trimEnd()));
      } catch {
        console.log(
          chalk.bgHex(theme.border).hex(theme.primary).bold(' LOADMODER ') +
            chalk.hex(theme.muted)(` v${APP_VERSION}`)
        );
      }
      console.log(
        chalk.hex(theme.muted)(`  v${APP_VERSION}  •  `) +
          chalk.hex(theme.primary).bold('Minecraft Mod & Modpack Manager') +
          chalk.hex(theme.muted)('  •  Nordic Clean TUI\n')
      );
    }
  }

  let content: string;
  if (cols < 70) {
    const line1 =
      chalk.hex(theme.textMuted)('Instance : ') +
      chalk.hex(theme.primary).bold(info.instanceName ?? 'Default');
    const line2 =
      chalk.hex(theme.textMuted)('Loader   : ') +
      chalk.hex(theme.secondary).bold(loaderVersionText);
    const line3 =
      chalk.hex(theme.textMuted)('Mods     : ') +
      chalk.hex(theme.success).bold(`${info.activeCount ?? 0}`) +
      chalk.hex(theme.muted)(` / ${info.modsCount ?? 0}`) +
      '  •  ' +
      chalk.hex(theme.info)(info.storageUsage ?? '0 B') +
      '  •  ' +
      chalk.hex(theme.success)(info.statusText ?? '● Siap');
    content = `${line1}\n${line2}\n${line3}`;
  } else {
    const line1 =
      chalk.hex(theme.textMuted)('Instance : ') +
      chalk.hex(theme.primary).bold(info.instanceName ?? 'Default') +
      '   ' +
      chalk.hex(theme.muted)('•') +
      '   ' +
      chalk.hex(theme.textMuted)('Loader : ') +
      chalk.hex(theme.secondary).bold(loaderVersionText);

    const line2 =
      chalk.hex(theme.textMuted)('Mods     : ') +
      chalk.hex(theme.success).bold(`${info.activeCount ?? 0} Aktif`) +
      chalk.hex(theme.muted)(` / ${info.modsCount ?? 0} Total`) +
      '   ' +
      chalk.hex(theme.muted)('•') +
      '   ' +
      chalk.hex(theme.textMuted)('Storage : ') +
      chalk.hex(theme.info)(info.storageUsage ?? '0 B') +
      '   ' +
      chalk.hex(theme.muted)('•') +
      '   ' +
      chalk.hex(theme.success)(info.statusText ?? '● Siap');
    content = `${line1}\n${line2}`;
  }

  const boxTitle = showAscii
    ? chalk.hex(theme.primary).bold(' ❖ STATUS INSTANCE ')
    : chalk.hex(theme.primary).bold(' ❖ LOADMODER ') + chalk.hex(theme.muted)(`v${APP_VERSION} `);

  console.log(
    boxen(content, {
      padding: { top: 0, bottom: 0, left: 2, right: 2 },
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: theme.border,
      title: boxTitle,
      titleAlignment: 'left',
    })
  );
};

export const renderInstanceHeader = (info: CommandCenterInfo) => {
  renderCommandCenterHeader(info);
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
      a: 'Pilih "Kelola Profil & Versi Game" di menu utama atau jalankan "lm init". LoadModer mendukung Prism Launcher, Modrinth App, MultiMC, CurseForge, dan Vanilla Launcher.',
    },
    {
      q: 'Bagaimana cara memasang modpack (.mrpack)?',
      a: 'Pilih "Jelajahi Modpack Populer" di menu utama atau jalankan "lm install <slug> --type modpack". Berkas modpack diekstrak otomatis beserta konfigurasi dan overrides.',
    },
    {
      q: 'Bagaimana cara menggunakan Bisect untuk mengatasi crash?',
      a: 'Pilih "Diagnostik Crash & Bisect Tool" di menu utama atau jalankan "lm bisect start". Sistem menggunakan algoritma pencarian biner (bisect) untuk menonaktifkan separuh mod pada tiap langkah pengujian hingga mod penyebab crash ditemukan.',
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
