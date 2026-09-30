import os from 'node:os';
import path from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';
import type { MinecraftInstance, LoaderType } from '../../types/instance.js';

export class InstanceDetector {
  private readonly home = os.homedir();
  private readonly isWin = process.platform === 'win32';
  private readonly isMac = process.platform === 'darwin';

  private get appData(): string {
    return process.env.APPDATA ?? path.join(this.home, 'AppData', 'Roaming');
  }

  async scanAll(): Promise<MinecraftInstance[]> {
    const results: MinecraftInstance[] = [];

    const [prism, modrinth, curseforge, vanilla] = await Promise.all([
      this.scanPrismAndMultiMC(),
      this.scanModrinthApp(),
      this.scanCurseForge(),
      this.scanVanilla(),
    ]);

    results.push(...prism, ...modrinth, ...curseforge);
    if (vanilla) results.push(vanilla);

    return results;
  }

  private async scanPrismAndMultiMC(): Promise<MinecraftInstance[]> {
    const instances: MinecraftInstance[] = [];
    const basePaths = [
      this.isWin
        ? path.join(this.appData, 'PrismLauncher', 'instances')
        : this.isMac
        ? path.join(this.home, 'Library', 'Application Support', 'PrismLauncher', 'instances')
        : path.join(this.home, '.local', 'share', 'PrismLauncher', 'instances'),
      this.isWin
        ? path.join(this.appData, 'MultiMC', 'instances')
        : path.join(this.home, '.local', 'share', 'MultiMC', 'instances'),
    ];

    for (const instancesDir of basePaths) {
      try {
        const dirs = await readdir(instancesDir, { withFileTypes: true });
        for (const dir of dirs) {
          if (!dir.isDirectory()) continue;
          const rootDir = path.join(instancesDir, dir.name);
          const mmcPackPath = path.join(rootDir, 'mmc-pack.json');

          let gameVersion: string | undefined;
          let loader: LoaderType | undefined;

          try {
            const mmc = JSON.parse(await readFile(mmcPackPath, 'utf8'));
            const mcComp = mmc.components?.find((c: any) => c.uid === 'net.minecraft');
            gameVersion = mcComp?.version;

            if (mmc.components?.some((c: any) => c.uid === 'net.fabricmc.fabric-loader')) loader = 'fabric';
            else if (mmc.components?.some((c: any) => c.uid === 'net.minecraftforge')) loader = 'forge';
            else if (mmc.components?.some((c: any) => c.uid === 'net.neoforged')) loader = 'neoforge';
            else if (mmc.components?.some((c: any) => c.uid === 'org.quiltmc.quilt-loader')) loader = 'quilt';
          } catch {}

          instances.push({
            id: `prism-${dir.name}`,
            name: dir.name,
            launcher: instancesDir.includes('MultiMC') ? 'MultiMC' : 'Prism',
            rootDir,
            modsDir: path.join(rootDir, '.minecraft', 'mods'),
            gameVersion,
            loader,
          });
        }
      } catch {}
    }

    return instances;
  }

  private async scanModrinthApp(): Promise<MinecraftInstance[]> {
    const instances: MinecraftInstance[] = [];
    const profilesDir = this.isWin
      ? path.join(this.appData, 'com.modrinth.theseus', 'profiles')
      : this.isMac
      ? path.join(this.home, 'Library', 'Application Support', 'com.modrinth.theseus', 'profiles')
      : path.join(this.home, '.config', 'ModrinthApp', 'profiles');

    try {
      const dirs = await readdir(profilesDir, { withFileTypes: true });
      for (const dir of dirs) {
        if (!dir.isDirectory()) continue;
        const rootDir = path.join(profilesDir, dir.name);
        const profilePath = path.join(rootDir, 'profile.json');

        try {
          const prof = JSON.parse(await readFile(profilePath, 'utf8'));
          instances.push({
            id: `modrinth-${dir.name}`,
            name: prof.name ?? dir.name,
            launcher: 'Modrinth',
            rootDir,
            modsDir: path.join(rootDir, 'mods'),
            gameVersion: prof.game_version,
            loader: prof.loader?.toLowerCase(),
          });
        } catch {}
      }
    } catch {}

    return instances;
  }

  private async scanCurseForge(): Promise<MinecraftInstance[]> {
    const instances: MinecraftInstance[] = [];
    const instancesDir = this.isWin
      ? path.join(this.home, 'curseforge', 'minecraft', 'Instances')
      : path.join(this.home, 'curseforge', 'minecraft', 'Instances');

    try {
      const dirs = await readdir(instancesDir, { withFileTypes: true });
      for (const dir of dirs) {
        if (!dir.isDirectory()) continue;
        const rootDir = path.join(instancesDir, dir.name);
        const configPath = path.join(rootDir, 'minecraftinstance.json');

        try {
          const cfg = JSON.parse(await readFile(configPath, 'utf8'));
          let loader: LoaderType | undefined;
          const loaderName = cfg.baseModLoader?.name?.toLowerCase() ?? '';
          if (loaderName.includes('fabric')) loader = 'fabric';
          else if (loaderName.includes('forge')) loader = 'forge';
          else if (loaderName.includes('neoforge')) loader = 'neoforge';

          instances.push({
            id: `cf-${dir.name}`,
            name: cfg.name ?? dir.name,
            launcher: 'CurseForge',
            rootDir,
            modsDir: path.join(rootDir, 'mods'),
            gameVersion: cfg.gameVersion,
            loader,
          });
        } catch {}
      }
    } catch {}

    return instances;
  }

  private async scanVanilla(): Promise<MinecraftInstance | null> {
    const mcDir = this.isWin
      ? path.join(this.appData, '.minecraft')
      : this.isMac
      ? path.join(this.home, 'Library', 'Application Support', 'minecraft')
      : path.join(this.home, '.minecraft');

    try {
      await stat(mcDir);
      const modsDir = path.join(mcDir, 'mods');

      let gameVersion: string | undefined;
      let loader: LoaderType | undefined;

      // 1. Pindai folder versions untuk mendeteksi Fabric/Forge/NeoForge dan versi MC
      const versionsDir = path.join(mcDir, 'versions');
      try {
        const vDirs = await readdir(versionsDir, { withFileTypes: true });
        for (const vd of vDirs) {
          if (!vd.isDirectory()) continue;
          const vJsonPath = path.join(versionsDir, vd.name, `${vd.name}.json`);
          try {
            const raw = await readFile(vJsonPath, 'utf8');
            const vJson = JSON.parse(raw);
            const mainClass = vJson.mainClass ?? '';

            if (mainClass.includes('fabricmc') || vd.name.toLowerCase().includes('fabric')) {
              loader = 'fabric';
            } else if (mainClass.includes('neoforged') || vd.name.toLowerCase().includes('neoforge')) {
              loader = 'neoforge';
            } else if (mainClass.includes('minecraftforge') || vd.name.toLowerCase().includes('forge')) {
              loader = 'forge';
            } else if (mainClass.includes('quiltmc') || vd.name.toLowerCase().includes('quilt')) {
              loader = 'quilt';
            }

            if (vJson.inheritsFrom) {
              gameVersion = vJson.inheritsFrom;
            } else {
              const match = vd.name.match(/(\d+\.\d+(?:\.\d+)?|26\.\d+)/);
              if (match) gameVersion = match[1];
            }

            if (loader && gameVersion) break;
          } catch {}
        }
      } catch {}

      // 2. Jika belum terdeteksi, deteksi dari berkas jar yang ada di folder mods
      if (!loader || !gameVersion) {
        try {
          const modFiles = await readdir(modsDir);
          for (const f of modFiles) {
            const lower = f.toLowerCase();
            if (!loader) {
              if (lower.includes('fabric')) loader = 'fabric';
              else if (lower.includes('neoforge')) loader = 'neoforge';
              else if (lower.includes('forge')) loader = 'forge';
              else if (lower.includes('quilt')) loader = 'quilt';
            }
            if (!gameVersion) {
              const m = f.match(/(?:mc|-|\+|fabric-)(\d+\.\d+(?:\.\d+)?|26\.\d+)/i);
              if (m) gameVersion = m[1];
            }
            if (loader && gameVersion) break;
          }
        } catch {}
      }

      return {
        id: 'vanilla-default',
        name: 'Official Minecraft (Default)',
        launcher: 'Vanilla',
        rootDir: mcDir,
        modsDir,
        gameVersion,
        loader,
      };
    } catch {
      return null;
    }
  }
}

export const instanceDetector = new InstanceDetector();
