# 02: Kurasi Tech Stack dan Pustaka (The Golden Stack)

Dokumen ini menjelaskan alasan teknis, pertimbangan arsitektur, dan kurasi pustaka (*libraries*) yang dipilih untuk membangun platform LoadModer (`lm`).

---

## 1. Ringkasan Golden Stack LoadModer

```
┌─────────────────────────────────────────────────────────────┐
│                    LOADMODER GOLDEN STACK                   │
├───────────────────────┬─────────────────────────────────────┤
│ Bahasa dan Runtime    │ TypeScript 5.5+ & Node.js 20+ (ESM) │
│ Desktop Engine        │ Electron 32 (Main & Preload Bridge) │
│ Desktop Frontend      │ React 19 + Vite 5 + Tailwind CSS v3 │
│ Icon System           │ Lucide React                        │
│ Standalone Packager   │ electron-builder (NSIS & Portable)  │
│ CLI Command Router    │ commander (v12+)                    │
│ TUI Dashboard & Nav   │ @inquirer/prompts (Raw Mode ANSI)   │
│ Wizard & Setup Flow   │ @clack/prompts                      │
│ Banner & Visual UI    │ figlet + gradient-string + chalk    │
│ Kotak & Pesan Header  │ boxen (round border)                │
│ Spinner & Progress    │ ora + cli-progress (multi-bar)      │
│ Kontrol Konkurensi    │ p-limit                             │
│ Streaming ZIP Engine  │ unzipper (streaming memory-safe)    │
│ Modpack Exporter      │ archiver (zip level 9)              │
│ Validasi Skema        │ zod                                 │
│ Normalisasi Path      │ pathe                               │
│ State Lockfile        │ write-file-atomic                   │
│ File Watcher          │ node:fs native watch + debounce     │
│ Pengujian Otomatis    │ vitest (244 tests / 34 files)       │
│ Bundler & Kompilasi   │ tsup (esbuild engine)               │
└───────────────────────┴─────────────────────────────────────┘
```

---

## 2. Rasional Pemilihan Pustaka

### A. Desktop GUI Subsystem: Electron 32 + React 19 + Vite
* **Electron 32**: Menyediakan isolasi proses yang aman antara Node.js main process dan renderer browser via `contextBridge` di preload script (`src/desktop/preload/index.ts`). Renderer tidak memiliki akses langsung ke filesystem mentah tanpa melalui IPC type-safe.
* **React 19**: Menyediakan arsitektur komponen modular untuk dashboard desktop, state management reaktif, dan performa perenderan tinggi untuk daftar ratusan mod.
* **Vite 5**: Mengompilasi kode renderer React dengan Hot Module Replacement (HMR) berkecepatan tinggi dan menghasilkan bundle produksi yang sangat teroptimasi.
* **electron-builder**: Mengompilasi aplikasi desktop menjadi standalone executable Windows (`.exe`) dalam format instalasi NSIS (`LoadModer-Setup-2.8.0.exe`) dan versi portabel mandiri (`LoadModer-2.8.0-Portable.exe`).

### B. CLI Router: `commander`
* Waktu cold-start sangat cepat (< 50ms), lebih efisien dibanding framework CLI berat.
* Mendukung sub-perintah bersarang (*nested subcommands*) dengan pemisahan berkas yang modular.
* Penanganan argumen variadic (`<targets...>`), opsi negated (`--no-deps`), dan default values yang rapi.
* Menghasilkan output `--help` terstruktur secara otomatis.

### C. Interaktivitas Terminal: Sinergi `@inquirer/prompts` dan `@clack/prompts`
* **`@inquirer/prompts`**: Digunakan untuk navigasi menu utama dashboard (`askInteractiveMenu`) dan pencarian mod instan (`askSearchMenu`). Didukung algoritma ANSI diff rendering internal yang meniadakan screen flickering, mendukung kontrol panah (`↑`/`↓`), tombol Vim (`j`/`k`), dan fitur pagination bawaan (`pageSize`).
* **`@clack/prompts`**: Digunakan untuk alur wizard inisialisasi (`init`), dialog konfirmasi (`confirm`), dan visual rel vertikal (*rail layout*) yang rapi dan minimalis.

### D. Pewarnaan dan Formatting: `picocolors` dan `chalk`
* `picocolors` digunakan pada loop pengulangan tinggi dan log streaming karena bobotnya yang sangat kecil (< 7 KB) dan performa perenderan ANSI cepat tanpa dependensi tambahan.
* `chalk` dan `gradient-string` dimanfaatkan untuk merender banner ASCII logo pada header dashboard awal.

### E. Progress Bar Unduhan Paralel: `cli-progress` vs `ora`
* `cli-progress` digunakan untuk unduhan multi-berkas dengan instansiasi MultiBar. Tiap file yang sedang diunduh memiliki progress bar terpisah dengan indikator byte transfer dan ukuran berkas.
* `ora` digunakan untuk indikator pemuatan tunggal (*single-task spinner*) saat membaca metadata API atau mengekstrak indeks modpack.

### F. Concurrency Limiter: `p-limit`
* Ketika modpack menginstruksikan pengunduhan puluhan file sekaligus, mengeksekusi seluruh permintaan HTTP secara bersamaan berisiko memicu `ECONNRESET` atau pemblokiran IP oleh Cloudflare Modrinth (*burst rate limit*).
* Dengan `pLimit(4)`, antrean unduhan dibatasi tepat 4 koneksi simultan, menjaga throughput jaringan dan konsumsi memori sistem tetap stabil.

### G. ZIP Streaming Engine: `unzipper` dan `archiver`
* `unzipper` memproses berkas arsip sebagai Node.js Stream tanpa perlu memuat seluruh isi berkas ke memori RAM.
* `archiver` digunakan pada Modpack Exporter untuk mengompilasi mod aktif dan konfigurasi ke dalam format `.mrpack` atau `.zip` dengan kompresi tingkat 9.

### H. Validasi Skema Data: `zod`
* Struktur respons API Modrinth, manifest `.mrpack`, dan file konfigurasi lokal divalidasi saat runtime.
* Mencegah serangan path traversal pada file `.mrpack` melalui validasi ketat path file tujuan.

### I. File Watcher: Node.js Native `fs.watch`
* Menggunakan modul bawaan `node:fs` sehingga tidak menambah beban dependensi eksternal yang besar (seperti `chokidar`).
* Dilengkapi mekanisme debounce 300ms untuk menangani operasi batch filesystem saat pemain menghapus atau menambah banyak mod sekaligus.

### J. Test Runner: `vitest`
* Eksekusi pengujian TypeScript instan tanpa tahap kompilasi terpisah.
* Menjalankan 257 unit tests pada 35 test files dengan waktu eksekusi di bawah 3 detik.

---

## 3. Spesifikasi `package.json`

```json
{
  "name": "loadmoder",
  "version": "2.8.0",
  "description": "High-performance Minecraft mod & modpack manager CLI",
  "license": "MIT",
  "type": "module",
  "bin": {
    "loadmoder": "./dist/index.js",
    "lm": "./dist/index.js"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsup",
    "build:all": "npm run build && npm run desktop:build",
    "desktop": "npm run desktop:build && electron .",
    "desktop:build": "npm run desktop:build:main && npm run desktop:build:renderer",
    "dist:exe": "npm run build:all && electron-builder --win",
    "test": "vitest run"
  }
}
```
