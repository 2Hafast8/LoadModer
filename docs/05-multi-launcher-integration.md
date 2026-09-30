# 05 — Integrasi Multi-Launcher & Auto-Discovery

Dokumen ini mendokumentasikan mekanisme dan algoritma pendeteksian otomatis instance Minecraft dari berbagai launcher pihak ketiga maupun launcher resmi pada sistem operasi Windows, macOS, dan Linux.

---

## 1. Lokasi Direktori Standar Tiap Launcher Cross-Platform

| Launcher | Windows | macOS | Linux |
| :--- | :--- | :--- | :--- |
| **Prism Launcher** | `%APPDATA%\PrismLauncher\instances` | `~/Library/Application Support/PrismLauncher/instances` | `~/.local/share/PrismLauncher/instances` |
| **MultiMC** | `%APPDATA%\MultiMC\instances` | `~/Library/Application Support/MultiMC/instances` | `~/.local/share/MultiMC/instances` |
| **Modrinth App** | `%APPDATA%\com.modrinth.theseus\profiles` | `~/Library/Application Support/com.modrinth.theseus/profiles` | `~/.config/ModrinthApp/profiles` |
| **CurseForge** | `%USERPROFILE%\curseforge\minecraft\Instances` | `~/Documents/curseforge/minecraft/Instances` | `~/curseforge/minecraft/Instances` |
| **Official Vanilla** | `%APPDATA%\.minecraft` | `~/Library/Application Support/minecraft` | `~/.minecraft` |

---

## 2. Struktur Metadata Tiap Launcher

Setiap launcher memiliki cara sendiri dalam menyimpan informasi mengenai **versi Minecraft**, **mod loader**, dan **nama profil**.

### A. Prism Launcher & MultiMC
* **Lokasi file konfigurasi**: `<instance_dir>/mmc-pack.json` dan `<instance_dir>/instance.cfg`
* Di dalam `mmc-pack.json`, terdapat array `components`:
  ```json
  {
    "formatVersion": 1,
    "components": [
      { "cachedName": "Minecraft", "uid": "net.minecraft", "version": "1.21.1" },
      { "cachedName": "Fabric Loader", "uid": "net.fabricmc.fabric-loader", "version": "0.16.5" }
    ]
  }
  ```
* **Pemetaan Loader**:
  * `net.fabricmc.fabric-loader` $\rightarrow$ `fabric`
  * `net.minecraftforge` $\rightarrow$ `forge`
  * `net.neoforged` $\rightarrow$ `neoforge`
  * `org.quiltmc.quilt-loader` $\rightarrow$ `quilt`
* **Path Folder Mods**: `<instance_dir>/.minecraft/mods/` (atau `<instance_dir>/minecraft/mods/`).

### B. Modrinth App (Theseus)
* **Lokasi file konfigurasi**: `<profile_dir>/profile.json`
* Struktur JSON:
  ```json
  {
    "name": "Fabulously Optimized",
    "game_version": "1.21.1",
    "loader": "fabric",
    "loader_version": "0.16.5",
    "icon": "..."
  }
  ```
* **Path Folder Mods**: `<profile_dir>/mods/`.

### C. CurseForge App
* **Lokasi file konfigurasi**: `<instance_dir>/minecraftinstance.json`
* Di dalamnya terdapat field:
  * `gameVersion`: `"1.20.1"`
  * `baseModLoader.name`: `"forge-47.2.0"` $\rightarrow$ parsed ke `forge`
* **Path Folder Mods**: `<instance_dir>/mods/`.

### D. Official Vanilla Launcher
* **Lokasi file konfigurasi**: `.minecraft/launcher_profiles.json`
* Profil tersimpan di dalam objek `profiles`:
  * Jika nama versi mengandung kata `fabric-loader-1.21.1`, LoadModer mengekstrak versi Minecraft dan loader menggunakan ekspresi reguler (Regex).
* **Path Folder Mods**: `.minecraft/mods/`.

---

## 3. Implementasi Algoritma Pendeteksi (`src/core/launcherDetector.ts`)

Berikut adalah kode lengkap detektor instance yang tangguh terhadap error I/O dan mendukung pembacaan lintas OS:

```typescript
import os from 'node:os';
import path from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';

export interface DiscoveredInstance {
  id: string;
  name: string;
  launcher: 'Prism' | 'MultiMC' | 'Modrinth' | 'CurseForge' | 'Vanilla';
  rootDir: string;
  modsDir: string;
  gameVersion?: string;
  loader?: 'fabric' | 'forge' | 'neoforge' | 'quilt';
}

export class LauncherDetector {
  private readonly home = os.homedir();
  private readonly isWin = process.platform === 'win32';
  private readonly isMac = process.platform === 'darwin';

  private get appData(): string {
    return process.env.APPDATA ?? path.join(this.home, 'AppData', 'Roaming');
  }

  async scanAll(): Promise<DiscoveredInstance[]> {
    const results: DiscoveredInstance[] = [];

    // Jalankan pemindaian secara paralel untuk performa instan
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

  // 1. Prism Launcher & MultiMC
  private async scanPrismAndMultiMC(): Promise<DiscoveredInstance[]> {
    const instances: DiscoveredInstance[] = [];
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
          let loader: DiscoveredInstance['loader'];

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

  // 2. Modrinth App (Theseus)
  private async scanModrinthApp(): Promise<DiscoveredInstance[]> {
    const instances: DiscoveredInstance[] = [];
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

  // 3. CurseForge App
  private async scanCurseForge(): Promise<DiscoveredInstance[]> {
    const instances: DiscoveredInstance[] = [];
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
          let loader: DiscoveredInstance['loader'];
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

  // 4. Official Vanilla
  private async scanVanilla(): Promise<DiscoveredInstance | null> {
    const mcDir = this.isWin
      ? path.join(this.appData, '.minecraft')
      : this.isMac
      ? path.join(this.home, 'Library', 'Application Support', 'minecraft')
      : path.join(this.home, '.minecraft');

    try {
      await stat(mcDir);
      return {
        id: 'vanilla-default',
        name: 'Official Minecraft (Default)',
        launcher: 'Vanilla',
        rootDir: mcDir,
        modsDir: path.join(mcDir, 'mods'),
      };
    } catch {
      return null;
    }
  }
}
```
