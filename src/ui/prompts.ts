import * as clack from '@clack/prompts';
import pc from 'picocolors';
import chalk from 'chalk';
import { theme } from './theme.js';

// Polyfill clack.log.dim jika belum ada di @clack/prompts
if (clack.log && typeof (clack.log as any).dim !== 'function') {
  (clack.log as any).dim = (msg: string) => clack.log.message(pc.dim(msg));
}

// Wrapper pengaman spinner agar s.stop() tidak crash jika s.start() belum dipanggil
const safeSpinner = () => {
  const spin = clack.spinner();
  let hasStarted = false;
  const originalStart = spin.start.bind(spin);
  const originalStop = spin.stop.bind(spin);

  return {
    ...spin,
    start: (msg?: string) => {
      hasStarted = true;
      return originalStart(msg);
    },
    stop: (msg?: string, code?: number) => {
      if (!hasStarted) return;
      hasStarted = false;
      return originalStop(msg, code);
    },
    message: spin.message.bind(spin),
  };
};

export const p = {
  ...clack,
  spinner: safeSpinner,
};

export { pc };

export function exitIfCancel<T>(value: T | symbol): asserts value is T {
  if (clack.isCancel(value)) {
    clack.cancel(chalk.hex(theme.muted)('Operasi dibatalkan.'));
    process.exit(130);
  }
}

export { showBanner, clearScreen } from './theme.js';
