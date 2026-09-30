import Table from 'cli-table3';
import chalk from 'chalk';
import { theme, tableChars } from './theme.js';

export function createModsTable(): Table.Table {
  return new Table({
    head: [
      chalk.hex(theme.primary).bold('Nama Mod'),
      chalk.hex(theme.primary).bold('Versi'),
      chalk.hex(theme.primary).bold('Status'),
      chalk.hex(theme.primary).bold('Tipe'),
      chalk.hex(theme.primary).bold('Ukuran'),
    ],
    chars: tableChars,
    style: {
      head: [],
      border: [theme.border],
    },
  });
}

export function createSearchTable(): Table.Table {
  return new Table({
    head: [
      chalk.hex(theme.primary).bold('No'),
      chalk.hex(theme.primary).bold('Judul / Slug'),
      chalk.hex(theme.primary).bold('Penulis'),
      chalk.hex(theme.primary).bold('Unduhan'),
      chalk.hex(theme.primary).bold('Kategori'),
    ],
    chars: tableChars,
    style: {
      head: [],
      border: [theme.border],
    },
  });
}
