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

Setiap launcher menyimpan informasi versi Minecraft, mod loader, dan konfigurasi profil secara berbeda:

### A. Prism Launcher & MultiMC
* **Berkas Konfigurasi**: `<instance_dir>/mmc-pack.json` dan `<instance_dir>/instance.cfg`
* Pada `mmc-pack.json`, informasi dibaca dari array `components`:
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
* **Path Folder Mods**: `<instance_dir>/.minecraft/mods/`

### B. Modrinth App (Theseus)
* **Berkas Konfigurasi**: `<profile_dir>/profile.json`
* Struktur JSON:
  ```json
  {
    "name": "Fabulously Optimized",
    "game_version": "1.21.1",
    "loader": "fabric",
    "loader_version": "0.16.5"
  }
  ```
* **Path Folder Mods**: `<profile_dir>/mods/`

### C. CurseForge App
* **Berkas Konfigurasi**: `<instance_dir>/minecraftinstance.json`
* Field target:
  * `gameVersion`: `"1.20.1"`
  * `baseModLoader.name`: `"forge-47.2.0"` $\rightarrow$ diparsing ke `forge`
* **Path Folder Mods**: `<instance_dir>/mods/`

### D. Official Vanilla Launcher
* **Direktori**: `.minecraft/versions` dan `.minecraft/mods`
* Sistem memindai file `.json` di tiap folder versi (`.minecraft/versions/<version>/<version>.json`) dan memeriksa nama file `.jar` yang ada di folder `mods/` untuk menentukan loader dan versi game aktif.

---

## 3. Implementasi Detektor Instance (`src/core/instance/detector.ts`)

Pendeteksian instance memindai seluruh direktori launcher yang terpasang:

```typescript
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
    const [prism, modrinth, curseforge, vanilla] = await Promise.all([
      this.scanPrismAndMultiMC(),
      this.scanModrinthApp(),
      this.scanCurseForge(),
      this.scanVanilla(),
    ]);

    const results: MinecraftInstance[] = [...prism, ...modrinth, ...curseforge];
    if (vanilla) results.push(vanilla);
    return results;
  }
}

export const instanceDetector = new InstanceDetector();
```

---

## 4. Pencarian Multi-Drive & Input Path Manual (`src/core/instance/driveScanner.ts`)

Jika pemain tidak menyimpan instalasi Minecraft di drive sistem (`C:\`), LoadModer menyediakan dua mekanisme pendeteksian:

### A. Pemindaian Multi-Drive Otomatis (`findMinecraftDirs` & `listLocalDrives`)
- **Pendeteksian Drive**: Mendeteksi seluruh huruf drive aktif (`D:`, `E:`, `F:`, dst. pada Windows, atau titik mount `/mnt`, `/media`, `/Volumes` pada Linux/macOS).
- **Pencarian Spesifik**: Hanya memindai folder dengan nama `.minecraft` atau `minecraft` (case-insensitive).
- **Validasi Marker Game**: Folder hanya diakui sebagai instance game resmi jika memiliki setidaknya satu marker: `versions/`, `mods/`, `saves/`, `options.txt`, atau `launcher_profiles.json`.
- **Proteksi Kinerja**: Membatasi kedalaman traversal hingga 5 level, batas waktu scan maksimum 60 detik (timeout aman), serta melewati direktori sistem seperti `Windows`, `System Volume Information`, `ProgramData`, dan `$Recycle.Bin`.

### B. Input Path Manual (`resolveManualMinecraftPath`)
- Pengguna dapat memasukkan path secara langsung via menu interaktif atau flag `lm init --path <dir>`.
- **Penanganan Cerdas**:
  - Otomatis menghapus tanda petik dari fitur Windows Explorer *"Copy as path"*.
  - Mengekspansi tilde (`~`) dan variabel lingkungan seperti `%APPDATA%`.
  - Jika diarahkan ke subfolder `mods/`, otomatis naik satu tingkat ke root direktori game.
  - Jika diarahkan ke folder induk (misalnya `D:\Games`), otomatis mendeteksi subfolder `.minecraft` atau `minecraft` di dalamnya.

---

## 5. Isolasi Profil & Snapshot Manager (`src/core/profile/snapshotManager.ts`)

Berganti versi game pada instance yang sama (misal dari `1.21.1 Fabric` ke `1.20.1 Forge`) berisiko menyebabkan game crash jika file mod versi lama masih tertinggal di folder `mods/`.

LoadModer menangani ini melalui **ProfileSnapshotManager**:
1. **Penyimpanan Snapshot**:
   Saat pengguna menjalankan `lm profile switch`, seluruh file `.jar` dan `.disabled` di folder `mods/` dipindahkan ke folder arsip snapshot:
   ```text
   <rootDir>/.loadmoder/snapshots/
   ├── fabric-1.21.1.json            # Metadata snapshot & salinan lockfile
   └── fabric-1.21.1/
       └── jars/                     # Arsip berkas .jar milik profil tersebut
   ```
2. **Restorasi Bersih**:
   Folder `mods/` dikosongkan dari mod versi sebelumnya, lalu jika snapshot target (`forge-1.20.1`) sudah pernah ada sebelumnya, file mod dan state lockfile target otomatis dipulihkan.
3. **Penyelarasan Perintah `install`**:
   Perintah `lm install` selalu memverifikasi versi game dan loader aktif untuk memastikan library yang diunduh cocok dengan konfigurasi instance.

