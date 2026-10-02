# 08 — Panduan Pengembang & Distribusi Binary

Dokumen ini adalah panduan lengkap bagi kontributor dan pengembang yang ingin mengembangkan, menguji, dan mendistribusikan **LoadModer** sebagai aplikasi mandiri (*single-file executable*) maupun paket CLI berbasis Node.js 20+.

---

## 1. Struktur Direktori Proyek

```text
LoadModer/
├── dist/                      # Bundle kompilasi JavaScript ESM tunggal (dist/index.js)
├── docs/                      # Dokumentasi arsitektur dan spesifikasi sistem
├── src/
│   ├── commands/              # Action handlers untuk setiap perintah CLI
│   │   ├── bisect.ts          # Perintah diagnostik crash bisect
│   │   ├── config.ts          # Pengaturan instance & konfigurasi global
│   │   ├── init.ts            # Wizard pendeteksi launcher & inisialisasi instance
│   │   ├── install.ts         # Pemasangan mod & modpack (.mrpack)
│   │   ├── list.ts            # Daftar mod terpasang & status lockfile
│   │   ├── profile.ts         # Manajemen profil versi Minecraft & loader
│   │   ├── remove.ts          # Penghapusan mod & orphan pruning
│   │   ├── search.ts          # Pencarian multi-kategori & filter kustom
│   │   ├── toggle.ts          # Pengaktifan / penonaktifan mod (.disabled)
│   │   ├── update.ts          # Pembaruan massal mod terpasang
│   │   └── watch.ts           # Pemantau folder mods real-time
│   ├── core/                  # Mesin logika domain inti (terisolasi dari CLI UI)
│   │   ├── dependency/
│   │   │   ├── graph.ts       # DAG & Reference Counting lockfile (loadmoder.lock.json)
│   │   │   └── resolver.ts    # Resolusi dependensi otomatis (API metadata & deskripsi)
│   │   ├── instance/
│   │   │   ├── config.ts      # Konfigurasi persistent (~/.loadmoder/config.json)
│   │   │   └── detector.ts    # Pemindai Prism, MultiMC, Modrinth, CurseForge, Vanilla
│   │   ├── minecraft/
│   │   │   └── versions.ts    # Dynamic Minecraft versions API (>= 1.16, TTL cache 1 jam)
│   │   ├── modpack/
│   │   │   └── unpacker.ts    # Ekstraktor streaming .mrpack, overrides, dan env filter
│   │   ├── profile/
│   │   │   └── snapshotManager.ts # Isolasi mod per profil & versi game
│   │   ├── troubleshoot/
│   │   │   └── bisect.ts      # Algoritma pencarian biner isolasi crash O(log2 N)
│   │   └── watcher/
│   │       └── modsWatcher.ts # Pemantau perubahan file mods via native fs.watch
│   ├── api/                   # Komunikasi HTTP & Modrinth API v2
│   │   ├── client.ts          # Client fetch dengan retry rate-limit, timeout & streaming
│   │   └── cache.ts           # In-memory TTL cache hemat kuota API
│   ├── ui/                    # Komponen antarmuka terminal & TUI
│   │   ├── dashboard/         # Layar TUI interaktif modular
│   │   │   ├── browser.ts     # Peramban mod/modpack dengan paginasi & filter
│   │   │   ├── detail.ts      # Layar detail proyek & opsi instalasi
│   │   │   ├── home.ts        # Dashboard menu utama & tabel filter aktif vertikal
│   │   │   └── manager.ts     # Pengelola mod terpasang (status, toggle, hapus)
│   │   ├── interactive.ts     # Helper navigasi keyboard raw mode
│   │   ├── progress.ts        # Instansiasi MultiBar cli-progress
│   │   ├── prompts.ts         # Pembungkus prompt @clack & @inquirer
│   │   ├── tables.ts          # Formatter tabel cli-table3
│   │   └── theme.ts           # Palet Nordic Clean TUI, ASCII banner, formatting utilitas
│   ├── types/                 # Skema Zod & tipe data TypeScript
│   │   ├── instance.ts
│   │   ├── lockfile.ts
│   │   ├── modrinth.ts
│   │   ├── mrpack.ts
│   │   └── snapshot.ts
│   ├── utils/                 # Utilitas filesystem, streaming hash, & format
│   │   ├── crypto.ts
│   │   ├── format.ts
│   │   └── markdown.ts
│   ├── constants.ts           # Metadata aplikasi, versi, dan konfigurasi path
│   └── index.ts               # Titik masuk utama CLI (Entry Point)
├── tests/                     # Pengujian unit & integrasi (Vitest)
│   ├── crypto.test.ts         # Uji fungsi hashing SHA-1, SHA-512, dan hashFile
│   ├── dependencyGraph.test.ts# Uji DAG reference counting & orphan pruning
│   ├── dependencyResolver.test.ts # Uji deteksi library API & regex deskripsi
│   ├── minecraftVersions.test.ts  # Uji fetching versi dinamis & cache TTL
│   ├── searchFilters.test.ts  # Uji filter kustom pencarian & query facets
│   └── snapshotManager.test.ts# Uji isolasi profil & pergantian versi mod
├── tsup.config.ts             # Konfigurasi bundler esbuild
├── package.json
└── tsconfig.json
```

---

## 2. Alur Kerja Pengembangan (Development Workflow)

### A. Persiapan Lingkungan
Pastikan Anda menggunakan Node.js versi 20 LTS atau lebih baru:
```bash
node -v # Harus >= 20.0.0
npm install
```

### B. Menjalankan Kode Langsung (Mode Cepat)
Menggunakan `tsx` untuk mengeksekusi TypeScript secara langsung tanpa kompilasi manual:
```bash
# Menjalankan menu bantuan CLI
npx tsx src/index.ts --help

# Membuka Dashboard TUI
npx tsx src/index.ts home

# Menguji pencarian mod
npx tsx src/index.ts search "sodium" -v 1.21.1 -l fabric

# Menguji simulasi instalasi (dry-run)
npx tsx src/index.ts install sodium --dry-run
```

### C. Pengujian Kualitas Kode (Type Checking & Unit Tests)
```bash
# 1. Validasi tipe TypeScript di seluruh src/ dan tests/
npx tsc --noEmit

# 2. Menjalankan seluruh test suite unit & integrasi
npm test

# 3. Menjalankan pengujian dalam mode interaktif
npx vitest
```

---

## 3. Bundling Berkecepatan Tinggi dengan `tsup`

Berkas konfigurasi `tsup.config.ts`:

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  minify: true,
  sourcemap: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
```

Jalankan perintah build:
```bash
npm run build
# Menghasilkan dist/index.js (satu file bundel utuh ESM, < 200 KB)
```

---

## 4. Distribusi Standalone Binary

Untuk mendistribusikan LoadModer tanpa mewajibkan pemain menginstal Node.js di komputer mereka, gunakan compiler binary seperti `@yao-pkg/pkg` atau `bun build --compile`:

```bash
# Contoh kompilasi binary mandiri untuk Windows
npx @yao-pkg/pkg dist/index.js --targets node20-win-x64 --output dist/loadmoder.exe

# Contoh kompilasi binary mandiri untuk Linux
npx @yao-pkg/pkg dist/index.js --targets node20-linux-x64 --output dist/loadmoder-linux
```

---

## 5. Variabel Lingkungan (Environment Variables)

Aplikasi membaca variabel lingkungan berikut saat runtime:

| Variabel | Deskripsi | Nilai Default |
| :--- | :--- | :--- |
| `LOADMODER_HOME` | Lokasi direktori data dan konfigurasi global LoadModer | `~/.loadmoder/` |
| `LOADMODER_CONTACT` | Informasi kontak pengembang untuk header `User-Agent` Modrinth API | *(Kosong)* |
| `MODRINTH_API_URL` | Base endpoint untuk Modrinth API v2 | `https://api.modrinth.com/v2` |

Contoh penggunaan:
```bash
# Mengarahkan konfigurasi ke folder portabel
export LOADMODER_HOME=/opt/loadmoder-data

# Menyertakan identitas kontak untuk Modrinth rate-limit tracking
export LOADMODER_CONTACT="admin@example.com"
```

