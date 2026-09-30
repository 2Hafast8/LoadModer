# 02 — Kurasi Tech Stack & Pustaka (The Golden Stack)

Dokumen ini membedah alasan teknis, komparasi performa, dan kurasi pustaka (libraries) yang dipilih untuk membangun platform **LoadModer**.

---

## 1. Ringkasan "Golden Stack" LoadModer

```
┌─────────────────────────────────────────────────────────────┐
│                    LOADMODER GOLDEN STACK                   │
├───────────────────────┬─────────────────────────────────────┤
│ Bahasa & Runtime      │ TypeScript 5.5+ & Node.js 20+ (ESM) │
│ CLI Command Router    │ commander (v12+)                    │
│ TUI Dashboard & Nav   │ Raw Mode Keyboard Engine (↑/↓/Enter)│
│ Banner & Visual UI    │ figlet + gradient-string + chalk    │
│ Kotak & Pesan Header  │ boxen (round border)                │
│ Spinner & Feedback    │ ora + cli-progress (multi-bar)      │
│ Kontrol Konkurensi    │ p-limit                             │
│ Streaming ZIP Engine  │ unzipper (streaming memory-safe)    │
│ Validasi Skema        │ zod                                 │
│ Normalisasi Path      │ pathe                               │
│ State Lockfile        │ write-file-atomic                   │
│ Bundler & Kompilasi   │ tsup + @yao-pkg/pkg (atau Bun)      │
└───────────────────────┴─────────────────────────────────────┘
```

---

## 2. Komparasi Mendalam & Rationale Setiap Pustaka

### A. CLI Router: `commander` vs `yargs` vs `citty`
* **Pilihan**: `commander`
* **Mengapa bukan `yargs`?** `yargs` memiliki dependensi transitif yang besar, sehingga memperlambat waktu *cold start* CLI hingga 150–200ms.
* **Mengapa `commander`?**
  1. Sangat stabil, dokumentasi matang, dan tipe TypeScript bawaan yang sangat presisi.
  2. Mendukung sub-perintah bersarang (*nested subcommands*) dengan pemisahan berkas yang bersih.
  3. Memiliki parser opsi fleksibel: boolean flags, variadic arguments (`<mods...>`), negated flags (`--no-deps`), dan default values.
  4. Auto-generate halaman `--help` yang terstruktur dan mudah dibaca.

### B. Interaktivitas & Navigasi Panah: Sinergi `@clack/prompts` & `@inquirer/prompts`
* **Pilihan**: Sinergi Hibrida (`@clack/prompts` untuk wizard inisialisasi + `@inquirer/prompts` untuk navigasi dashboard menu & filter instan)
* **Rasional Desain UX & Performa**:
  * **`@inquirer/prompts`** digunakan untuk menu navigasi utama dashboard (`askInteractiveMenu`) dan pencarian mod instan (`askSearchMenu`). Menghilangkan *screen flickering* berkat algoritma *ANSI diff rendering* internal, mendukung kontrol panah (`↑`/`↓`), tombol Vim (`j`/`k`), lompatan nomor (`1-9`), serta built-in pagination (`pageSize`) tanpa perlu slicing manual.
  * **`@clack/prompts`** digunakan untuk alur wizard instalasi dan inisialisasi instance (`init`, `confirm`, `spinner`) karena gaya visual *rail layout* vertikal yang elegan dan minimalis.


### C. Pewarnaan & Formatting: `picocolors` vs `chalk`
* **Pilihan**: `picocolors`
* **Analisis Performa**:
  * `chalk` adalah pustaka luar biasa, namun memiliki bobot modul yang lebih besar dan runtime overhead dalam membangun string format ANSI.
  * `picocolors` dibuat oleh Alexey Raspopov (pencipta Nanoid). Ukurannya kurang dari **7 KB** (berbanding ~100 KB ekosistem chalk), **zero dependencies**, dan **3 hingga 4 kali lebih cepat** dalam tes benchmark pewarnaan terminal.
  * Untuk CLI yang sering mencetak ribuan baris log progres, penghematan CPU dari `picocolors` terasa sangat nyata.

### D. Progress Bar Unduhan Paralel: `cli-progress` vs `ora`
* **Pilihan**: Kombinasi `cli-progress` (untuk unduhan banyak file) + `@clack/prompts spinner` (untuk operasi single-task).
* **Fitur Utama `cli-progress`**:
  * Mendukung instansiasi **MultiBar**. Ketika mengunduh modpack dengan 50 mod secara paralel (3-5 unduhan aktif sekaligus), `cli-progress` merender bar independen untuk tiap worker tanpa saling menimpa tampilan.
  * Format template fleksibel: menampilkan kecepatan unduh (MB/s), ETA sisa waktu, ukuran file yang diterima vs total, dan nama file.
  * Ringan dan tidak membebani event loop Node.js.

### E. Concurrency Limiter: `p-limit`
* **Pilihan**: `p-limit` (oleh Sindre Sorhus)
* **Kebutuhan Teknis**:
  * Jika sebuah modpack berisi 80 mod dan semuanya langsung dipanggil dengan `Promise.all(urls.map(download))`, akan terjadi lonjakan 80 koneksi HTTP simultan. Hal ini memicu:
    1. Error `ECONNRESET` atau `ETIMEDOUT` dari jaringan lokal.
    2. Modrinth Cloudflare memblokir IP pengguna karena *burst rate limit*.
    3. Konsumsi soket TCP dan memori RAM membengkak.
  * Dengan `const limit = pLimit(4)`, seluruh 80 unduhan dimasukkan ke dalam antrean, namun hanya tepat **4 unduhan** yang berjalan bersamaan. Begitu satu selesai, unduhan berikutnya langsung diproses secara otomatis.

### F. ZIP Streaming Engine: `unzipper` vs `adm-zip`
* **Pilihan**: `unzipper` (atau `yauzl`)
* **Mengapa bukan `adm-zip`?** `adm-zip` membaca seluruh file ZIP ke dalam memori RAM (Buffer). Jika pengguna mengunduh modpack berukuran 300MB, Node.js akan mengalokasikan ratusan megabyte RAM hanya untuk membaca arsip tersebut.
* **Keunggulan `unzipper`**:
  * Sepenuhnya berbasis **Node.js Stream**.
  * Dapat membaca entri file secara streaming. Untuk mengambil file `modrinth.index.json` dari dalam file `.mrpack`, `unzipper` hanya memproses header file zip tanpa perlu mengekstrak seluruh modpack ke disk atau RAM.

### G. Validasi Skema Data: `zod`
* **Pilihan**: `zod`
* **Keamanan Data**:
  * Modrinth API v2, `modrinth.index.json`, dan file konfigurasi lokal `loadmoder.lock.json` berisiko memiliki inkonsistensi struktur (misalnya versi API baru atau field opsional bernilai `null`).
  * `zod` memvalidasi objek JSON saat runtime dan sekaligus mengekspor tipe TypeScript statis (`z.infer<typeof Schema>`). Menghilangkan kemungkinan runtime crash seperti `Cannot read property 'sha512' of undefined`.

### H. Build & Single-Binary Executable: `tsup` & `@yao-pkg/pkg`
* **Target Distribusi**:
  * Kompilasi source code TypeScript menggunakan `tsup` (berbasis `esbuild`). Waktu build kurang dari 1 detik.
  * Menggunakan `@yao-pkg/pkg` (atau `bun build --compile`) untuk menggabungkan Node.js runtime dan bundle JS menjadi satu file mandiri:
    * `loadmoder.exe` (Windows)
    * `loadmoder-linux` (Linux x64)
    * `loadmoder-macos` (macOS arm64/x64)
  * Pemain Minecraft cukup mengunduh file `.exe` dan memasukkannya ke direktori PATH atau menjalankannya langsung di CMD tanpa perlu menginstal Node.js/npm.

---

## 3. Spesifikasi `package.json`

Berikut adalah deklarasi dependensi produksi dan dependensi pengembangan yang telah teruji kompatibilitasnya:

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
    "boxen": "^8.0.1",
    "chalk": "^5.4.1",
    "cli-progress": "^3.12.0",
    "cli-table3": "^0.6.5",
    "commander": "^12.1.0",
    "figlet": "^1.8.0",
    "gradient-string": "^3.0.0",
    "ora": "^8.2.0",
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

## 4. Konfigurasi `tsconfig.json` Optimal

Dikonfigurasi khusus untuk performa modul ES (NodeNext) dan resolusi tipe yang ketat (*strict mode*):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```
