# 05 — Integrasi Multi-Launcher, Auto-Discovery & Profile Snapshots

Dokumen ini mendokumentasikan mekanisme pendeteksian otomatis (*auto-discovery*) instance Minecraft dari berbagai launcher pihak ketiga maupun resmi, serta arsitektur isolasi profil berbasis snapshot pada sistem operasi Windows, macOS, dan Linux.

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

Setiap launcher memiliki cara sendiri dalam menyimpan informasi mengenai versi Minecraft, mod loader, dan nama profil:

### A. Prism Launcher & MultiMC
* **File Konfigurasi**: `<instance_dir>/mmc-pack.json` dan `<instance_dir>/instance.cfg`
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
* **File Konfigurasi**: `<profile_dir>/profile.json`
* Struktur JSON:
  ```json
  {
    "name": "Fabulously Optimized",
    "game_version": "1.21.1",
    "loader": "fabric",
    "loader_version": "0.16.5"
  }
  ```
* **Path Folder Mods**: `<profile_dir>/mods/`.

### C. CurseForge App
* **File Konfigurasi**: `<instance_dir>/minecraftinstance.json`
* Di dalamnya terdapat field:
  * `gameVersion`: `"1.20.1"`
  * `baseModLoader.name`: `"forge-47.2.0"` $\rightarrow$ parsed ke `forge`
* **Path Folder Mods**: `<instance_dir>/mods/`.

### D. Official Vanilla Launcher
* **File Konfigurasi**: `.minecraft/launcher_profiles.json`
* Profil tersimpan di dalam objek `profiles`. Versi Minecraft dan loader diekstraksi dari nama versi target.
* **Path Folder Mods**: `.minecraft/mods/`.

---

## 3. Implementasi Detektor Instance (`src/core/instance/detector.ts`)

Kode pendeteksi instance memindai seluruh direktori launcher di sistem operasi pengguna secara konkuren:

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
    const [prism, modrinth, curseforge, vanilla] = await Promise.all([
      this.scanPrismAndMultiMC(),
      this.scanModrinthApp(),
      this.scanCurseForge(),
      this.scanVanilla(),
    ]);

    const results: DiscoveredInstance[] = [...prism, ...modrinth, ...curseforge];
    if (vanilla) results.push(vanilla);
    return results;
  }
  // ... pemindaian spesifik per launcher
}
```

---

## 4. Isolasi Profil & Snapshot Manager (`src/core/profile/snapshotManager.ts`)

Ketika menggunakan satu direktori permainan bersama (terutama pada Vanilla Launcher di `.minecraft/mods/`), berganti versi game (misal dari `1.21.1 Fabric` ke `1.20.1 Forge`) berisiko fatal:
* Mod versi `1.21.1` akan menyebabkan crash saat dimuat di game `1.20.1`.
* Menghapus file secara manual membuat konfigurasi mod sebelumnya hilang.

LoadModer mengatasi masalah ini dengan **Profile Snapshot Engine**:
1. **Penyimpanan Snapshot**:
   Saat pengguna berganti profil melalui `lm profile switch`, seluruh file `.jar` dan `.disabled` di folder `mods/` saat ini dipindahkan atau disinkronkan ke direktori snapshot lokal:
   ```text
   .loadmoder/profiles/<profile_id>/
   ├── profile.json            # Metadata (nama, versi Minecraft, mod loader)
   └── mods/                   # Berkas-berkas mod milik profil tersebut
   ```
2. **Restorasi Bersih**:
   Folder `mods/` dikosongkan dari mod versi sebelumnya, lalu file-file milik profil target disalin kembali ke folder `mods/`.
3. **Penyelarasan Perintah `install`**:
   Perintah `lm install` selalu memeriksa versi Minecraft dan loader dari profil aktif saat ini, mencegah salah deteksi versi game saat mengunduh library dependensi.
