# 📦 LoadModer (`lm`)

> **High-Performance Minecraft Mod & Modpack Manager CLI powered by Modrinth API v2.**  
> Built with modern TypeScript, Nordic Minimalist Clean TUI, bidirectional DAG dependency resolution, and multi-launcher auto-discovery.

[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-38bdf8.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6.svg)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/tests-36%20passed-34d399.svg)](https://vitest.dev/)
[![License](https://img.shields.io/badge/license-MIT-34d399.svg)](LICENSE)
[![Modrinth API](https://img.shields.io/badge/API-Modrinth%20v2-00af5c.svg)](https://docs.modrinth.com/api-spec/)

---

## ⚡ Fitur Utama

LoadModer dirancang untuk menghadirkan keandalan package manager modern (seperti **Cargo** di Rust atau **pnpm** di Node.js) ke dalam ekosistem modding Minecraft:

* **🎯 Dual-Mode Operations**:
  - **Interactive TUI Dashboard**: Cukup panggil `lm` untuk membuka dashboard interaktif dengan navigasi keyboard panah (`↑`/`↓` atau `j`/`k`), filter cepat, dan penjelajah katalog.
  - **Direct Command Line**: Jalankan `lm install`, `lm search`, `lm update` langsung dengan argumen dan flag untuk automasi terminal maupun skrip CI/CD.
* **🧩 Auto-Install Dependency Resolver**:
  - Mendeteksi dependensi library wajib langsung dari metadata API Modrinth dan parsing deskripsi mod.
  - Otomatis mencocokkan versi Minecraft dan mod loader aktif, serta melewati pengunduhan jika berkas library sudah tersedia di folder `mods`.
* **🌐 Dynamic Minecraft Versions**:
  - Mengambil daftar versi resmi Minecraft secara dinamis via API Modrinth (versi $\ge$ 1.16) dengan sistem caching lokal 24 jam dan pembaruan otomatis saat versi baru dirilis.
* **🔍 Custom Search & Multi-Content Support**:
  - Pencarian konten terpadu untuk **Mods**, **Modpacks** (`.mrpack`), **Shaders**, dan **Resource Packs**.
  - Filter kustom fleksibel berdasarkan versi game, mod loader, kategori proyek, dan environment (client/server), lengkap dengan tabel ringkasan filter aktif vertikal di TUI.
* **💾 Profile Snapshot & Version Isolation**:
  - Mengisolasi file mod per profil dan versi game ke dalam snapshot lokal (`.loadmoder/profiles/`), mencegah hilangnya mod atau tercampurnya mod antar versi saat berganti konfigurasi.
* **👀 Real-Time Directory Watcher (`lm watch`)**:
  - Memantau folder `mods` secara real-time via `chokidar` untuk mendeteksi penambahan, penghapusan, atau perubahan file secara manual di luar CLI.
* **🔒 Lockfile & DAG Dependency Graph (`loadmoder.lock.json`)**:
  - Melacak silsilah dependensi secara akurat, mencegah duplikasi, dan membersihkan dependensi yatim (*orphan pruning*) saat mod utama dihapus.
* **🩺 Crash Bisect Engine ($O(\log_2 N)$)**:
  - Melacak mod perusak atau penyebab crash game secara otomatis menggunakan algoritma pencarian biner dalam beberapa langkah uji.

---

## 🚀 Quick Start

### Prasyarat
- **Node.js**: Versi `20.0.0` atau yang lebih baru.
- **npm**: Bawaan Node.js.

### 1. Instalasi & Setup Lokal
```bash
# Clone repository
git clone https://github.com/2Hafast8/LoadModer.git
cd LoadModer

# Instal dependensi
npm install

# Kompilasi project
npm run build

# Daftarkan binary "lm" secara global ke sistem
npm link
```

### 2. Jalankan Dashboard Interaktif
```bash
lm
```
*Atau gunakan alias lengkap:* `loadmoder`

---

## 🛠️ Ringkasan Perintah CLI

| Perintah | Deskripsi | Contoh Penggunaan |
| :--- | :--- | :--- |
| `lm` / `lm home` | Membuka Dashboard TUI interaktif dengan navigasi keyboard | `lm` |
| `lm init` | Wizard pendeteksi launcher Minecraft dan konfigurasi instance | `lm init` |
| `lm search <query>` | Mencari mod, modpack, shader, atau resource pack di Modrinth | `lm search sodium -t mod -l fabric -v 1.21.1` |
| `lm install <slug...>` | Memasang mod atau modpack beserta library dependensinya | `lm install sodium iris fabric-api` |
| `lm list` | Menampilkan tabel status mod terpasang, ukuran file, dan lockfile | `lm list` |
| `lm update` | Memeriksa & memperbarui seluruh mod ke versi rilis terbaru | `lm update -y` |
| `lm remove <slug...>` | Menghapus mod beserta pembersihan otomatis dependensi yatim | `lm remove iris --prune` |
| `lm enable <mod>` | Mengaktifkan mod yang dinonaktifkan (`.jar.disabled` $\rightarrow$ `.jar`) | `lm enable sodium` |
| `lm disable <mod>` | Menonaktifkan mod tanpa menghapus file (`.jar` $\rightarrow$ `.jar.disabled`) | `lm disable sodium` |
| `lm bisect <action>` | Investigasi biner mod penyebab game crash (`start` \| `good` \| `bad` \| `reset`) | `lm bisect start` |
| `lm watch` | Memantau folder mods secara real-time dan menyinkronkan data | `lm watch` |
| `lm profile <action>` | Mengelola snapshot profil versi game (`list` \| `switch`) | `lm profile switch -v 1.21.1 -l fabric` |
| `lm config <action>` | Menampilkan atau mengatur konfigurasi instance aktif | `lm config show` |

---

## 🏗️ Arsitektur Sistem

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER (CLI & DUAL UX)                   │
│  Interactive TUI Dashboard (Home) │ Commander Router (CLI Commands)    │
│  Keyboard Arrow Engine (Raw Mode) │ Figlet & Neon Theme Banner         │
│  Boxen Rounded Cards & Metadata   │ Cli-Table3 Rounded Border Tables   │
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
│   (Undici / Fetch + Retry) │ (p-limit & Range HTTP) │ (Node:Crypto)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📚 Dokumentasi Mendalam

Dokumentasi arsitektur dan spesifikasi teknis lengkap tersedia pada folder [`docs/`](docs/README.md):

* [**01. Arsitektur & Visi Sistem**](docs/01-architecture-and-vision.md) — Filosofi desain, alur data end-to-end, dan tata kelola kuota API.
* [**02. Kurasi Tech Stack & Pustaka**](docs/02-tech-stack-and-libraries.md) — Komparasi performa dan pemilihan pustaka *The Golden Stack*.
* [**03. Spesifikasi Perintah & UX CLI**](docs/03-cli-commands-and-ux.md) — Panduan lengkap opsi, flag global, dan tata letak visual TUI.
* [**04. Mesin Modpack (.mrpack Engine)**](docs/04-modpack-engine.md) — Parsing spesifikasi `.mrpack`, ekstraksi streaming, dan pemisahan override.
* [**05. Integrasi Multi-Launcher**](docs/05-multi-launcher-integration.md) — Auto-discovery Prism, MultiMC, Modrinth App, CurseForge, dan Vanilla.
* [**06. Dependency Graph & Lockfile**](docs/06-dependency-graph-and-lockfile.md) — Mesin resolusi dependensi otomatis, Directed Acyclic Graph, dan reference counting.
* [**07. Diagnostik Crash & Bisect Engine**](docs/07-troubleshooting-and-bisect.md) — Algoritma pencarian biner isolasi crash dan toggle status mod.
* [**08. Panduan Pengembang & API**](docs/08-developer-guide-and-api.md) — Struktur berkas lengkap, workflow pengujian, dan kompilasi executable.
* [**Cetak Biru Arsitektur LoadModer**](docs/LOADMODER_ARCHITECTURE.md) — Spesifikasi platform menyeluruh dan pilar rekayasa sistem.
* [**Katalog Agent Skills**](docs/SKILL.md) — Indeks 18 skill agen yang memandu kualitas kode, keamanan, dan UX.

---

## 🧪 Pengujian & Type Checking

LoadModer menerapkan pengujian otomatis menyeluruh menggunakan **Vitest** dan **TypeScript compiler**:

```bash
# Menjalankan validasi tipe TypeScript di seluruh src dan tests
npx tsc --noEmit

# Menjalankan seluruh test suite unit & integrasi
npm test

# Menjalankan test dalam mode watch interaktif
npx vitest
```

**Status Test Suite:**
- `tests/crypto.test.ts` (3 tests)
- `tests/minecraftVersions.test.ts` (10 tests)
- `tests/dependencyGraph.test.ts` (3 tests)
- `tests/snapshotManager.test.ts` (3 tests)
- `tests/dependencyResolver.test.ts` (11 tests)
- `tests/searchFilters.test.ts` (6 tests)
- **Total: 6 test suites, 36 tests passed (100%)**.

---

## 📄 Lisensi

Didistribusikan di bawah lisensi [MIT](LICENSE).
