import { instanceConfig } from '../core/instance/config.js';
import { BisectRunner } from '../core/troubleshoot/bisect.js';
import { p, pc, showBanner } from '../ui/prompts.js';

interface ToggleOptions {
  dir?: string;
}

export async function toggleCommand(modQuery: string, enable: boolean, opts: ToggleOptions) {
  showBanner();
  await instanceConfig.load();
  const activeInst = instanceConfig.getActiveInstance();

  const modsDir = opts.dir ?? activeInst?.modsDir;
  if (!modsDir) {
    p.log.error('Folder mods belum ditentukan. Jalankan "loadmoder init" terlebih dahulu.');
    process.exit(1);
  }

  const runner = new BisectRunner(modsDir);

  try {
    const newName = await runner.toggleMod(modQuery, enable);
    if (enable) {
      p.outro(pc.green(`Mod diaktifkan: ${pc.bold(newName)}`));
    } else {
      p.outro(pc.yellow(`Mod dinonaktifkan: ${pc.bold(newName)}`));
    }
  } catch (err) {
    p.log.error((err as Error).message);
    process.exit(1);
  }
}
