# LoadModer — Cetak Biru Arsitektur Platform CLI & TUI Mod Manager Minecraft

Dokumen ini merupakan cetak biru arsitektur menyeluruh dari **LoadModer** sebagai platform manajemen mod, modpack, shader, dan resource pack Minecraft berbasis Command Line (CLI) dan Terminal User Interface (TUI) kelas produksi yang terintegrasi dengan Modrinth API v2.

---

## 1. Visi Platform: "NPM / Cargo"-nya Ekosistem Minecraft

Platform modding CLI modern tidak boleh hanya sekadar "downloader file `.jar`". LoadModer dirancang untuk memberikan keandalan dan kenyamanan selayaknya package manager modern (`npm`, `cargo`, `pip`) yang terintegrasi langsung dengan ekosistem Minecraft:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          LOADMODER CLI CORE                            │
├─────────────────┬────────────────────┬─────────────────┬───────────────┤
│  Asset Router   │  Modpack Engine    │ Dependency DAG  │ Auto-Detector │
│  (Mod/Shader/RP)│  (.mrpack unpack)  │ & Auto Resolver │ Multi-Launcher│
├─────────────────┼────────────────────┼─────────────────┼───────────────┤
│ Dynamic Version │ Profile Snapshots  │ Real-Time Watch │ Crash Bisect  │
│ (MC >= 1.16 API)│ & State Isolation  │ (Disk Monitor)  │ Engine        │
├─────────────────┴────────────────────┴─────────────────┴───────────────┤
│                   High-Concurrency Pipeline & Cache                    │
├────────────────────────────────────────────────────────────────────────┤
│                       Modrinth API (Labrinth v2)                       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Delapan Pilar Pengembangan Platform LoadModer

### Pilar 1: Mesin Modpack Penuh (`.mrpack` Engine)
Format modpack standar Modrinth adalah `.mrpack` (arsip ZIP terstruktur). LoadModer mengintegrasikan mesin unpacking (`src/core/modpack/unpacker.ts`) yang mampu:
1. **Membaca Manifest `modrinth.index.json`**:
   - Memvalidasi versi game dan loader (`dependencies.minecraft`, `dependencies.fabric-loader` / `forge`).
   - Memetakan daftar berkas ke lokasi tujuan (`path`, misal `mods/sodium-1.21.jar`, `config/options.txt`).
   - Memfilter berdasarkan target environment (`env.client` vs `env.server`).
2. **Memproses Overrides**:
   - Menyalin folder `overrides/` langsung ke root instance Minecraft.
   - Menyalin `client-overrides/` hanya jika target instalasi adalah client.
   - Menyalin `server-overrides/` jika target adalah dedicated server.
3. **Atomic Unpack & Rollback**:
   Jika unduhan modpack gagal di tengah jalan, seluruh berkas sementara dibatalkan tanpa merusak folder game yang ada.

### Pilar 2: Auto-Discovery & Integrasi Multi-Launcher
LoadModer secara otomatis mendeteksi launcher (`src/core/instance/detector.ts`):
1. **Prism Launcher / MultiMC**:
   - Membaca `instance.cfg` dan `mmc-pack.json` (versi MC + loader yang terpasang).
2. **Modrinth App (Theseus)**:
   - Membaca `profile.json` untuk mengetahui metadata versi secara instan.
3. **CurseForge App**:
   - Membaca `minecraftinstance.json`.
4. **Official Vanilla Launcher**:
   - Membaca `.minecraft/launcher_profiles.json`.

### Pilar 3: Unified Multi-Asset Routing & Custom Filters
Satu perintah untuk semua tipe konten Modrinth dengan perutean direktori otomatis:
* **Mod (`project_type: mod`)** → `mods/*.jar`
* **Modpack (`project_type: modpack`)** → Unpacking `.mrpack` ke root instance
* **Resource Pack (`project_type: resourcepack`)** → `resourcepacks/*.zip`
* **Shader Pack (`project_type: shader`)** → `shaderpacks/*.zip`
* Filter kustom terpadu: versi Minecraft, mod loader, kategori, dan environment.

### Pilar 4: Dependency Graph, Auto Resolver & Orphan Pruning
* **Automatic Dependency Resolver** (`src/core/dependency/resolver.ts`): Mendeteksi library yang diwajibkan dari API metadata dan parsing teks deskripsi mod.
* **Pre-Check File Lokal**: Menghindari pengunduhan ulang jika file JAR library sudah tersedia di folder `mods/`.
* **Directed Acyclic Graph (DAG)**: Melacak silsilah dependensi di `loadmoder.lock.json`.
* **Orphan Pruning**: Membersihkan library yang tidak lagi dirujuk mod lain saat mod induk dihapus dengan `--prune`.

### Pilar 5: Dynamic Minecraft Version Discovery & Auto-Updates
* Modul `src/core/minecraft/versions.ts` mengambil daftar versi resmi Minecraft secara dinamis langsung dari Modrinth API (`GET /v2/tag/game_version`).
* Memfilter versi rilis $\ge$ 1.16, mengurutkan secara semantik, dan menyimpan cache lokal dengan TTL 24 jam.
* Mendukung pembaruan otomatis tanpa perlu hardcode versi baru di masa mendatang.

### Pilar 6: Profile Snapshot & Version Isolation Manager
* Modul `src/core/profile/snapshotManager.ts` mengisolasi berkas mod per profil dan versi game ke dalam `.loadmoder/profiles/<id>/mods/`.
* Menghilangkan risiko kontaminasi file mod antar versi Minecraft saat pemain berganti konfigurasi via `lm profile switch`.

### Pilar 7: Real-Time Directory Watcher & State Reconciliation
* Modul `src/commands/watch.ts` memantau folder `mods/` secara real-time via `chokidar`.
* Mendeteksi penambahan, penghapusan, atau pergantian file secara manual di luar CLI, lalu memperbarui status lockfile secara otomatis.

### Pilar 8: Crash Isolation & Diagnostic Tools (Bisect & Toggle)
* **Mod Toggle (`enable` / `disable`)**: Mengubah status mod (`.jar` $\leftrightarrow$ `.jar.disabled`) secara instan tanpa menghapus file.
* **Automated Mod Bisect (`src/core/troubleshoot/bisect.ts`)**: Mengisolasi mod perusak/penyebab crash dalam $O(\log_2 N)$ langkah uji menggunakan algoritma pencarian biner.

---

## 3. Hierarki Perintah LoadModer CLI (Alias: `lm`)

```text
loadmoder (alias: lm)
├── [tanpa argumen]      # Meluncurkan Dashboard Interaktif TUI
├── home                 # Buka antarmuka interaktif dashboard utama
├── init                 # Wizard interaktif deteksi launcher & inisialisasi instance
├── search <query>       # Pencarian universal (mod, pack, shader, resourcepack)
├── install <targets...> # Pemasangan mod, URL Modrinth, atau modpack .mrpack
├── update [targets...]  # Cek & pembaruan massal versi mod yang kompatibel
├── remove <targets...>  # Hapus mod beserta pembersihan dependensi yatim (prune)
├── list                 # Daftar aset terpasang, status dependensi, dan lockfile
├── enable <name>        # Aktifkan mod (.jar.disabled -> .jar)
├── disable <name>       # Nonaktifkan mod (.jar -> .jar.disabled)
├── bisect <action>      # Wizard pencarian biner isolasi mod penyebab crash
├── watch                # Pantau folder mods secara real-time untuk sinkronisasi
├── profile <action>     # Kelola snapshot profil versi game (list | switch)
└── config <action>      # Pengaturan global & manajemen profil instance
```

---

## 4. Arsitektur Data: `loadmoder.lock.json`

```json
{
  "$schema": "https://loadmoder.dev/schema/v1/lock.json",
  "version": 1,
  "gameVersion": "1.21.1",
  "loader": "fabric",
  "environment": "client",
  "updatedAt": "2026-09-30T14:00:00Z",
  "mods": {
    "sodium": {
      "projectId": "AANobbMI",
      "versionId": "f90B2c1A",
      "versionNumber": "mc1.21.1-0.6.0",
      "filename": "sodium-fabric-0.6.0+mc1.21.1.jar",
      "sha512": "3a8f...b291",
      "isRoot": true,
      "dependencies": ["fabric-api"],
      "dependedBy": []
    },
    "fabric-api": {
      "projectId": "P7dR8mSH",
      "versionId": "hJ98aK2L",
      "versionNumber": "0.102.0+1.21.1",
      "filename": "fabric-api-0.102.0+1.21.1.jar",
      "sha512": "9e12...a04c",
      "isRoot": false,
      "dependencies": [],
      "dependedBy": ["sodium", "iris"]
    }
  }
}
```

---

## 5. Implementasi Teknis Modul Kunci

### A. Modpack Unpacker (`src/core/modpack/unpacker.ts`)
Membaca `modrinth.index.json` secara streaming melalui `unzipper`, memproses folder `overrides/`, dan mengunduh seluruh file dependensi secara paralel dengan `p-limit`.

### B. Auto-Detector Launcher (`src/core/instance/detector.ts`)
Memindai instance Prism, MultiMC, Modrinth App, CurseForge, dan Vanilla lintas OS secara paralel.

### C. Automatic Dependency Resolver (`src/core/dependency/resolver.ts`)
Menginspeksi dependensi required dari API dan regex deskripsi, memverifikasi file JAR lokal, dan menyematkan metadata ke lockfile.

### D. Snapshot Manager (`src/core/profile/snapshotManager.ts`)
Menyimpan dan merestorasi file mod per profil dan versi game secara bersih saat berpindah versi.

### E. Crash Bisect Engine (`src/core/troubleshoot/bisect.ts`)
Membagi kelompok mod aktif menjadi dua bagian dan mengisolasi mod penyebab crash dalam hitungan langkah.

---

## 6. Integrasi UI/UX Interaktif

* **TUI Dashboard Menu**: Navigasi keyboard panah (`↑`/`↓`) atau Vim (`j`/`k`), tabel ringkasan filter aktif vertikal, dan browser konten modular.
* **Perutean Tanpa Duplikasi**: Layar detail, filter, dan peramban terisolasi secara bersih tanpa kebocoran state antar menu.
* **Pemberitahuan Kompatibilitas**: Verifikasi otomatis kesesuaian mod loader dan versi Minecraft sebelum pengunduhan dieksekusi.
