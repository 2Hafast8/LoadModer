# 08 — Panduan Pengembang & Distribusi Binary

Dokumen ini adalah panduan lengkap bagi kontributor dan pengembang yang ingin mengembangkan, menguji, dan mendistribusikan **LoadModer** sebagai aplikasi mandiri (*single-file executable* `.exe`) tanpa perlu dependensi Node.js di komputer pengguna akhir.

---

## 1. Struktur Direktori Proyek

```text
LoadModer/
├── dist/                      # Bundle kompilasi JavaScript tunggal (dist/index.js)
├── docs/                      # Dokumentasi teknis sistem lengkap
├── src/
│   ├── commands/              # Action handlers untuk setiap perintah CLI
│   │   ├── init.ts
│   │   ├── install.ts
│   │   ├── search.ts
│   │   ├── list.ts
│   │   ├── update.ts
│   │   ├── remove.ts
│   │   ├── toggle.ts
│   │   ├── bisect.ts
│   │   └── config.ts
│   ├── core/                  # Mesin logika domain inti (terisolasi dari CLI UI)
│   │   ├── dependency/
│   │   │   └── graph.ts       # DAG & Reference Counting lockfile (loadmoder.lock.json)
│   │   ├── instance/
│   │   │   ├── config.ts      # Manajer konfigurasi persistent (~/.loadmoder/config.json)
│   │   │   └── detector.ts    # Pemindai Prism, MultiMC, Modrinth App, CurseForge, Vanilla
│   │   ├── modpack/
│   │   │   └── unpacker.ts    # Ekstraktor .mrpack, overrides, dan env filter
│   │   └── troubleshoot/
│   │       └── bisect.ts      # Algoritma pencarian biner isolasi crash O(log2 N) & .disabled
│   ├── api/                   # Komunikasi HTTP & Modrinth API v2
│   │   ├── client.ts          # Client fetch dengan retry rate-limit, timeout & streaming
│   │   └── cache.ts           # In-memory TTL cache hemat kuota API
│   ├── ui/                    # Komponen antarmuka terminal (gaya anichi-cli)
│   │   ├── theme.ts           # Tema neon cyberpunk, ASCII shadow banner, boxen, logger
│   │   ├── interactive.ts     # Engine navigasi keyboard raw mode (↑/↓/Enter)
│   │   ├── dashboard/         # Layar TUI interaktif modular
│   │   │   ├── home.ts        # Dashboard menu utama
│   │   │   ├── browser.ts     # Peramban mod/modpack dengan paginasi & detail
│   │   │   └── manager.ts     # Pengelola mod terpasang (status, toggle, hapus)
│   │   ├── prompts.ts         # Pembungkus prompt & helper
│   │   ├── progress.ts        # Instansiasi MultiBar cli-progress
│   │   └── tables.ts          # Formatter tabel cli-table3
│   ├── types/                 # Skema Zod & tipe data TypeScript
│   │   ├── instance.ts
│   │   ├── modrinth.ts
│   │   ├── mrpack.ts
│   │   └── lockfile.ts
│   ├── utils/                 # Utilitas filesystem, streaming hash, & format
│   │   ├── crypto.ts
│   │   └── format.ts
│   ├── constants.ts           # Metadata aplikasi, versi, dan konfigurasi path
│   └── index.ts               # Titik masuk utama CLI (Entry Point)
├── tests/                     # Pengujian unit & integrasi (Vitest)
│   ├── crypto.test.ts
│   └── dependencyGraph.test.ts
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

# Menguji pencarian mod
npx tsx src/index.ts search "sodium"

# Menguji simulasi instalasi (dry-run)
npx tsx src/index.ts install sodium --dry-run
```

### C. Menjalankan Automated Tests (Vitest)
```bash
npm test
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
# Menghasilkan dist/index.js (satu file bundel utuh, < 1MB)
```

---

## 4. Distribusi Single-Binary Standalone (`.exe`)

Pemain Minecraft biasa tidak memiliki Node.js di komputer mereka. Kita dapat mengompilasi bundel JavaScript beserta runtime Node.js menjadi satu file biner mandiri menggunakan `@yao-pkg/pkg` atau `bun`:

### Metode A: Menggunakan `@yao-pkg/pkg`
```bash
# Kompilasi untuk Windows (x64)
npx pkg dist/index.js --targets node20-win-x64 --output bin/loadmoder.exe

# Kompilasi untuk Linux
npx pkg dist/index.js --targets node20-linux-x64 --output bin/loadmoder-linux

# Kompilasi untuk macOS (Apple Silicon / Intel)
npx pkg dist/index.js --targets node20-macos-arm64 --output bin/loadmoder-macos
```

### Metode B: Menggunakan Bun (`bun build --compile`)
Jika Anda memiliki Bun terpasang di sistem:
```bash
bun build src/index.ts --compile --outfile bin/loadmoder.exe
```
Hasil file `loadmoder.exe` dapat langsung didistribusikan di GitHub Releases, dan pengguna cukup mengetik `loadmoder` di Command Prompt Windows!

---

## 5. Cara Menambahkan Perintah Baru (Contoh: `loadmoder info <mod>`)

Untuk menambahkan fitur baru ke LoadModer, ikuti 3 langkah modular berikut:

### Langkah 1: Buat Action Handler di `src/commands/info.ts`
```typescript
import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { ModrinthClient } from '../api/modrinthClient.js';

export async function infoCommand(api: ModrinthClient, modSlug: string) {
  const s = p.spinner();
  s.start(`Mengambil informasi proyek "${modSlug}"...`);

  try {
    const project = await api.getProject(modSlug);
    s.stop(pc.green('Data berhasil diambil!'));

    console.log(`\n${pc.bold(pc.cyan(project.title))} [${project.slug}]`);
    console.log(`${pc.dim('Deskripsi:')} ${project.description}`);
    console.log(`${pc.dim('Kategori :')} ${project.categories.join(', ')}`);
    console.log(`${pc.dim('Unduhan  :')} ${new Intl.NumberFormat().format(project.downloads)} kali`);
  } catch (err) {
    s.stop(pc.red('Gagal mengambil informasi.'));
    p.log.error((err as Error).message);
    process.exitCode = 1;
  }
}
```

### Langkah 2: Daftarkan ke Commander di `src/index.ts`
```typescript
import { Command } from 'commander';
import { infoCommand } from './commands/info.js';
import { modrinthClient } from './api/modrinthClient.js';

const program = new Command();

program
  .command('info')
  .description('Menampilkan informasi lengkap mengenai mod atau proyek Modrinth')
  .argument('<slug>', 'Slug atau ID proyek Modrinth')
  .action(async (slug: string) => {
    await infoCommand(modrinthClient, slug);
  });
```

---

## 6. GitHub Actions Workflow (CI/CD Otomatis)

Berkas `.github/workflows/release.yml` untuk rilis biner multi-platform otomatis:

```yaml
name: Build & Release Binaries

on:
  push:
    tags:
      - 'v*'

jobs:
  build-binaries:
    strategy:
      matrix:
        os: [windows-latest, ubuntu-latest, macos-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Run Tests
        run: npm test

      - name: Build JS Bundle
        run: npm run build

      - name: Package Windows Binary
        if: matrix.os == 'windows-latest'
        run: npx pkg dist/index.js --targets node20-win-x64 --output loadmoder-windows-x64.exe

      - name: Package Linux Binary
        if: matrix.os == 'ubuntu-latest'
        run: npx pkg dist/index.js --targets node20-linux-x64 --output loadmoder-linux-x64

      - name: Package macOS Binary
        if: matrix.os == 'macos-latest'
        run: npx pkg dist/index.js --targets node20-macos-arm64 --output loadmoder-macos-arm64

      - name: Upload Release Assets
        uses: softprops/action-gh-release@v2
        with:
          files: |
            loadmoder-*
```
Dokumentasi ini memastikan setiap pengembang dapat berkontribusi secara modular dan menghasilkan rilis biner yang andal bagi komunitas Minecraft.
