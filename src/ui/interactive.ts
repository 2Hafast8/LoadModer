import chalk from 'chalk';
import { select, input, search, Separator } from '@inquirer/prompts';
import { ExitPromptError } from '@inquirer/core';
import { clearScreen } from './theme.js';

// === Nordic Minimalist Clean Theme for Inquirer Navigation ===
export const ui = {
  primary: '#38bdf8',     // Frost Ice Blue (Aksen utama / kursor)
  accent: '#38bdf8',      // Alias primary
  accentAlt: '#818cf8',   // Soft Lavender (Tombol aksi navigasi)
  success: '#34d399',     // Mint Green (Status aktif & konfirmasi)
  text: '#f1f5f9',        // Slate Light (Teks standar)
  textMuted: '#94a3b8',   // Slate Gray (Teks sekunder / deskripsi)
  muted: '#64748b',       // Deep Slate (Redup / garis pemisah)
  activeBg: '#1e293b',    // Slate 800 (Highlight baris terpilih)
  border: '#334155',      // Slate 700 (Border)
  pointer: '❯',           // Modern minimal pointer
  separator: '─',
};

export interface InteractiveChoice {
  name: string;
  value: string;
  hint?: string;
  disabled?: boolean | string;
}

export interface InteractiveMenuOptions {
  loop?: boolean;
  pageSize?: number;
  customFooter?: string;
}

export function renderFooter(customHint?: string): string {
  if (customHint) {
    return chalk.hex(ui.muted)('  ') + customHint;
  }
  return (
    chalk.hex(ui.muted)('  ') +
    chalk.hex(ui.accent)('↑↓ / jk') + chalk.hex(ui.textMuted)(' Geser') +
    chalk.hex(ui.muted)('  •  ') +
    chalk.hex(ui.accent)('Enter') + chalk.hex(ui.textMuted)(' Pilih') +
    chalk.hex(ui.muted)('  •  ') +
    chalk.hex(ui.accentAlt)('Ctrl+C') + chalk.hex(ui.textMuted)(' Keluar')
  );
}

/**
 * Menu navigasi arrow key modern berbasis @inquirer/prompts.
 * Mendukung navigasi panah (↑/↓), vim keys (j/k), lompatan nomor (1-9),
 * default loop: false untuk mencegah kursor berputar balik ke atas saat mencapai bawah.
 */
export async function askInteractiveMenu(
  message: string,
  choices: InteractiveChoice[],
  renderContext?: () => void,
  options?: InteractiveMenuOptions | string
): Promise<string> {
  const opts = typeof options === 'string' ? { customFooter: options } : options;
  const loop = opts?.loop ?? false;
  const pageSize = opts?.pageSize ?? 14;

  if (renderContext) {
    clearScreen();
    renderContext();
    console.log('');
  }

  const inquirerChoices = choices.map((c) => {
    if (c.value === 'sep') {
      const isPlainLine =
        !c.name ||
        c.name === 'sep' ||
        c.name === '──────────────────' ||
        /^─+$/.test(c.name.trim());

      if (isPlainLine) {
        return new Separator(chalk.hex(ui.muted)('  ' + ui.separator.repeat(54)));
      }

      // Separator berlabel / section header
      const label = c.name.replace(/[─\-]/g, '').trim().toUpperCase();
      return new Separator(
        chalk.hex(ui.accentAlt).bold(`\n  ▸ ${label}`) +
          chalk.hex(ui.muted)(` ${ui.separator.repeat(Math.max(8, 46 - label.length))}`)
      );
    }

    if (c.name === '──────────────────' || /^─+$/.test(c.name.trim())) {
      return new Separator(chalk.hex(ui.muted)('  ' + ui.separator.repeat(54)));
    }

    const isAction =
      c.name.startsWith('[') &&
      (c.name.includes('Kembali') || c.name.includes('Keluar') || c.name.includes('Halaman') || c.name.includes('Cari'));

    const styledName = isAction
      ? chalk.hex(ui.accentAlt)(c.name)
      : chalk.hex(ui.text)(c.name);

    return {
      name: styledName,
      value: c.value,
      description: c.hint ? chalk.hex(ui.textMuted)(c.hint) : undefined,
      disabled: c.disabled,
    };
  });

  try {
    return await select({
      message: chalk.hex(ui.text).bold(message),
      choices: inquirerChoices,
      pageSize,
      loop,
      theme: {
        prefix: {
          idle: chalk.hex(ui.accent).bold('❖'),
          done: chalk.hex(ui.success).bold('✔'),
        },
        icon: {
          cursor: chalk.hex(ui.accent).bold('❯ '),
        },
        style: {
          message: (text: string) => chalk.hex(ui.text).bold(text),
          highlight: (text: string) => chalk.bgHex(ui.activeBg).hex(ui.accent).bold(` ${text} `),
          description: (text: string) => chalk.hex(ui.textMuted)(`› ${text}`),
          help: (text: string) => chalk.hex(ui.muted)(text),
        },
      },
    });
  } catch (err: any) {
    if (err?.name === 'ExitPromptError' || err instanceof ExitPromptError) {
      console.log(chalk.hex(ui.muted)('\nOperasi dibatalkan.\n'));
      process.exit(130);
    }
    throw err;
  }
}

/**
 * Menu pencarian instan dengan filtering real-time saat mengetik + navigasi arrow key.
 */
export async function askSearchMenu(
  message: string,
  choices: InteractiveChoice[],
  renderContext?: () => void
): Promise<string> {
  if (renderContext) {
    clearScreen();
    renderContext();
    console.log('');
  }

  try {
    return await search({
      message: chalk.hex(ui.text).bold(message),
      source: async (input) => {
        if (!input) {
          return choices
            .filter((c) => c.value !== 'sep')
            .map((c) => ({
              name: chalk.hex(ui.text)(c.name),
              value: c.value,
              description: c.hint ? chalk.hex(ui.textMuted)(c.hint) : undefined,
            }));
        }

        const query = input.toLowerCase();
        return choices
          .filter((c) => c.value !== 'sep' && (c.name.toLowerCase().includes(query) || (c.hint && c.hint.toLowerCase().includes(query))))
          .map((c) => ({
            name: chalk.hex(ui.text)(c.name),
            value: c.value,
            description: c.hint ? chalk.hex(ui.textMuted)(c.hint) : undefined,
          }));
      },
      pageSize: 14,
      theme: {
        prefix: {
          idle: chalk.hex(ui.accent).bold('❖'),
          done: chalk.hex(ui.success).bold('✔'),
        },
        icon: {
          cursor: chalk.hex(ui.accent).bold('❯ '),
        },
        style: {
          message: (text: string) => chalk.hex(ui.text).bold(text),
          highlight: (text: string) => chalk.bgHex(ui.activeBg).hex(ui.accent).bold(` ${text} `),
          description: (text: string) => chalk.hex(ui.textMuted)(`› ${text}`),
          searchTerm: (text: string) => chalk.hex(ui.accent).bold(text),
        },
      },
    });
  } catch (err: any) {
    if (err?.name === 'ExitPromptError' || err instanceof ExitPromptError) {
      console.log(chalk.hex(ui.muted)('\nOperasi dibatalkan.\n'));
      process.exit(130);
    }
    throw err;
  }
}

/**
 * Input prompt minimalis berbasis @inquirer/prompts
 */
export async function ask(query: string, defaultValue?: string): Promise<string> {
  try {
    return await input({
      message: chalk.hex(ui.text)(query),
      default: defaultValue,
      theme: {
        prefix: {
          idle: chalk.hex(ui.accent).bold('›'),
          done: chalk.hex(ui.success).bold('✔'),
        },
        style: {
          message: (text: string) => chalk.hex(ui.text)(text),
          answer: (text: string) => chalk.hex(ui.primary).bold(text),
          defaultAnswer: (text: string) => chalk.hex(ui.muted)(`(${text})`),
        },
      },
    });
  } catch (err: any) {
    if (err?.name === 'ExitPromptError' || err instanceof ExitPromptError) {
      console.log(chalk.hex(ui.muted)('\nOperasi dibatalkan.\n'));
      process.exit(130);
    }
    throw err;
  }
}
