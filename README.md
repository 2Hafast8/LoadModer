# 📦 LoadModer (`lm`)

> **CLI, TUI, dan Desktop GUI package manager untuk mod, modpack (.mrpack), shader, dan resource pack Minecraft berbasis Modrinth API v2.**  
> Ditulis menggunakan TypeScript (ESM) dengan arsitektur DAG dependency resolution, isolasi profil snapshot, pendeteksi multi-launcher otomatis, dan distribusi standalone Windows executable (`.exe`).

[![Version](https://img.shields.io/badge/version-2.9.0-38bdf8.svg)](package.json)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-38bdf8.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6.svg)](https://www.typescriptlang.org/)
[![CI](https://github.com/2Hafast8/LoadModer/actions/workflows/ci.yml/badge.svg)](https://github.com/2Hafast8/LoadModer/actions/workflows/ci.yml)
[![Vitest](https://img.shields.io/badge/tests-281%20passed-34d399.svg)](https://vitest.dev/)
[![License](https://img.shields.io/badge/license-MIT-34d399.svg)](LICENSE)
[![Modrinth API](https://img.shields.io/badge/API-Modrinth%20v2-00af5c.svg)](https://docs.modrinth.com/api-spec/)
[![Releases](https://img.shields.io/github/v/release/2Hafast8/LoadModer?color=a855f7&label=Windows%20App)](https://github.com/2Hafast8/LoadModer/releases)

---

## ⚡ Fitur Utama

* **🛡️ Anti-File Lock & Process Guard (v2.9.0)**:
  - Deteksi otomatis proses aktif game Minecraft (`javaw.exe`, `java.exe`, `minecraft`) sebelum operasi file disk dieksekusi.
  - Memblokir perpindahan profil/mode, toggle status mod, penghapusan mod, dan instalasi jika game sedang terbuka guna mencegah korupsi data disk dan error `EBUSY`/`EPERM`.
* **🎨 Official App Branding & Logo Integration (v2.9.0)**:
  - Integrasi icon dan logo resmi LoadModer pada executable Windows installer, taskbar & window frame Electron, browser renderer favicon, dan TopBar navigasi aplikasi.
* **🔄 Native In-App Auto Updater (Desktop & CLI)**:
  - **Pemeriksaan Otomatis GitHub Releases**: Aplikasi secara otomatis mengecek rilis resmi GitHub saat diluncurkan secara asinkron tanpa memperlambat startup.
  - **Modal Pembaruan Interaktif**: Tampilan catatan rilis (changelog markdown), bilah unduhan berkecepatan tinggi dengan estimasi kecepatan (MB/s), verifikasi integritas checksum SHA-256 otomatis sebelum instalasi, tombol "Buka Folder Unduhan" untuk versi Portable, serta petunjuk ramah Windows SmartScreen.
  - **1-Click Auto Install & Restart**: Menjalankan installer Windows (`.exe`) secara aman dan menutup aplikasi lama dengan mulus.
  - **TopBar Badge & Manual Trigger**: Badge berkilau `✨ vX.Y.Z` saat ada pembaruan dan tombol klik untuk cek manual sewaktu-waktu.
  - **Terminal Update Notifier**: Notifikasi non-blocking saat menggunakan CLI jika versi npm terbaru telah tersedia.
* **🔒 Operation Loading Overlay (Screen Lock Guard)**:
  - Pelindung layar penuh selama proses berat (perpindahan mode, simpan profil, disable modpack, restore baseline) dengan timer keselamatan darurat 45 detik (*Emergency Unlock*) dan kontrol jendela yang tetap dapat diakses.
* **📦 Launcher Mode Card Grid & 6-Item Pagination**:
  - Antarmuka kartu wadah modpack responsif (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) dengan badge loader berwarna, versi Minecraft, status aktif, dan filter pencarian real-time.
  - Sistem paginasi 6 item per halaman pada Saved Modpack Containers dan Profile Versions.
* **💾 TL-Mods Manual Profile Save & Clean State Auto-Healing**:
  - Pencadangan instan profil modpack TL-Mods dan auto-healing status profil aktif ketika folder wadah dalam kondisi bersih dari mod.
* **🖥️ Standalone Windows Desktop GUI & Drag-and-Drop Installer**:
  - **Aplikasi Windows Mandiri (.exe)**: Tersedia dalam bentuk **NSIS Setup Wizard** (`LoadModer-Setup-2.9.0.exe`) dan **Portable Executable** (`LoadModer-2.9.0-Portable.exe`) di [GitHub Releases](https://github.com/2Hafast8/LoadModer/releases).
  - **Drag-and-Drop Installer**: Cukup seret dan lepaskan berkas `.jar`, `.mrpack`, atau `.zip` ke jendela aplikasi untuk langsung memasangnya ke instance aktif.
  - **Smart Archive Inspection**: Secara otomatis membedakan apakah berkas ZIP adalah Shaderpack (folder `shaders/`), Resourcepack (`pack.mcmeta`), atau Modpack (`modrinth.index.json`).
  - **Bilingual Interface**: Dukungan penuh bahasa Indonesia dan bahasa Inggris dengan peralihan instan.
  - **Diagnostics & Modpack Exporter GUI**: Visualisasi Bisect binary search, Crash Log Analyzer, Restore Points Panel, dan ekspor modpack ke `.mrpack`/`.zip`.
* **🩺 CLI Diagnostics Parity & Crash Log Analyzer (`lm diagnose`)**:
  - Perintah CLI mandiri untuk memindai berkas log dan crash report secara otomatis, mendeteksi mod penyebab crash, missing dependencies, dan rekomendasi solusi cepat.
* **⚡ Bulk Updates & Enhanced Explore Navigation**:
  - Pembaruan serentak semua mod ("Update All") dengan resolusi dependensi otomatis.
  - Toolbar jelajah 2-tingkat dengan selector versi, loader, filter dinamis, dan sistem paginasi responsif hingga 4 kolom grid.
* **👑 Official Minecraft Vanilla Priority & Koeksistensi Aditif**:
  - Menetapkan Official Minecraft (`vanilla-default`) sebagai launcher resmi standar saat inisialisasi awal.
  - Pengenalan pintar wadah bersama `%APPDATA%\.minecraft` (memprioritaskan file executable/profil TLauncher sebelum mengasumsikan instalasi resmi Mojang).
  - Kebijakan aditif murni: penambahan launcher baru tidak akan pernah menimpa atau menghapus konfigurasi instance yang sudah disimpan pengguna di `config.json`.
* **🎯 Operasi Multi-Interface (Desktop GUI, Nordic Clean TUI & Direct CLI)**:
  - **Desktop GUI**: Antarmuka visual native Windows berbasis Electron 32 dan React 19 dengan live updates.
  - **Interactive TUI Dashboard**: Header adaptif Figlet ASCII + 4-line Nordic Cyber Status Box, Live Badges navigasi instan, dan kontrol keyboard panah (`↑`/`↓` atau `j`/`k`).
  - **Direct CLI**: Jalankan `lm install`, `lm search`, `lm update` langsung dengan flag dan argumen untuk skrip otomasi maupun terminal.
* **🏰 Legacy Launcher Dual-Path Modpack Architecture**:
  - **Pemisahan Engine & Wadah**: Engine jar & json disimpan di `game/versions/<version>/`, sedangkan modpack dan mods diisolasi di `game/home/<profile>/mods`.
  - **Auto-Sync tl.properties**: Membaca profil aktif dari konfigurasi launcher Legacy secara otomatis.
* **🛡️ One-Time Golden Baseline Snapshot & Permanent Restore**:
  - **Pencadangan Satu Kali (`.loadmoder/baseline/`)**: Mengunci setelan dasar dan konfigurasi awal launcher (`options.txt`, dsb.) sebelum modpack pertama dipasang.
  - **Restorasi Bersih Permanen (Zero-Delete Policy)**: Saat modpack dinonaktifkan (`lm modpack disable` / Clean State), setelan asli pemain langsung dipulihkan dari master baseline yang tersimpan permanen.
* **🚫 Zero-Overwrite Active Modpack Guard**:
  - Menghapus fitur penimpaan langsung saat modpack aktif untuk mencegah tabrakan berkas.
  - Pilihan tegas: `❌ Cancel` (batalkan tanpa sentuh disk) atau `🧹 Clean Install` (arsipkan modpack aktif ke brankas profil `.loadmoder/profiles/<id>`, bersihkan live files, pasang modpack baru secara bersih).
* **📦 TLauncher Modpack Profile Vault & Multi-Client Isolation**:
  - **Wadah Client Terisolasi**: Pemisahan wadah client TLauncher per loader (`fabric`, `forge`) dan versi game.
  - **Brankas Profil Lokal (`.loadmoder/profiles/`)**: Beralih antar-modpack secara instan tanpa unduh ulang (`lm modpack switch`).
  - **Clean State & Global Disable**: Mengarsipkan seluruh modpack aktif ke brankas dan membersihkan wadah kerja kembali ke kondisi Vanilla awal (`lm modpack disable`).
* **🏷️ Browser Cepat & Horizontal Filter Chips**:
  - Filter chip bar 2 baris ringkas menggantikan tabel vertikal, menampilkan hasil pencarian pertama langsung di layar tanpa scroll.
* **⚡ Validasi Status Terpasang Konkuren**:
  - Pengecekan paralel aset terpasang (via `loadmoder.lock.json` dan pemindaian disk) saat proses pencarian berlangsung (`lm search` dan TUI Browser) tanpa latensi tambahan.
* **🗃️ Mod Manager Canggih (Segmented Tabs & Batch Operations)**:
  - Tab segmen status: `● Semua Mod`, `✔ Aktif`, `○ Nonaktif`, dan pengukur kapasitas penyimpanan (*storage gauge*).
  - Operasi massal (*batch toggle*) untuk mengaktifkan, menonaktifkan, atau menghapus banyak mod sekaligus dalam satu aksi.
* **♿ Aksesibilitas Penuh (WCAG 2.2 AA & `NO_COLOR`)**:
  - Seluruh token warna memenuhi rasio kontras $\ge 4.5:1$ pada dark mode maupun light mode.
  - Standar `NO_COLOR` dan mode `ACCESSIBLE=true` (preservasi buffer *scrollback* terminal).
* **🎮 Multi-Drive Launcher Locator**:
  - Mendeteksi launcher pihak ketiga (Prism, MultiMC, Modrinth App, CurseForge, TLauncher, Vanilla) di seluruh partisi drive Windows (`C:`, `D:`, `E:`, dll.) secara otomatis.
* **🧩 Resolusi Dependensi Otomatis & Lockfile DAG**:
  - Membaca dependensi wajib dari metadata API Modrinth dan membuat Directed Acyclic Graph (DAG) di `loadmoder.lock.json`.
  - Pelacakan referensi (`dependedBy`) dan pembersihan otomatis dependensi yatim (*orphan pruning*) saat mod induk dihapus via `lm remove --prune`.
* **🌐 Versi Minecraft Dinamis**:
  - Mengambil daftar versi resmi Minecraft ($\ge$ 1.16) langsung dari Modrinth API dengan cache lokal (TTL 1 jam) dan fallback offline.
* **💾 Isolasi Profil & Snapshot**:
  - Menyimpan file mod per versi game dan loader ke snapshot lokal (`.loadmoder/snapshots/`), mencegah bentrok file saat berganti konfigurasi via `lm profile switch`.
* **👀 Pemantau Folder Real-Time (`lm watch`)**:
  - Memantau folder `mods/` menggunakan Node.js native `fs.watch` dengan debouncing untuk mendeteksi penambahan, penghapusan, atau perubahan nama file manual.
* **🩺 Diagnostik Crash ($O(\log_2 N)$) & Crash Log Analyzer**:
  - Melacak mod penyebab crash menggunakan algoritma pencarian biner otomatis (`lm bisect`) dan pemindai crash log regex.

---

## 🚀 Panduan Memulai

### Prasyarat
- **Node.js**: Versi `20.0.0` atau lebih baru.
- **npm**: Bawaan Node.js.

### 1. Unduh Aplikasi Desktop Windows Mandiri (.exe)
Bagi pengguna yang menginginkan tampilan grafis tanpa perlu instalasi Node.js:
- Kunjungi halaman **[LoadModer Releases](https://github.com/2Hafast8/LoadModer/releases)**.
- Unduh **`LoadModer-Setup-2.7.0.exe`** untuk instalasi dengan wizard desktop shortcut, atau
- Unduh **`LoadModer-2.7.0-Portable.exe`** untuk menjalankan aplikasi langsung tanpa instalasi.

### 2. Instalasi CLI via NPM
```bash
# Instalasi global agar perintah "lm" dan "loadmoder" langsung aktif di terminal:
npm install -g loadmoder

# Atau jalankan langsung tanpa instalasi:
npx loadmoder
```

### 3. Pemasangan dari Sumber & Mode Developer
```bash
# Clone repository
git clone https://github.com/2Hafast8/LoadModer.git
cd LoadModer

# Instal dependensi & build seluruh bundle
npm ci
npm run build:all

# Jalankan Desktop GUI (otomatis rebuild & sinkronisasi)
npm run desktop

# Atau jalankan TUI Dashboard
npm run dev
```

---

## 🛠️ Ringkasan Perintah CLI

| Perintah | Deskripsi | Contoh Penggunaan |
| :--- | :--- | :--- |
| `lm` / `lm home` | Membuka Dashboard TUI interaktif dengan navigasi keyboard | `lm` |
| `lm init` | Memindai launcher Minecraft dan menentukan instance target | `lm init` |
| `lm search <query>` | Mencari konten di Modrinth dengan filter | `lm search sodium -t mod -l fabric -v 1.21.1` |
| `lm install <targets...>` | Memasang mod, file `.mrpack`, atau link Modrinth beserta dependensinya | `lm install sodium iris fabric-api` |
| `lm list` | Menampilkan tabel status mod, ukuran berkas, dan relasi lockfile | `lm list` |
| `lm update` | Memeriksa dan memperbarui mod ke versi rilis yang kompatibel | `lm update -y` |
| `lm remove <slug...>` | Menghapus mod beserta dependensi yatim | `lm remove iris --prune` |
| `lm enable <mod>` | Mengaktifkan mod yang dinonaktifkan (`.jar.disabled` -> `.jar`) | `lm enable sodium` |
| `lm disable <mod>` | Menonaktifkan mod tanpa menghapus file (`.jar` -> `.jar.disabled`) | `lm disable sodium` |
| `lm bisect <action>` | Pencarian biner isolasi mod penyebab crash (`start` \| `good` \| `bad` \| `reset`) | `lm bisect start` |
| `lm watch` | Memantau folder mods secara real-time dan menyinkronkan data | `lm watch` |
| `lm modpack <action>` | Mengelola profil modpack terisolasi (`list` \| `switch` \| `disable`) | `lm modpack switch zombie-apocalypse` |
| `lm profile <action>` | Mengelola snapshot profil versi game (`list` \| `switch`) | `lm profile switch -v 1.21.1 -l fabric` |
| `lm config <action>` | Menampilkan atau mengatur konfigurasi instance aktif | `lm config show` |

---

## ⚙️ Variabel Lingkungan (Environment Variables)

| Variabel | Deskripsi | Nilai Bawaan |
| :--- | :--- | :--- |
| `LOADMODER_HOME` | Menentukan lokasi folder konfigurasi global | `~/.loadmoder` |
| `LOADMODER_CONTACT` | Informasi kontak (email/URL) yang disertakan pada header `User-Agent` HTTP ke Modrinth | Kosong |
| `MODRINTH_API_URL` | Menimpa base endpoint API Modrinth (misal: staging API) | `https://api.modrinth.com/v2` |

---

## 🏗️ Arsitektur Sistem

```
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
│   Modrinth API Client (v2) │ Parallel Download Pool │ Streaming Crypto│
│   (Node:Fetch + RateLimit) │ (p-limit Concurrency)  │ (Node:Crypto)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📚 Dokumentasi Teknis

Dokumentasi arsitektur dan spesifikasi lengkap tersedia di folder [`docs/`](docs/README.md):

* [**01. Arsitektur dan Visi Sistem**](docs/01-architecture-and-vision.md): Struktur berlapis, alur data end-to-end, Desktop GUI subsystem, dan tata kelola kuota API.
* [**02. Kurasi Tech Stack dan Pustaka**](docs/02-tech-stack-and-libraries.md): Pemilihan pustaka runtime CLI dan Desktop GUI (Electron 32, React 19, Vite, Tailwind CSS, electron-builder).
* [**03. Spesifikasi Perintah dan UX LoadModer**](docs/03-cli-commands-and-ux.md): Detail opsi perintah, flag global, peluncuran desktop, dan tata letak visual TUI.
* [**04. Mesin Modpack (.mrpack Engine)**](docs/04-modpack-engine.md): Parsing spesifikasi `.mrpack`, ekstraksi streaming, ekspor modpack, brankas profil modpack, dan isolasi wadah.
* [**05. Integrasi Multi-Launcher**](docs/05-multi-launcher-integration.md): Auto-discovery Official Vanilla, Prism, MultiMC, Modrinth App, CurseForge, TLauncher, dan Legacy Launcher.
* [**06. Dependency Graph dan Lockfile**](docs/06-dependency-graph-and-lockfile.md): Resolusi dependensi otomatis, Directed Acyclic Graph (DAG), dan reference counting.
* [**07. Diagnostik Crash dan Bisect Engine**](docs/07-troubleshooting-and-bisect.md): Algoritma pencarian biner isolasi crash, toggle status mod, dan Crash Log Analyzer.
* [**08. Panduan Pengembang dan Distribusi Binary**](docs/08-developer-guide-and-api.md): Struktur direktori lengkap, pengujian Vitest, kompilasi bundle, dan packaging Windows standalone `.exe`.
* [**09. Spesifikasi Desain UI/UX (Nordic Clean)**](docs/09-ui-ux-design-specification.md): Filosofi visual, palet warna, aksesibilitas WCAG AA, dan arsitektur komponen TUI & Desktop.
* [**C4 Architecture Specification**](docs/c4-architecture.md): Dokumentasi C4 Model resmi (System Context, Container, Component, dan Code Data Flow) untuk subsistem CLI dan Desktop.
* [**Katalog Agent Skills**](docs/SKILL.md): Indeks 18 skill agen yang memandu kualitas kode dan standar arsitektur.

---

## 🧪 Pengujian & Type Checking

```bash
# Validasi tipe TypeScript
npx tsc --noEmit

# Eksekusi seluruh test suite unit & integrasi
npm test

# Mode watch interaktif Vitest
npx vitest
```

**Hasil Pengujian:**
- 35 test files lulus (100%)
- 257 unit & integration tests lulus (100%)
- Cakupan: Dependency Graph, Resolver, Drive Scanner, Multi-Launcher Detection, Legacy Launcher Dual-Path, TLauncher Profile Vault, Log Analyzer, Bisect Runner, Diagnostics CLI, Modpack Exporter, Local Installer, Desktop Dual-Mode IPC, Desktop I18n, UI Theme & Accessibility.

---

## 📄 Lisensi

Didistribusikan di bawah lisensi [MIT](LICENSE).
