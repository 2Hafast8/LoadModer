import cliProgress from 'cli-progress';
import chalk from 'chalk';
import { theme } from './theme.js';

export function createMultiProgressBar() {
  return new cliProgress.MultiBar(
    {
      clearOnComplete: false,
      hideCursor: true,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      format: `${chalk.hex(theme.primary)('{bar}')} ${chalk.hex(theme.success)('{percentage}%')} │ ${chalk.bold.hex(theme.text)('{filename}')} │ ${chalk.hex(theme.textMuted)('{received}/{total} MB')}`,
    },
    cliProgress.Presets.shades_classic
  );
}
