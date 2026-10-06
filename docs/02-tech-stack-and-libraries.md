# 02 — Kurasi Tech Stack & Pustaka (The Golden Stack)

Dokumen ini menjelaskan alasan teknis, pertimbangan arsitektur, dan kurasi pustaka (*libraries*) yang dipilih untuk membangun platform **LoadModer** (`lm`).

---

## 1. Ringkasan "Golden Stack" LoadModer

```
┌─────────────────────────────────────────────────────────────┐
│                    LOADMODER GOLDEN STACK                   │
├───────────────────────┬─────────────────────────────────────┤
│ Bahasa & Runtime      │ TypeScript 5.5+ & Node.js 20+ (ESM) │
│ CLI Command Router    │ commander (v12+)                    │
│ TUI Dashboard & Nav   │ @inquirer/prompts (Raw Mode ANSI)   │
│ Wizard & Setup Flow   │ @clack/prompts                      │
│ Banner & Visual UI    │ figlet + gradient-string + chalk    │
│ Kotak & Pesan Header  │ boxen (round border)                │
│ Spinner & Progress    │ ora + cli-progress (multi-bar)      │
│ Kontrol Konkurensi    │ p-limit                             │
│ Streaming ZIP Engine  │ unzipper (streaming memory-safe)    │
│ Validasi Skema        │ zod                                 │
│ Normalisasi Path      │ pathe                               │
│ State Lockfile        │ write-file-atomic                   │
│ File Watcher          │ node:fs native watch + debounce     │
│ Pengujian Otomatis    │ vitest (157 tests / 21 files)       │
│ Bundler & Kompilasi   │ tsup (esbuild engine)               │
└───────────────────────┴─────────────────────────────────────┘
```

---

## 2. Rasional Pemilihan Pustaka

### A. CLI Router: `commander`
* **Alasan Pemilihan**:
  1. Sangat stabil, dokumentasi matang, dan tipe TypeScript bawaan yang presisi.
  2. Waktu *cold start* sangat cepat (< 50ms), jauh lebih efisien dibanding framework CLI berat seperti `yargs`.
  3. Mendukung sub-perintah bersarang (*nested subcommands*) dengan pemisahan berkas yang modular.
  4. Penanganan argumen variadic (`<targets...>`), opsi negated (`--no-deps`), dan default values yang rapi.
  5. Menghasilkan output `--help` terstruktur secara otomatis.

### B. Interaktivitas Terminal: Sinergi `@inquirer/prompts` & `@clack/prompts`
* **Rasional Desain Hibrida**:
  * **`@inquirer/prompts`**: Digunakan untuk navigasi menu utama dashboard (`askInteractiveMenu`) dan pencarian mod instan (`askSearchMenu`). Didukung algoritma *ANSI diff rendering* internal yang meniadakan *screen flickering*, mendukung kontrol panah (`↑`/`↓`), tombol Vim (`j`/`k`), dan fitur pagination bawaan (`pageSize`).
  * **`@clack/prompts`**: Digunakan untuk alur wizard inisialisasi (`init`), dialog konfirmasi (`confirm`), dan visual rel vertikal (*rail layout*) yang rapi dan minimalis.

### C. Pewarnaan & Formatting: `picocolors` & `chalk`
* **Rasional Penggunaan**:
  * `picocolors` digunakan pada loop pengulangan tinggi dan log streaming karena bobotnya yang sangat kecil (< 7 KB) dan performa perenderan ANSI 3–4x lebih cepat tanpa dependensi tambahan.
  * `chalk` dan `gradient-string` dimanfaatkan untuk merender banner ASCII logo pada header dashboard awal.

### D. Progress Bar Unduhan Paralel: `cli-progress` vs `ora`
* **Rasional Kombinasi**:
  * `cli-progress` digunakan untuk unduhan multi-berkas dengan instansiasi **MultiBar**. Tiap file yang sedang diunduh memiliki progress bar terpisah dengan indikator byte transfer dan ukuran berkas.
  * `ora` digunakan untuk indikator pemuatan tunggal (*single-task spinner*) saat membaca metadata API atau mengekstrak indeks modpack.

### E. Concurrency Limiter: `p-limit`
* **Kebutuhan Teknis**:
  * Ketika modpack menginstruksikan pengunduhan puluhan file sekaligus, mengeksekusi seluruh permintaan HTTP secara bersamaan berisiko memicu `ECONNRESET`, pemutusan koneksi TCP, atau pemblokiran IP oleh Cloudflare Modrinth (*burst rate limit*).
  * Dengan `pLimit(4)`, antrean unduhan dibatasi tepat 4 koneksi simultan, menjaga throughput jaringan dan konsumsi memori sistem tetap stabil.

### F. ZIP Streaming Engine: `unzipper`
* **Keunggulan Teknis**:
  * Berbeda dari library seperti `adm-zip` yang membaca keseluruhan arsip ZIP ke dalam RAM, `unzipper` memproses berkas sebagai **Node.js Stream**.
  * File metadata seperti `modrinth.index.json` di dalam arsip `.mrpack` berukuran besar dapat dibaca langsung tanpa perlu mengekstrak seluruh arsip ke disk.

### G. Validasi Skema Data: `zod`
* **Keamanan Data**:
  * Struktur respons API Modrinth, manifest `.mrpack`, dan file konfigurasi lokal divalidasi saat runtime.
  * Mencegah serangan path traversal pada file `.mrpack` melalui validasi ketat path file tujuan.

### H. File Watcher: Node.js Native `fs.watch`
* **Keunggulan Teknis**:
  * Menggunakan modul bawaan `node:fs` sehingga tidak menambah beban dependensi eksternal yang besar (seperti `chokidar`).
  * Dilengkapi mekanisme debounce 300ms untuk menangani operasi batch filesystem saat pemain menghapus atau menambah banyak mod sekaligus.

### I. Test Runner: `vitest`
* **Kecepatan & Integrasi**:
  * Eksekusi pengujian TypeScript instan tanpa tahap kompilasi terpisah.
  * Kompatibilitas penuh dengan sintaks ESM modern dan mocking bawaan (`vi.spyOn`).

---

## 3. Spesifikasi `package.json`

```json
{
  "name": "loadmoder",
  "version": "2.0.0",
  "description": "High-performance Minecraft mod & modpack manager CLI powered by Modrinth API",
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
    "test": "vitest run"
  },
  "dependencies": {
    "@clack/prompts": "^0.7.0",
    "@inquirer/prompts": "^8.7.2",
    "boxen": "^9.0.0",
    "chalk": "^6.0.1",
    "cli-progress": "^3.12.0",
    "cli-table3": "^0.6.5",
    "commander": "^12.1.0",
    "figlet": "^1.12.0",
    "gradient-string": "^3.0.0",
    "ora": "^9.4.1",
    "p-limit": "^5.0.0",
    "pathe": "^1.1.2",
    "picocolors": "^1.0.1",
    "unzipper": "^0.12.3",
    "write-file-atomic": "^5.0.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/cli-progress": "^3.11.6",
    "@types/figlet": "^1.7.0",
    "@types/gradient-string": "^1.1.6",
    "@types/node": "^22.0.0",
    "@types/unzipper": "^0.10.10",
    "@types/write-file-atomic": "^4.0.3",
    "tsup": "^8.1.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.3",
    "vitest": "^1.6.0"
  }
}
```

---

## 4. Konfigurasi `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "types": ["node"]
  },
  "include": [
    "src/**/*",
    "tests/**/*"
  ]
}
```
