# 08: Panduan Pengembang dan Distribusi Binary

Dokumen ini adalah panduan lengkap bagi kontributor dan pengembang yang ingin mengembangkan, menguji, dan mendistribusikan LoadModer sebagai aplikasi desktop mandiri (`.exe`) maupun paket CLI berbasis Node.js 20+.

---

## 1. Struktur Direktori Proyek

```text
LoadModer/
├── dist/                      # Bundle kompilasi CLI ESM tunggal (dist/index.js)
├── dist-desktop/              # Bundle kompilasi Desktop (main, preload, dan assets web)
├── docs/                      # Dokumentasi teknis, spesifikasi, dan C4 architecture
├── src/
│   ├── commands/              # Action handlers untuk setiap perintah CLI
│   │   ├── bisect.ts          # Perintah diagnostik crash bisect
│   │   ├── config.ts          # Pengaturan instance & konfigurasi global
│   │   ├── init.ts            # Wizard pendeteksi launcher & inisialisasi instance
│   │   ├── install.ts         # Pemasangan mod & modpack (.mrpack)
│   │   ├── list.ts            # Daftar mod terpasang & status lockfile
│   │   ├── modpack.ts         # Kelola profil modpack tersimpan di brankas
│   │   ├── profile.ts         # Manajemen profil versi Minecraft & loader
│   │   ├── remove.ts          # Penghapusan mod & orphan pruning
│   │   ├── search.ts          # Pencarian multi-kategori & filter kustom
│   │   ├── toggle.ts          # Pengaktifan / penonaktifan mod (.disabled)
│   │   ├── update.ts          # Pembaruan massal mod terpasang
│   │   └── watch.ts           # Pemantau folder mods real-time
│   ├── core/                  # Mesin logika domain inti (terisolasi dari UI)
│   │   ├── dependency/
│   │   │   ├── graph.ts       # DAG & Reference Counting lockfile (loadmoder.lock.json)
│   │   │   └── resolver.ts    # Resolusi dependensi otomatis
│   │   ├── instance/
│   │   │   ├── capabilities.ts # Matriks kemampuan launcher
│   │   │   ├── config.ts      # Konfigurasi persistent (~/.loadmoder/config.json)
│   │   │   ├── detector.ts    # Pemindai launcher (Prism, Vanilla, TLauncher, dll.)
│   │   │   ├── driveScanner.ts# Scanner drive lokal & input path manual
│   │   │   └── localInstaller.ts # Drag-and-drop archive parser & classifier
│   │   ├── minecraft/
│   │   │   └── versions.ts    # Dynamic Minecraft versions API (>= 1.16)
│   │   ├── modpack/
│   │   │   ├── baselineManager.ts # Baseline snapshot & pemulihan permanen
│   │   │   ├── exporter.ts    # Kompilasi modpack ke .mrpack / .zip
│   │   │   ├── legacy/        # Engine dual-path Legacy Launcher
│   │   │   ├── profileManager.ts # Brankas profil modpack & isolasi wadah
│   │   │   └── unpacker.ts    # Ekstraktor streaming .mrpack & env filter
│   │   ├── profile/
│   │   │   └── snapshotManager.ts # Isolasi mod per profil & versi game
│   │   ├── troubleshoot/
│   │   │   ├── bisect.ts      # Binary search isolasi mod crash O(log2 N)
│   │   │   └── logAnalyzer.ts # Crash log & stack trace regex analyzer
│   │   └── watcher/
│   │       └── modsWatcher.ts # Pemantau perubahan file mods via native fs.watch
│   ├── desktop/               # Aplikasi Desktop GUI Electron
│   │   ├── main/              # Electron Main process & IPC handlers
│   │   ├── preload/           # contextBridge type-safe security gateway
│   │   ├── renderer/          # React 19 Frontend (Vite + Tailwind CSS)
│   │   │   ├── components/    # TopBar, DropZoneOverlay, Toast, Modals
│   │   │   └── views/         # ModsView, ExploreView, InstancesView, BisectView
│   │   └── types/             # Deklarasi IPC dan interface Desktop
│   ├── api/                   # Komunikasi HTTP & Modrinth API v2
│   │   ├── client.ts          # Fetch client dengan rate-limit backoff & streaming
│   │   └── cache.ts           # In-memory TTL cache hemat kuota API
│   ├── ui/                    # Komponen terminal TUI (Nordic Clean)
│   │   ├── dashboard/         # Layar TUI interaktif (home, browser, manager)
│   │   └── theme.ts           # Palet Nordic Clean, ASCII banner, kontras
│   ├── types/                 # Skema Zod & tipe data TypeScript
│   ├── utils/                 # Utilitas filesystem, streaming hash, & format
│   ├── constants.ts           # Metadata aplikasi, versi (2.7.0), dan konstanta
│   └── index.ts               # Titik masuk utama CLI (Entry Point)
├── tests/                     # 35 berkas pengujian Vitest (257 tests)
├── electron-builder.json      # Konfigurasi packaging Windows .exe (NSIS & Portable)
├── tsup.config.ts             # Bundler esbuild untuk CLI
├── tsup.desktop.config.ts     # Bundler esbuild untuk Desktop main & preload
├── vite.config.desktop.ts     # Bundler Vite untuk Desktop React renderer
├── package.json
└── tsconfig.json
```

---

## 2. Alur Kerja Pengembangan

### A. Persiapan Lingkungan
Gunakan Node.js versi 20 LTS atau lebih baru:
```bash
node -v # Harus >= 20.0.0
npm install
```

### B. Menjalankan Desktop GUI
```bash
# Otomatis mengompilasi main, preload, dan renderer lalu menjalankan Electron:
npm run desktop
```

### C. Menjalankan CLI dalam Mode Pengembangan
```bash
# Menjalankan menu bantuan CLI
npx tsx src/index.ts --help

# Membuka Dashboard TUI interaktif
npx tsx src/index.ts home

# Menguji pencarian mod
npx tsx src/index.ts search "sodium" -v 1.21.1 -l fabric
```

### D. Pengujian Kualitas Kode
```bash
# 1. Validasi tipe TypeScript
npx tsc --noEmit

# 2. Menjalankan seluruh 244 unit tests
npm test

# 3. Menjalankan pengujian dalam mode interaktif
npx vitest
```

---

## 3. Kompilasi Bundle Distribusi

### A. Build CLI Bundle
```bash
npm run build
# Menghasilkan dist/index.js (ESM bundle tunggal dengan banner #!/usr/bin/env node)
```

### B. Build Seluruh Target (CLI & Desktop)
```bash
npm run build:all
# Mengompilasi dist/index.js, dist-desktop/main.js, dist-desktop/preload.js, dan assets web Vite
```

---

## 4. Distribusi Standalone Windows Executable (.exe)

LoadModer menggunakan **electron-builder** untuk menghasilkan berkas installer dan portable untuk pengguna Windows tanpa memerlukan instalasi Node.js:

```bash
# Mengompilasi installer dan portable .exe ke folder dist-desktop/
npm run dist:exe
```

Output kompilasi:
* **`LoadModer-Setup-2.7.0.exe`**: NSIS installer wizard dengan pembuatan desktop shortcut dan uninstaller bersih.
* **`LoadModer-2.7.0-Portable.exe`**: Executable mandiri yang dapat langsung dijalankan dari USB flashdisk atau folder mana pun.

Distribusi ini juga terintegrasi dengan **GitHub Actions CI/CD** (`.github/workflows/release.yml`), yang secara otomatis mengompilasi dan mengunggah aset binary ke halaman GitHub Releases ketika tag rilis `v*` dipush.

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
