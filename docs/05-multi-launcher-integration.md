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
| **TLauncher** | `%APPDATA%\.minecraft\versions` | `~/Library/Application Support/minecraft/versions` | `~/.minecraft/versions` |
| **Legacy Launcher** | `%APPDATA%\.tlauncher\legacy\Minecraft\game` | `~/Library/Application Support/.tlauncher/legacy/Minecraft/game` | `~/.tlauncher/legacy/Minecraft/game` |
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

### E. TLauncher & Wadah Versi Mandiri (`versions/<container>/`)
* **Pola Wadah Client**: Setiap instalasi atau modpack TLauncher dibuat sebagai folder terpisah di `.minecraft/versions/<container_name>/` (misalnya `mypack(fabric)`, `mypack(forge)`, `mypack(fabric-1.21)`).
* **Metadata Konfigurasi**:
  * `TLauncherAdditional.json`: Metadata modpack TL MODS. Versi Minecraft dibaca dari `modpack.version.gameVersionDTO.name` atau `minecraftVersionTypes[0].name`.
  * `<container_name>.json`: Metadata versi engine launcher yang mencatat `inheritsFrom` dan dependencies engine.
* **Filosofi Integrasi Non-Intrusif (Read-Only Version & Wadah TLauncher)**:
  * Wadah baru dan pemilihan versi/loader dikelola langsung oleh pemain di aplikasi TLauncher melalui tombol **TL MODS** $\rightarrow$ **Create Modpack**.
  * TLauncher memiliki sistem registrasi internal yang ketat terhadap folder versi baru. Untuk menjamin stabilitas dan kompatibilitas 100%, LoadModer tidak memodifikasi atau membuat file engine secara paksa dari luar, melainkan membaca metadata secara akurat (*read-only*) dan mengelola ekosistem mod di dalam wadah tersebut.
* **Path Folder Mods & Brankas**:
  * Root wadah: `.minecraft/versions/<container_name>/`
  * Folder mods kerja: `.minecraft/versions/<container_name>/mods/`
  * Brankas profil modpack: `.minecraft/versions/<container_name>/.loadmoder/profiles/`
* **Preservasi File Mesin Launcher (`isPreservedEngineItem`)**:
  * Saat pembersihan wadah dilakukan, seluruh file engine launcher dipertahankan secara utuh (`TLauncherAdditional.json`, `<cName>.jar`, `<cName>.json`, direktori `.fabric`, `.loadmoder`, dan `logs`).

### F. Legacy Launcher (TL Legacy) & Arsitektur Dual-Path (`versions/` vs `home/`)
* **Pola Dual-Path**:
  * **Engine Storage (`game/versions/<version>/`)**: Tempat berkas `.jar` dan `.json` engine yang diunduh Legacy Launcher. Folder ini murni dibaca dan tidak dimodifikasi saat mengelola modpack.
  * **Profile Containers (`game/home/<profile>/`)**: Wadah profil mandiri tempat berkas permainan, mods (`home/<profile>/mods`), konfigurasi, dan brankas profil `.loadmoder/`.
* **Sinkronisasi Konfigurasi `tl.properties`**:
  * LoadModer membaca `login.version` (misal `Fabric 26.2`) dan `minecraft.gamedir.separate` untuk memetakan folder kerja mods secara otomatis.
* **Aturan Deteksi Jalur Pintar (`detectLauncherFromPath`)**:
  * **Drive C:** Pemindaian membaca path relatif setelah `AppData\Roaming\` (misal `.tlauncher\legacy\Minecraft\game` terdeteksi akurat sebagai **Legacy**, bukan sekadar "Custom (game)").
  * **Partisi Non-C (`D:`, `E:`, dll.):** Memeriksa seluruh path lengkap dari root drive hingga leaf folder.
* **Preservasi Berkas Sistem Legacy (`isLegacyPreservedItem`)**:
  * Menjamin berkas pengguna dan loader (`servers.dat`, `servers.dat.bak`, `saves/`, `.fabric/`, `.loadmoder/`, `logs/`) tetap terlindungi saat pembersihan wadah.
* **Sistem Cadangan Baseline Satu Kali (`BaselineManager`)**:
  * Sebelum modpack pertama diekstrak, kondisi awal lingkungan wadah (termasuk `options.txt` awal) dikunci ke `.loadmoder/baseline/`.
  * Saat wadah dinonaktifkan (`lm modpack disable`), lingkungan game live dibersihkan dan dipulihkan kembali ke setelan baseline asli pemain tanpa menghapus berkas master baseline.


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

