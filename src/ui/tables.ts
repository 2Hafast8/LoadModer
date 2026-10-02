import Table from 'cli-table3';
import chalk from 'chalk';
import { theme, tableChars } from './theme.js';

export function createModsTable(): Table.Table {
  const termCols = process.stdout.columns || 80;
  const isCompact = termCols < 95;
  const nameColWidth = isCompact ? 24 : Math.max(28, termCols - 58);

  return new Table({
    head: [
      chalk.hex(theme.primary).bold('Nama Mod'),
      chalk.hex(theme.primary).bold('Versi'),
      chalk.hex(theme.primary).bold('Status'),
      chalk.hex(theme.primary).bold('Tipe'),
      chalk.hex(theme.primary).bold('Ukuran'),
    ],
    colWidths: [nameColWidth, isCompact ? 16 : 18, isCompact ? 11 : 12, isCompact ? 7 : 8, isCompact ? 8 : 10],
    wordWrap: true,
    chars: tableChars,
    style: {
      head: [],
      border: [theme.border],
    },
  });
}

export function createSearchTable(): Table.Table {
  const termCols = process.stdout.columns || 80;
  const isCompact = termCols < 95;
  const titleColWidth = isCompact ? 24 : Math.max(28, termCols - 54);

  return new Table({
    head: [
      chalk.hex(theme.primary).bold('No'),
      chalk.hex(theme.primary).bold('Judul / Slug'),
      chalk.hex(theme.primary).bold('Penulis'),
      chalk.hex(theme.primary).bold('Unduhan'),
      chalk.hex(theme.primary).bold('Kategori'),
    ],
    colWidths: [isCompact ? 4 : 5, titleColWidth, isCompact ? 14 : 16, isCompact ? 10 : 12, isCompact ? 11 : 14],
    wordWrap: true,
    chars: tableChars,
    style: {
      head: [],
      border: [theme.border],
    },
  });
}
