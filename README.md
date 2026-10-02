# 📦 LoadModer (`lm`)

> **CLI & TUI package manager untuk mod, modpack (.mrpack), shader, dan resource pack Minecraft berbasis Modrinth API v2.**  
> Ditulis menggunakan TypeScript (ESM) dengan arsitektur DAG dependency resolution, isolasi profil snapshot, dan pendeteksi multi-launcher otomatis.

[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-38bdf8.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6.svg)](https://www.typescriptlang.org/)
[![CI](https://github.com/2Hafast8/LoadModer/actions/workflows/ci.yml/badge.svg)](https://github.com/2Hafast8/LoadModer/actions/workflows/ci.yml)
[![Vitest](https://img.shields.io/badge/tests-91%20passed-34d399.svg)](https://vitest.dev/)
[![License](https://img.shields.io/badge/license-MIT-34d399.svg)](LICENSE)
[![Modrinth API](https://img.shields.io/badge/API-Modrinth%20v2-00af5c.svg)](https://docs.modrinth.com/api-spec/)

---

## ⚡ Fitur Utama

* **🎯 Operasi Dual-Mode**:
  - **Interactive TUI Dashboard**: Jalankan `lm` untuk navigasi keyboard panah (`↑`/`↓` atau `j`/`k`), filter cepat, dan penjelajah katalog.
  - **Direct CLI**: Jalankan `lm install`, `lm search`, `lm update` langsung dengan argumen dan flag untuk skrip otomatisasi maupun terminal.
* **🧩 Resolusi Dependensi Otomatis**:
  - Membaca dependensi wajib dari metadata API Modrinth dan parsing deskripsi mod.
  - Menyesuaikan versi Minecraft dan mod loader aktif, serta melewati file yang sudah terpasang di folder `mods/`.
* **🌐 Versi Minecraft Dinamis**:
  - Mengambil daftar versi resmi Minecraft ($\ge$ 1.16) langsung dari Modrinth API dengan cache lokal (TTL 1 jam) dan fallback offline.
* **🔍 Dukungan Multi-Konten**:
  - Mengelola **Mods** (`.jar`), **Modpacks** (`.mrpack`), **Shaders**, dan **Resource Packs**.
  - Filter berdasarkan versi game, mod loader, kategori, dan environment (`client`/`server`).
* **💾 Isolasi Profil & Snapshot**:
  - Menyimpan file mod per versi game dan loader ke snapshot lokal (`.loadmoder/snapshots/`), mencegah bentrok file saat berganti konfigurasi via `lm profile switch`.
* **👀 Pemantau Folder Real-Time (`lm watch`)**:
  - Memantau folder `mods/` menggunakan Node.js native `fs.watch` dengan debouncing untuk mendeteksi penambahan, penghapusan, atau perubahan nama file manual.
* **🔒 Lockfile & Graf Dependensi (`loadmoder.lock.json`)**:
  - Directed Acyclic Graph (DAG) dengan pelacakan referensi (`dependedBy`) dan pembersihan otomatis dependensi yatim (*orphan pruning*) saat mod induk dihapus via `lm remove --prune`.
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
│ • Dependency Resolver & DAG Graph │   │ • Lockfile Manager (.lock.json)│
│ • Dynamic Minecraft Versions API  │   │ • Profile Snapshot Manager     │
│ • Environment Filter (Client/Srv) │   │ • Mod Disabler (.disabled)     │
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
* [**03. Spesifikasi Perintah & UX CLI**](docs/03-cli-commands-and-ux.md) — Detail opsi perintah, flag global, dan tata letak visual TUI.
* [**04. Mesin Modpack (.mrpack Engine)**](docs/04-modpack-engine.md) — Parsing spesifikasi `.mrpack`, ekstraksi streaming, dan pemisahan overrides.
* [**05. Integrasi Multi-Launcher**](docs/05-multi-launcher-integration.md) — Auto-discovery Prism, MultiMC, Modrinth App, CurseForge, dan Vanilla.
* [**06. Dependency Graph & Lockfile**](docs/06-dependency-graph-and-lockfile.md) — Resolusi dependensi otomatis, Directed Acyclic Graph, dan reference counting.
* [**07. Diagnostik Crash & Bisect Engine**](docs/07-troubleshooting-and-bisect.md) — Algoritma pencarian biner isolasi crash dan toggle status mod.
* [**08. Panduan Pengembang & API**](docs/08-developer-guide-and-api.md) — Struktur berkas, alur pengujian, variabel lingkungan, dan kompilasi.
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
- `tests/dependencyResolver.test.ts` (11 tests)
- `tests/security.test.ts` (8 tests)
- `tests/dependencyGraph.test.ts` (8 tests)
- `tests/minecraftVersions.test.ts` (10 tests)
- `tests/snapshotManager.test.ts` (3 tests)
- `tests/uiThemeA11y.test.ts` (13 tests)
- `tests/compatibility.test.ts` (5 tests)
- `tests/bisect.test.ts` (6 tests)
- `tests/instanceConfig.test.ts` (4 tests)
- `tests/searchFilters.test.ts` (6 tests)
- `tests/architectureRefactor.test.ts` (6 tests)
- `tests/cliJsonOutput.test.ts` (2 tests)
- `tests/instanceDetector.test.ts` (2 tests)
- `tests/modsWatcher.test.ts` (2 tests)
- `tests/crypto.test.ts` (3 tests)
- `tests/performance.test.ts` (2 tests)
- **Total: 16 test files, 91 tests passed (100%)**.

---

## 📄 Lisensi

Didistribusikan di bawah lisensi [MIT](LICENSE).
