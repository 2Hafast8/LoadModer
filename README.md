<div align="center">

<img src="docs/assets/banner.png" alt="LoadModer Banner" width="100%" />

<br/>
<br/>

<a href="https://loadmoder.crft.my.id">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="docs/assets/logo-light.png">
    <img src="docs/assets/logo.png" alt="LoadModer Logo" width="280" />
  </picture>
</a>

# LoadModer (`lm`)

**High-Performance Minecraft Mod & Modpack Manager**  
*Desktop GUI • Interactive TUI • Automated CLI*

[![npm version](https://img.shields.io/npm/v/loadmoder?color=cb3837&logo=npm)](https://www.npmjs.com/package/loadmoder)
[![npm downloads](https://img.shields.io/npm/dm/loadmoder?color=blue&logo=npm)](https://www.npmjs.com/package/loadmoder)
[![Releases](https://img.shields.io/github/v/release/2Hafast8/LoadModer?color=a855f7&label=Windows%20App&logo=windows)](https://github.com/2Hafast8/LoadModer/releases)
[![CI](https://github.com/2Hafast8/LoadModer/actions/workflows/ci.yml/badge.svg)](https://github.com/2Hafast8/LoadModer/actions/workflows/ci.yml)
[![Vitest](https://img.shields.io/badge/tests-297%20passed-34d399.svg?logo=vitest)](https://vitest.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-34d399.svg)](https://github.com/2Hafast8/LoadModer/blob/main/LICENSE)
[![Website](https://img.shields.io/badge/website-loadmoder.crft.my.id-0284c7)](https://loadmoder.crft.my.id)

<p align="center">
  <a href="#-tampilan-antarmuka--demo-showcase">Demo & Preview</a> •
  <a href="#-fitur-unggulan">Fitur Unggulan</a> •
  <a href="#-instalasi--memulai-cepat">Instalasi</a> •
  <a href="#-ringkasan-perintah-cli">Perintah CLI</a> •
  <a href="#-arsitektur-sistem">Arsitektur</a> •
  <a href="#-dokumentasi-teknis">Dokumentasi</a> •
  <a href="#-pengujian">Pengujian</a>
</p>

---

</div>

**LoadModer (`lm`)** adalah package manager mandiri berkinerja tinggi untuk mengelola mod, modpack (`.mrpack`), shaderpack, dan resource pack Minecraft berbasis **Modrinth API v2**.

Dirancang dengan arsitektur **Directed Acyclic Graph (DAG)** untuk resolusi dependensi otomatis, isolasi snapshot profil versi game, pendeteksi tanda tangan launcher lintas drive, serta pelindung proses disk terintegrasi. LoadModer hadir dalam bentuk aplikasi desktop native Windows (`.exe`), antarmuka terminal interaktif (TUI), dan perintah baris CLI langsung.

---

## 📸 Tampilan Antarmuka & Demo (Showcase)

LoadModer menghadirkan pengalaman visual ganda yang dirancang untuk kebutuhan berbeda: **Desktop GUI Modern** untuk eksplorasi visual interaktif, dan **Nordic Clean TUI / CLI** untuk efisiensi kecepatan di terminal.

### 🖥️ 1. Desktop GUI Application (Windows Standalone)
Antarmuka visual native berbasis Electron 32 dan React 19. Dilengkapi penjelajah modpack dengan kartu responsif, *drag-and-drop installer* (`.jar`, `.zip`, `.mrpack`, atau tautan URL web), pemetaan folder kustom, dan penganalisis crash report visual.

<div align="center">
  <img src="docs/assets/desktop-preview.png" alt="LoadModer Desktop GUI Preview" width="100%" />
  <p><em>Tampilan Desktop GUI: Penjelajah Modpack, Status Instance Aktif, dan Live Operation Guard.</em></p>
</div>

---

### ⚡ 2. Interactive Terminal UI (TUI) Dashboard
Dijalankan via perintah `lm` atau `lm home`. Menyajikan kontrol keyboard ergonomis (`↑`/`↓`/`Enter`), chip filter horizontal real-time, status box Nordic Cyber, dan indikator kapasitas disk tanpa perlu meninggalkan terminal.

<div align="center">
  <img src="docs/assets/tui-preview.png" alt="LoadModer Interactive TUI Preview" width="100%" />
</div>

```text
  _                     _ __  __           _           
 | |    ___   __ _   __| |  \/  | ___   __| | ___ _ __ 
 | |   / _ \ / _` | / _` | |\/| |/ _ \ / _` |/ _ \ '__|
 | |__| (_) | (_| || (_| | |  | | (_) | (_| |  __/ |   
 |_____\___/ \__,_| \__,_|_|  |_|\___/ \__,_|\___|_|   
  v2.11.0  •  Minecraft Mod & Modpack Manager  •  Nordic Clean TUI

┌────────────────────────────────────────────────────────────────────────┐
│  Instance Aktif : Prism Launcher (Fabric 1.21.1) • Modrinth API v2     │
│  Wadah Modpack  : default (Active)               • Mod Terpasang: 48   │
│  Penyimpanan    : 142.8 MB                       • Guard: javaw.exe OK │
└────────────────────────────────────────────────────────────────────────┘

? Pilih Operasi: (Gunakan tombol panah ↑/↓ dan Enter)
❯ 🌐 Jelajahi Konten Baru (Mod, Modpack, Shader, Resource Pack)
  📦 Kelola Mod Terpasang (Aktif / Nonaktif / Hapus)
  🔄 Periksa & Perbarui Mod (Update All)
  📁 Ganti Profil / Versi Game (Snapshot Manager)
  🩺 Diagnostik & Analisis Crash (Bisect & Log Scanner)
  ⚙️  Pengaturan & Konfigurasi Instance
  🚪 Keluar
```

---

### 💻 3. Direct Headless CLI
Eksekusi baris perintah langsung untuk otomasi skrip, terminal cepat, atau pipeline CI/CD:

```bash
# Pencarian cepat dengan filter tipe, loader, dan versi Minecraft:
$ lm search sodium -t mod -l fabric -v 1.21.1
✔ Ditemukan 12 hasil yang kompatibel di Modrinth API v2:
┌─────────────────┬──────────┬──────────────┬─────────────┬─────────────┐
│ Nama Mod        │ Slug     │ Versi Mod    │ Unduhan     │ Status      │
├─────────────────┼──────────┼──────────────┼─────────────┼─────────────┤
│ Sodium          │ sodium   │ mc1.21.1-0.6 │ 32.4M       │ [Terpasang] │
│ Sodium Extra    │ extra    │ mc1.21.1-0.5 │ 14.1M       │ [Tersedia]  │
└─────────────────┴──────────┴──────────────┴─────────────┴─────────────┘

# Instalasi mod beserta resolusi dependensi otomatis (DAG):
$ lm install iris
✔ Mengunduh metadata dependensi...
  ├─ iris (v1.8.0)
  └─ fabric-api (v0.100.0) [Dependensi Wajib]
✔ Memverifikasi checksum SHA-512... Selesai.
✔ Memasang berkas ke .minecraft/mods... Sukses.
```

---

## ⚡ Fitur Unggulan

### 🖥️ 1. Antarmuka Fleksibel (Dual-Mode Interface)
* **Desktop GUI Modern**: Antarmuka grafis visual berbasis **Electron 32** dan **React 19** dengan Tailwind CSS Nordic theme, pencarian instan, dan live updates.
* **Interactive TUI Dashboard**: Dashboard terminal keyboard-driven (`lm` / `lm home`) dengan Figlet ASCII header, Nordic Cyber status box, filter chips horizontal, dan navigasi panah (`↑`/`↓` atau `j`/`k`).
* **Direct Scriptable CLI**: Perintah modular langsung (`lm install`, `lm update`, `lm remove`, `lm search`) yang dirancang untuk otomasi skrip terminal dan CI/CD.

### 🧩 2. Resolusi Dependensi Otomatis & Lockfile DAG
* **Directed Acyclic Graph (DAG)**: Menghitung pohon dependensi wajib secara rekursif langsung dari metadata Modrinth API v2.
* **Integritas State (`loadmoder.lock.json`)**: Melacak relasi file, versi game, loader target, dan hash checksum SHA-512 dengan penyimpanan atomik (`write-file-atomic`).
* **Orphan Pruning**: Mendeteksi dan membersihkan pustaka dependensi yatim secara otomatis saat mod induk dihapus melalui `lm remove <slug> --prune`.

### 🎮 3. Deteksi Multi-Launcher Otomatis & Pemetaan Kustom
* **Multi-Drive Auto-Discovery**: Memindai seluruh partisi drive Windows (`C:`, `D:`, `E:`, dll.) untuk mendeteksi instalasi launcher secara otomatis:
  * Official Minecraft Launcher (`.minecraft`)
  * Prism Launcher & MultiMC
  * Modrinth App & CurseForge
  * TLauncher & Legacy Launcher
  * SKLauncher
* **Content-Based Signature**: Pengenalan berbasis tanda tangan file unik (`tlauncher-2.0.properties`, `TlauncherProfiles.json`, dll.) tanpa bergantung pada asumsi path default.
* **Custom Folder Paths**: Fleksibilitas memetakan folder kustom untuk `mods`, `resourcepacks`, `shaderpacks`, dan direktori wadah modpack.

### 📦 4. Manajemen Modpack & Isolasi Profil
* **Streaming `.mrpack` Engine**: Membaca, memvalidasi manifes dengan skema Zod, mengekstrak berkas overrides, dan mengunduh dependensi secara paralel dengan pembatas konkurensi (`p-limit`).
* **Brankas Profil Terisolasi (`.loadmoder/profiles/`)**: Beralih antar-modpack secara instan tanpa perlu mengunduh ulang aset (`lm modpack switch`).
* **One-Time Golden Baseline Snapshot**: Mengunci dan mencadangkan konfigurasi awal launcher (`options.txt`, dll.) sebelum modpack pertama dipasang, memastikan pemulihan bersih permanen (*Zero-Delete Policy*) saat modpack dinonaktifkan.

### 🎯 5. Drag-and-Drop Cerdas & Dukungan Browser Web
* **Inspeksi Arsip Otomatis**: Menyeret berkas langsung ke antarmuka mendeteksi tipe konten secara akurat:
  * Berkas `.jar` -> langsung ke direktori `mods/`
  * Berkas `.zip` berisi `shaders/` -> direktori `shaderpacks/`
  * Berkas `.zip` berisi `pack.mcmeta` -> direktori `resourcepacks/`
  * Berkas `.mrpack` -> ekstraksi modpack ke wadah terisolasi
* **Web Blob & Direct URL Download**: Mendukung penarikan berkas virtual dari browser web dan penarikan tautan download URL langsung ke dalam aplikasi.

### 🛡️ 6. Keamanan Operasi, Process Guard & Crash Diagnostics
* **Anti-File Lock & Process Guard**: Mendeteksi proses aktif game (`javaw.exe`, `java.exe`) sebelum modifikasi disk dilakukan, mencegah galat `EBUSY`/`EPERM` dan korupsi berkas saat game berjalan.
* **Crash Diagnostics & Bisect Engine**: Melacak mod penyebab crash menggunakan algoritma pencarian biner otomatis $O(\log_2 N)$ (`lm bisect`) dan penganalisis pola berkas log (`lm diagnose`).
* **Auto-Updater 5-Layer Integrity Guard**: Sistem pembaruan aplikasi mandiri dengan verifikasi byte `Content-Length`, ukuran GitHub Release, threshold 30 MB, checksum SHA-256, dan validasi header PE binary Windows.

---

## 📊 Matriks Perbandingan

Perbandingan alur kerja pengelolaan mod dan modpack antara metode manual, launcher konvensional, dan LoadModer:

| Kemampuan Utama | Manual (Explorer) | Launcher Konvensional | LoadModer (`lm`) |
| :--- | :--- | :--- | :--- |
| **Resolusi Dependensi** | ❌ Cari & unduh manual satu per satu | ⚠️ Terbatas pada modpack bawaan | ✅ **Otomatis rekursif (DAG & Lockfile)** |
| **Pembersihan Dependensi (Pruning)** | ❌ Sering tertinggal (*orphaned files*) | ❌ Tidak didukung | ✅ **Otomatis terhapus (`--prune`)** |
| **Cakupan Launcher** | ⚠️ Harus navigasi folder terpisah | ❌ Terkunci ke ekosistem launcher sendiri | ✅ **Universal lintas drive (`C:`, `D:`, `E:`)** |
| **Efisiensi Ruang Disk** | ❌ Rawan penumpukan berkas ganda | ⚠️ Duplikasi penuh per instalasi (*heavy*) | ✅ **Brankas snapshot & Golden Baseline** |
| **Investigasi Crash & Konflik** | ❌ Coba-coba uji mod satu per satu | ⚠️ Pembaca log teks mentah | ✅ **Binary search $O(\log_2 N)$ & Regex analyzer** |
| **Proteksi Berkas Aktif (Anti-Lock)** | ❌ Rawan korupsi `EBUSY` saat game aktif | ⚠️ Peringatan dialog standar | ✅ **Process Guard `javaw.exe` & atomic write** |
| **Pilihan Antarmuka** | Hanya File Manager | Hanya Desktop GUI | ✅ **Desktop GUI, Nordic TUI, & Direct CLI** |
| **Dukungan Otomasi & CI/CD** | ❌ Tidak dapat diskrip | ❌ Tidak ada antarmuka baris perintah | ✅ **Headless CLI flags & format `--json`** |

---

## 🚀 Instalasi & Memulai Cepat

### Opsi 1: Aplikasi Desktop Windows Mandiri (`.exe`)
Untuk pengguna yang menginginkan antarmuka grafis tanpa perlu memasang Node.js:
1. Unduh installer resmi dari halaman **[GitHub Releases](https://github.com/2Hafast8/LoadModer/releases)**:
   * **`LoadModer-Setup-2.11.0.exe`**: Setup installer lengkap dengan desktop shortcut dan auto-updater.
   * **`LoadModer-2.11.0-Portable.exe`**: Versi portabel, langsung jalan tanpa instalasi.
2. Jalankan aplikasi, pilih instance Minecraft yang terdeteksi, dan mulai kelola mod Anda.

### Opsi 2: Instalasi Global via NPM (CLI & TUI)
Bagi pengguna terminal, server administrator, atau developer:

```bash
# Instalasi global agar perintah "lm" dan "loadmoder" aktif di sistem:
npm install -g loadmoder

# Atau jalankan instan tanpa instalasi permanen:
npx loadmoder
```

### Opsi 3: Pemasangan dari Sumber (Development Mode)
```bash
# 1. Clone repository
git clone https://github.com/2Hafast8/LoadModer.git
cd LoadModer

# 2. Instal seluruh dependensi
npm ci

# 3. Kompilasi bundle CLI & Desktop
npm run build:all

# 4. Jalankan Desktop GUI
npm run desktop

# Atau jalankan TUI Dashboard
npm run dev
```

---

## 🛠️ Ringkasan Perintah CLI

Semua operasi dapat dijalankan melalui perintah `lm` atau `loadmoder`:

```text
Usage: lm [options] [command]

High-performance Minecraft mod & modpack manager CLI

Commands:
  home | lm                      Buka TUI Dashboard interaktif
  init                           Pindai launcher dan tentukan instance target
  search <query>                 Cari konten di Modrinth dengan filter
  install <targets...>           Pasang mod, berkas .mrpack, atau file lokal
  list                           Tampilkan tabel status mod, kapasitas, dan lockfile
  update                         Periksa dan perbarui mod ke versi kompatibel
  remove <slugs...>              Hapus mod beserta dependensi yatim (--prune)
  enable <mod>                   Aktifkan mod (.jar.disabled -> .jar)
  disable <mod>                  Nonaktifkan mod (.jar -> .jar.disabled)
  toggle <mod>                   Beralih status aktif/nonaktif mod
  diagnose                       Pindai berkas log dan analisis mod penyebab crash
  bisect <start|good|bad|reset>  Lacak mod penyebab crash dengan binary search
  modpack <action>               Kelola profil modpack terisolasi (list|switch|disable)
  profile <action>               Kelola snapshot versi game (list|switch)
  watch                          Pantau folder mods secara real-time
  config <show|set|get|path>     Kelola konfigurasi instance aktif
```

### Contoh Penggunaan Nyata:

```bash
# Mencari mod Sodium untuk Fabric 1.21.1:
lm search sodium -t mod -l fabric -v 1.21.1

# Memasang Fabric API dan Iris Shader beserta seluruh dependensinya:
lm install fabric-api iris

# Memperbarui seluruh mod terpasang secara otomatis:
lm update -y

# Menghapus mod beserta pustaka dependensi yang tidak lagi digunakan:
lm remove iris --prune

# Mendiagnosis penyebab crash dari berkas crash-reports:
lm diagnose

# Mengisolasi mod penyebab crash menggunakan pencarian biner otomatis:
lm bisect start
lm bisect bad
lm bisect good
```

---

## 🏗️ Arsitektur Sistem

LoadModer mengadopsi prinsip pemisahan domain murni (*Domain-Driven Decoupling*). Modul logika domain di `src/core/` terisolasi sepenuhnya dari dependensi visual/UI sehingga dapat diuji secara deterministik.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER (MULTI-INTERFACE)                 │
│  Desktop GUI (Electron 32 + React 19) │ Interactive TUI Dashboard (lm) │
│  Commander CLI Router (Direct Args)   │ IPC Preload Security Gateway   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    APPLICATION / ORCHESTRATION LAYER                   │
│   Install Orchestrator │ Update Engine │ Bisect Runner │ Watch Engine  │
│   Local Archive Router │ Log Analyzer  │ Modpack Export Coordinator    │
└───────────────────┬───────────────────────────────┬────────────────────┘
                    │                               │
┌───────────────────▼───────────────┐   ┌───────────▼────────────────────┐
│        CORE DOMAIN ENGINES        │   │    INSTANCE & STATE DOMAIN     │
│ • Modpack Engine (Unpack/Export)  │   │ • Launcher Auto-Discovery      │
│ • Dependency Resolver & DAG Graph │   │ • Lockfile Manager (.lock.json)│
│ • Dynamic Minecraft Versions API  │   │ • Profile Snapshot Manager     │
│ • Environment Filter (Client/Srv) │   │ • Mod Disabler (.disabled)     │
│ • Local File Drag-Drop Installer  │   │ • Crash Log Pattern Analyzer   │
└───────────────────┬───────────────┘   └───────────┬────────────────────┘
                    │                               │
┌───────────────────▼───────────────────────────────▼────────────────────┐
│                  INFRASTRUCTURE & ADAPTER LAYER                        │
│   Modrinth API Client (v2) │ Parallel Download Pool │ Streaming Crypto │
│   (Node:Fetch + RateLimit) │ (p-limit Concurrency)  │ (Node:Crypto)    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Variabel Lingkungan

| Variabel | Deskripsi | Nilai Default |
| :--- | :--- | :--- |
| `LOADMODER_HOME` | Menentukan lokasi folder konfigurasi dan penyimpanan profil global | `~/.loadmoder` |
| `LOADMODER_CONTACT` | Informasi kontak pengembang yang disertakan pada header `User-Agent` HTTP ke Modrinth | Kosong |
| `MODRINTH_API_URL` | Menimpa base endpoint API Modrinth (misal: pengujian staging API) | `https://api.modrinth.com/v2` |
| `NO_COLOR` | Menonaktifkan format warna terminal sesuai standar open-source | `0` / Tidak aktif |
| `ACCESSIBLE` | Mode aksesibilitas terminal (WCAG AA & preservasi scrollback buffer) | `false` |

---

## 📚 Dokumentasi Teknis

Dokumentasi arsitektur, panduan teknis, dan spesifikasi antarmuka tersedia di folder [`docs/`](docs/README.md):

* [**01. Arsitektur dan Visi Sistem**](docs/01-architecture-and-vision.md): Struktur berlapis, alur data end-to-end, dan tata kelola kuota API.
* [**02. Kurasi Tech Stack**](docs/02-tech-stack-and-libraries.md): Pemilihan dependensi runtime CLI dan Desktop GUI (Electron 32, React 19, Vite, Tailwind CSS).
* [**03. Spesifikasi Perintah & UX**](docs/03-cli-commands-and-ux.md): Rincian opsi flag global, peluncuran desktop, dan tata letak Nordic TUI.
* [**04. Mesin Modpack (.mrpack Engine)**](docs/04-modpack-engine.md): Ekstraksi streaming, Zod parsing, isolasi wadah, dan ekspor modpack.
* [**05. Integrasi Multi-Launcher**](docs/05-multi-launcher-integration.md): Spesifikasi auto-discovery Vanilla, Prism, MultiMC, Modrinth, CurseForge, TLauncher, dan Legacy Launcher.
* [**06. Dependency Graph & Lockfile**](docs/06-dependency-graph-and-lockfile.md): Resolusi dependensi otomatis, Directed Acyclic Graph (DAG), dan reference counting.
* [**07. Diagnostik Crash & Bisect Engine**](docs/07-troubleshooting-and-bisect.md): Algoritma pencarian biner isolasi crash dan Crash Log Pattern Analyzer.
* [**08. Panduan Pengembang & Binary Build**](docs/08-developer-guide-and-api.md): Struktur proyek, pengujian Vitest, kompilasi bundle, dan packaging NSIS Windows.
* [**09. Spesifikasi Desain UI/UX (Nordic Clean)**](docs/09-ui-ux-design-specification.md): Palet warna Nordic Clean, aksesibilitas WCAG AA, dan arsitektur komponen visual.
* [**C4 Architecture Model**](docs/c4-architecture.md): Dokumentasi C4 resmi (System Context, Container, Component, dan Data Flow Diagram).
* [**Katalog Agent Skills**](docs/SKILL.md): Indeks 18 skill agen yang memandu kualitas kode dan standar rekayasa perangkat lunak.

---

## 🧪 Pengujian & Jaminan Mutu

LoadModer mengedepankan keandalan tinggi dengan cakupan pengujian unit dan integrasi yang komprehensif:

```bash
# 1. Validasi tipe statis TypeScript (0 errors)
npx tsc --noEmit

# 2. Eksekusi seluruh rangkaian pengujian unit & integrasi
npm test

# 3. Validasi bundle distribusi produksi
npm run build
```

**Metrik Pengujian Terverifikasi:**
* **42 Test Files** lulus 100%
* **297 Tests** lulus 100%
* **Cakupan Pengujian**: Dependency Resolver DAG, Orphan Pruner, Drive Scanner Multi-Partition, Multi-Launcher Signatures, Legacy Dual-Path Isolation, TLauncher Profile Vault, Crash Log Analyzer, Bisect Binary Engine, Local Drag-and-Drop Archive Inspector, Process Guard Windows, dan Desktop IPC Security Gateway.

---

## 📄 Lisensi & Kontribusi

Proyek ini didistribusikan di bawah lisensi terbuka [MIT](LICENSE).

Dikembangkan oleh **[Hafiz Noval Rianto](https://github.com/2Hafast8)**. Kontribusi berupa pelaporan isu, saran fitur, dan pull request selalu disambut dengan hangat melalui [GitHub Issues](https://github.com/2Hafast8/LoadModer/issues).
