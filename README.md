# 📦 LoadModer (`lm`)

> **CLI & TUI package manager untuk mod, modpack (.mrpack), shader, dan resource pack Minecraft berbasis Modrinth API v2.**  
> Ditulis menggunakan TypeScript (ESM) dengan arsitektur DAG dependency resolution, isolasi profil snapshot, dan pendeteksi multi-launcher otomatis.

[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-38bdf8.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6.svg)](https://www.typescriptlang.org/)
[![CI](https://github.com/2Hafast8/LoadModer/actions/workflows/ci.yml/badge.svg)](https://github.com/2Hafast8/LoadModer/actions/workflows/ci.yml)
[![Vitest](https://img.shields.io/badge/tests-157%20passed-34d399.svg)](https://vitest.dev/)
[![License](https://img.shields.io/badge/license-MIT-34d399.svg)](LICENSE)
[![Modrinth API](https://img.shields.io/badge/API-Modrinth%20v2-00af5c.svg)](https://docs.modrinth.com/api-spec/)

---

## ⚡ Fitur Utama

* **🎯 Operasi Dual-Mode (Nordic Clean TUI & Direct CLI)**:
  - **Interactive TUI Dashboard**: Header adaptif Figlet ASCII + 4-line Nordic Cyber Status Box, Live Badges navigasi instan, dan kontrol keyboard panah (`↑`/`↓` atau `j`/`k`).
  - **Direct CLI**: Jalankan `lm install`, `lm search`, `lm update` langsung dengan flag dan argumen untuk skrip otomasi maupun terminal.
* **📦 TLauncher Modpack Profile Vault & Multi-Client Isolation**:
  - **Wadah Client Terisolasi**: Pemisahan wadah client TLauncher per loader (`fabric`, `forge`) dan versi game (misal: `mypack(fabric)`, `mypack(forge)`, `mypack(fabric-1.21)`).
  - **Brankas Profil Lokal (`.loadmoder/profiles/`)**: Beralih antar-modpack secara instan tanpa unduh ulang (`lm modpack switch`).
  - **Active Modpack Download Guard**: Mencegah tumpang tindih profil aktif saat memasang modpack baru dengan pilihan *Jangan download (batal)* atau *Download & bersihkan wadah*.
  - **Clean State & Global Disable**: Mengarsipkan seluruh modpack aktif ke brankas dan membersihkan wadah kerja kembali ke kondisi Vanilla awal (`lm modpack disable`).
  - **Panduan Terintegrasi TLauncher**: Menu panduan interaktif pembuatan wadah client di TLauncher via menu **TL MODS** -> **Create**.
* **🏷️ Browser Cepat & Horizontal Filter Chips**:
  - Filter chip bar 2 baris ringkas menggantikan tabel vertikal, menampilkan hasil pencarian pertama langsung di layar tanpa scroll.
* **⚡ Validasi Status Terpasang Konkuren**:
  - Pengecekan paralel aset terpasang (via `loadmoder.lock.json` dan pemindaian disk) saat proses pencarian berlangsung (`lm search` dan TUI Browser) tanpa latensi tambahan.
  - Kartu rincian mod menampilkan status akurat: `✔ Terpasang (Aktif)`, `○ Terpasang (Nonaktif)`, atau `🌐 Belum Terpasang (Modrinth)` beserta perbandingan versi lokal vs rilis terbaru.
* **🗃️ Mod Manager Canggih (Segmented Tabs & Batch Operations)**:
  - Tab segmen status: `● Semua Mod`, `✔ Aktif`, `○ Nonaktif`, dan pengukur kapasitas penyimpanan (*storage gauge*).
  - Operasi massal (*batch toggle*) untuk mengaktifkan, menonaktifkan, atau menghapus banyak mod sekaligus dalam satu aksi.
* **♿ Aksesibilitas Penuh (WCAG 2.2 AA & `NO_COLOR`)**:
  - Seluruh token warna memenuhi rasio kontras $\ge 4.5:1$ pada dark mode maupun light mode.
  - Standar `NO_COLOR` dan mode `ACCESSIBLE=true` (preservasi buffer *scrollback* terminal).
  - Indikator ganda berbasis simbol teks (`✔`, `○`, `🌐`, `●`, `▲`, `✖`), tidak pernah mengandalkan warna semata.
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
* **🩺 Diagnostik Crash ($O(\log_2 N)$)**:
  - Melacak mod penyebab crash menggunakan algoritma pencarian biner otomatis (`lm bisect`).

---

## 🚀 Panduan Memulai

### Prasyarat
- **Node.js**: Versi `20.0.0` atau lebih baru.
- **npm**: Bawaan Node.js.

### 1. Pemasangan & Kompilasi
```bash
# Clone repository
git clone https://github.com/2Hafast8/LoadModer.git
cd LoadModer

# Instal dependensi
npm ci

# Kompilasi bundle
npm run build

# Daftarkan binary "lm" dan "loadmoder" secara global
npm link
```

### 2. Jalankan Dashboard
```bash
lm
```
*Atau gunakan alias:* `loadmoder`

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
| `lm enable <mod>` | Mengaktifkan mod yang dinonaktifkan (`.jar.disabled` $\rightarrow$ `.jar`) | `lm enable sodium` |
| `lm disable <mod>` | Menonaktifkan mod tanpa menghapus file (`.jar` $\rightarrow$ `.jar.disabled`) | `lm disable sodium` |
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
│                   PRESENTATION LAYER (CLI & DUAL UX)                   │
│  Interactive TUI Dashboard (Home) │ Commander Router (CLI Commands)    │
│  Keyboard Navigation (@inquirer)  │ Figlet & Nordic Clean Theme        │
│  Boxen Cards & Metadata           │ Cli-Table3 Border Tables           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    APPLICATION / ORCHESTRATION LAYER                   │
│   Install Orchestrator │ Update Engine │ Bisect Runner │ Watch Engine  │
└───────────────────┬───────────────────────────────┬────────────────────┘
                    │                               │
┌───────────────────▼───────────────┐   ┌───────────▼────────────────────┐
│        CORE DOMAIN ENGINES        │   │    INSTANCE & STATE DOMAIN     │
│ • Modpack Engine (.mrpack unpack) │   │ • Launcher Auto-Discovery      │
│ • Modpack Profile Vault & Manager │   │ • Lockfile Manager (.lock.json)│
│ • Dependency Resolver & DAG Graph │   │ • Profile Snapshot Manager     │
│ • Dynamic Minecraft Versions API  │   │ • Mod Disabler (.disabled)     │
│ • Environment Filter (Client/Srv) │   │ • Multi-Drive Path Resolver    │
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

* [**01. Arsitektur & Visi Sistem**](docs/01-architecture-and-vision.md) — Struktur berlapis, alur data end-to-end, dan tata kelola kuota API.
* [**02. Kurasi Tech Stack & Pustaka**](docs/02-tech-stack-and-libraries.md) — Pemilihan pustaka runtime, performa cold-start, dan batasan konkurensi.
* [**03. Spesifikasi Perintah & UX CLI**](docs/03-cli-commands-and-ux.md) — Detail opsi perintah, flag global, perintah `lm modpack`, dan tata letak visual TUI.
* [**04. Mesin Modpack (.mrpack Engine) & Profile Vault**](docs/04-modpack-engine.md) — Parsing spesifikasi `.mrpack`, ekstraksi streaming, brankas profil modpack, dan isolasi wadah TLauncher.
* [**05. Integrasi Multi-Launcher & TLauncher**](docs/05-multi-launcher-integration.md) — Auto-discovery Prism, MultiMC, Modrinth App, CurseForge, Vanilla, dan wadah TLauncher.
* [**06. Dependency Graph & Lockfile**](docs/06-dependency-graph-and-lockfile.md) — Resolusi dependensi otomatis, Directed Acyclic Graph, dan reference counting.
* [**07. Diagnostik Crash & Bisect Engine**](docs/07-troubleshooting-and-bisect.md) — Algoritma pencarian biner isolasi crash dan toggle status mod.
* [**08. Panduan Pengembang & API**](docs/08-developer-guide-and-api.md) — Struktur berkas, alur pengujian, variabel lingkungan, dan kompilasi.
* [**09. Spesifikasi Desain UI/UX (Nordic Clean TUI)**](docs/09-ui-ux-design-specification.md) — Filosofi visual, palet warna, aksesibilitas WCAG AA, dan arsitektur TUI.
* [**Cetak Biru Arsitektur LoadModer**](docs/LOADMODER_ARCHITECTURE.md) — Spesifikasi platform menyeluruh dan pilar rekayasa sistem.
* [**Katalog Agent Skills**](docs/SKILL.md) — Indeks 18 skill agen yang memandu kualitas kode dan standar arsitektur.

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
- `tests/installedIndex.test.ts` (5 tests)
- `tests/dependencyGraph.test.ts` (8 tests)
- `tests/dependencyResolver.test.ts` (11 tests)
- `tests/driveScanner.test.ts` (29 tests)
- `tests/security.test.ts` (8 tests)
- `tests/minecraftVersions.test.ts` (10 tests)
- `tests/snapshotManager.test.ts` (3 tests)
- `tests/uiThemeA11y.test.ts` (22 tests)
- `tests/detailCard.test.ts` (5 tests)
- `tests/e2eUiFlow.test.ts` (2 tests)
- `tests/compatibility.test.ts` (5 tests)
- `tests/bisect.test.ts` (6 tests)
- `tests/architectureRefactor.test.ts` (6 tests)
- `tests/instanceConfig.test.ts` (4 tests)
- `tests/searchFilters.test.ts` (6 tests)
- `tests/performance.test.ts` (2 tests)
- `tests/instanceDetector.test.ts` (2 tests)
- `tests/modsWatcher.test.ts` (3 tests)
- `tests/cliJsonOutput.test.ts` (2 tests)
- `tests/crypto.test.ts` (3 tests)
- `tests/tlauncherModpackProfile.test.ts` (15 tests)
- **Total: 21 test files, 157 tests passed (100%)**.

---

## 📄 Lisensi

Didistribusikan di bawah lisensi [MIT](LICENSE).
