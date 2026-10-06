import * as clack from "@clack/prompts";
import chalk from "chalk";
import {theme} from "./theme.js";

if (clack.log && typeof (clack.log as any).dim !== "function") {
  (clack.log as any).dim = (msg: string) => clack.log.message(chalk.dim(msg));
}
let pendingSpinnerCleanup: (() => void) | null = null;

const safeSpinner = () => {
  if (pendingSpinnerCleanup) {
    pendingSpinnerCleanup();
    pendingSpinnerCleanup = null;
  }

  const sigintBefore = process.listeners("SIGINT");
  const sigtermBefore = process.listeners("SIGTERM");
  const exitBefore = process.listeners("exit");
  const uncaughtBefore = process.listeners("uncaughtExceptionMonitor");
  const unhandledBefore = process.listeners("unhandledRejection");

  const spin = clack.spinner();
  let hasStarted = false;

  const addedSigint = process.listeners("SIGINT").filter((l) => !sigintBefore.includes(l));
  const addedSigterm = process.listeners("SIGTERM").filter((l) => !sigtermBefore.includes(l));
  const addedExit = process.listeners("exit").filter((l) => !exitBefore.includes(l));
  const addedUncaught = process.listeners("uncaughtExceptionMonitor").filter((l) => !uncaughtBefore.includes(l));
  const addedUnhandled = process.listeners("unhandledRejection").filter((l) => !unhandledBefore.includes(l));

  const cleanupListeners = () => {
    addedSigint.forEach((l) => process.removeListener("SIGINT", l));
    addedSigterm.forEach((l) => process.removeListener("SIGTERM", l));
    addedExit.forEach((l) => process.removeListener("exit", l));
    addedUncaught.forEach((l) => process.removeListener("uncaughtExceptionMonitor", l));
    addedUnhandled.forEach((l) => process.removeListener("unhandledRejection", l));
    if (pendingSpinnerCleanup === cleanupListeners) {
      pendingSpinnerCleanup = null;
    }
  };

  pendingSpinnerCleanup = cleanupListeners;

  const originalStart = spin.start.bind(spin);
  const originalStop = spin.stop.bind(spin);

  return {
    ...spin,
    start: (msg?: string) => {
      hasStarted = true;
      return originalStart(msg);
    },
    stop: (msg?: string, code?: number) => {
      try {
        if (!hasStarted) return;
        hasStarted = false;
        return originalStop(msg, code);
      } finally {
        cleanupListeners();
      }
    },
    message: spin.message.bind(spin),
  };
};

export const p = {
  ...clack,
  spinner: safeSpinner,
};

export const pc = chalk;

export function exitIfCancel<T>(value: T | symbol): asserts value is T {
  if (clack.isCancel(value)) {
    clack.cancel(chalk.hex(theme.muted)("Operasi dibatalkan."));
    process.exit(130);
  }
}

export {showBanner, clearScreen} from "./theme.js";
