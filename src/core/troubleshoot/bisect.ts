import path from 'node:path';
import { readdir, rename, readFile, rm } from 'node:fs/promises';
import writeFileAtomic from 'write-file-atomic';

interface BisectState {
  activeCandidates: string[];
  currentTestGroup: string[];
  step: number;
  initialDisabled?: string[];
}

export class BisectRunner {
  private readonly stateFile: string;

  constructor(private readonly modsDir: string) {
    this.stateFile = path.join(modsDir, '.loadmoder_bisect.json');
  }

  async start(): Promise<{ totalMods: number; testingCount: number }> {
    const files = await readdir(this.modsDir);
    const activeMods = files.filter((f) => f.endsWith('.jar'));
    const alreadyDisabled = files.filter((f) => f.endsWith('.jar.disabled'));

    if (activeMods.length < 2) {
      throw new Error('Minimal harus ada 2 mod aktif untuk memulai sesi bisect.');
    }

    const midpoint = Math.ceil(activeMods.length / 2);
    const toDisable = activeMods.slice(0, midpoint);

    for (const file of toDisable) {
      await rename(path.join(this.modsDir, file), path.join(this.modsDir, `${file}.disabled`));
    }

    const state: BisectState = {
      activeCandidates: activeMods,
      currentTestGroup: toDisable,
      step: 1,
      initialDisabled: alreadyDisabled,
    };
    await writeFileAtomic(this.stateFile, JSON.stringify(state, null, 2), 'utf8');

    return { totalMods: activeMods.length, testingCount: toDisable.length };
  }

  async report(status: 'good' | 'bad'): Promise<{ finished: boolean; culprit?: string; remaining: number; step: number }> {
    let state: BisectState;
    try {
      state = JSON.parse(await readFile(this.stateFile, 'utf8'));
    } catch {
      throw new Error('Tidak ada sesi bisect yang sedang berjalan. Mulai dengan: loadmoder bisect start');
    }

    let candidates: string[];

    if (status === 'good') {
      candidates = state.currentTestGroup;
    } else {
      candidates = state.activeCandidates.filter((f) => !state.currentTestGroup.includes(f));
    }

    if (candidates.length <= 1) {
      const culprit = candidates[0];
      await this.reset();
      return { finished: true, culprit, remaining: 1, step: state.step };
    }

    await this.resetFiles(state.initialDisabled);
    const midpoint = Math.ceil(candidates.length / 2);
    const nextDisable = candidates.slice(0, midpoint);

    for (const file of nextDisable) {
      await rename(path.join(this.modsDir, file), path.join(this.modsDir, `${file}.disabled`));
    }

    state.activeCandidates = candidates;
    state.currentTestGroup = nextDisable;
    state.step++;
    await writeFileAtomic(this.stateFile, JSON.stringify(state, null, 2), 'utf8');

    return { finished: false, remaining: candidates.length, step: state.step };
  }

  async reset(): Promise<void> {
    let initialDisabled: string[] = [];
    try {
      const state: BisectState = JSON.parse(await readFile(this.stateFile, 'utf8'));
      if (state.initialDisabled) initialDisabled = state.initialDisabled;
    } catch {}
    await this.resetFiles(initialDisabled);
    try {
      await rm(this.stateFile, { force: true });
    } catch {}
  }

  private async resetFiles(initialDisabled: string[] = []): Promise<void> {
    try {
      const files = await readdir(this.modsDir);
      const skipSet = new Set(initialDisabled);
      for (const f of files) {
        if (f.endsWith('.jar.disabled') && !skipSet.has(f)) {
          await rename(path.join(this.modsDir, f), path.join(this.modsDir, f.replace(/\.disabled$/, '')));
        }
      }
    } catch {}
  }

  async toggleMod(modQuery: string, enable: boolean): Promise<string> {
    const files = await readdir(this.modsDir);
    const targetSuffix = enable ? '.jar.disabled' : '.jar';
    const replaceSuffix = enable ? '.jar' : '.jar.disabled';

    const match = files.find(
      (f) => f.toLowerCase().includes(modQuery.toLowerCase()) && f.endsWith(targetSuffix)
    );

    if (!match) {
      throw new Error(`Berkas "${modQuery}" dengan status ${enable ? 'nonaktif' : 'aktif'} tidak ditemukan.`);
    }

    const oldPath = path.join(this.modsDir, match);
    const newName = match.replace(new RegExp(`\\${targetSuffix}$`), replaceSuffix);
    const newPath = path.join(this.modsDir, newName);

    await rename(oldPath, newPath);
    return newName;
  }
}
