import * as p from '@clack/prompts';
import pc from 'picocolors';
import chalk from 'chalk';
import { theme } from './theme.js';

// Polyfill p.log.dim jika belum ada di @clack/prompts
if (p.log && typeof (p.log as any).dim !== 'function') {
  (p.log as any).dim = (msg: string) => p.log.message(pc.dim(msg));
}

export { p, pc };

export function exitIfCancel<T>(value: T | symbol): asserts value is T {
  if (p.isCancel(value)) {
    p.cancel(chalk.hex(theme.muted)('Operasi dibatalkan.'));
    process.exit(130);
  }
}

export function showBanner(version = '2.0.0') {
  console.clear();
  p.intro(`${chalk.bgHex(theme.border).hex(theme.primary).bold(' LOADMODER ')} ${chalk.hex(theme.muted)(`v${version}`)}`);
}
