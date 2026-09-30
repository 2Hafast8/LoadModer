# Panduan Lengkap Integrasi Modrinth API dan Implementasi CLI Mod Manager Minecraft (TypeScript & Node.js)

Dokumen ini adalah panduan komprehensif mengenai **Modrinth API (Labrinth)**: aturan arsitektur, otentikasi, rate limit, struktur endpoint, dan migrasi versi API. Bagian utamanya adalah langkah demi langkah membangun **aplikasi CLI (Command Line Interface)** berbasis **Node.js & TypeScript** yang mencari, memasang, memperbarui, dan menghapus mod **langsung di folder `mods` Minecraft**.

**Fitur CLI yang dibangun di panduan ini:**

| Perintah | Fungsi |
| :--- | :--- |
| `mcmod search <kata kunci>` | Mencari mod di Modrinth dengan filter versi Minecraft & loader |
| `mcmod install <mod...>` | Mencari lalu memasang mod langsung ke folder mods, termasuk **dependensi wajib** |
| `mcmod list` | Menampilkan mod yang terpasang (dikenali otomatis lewat hash file) |
| `mcmod update` | Memperbarui semua mod terpasang ke versi terbaru yang kompatibel |
| `mcmod remove <nama>` | Menghapus mod terpasang |
| `mcmod config ...` | Menyimpan folder mods, versi Minecraft, dan loader bawaan |

**Prasyarat**: Node.js **20 atau lebih baru** (memakai `fetch` bawaan), npm, dan koneksi internet.

---

## 1. Arsitektur & Konsep Dasar Modrinth API (Labrinth)

Modrinth API (secara internal bernama **Labrinth**, versi dokumentasi saat ini `v2.7.0/366f528`) menggunakan arsitektur RESTful berbasis OpenAPI 3.0.0.

### A. Base URL & Lingkungan Pengujian
* **Environment Produksi**: `https://api.modrinth.com/v2`
* **Environment Staging (Pengujian)**: `https://staging-api.modrinth.com/`
* **Uji Koneksi (Base Endpoint)**:
  Permintaan GET ke staging URL mengembalikan data selamat datang dan versi backend:
  ```json
  {
    "about": "Welcome traveler!",
    "documentation": "https://docs.modrinth.com",
    "name": "modrinth-labrinth",
    "version": "2.7.0"
  }
  ```
  Jika respons serupa muncul, klien kamu sudah bisa memakai Modrinth API. Untuk produksi, ganti `staging-api.modrinth.com` dengan `api.modrinth.com`.

### B. Peralatan Pengujian API & CORS
* **Alat Pengujian Rekomendasi**: **cURL** (command-line), **ReqBIN** (online), **Postman**, **Insomnia**, atau browser web langsung untuk permintaan GET tanpa header khusus. Dokumentasi resmi tidak menyediakan fitur "try it out".
* **Cross-Origin Resource Sharing (CORS)**: API Modrinth mengimplementasikan CORS sesuai spesifikasi W3C dengan *wildcard same-origin*, sehingga seluruh data publik dapat diakses dari aplikasi web/browser mana pun.

---

## 2. Aturan Operasional & Akses API

### A. Header `User-Agent` (Wajib)
Modrinth mewajibkan setiap permintaan HTTP menyertakan header `User-Agent` yang **mengidentifikasi aplikasi secara unik**. Memakai header bawaan pustaka HTTP (seperti `okhttp/4.9.3`) meningkatkan risiko traffic kamu diblokir. Menyertakan kontak bersifat dianjurkan (bukan wajib) agar Modrinth bisa menghubungi kamu sebelum memblokir.

**Tingkat Kualitas Header `User-Agent`**:
* ❌ **Bad**: `User-Agent: okhttp/4.9.3`
* 🟢 **Good**: `User-Agent: nama_proyek`
* 🔵 **Better**: `User-Agent: username_github/nama_proyek/1.56.0`
* ⭐ **Best**: `User-Agent: username_github/nama_proyek/1.56.0 (contact@example.com)`

> Catatan: `fetch` bawaan Node.js mengirim `User-Agent: node` secara default, jadi **wajib** menimpanya secara eksplisit (sudah dilakukan di `src/modrinth.ts`).

### B. Batas Penggunaan (Rate Limits)
* **Batas per IP**: berlaku per alamat IP, baik memakai token maupun tidak.
* **Kuota Standard**: **300 permintaan per menit**. Jika butuh batas lebih tinggi, hubungi `support@modrinth.com`.
* **Header Indikator Respon**:
  * `X-Ratelimit-Limit`: jumlah maksimum permintaan per menit (300).
  * `X-Ratelimit-Remaining`: sisa permintaan dalam jendela waktu saat ini.
  * `X-Ratelimit-Reset`: waktu dalam detik hingga jendela rate limit di-reset.
* **Strategi di CLI**: saat menerima status `429`, klien menunggu sesuai `X-Ratelimit-Reset` lalu mengulang (maksimal 3 kali). Untuk efisiensi, CLI memakai endpoint **batch** (`/projects`, `/version_files`, `/version_files/update`) sehingga puluhan mod cukup 1 permintaan, bukan puluhan.

### C. Sistem Identifikasi Data (Identifiers)
1. **Base62 ID (8 karakter)**: ID unik yang konstan untuk proyek, versi, pengguna, thread, tim, dan laporan.
2. **Slug & Username**: nama yang mudah dibaca untuk proyek (*slug*) dan pengguna (*username*). Keduanya **dapat berubah kapan saja**, jadi untuk penyimpanan jangka panjang gunakan Base62 ID. Sebagian besar sub-route proyek (mis. `/v2/project/{id_or_slug}/version`) menerima slug sebagai pengganti ID.
3. **File Hashes**: berkas versi diidentifikasi dengan hash **SHA-1** atau **SHA-512**. CLI ini memakai SHA-1 untuk mengenali file yang sudah terpasang dan SHA-512 untuk memverifikasi file hasil unduhan.

### D. Status Error yang Perlu Ditangani
| Status | Arti | Penanganan di CLI |
| :--- | :--- | :--- |
| `400` | Permintaan tidak valid (mis. facets salah format) | Tampilkan pesan error dari body respons |
| `401` | Token tidak ada / scope tidak sesuai | Tidak terjadi pada operasi publik; relevan bila nanti menambah fitur yang butuh token |
| `404` | Proyek/versi tidak ditemukan | Tampilkan pesan dan lanjut ke mod berikutnya |
| `410` | Versi API sudah dihentikan permanen | Hentikan dan minta pengguna memperbarui aplikasi |
| `429` | Terkena rate limit | Tunggu `X-Ratelimit-Reset`, ulangi otomatis |

---

## 3. Otentikasi, Token & Akses Keamanan

Permintaan publik (mencari mod, membaca detail versi, mengunduh file) **tidak memerlukan token**. Itu sebabnya CLI mod manager di panduan ini tidak membutuhkan login apa pun.

### A. Penggunaan Token Akses
Token otentikasi **wajib** untuk:
1. **Membuat data baru** (mis. mengunggah versi/file mod baru).
2. **Mengubah data** (mis. mengedit rincian proyek).
3. **Mengakses data privat** (draf proyek, notifikasi, email pengguna, data payout).

### B. Skema Otentikasi & Token
* **Tipe**: Personal Access Token (PAT) atau OAuth2. Semua token terikat ke satu pengguna Modrinth.
* **Header**: `Authorization: mrp_TOKEN_ANDA`
* **Membuat PAT**: lewat pengaturan akun Modrinth (`https://modrinth.com/settings/account`).
* **Scope**: setiap token punya cakupan izin, mis. `USER_READ_EMAIL`. Permintaan tanpa scope yang sesuai menghasilkan error `401`.
* **Depresiasi Token GitHub**: token GitHub masih didukung demi kompatibilitas, tetapi **akan berhenti berfungsi saat API v3 dirilis** untuk umum. Beralihlah ke PAT.
* **Aksi khusus frontend**: beberapa tindakan sensitif (mis. menghapus akun) tidak bisa dilakukan lewat API.

> ⚠️ Jangan pernah mengirim token Modrinth ke domain selain API Modrinth (termasuk saat mengunduh file dari CDN), dan jangan commit token ke repositori.

---

## 4. Struktur Endpoint Modrinth API v2

| Kategori | Base Route | Fitur Utama |
| :--- | :--- | :--- |
| **`projects`** | `/v2/search`, `/v2/project/{id}` | Mencari proyek, detail proyek, galeri, dependensi, follow/unfollow |
| **`versions`** | `/v2/project/{id}/version`, `/v2/version/{id}` | Daftar versi, ambil versi berdasarkan ID/nomor, unggah versi baru |
| **`version-files`** | `/v2/version_file/{hash}`, `/v2/version_files` | Detail versi dari hash file, serta versi terbaru berdasarkan loader & versi game |
| **`users`** | `/v2/user/{id}` | Profil, proyek milik pengguna, proyek diikuti, payout |
| **`notifications`** | `/v2/user/{id}/notifications` | Membaca, menghapus, menandai notifikasi |
| **`teams` & `threads`** | `/v2/team/{id}`, `/v2/thread/{id}` | Anggota tim, ownership, pesan thread, laporan (*reports*) |
| **`tags`** | `/v2/tag/category`, `/v2/tag/loader`, `/v2/tag/game_version` | Daftar kategori, loader, versi Minecraft, lisensi, tipe proyek |
| **`misc`** | `/v2/statistics`, `/v2/updates/{id}/forge_updates.json` | Statistik instance dan file update Forge |

### A. Endpoint yang Dipakai oleh CLI Ini
| Method & Path | Dipakai untuk |
| :--- | :--- |
| `GET /search` | Mencari mod (`query`, `facets`, `index`, `limit`, `offset`) |
| `GET /project/{id\|slug}` | Detail proyek |
| `GET /projects?ids=["a","b"]` | Mengambil judul/slug banyak proyek sekaligus |
| `GET /project/{id\|slug}/version` | Daftar versi, difilter `game_versions` & `loaders` |
| `GET /version/{id}` | Detail satu versi (untuk dependensi yang dipatok ke versi tertentu) |
| `POST /version_files` | Mengenali file terpasang: peta hash → versi |
| `POST /version_files/update` | Versi terbaru untuk banyak hash sekaligus (perintah `update`) |
| `GET https://cdn.modrinth.com/...` | Mengunduh file `.jar` (URL dari field `files[].url`) |

### B. Parameter `/search`
* **`query`**: kata kunci.
* **`facets`**: string JSON berupa array bersarang. **Satu array = OR**, **array berbeda = AND**.
  * Contoh: `[["project_type:mod"],["versions:1.21.1"],["categories:fabric"]]` → proyek bertipe mod **DAN** mendukung 1.21.1 **DAN** loader fabric.
  * Facet umum: `project_type`, `categories` (**loader digabung dengan categories**), `versions`, `open_source`, `environment`, `license`, dll.
  * Operator: `:` (sama dengan `=`), `!=`, `>=`, `>`, `<=`, `<`.
* **`index`**: urutan hasil: `relevance` (default), `downloads`, `follows`, `newest`, `updated`.
* **`limit`**: default 10, maksimum 100. **`offset`**: untuk paginasi.
* Respons berisi `hits[]` (dengan `project_id`, `slug`, `title`, `description`, `author`, `downloads`, `versions`, dll.) beserta `offset`, `limit`, `total_hits`.

### C. Parameter `/project/{id}/version`
* `game_versions` dan `loaders` berupa **string JSON array**, mis. `game_versions=["1.21.1"]&loaders=["fabric"]`.
* Setiap versi memiliki `version_type` (`release` | `beta` | `alpha`), `dependencies[]`, dan `files[]` (dengan `hashes.sha1`, `hashes.sha512`, `url`, `filename`, `primary`, `size`).
* Field `dependencies[].dependency_type` bernilai `required`, `optional`, `incompatible`, atau `embedded`. `version_id` dan `project_id` bisa `null`.
* Jika tidak ada file yang bertanda `primary: true`, anggap file pertama sebagai file utama.

### D. `POST /version_files/update` (Pembaruan Massal)
Body JSON:
```json
{
  "hashes": ["<sha1 file 1>", "<sha1 file 2>"],
  "algorithm": "sha1",
  "loaders": ["fabric"],
  "game_versions": ["1.21.1"],
  "version_types": ["release"]
}
```
Respons berupa peta `hash → objek versi terbaru`. `hashes`, `algorithm`, `loaders`, dan `game_versions` wajib; `version_types` opsional (`release`, `beta`, `alpha`).

---

## 5. Migrasi API & Plugin Minotaur (Gradle)

### A. Kebijakan Versi API
Ketika terjadi *breaking change*, versi API pada URL dinaikkan (mis. v1 ke v2) dan langkah migrasi dipublikasikan. API versi lama langsung dianggap *deprecated*, tanpa jaminan dukungan dan tanpa kepastian berapa lama masih hidup. Modrinth menerapkan berbagai taktik agar pengembang segera berpindah, misalnya menyisipkan teks `"STOP USING THIS API"` pada data respons. Setelah dihentikan sepenuhnya, endpoint akan **selalu** mengembalikan error `410 Gone`, jadi aplikasi harus menangani status ini.

### B. Ringkasan Perubahan API v1 ke v2
* Field ber-istilah `mod` bergeser menjadi `project` (mis. `mod_id` → `project_id`).
* Route pencarian dipindah dari `/api/v1/mod` ke `/v2/search`.
* Field proyek baru: `project_type` (`mod` atau `modpack`), `moderation_message` (berisi `message` dan `body`), dan `gallery`.
* Facet pencarian baru: `project_type`. Pengurutan alfabetis dihapus.
* Status proyek baru: `archived` (tidak muncul di pencarian).
* Galeri gambar, URL donasi, tag (kategori/loader) dengan ikon SVG, dan notifikasi bertipe (`type`, mis. `project_update`).
* Dependensi lama dihapus dan diganti sistem baru.
* Berkas yang diunggah kini divalidasi sebagai mod/modpack yang valid.
* Sub-route proyek dan pengguna mendukung slug sebagai pengganti ID.

### C. Plugin Minotaur v1 ke v2 (Gradle)
Minotaur adalah plugin Gradle resmi Modrinth untuk mempublikasikan mod; versi mayor Minotaur sejalan dengan versi mayor API.
* Task otomatis bernama `modrinth` menggantikan `publishModrinth` (cukup tulis blok `modrinth {`).
* Versi game dan loader dideklarasikan lewat array `gameVersions` dan `loaders`.
* `versionType` menggantikan `releaseType`.
* Blok DSL dependensi baru, mis. `required.project("fabric-api")`.
* Slug boleh dipakai di mana pun yang sebelumnya meminta project ID.

---

## 6. Rancangan CLI Mod Manager

### A. Alur Kerja `mcmod install`
```text
1. Tentukan filter  : versi Minecraft + loader (flag > config > prompt interaktif)
2. Tentukan folder  : --dir > config > folder .minecraft/mods bawaan OS
3. Pindai folder    : hitung SHA-1 tiap .jar -> POST /version_files -> tahu mod apa yang sudah ada
4. Cari mod         : GET /search dengan facets (mod + versi + loader) -> pilih dari daftar
5. Ambil versi      : GET /project/{slug}/version -> pilih rilis stabil terbaru
6. Unduh            : ke <file>.jar.part -> verifikasi SHA-512 -> rename atomik menjadi .jar
7. Dependensi       : tiap dependency_type "required" diproses rekursif (dengan penjaga loop)
8. Rapikan          : hapus file versi lama dari mod yang sama agar tidak duplikat
```

**Keputusan desain penting:**
* **Stateless**: status "mod apa yang terpasang" dibaca dari hash file di folder mods, bukan dari file kunci (lockfile) terpisah. Jadi mod yang kamu tambahkan manual pun ikut dikenali selama ada di Modrinth.
* **Unduhan aman**: file ditulis ke `.part` dulu, sehingga unduhan yang terputus tidak pernah dimuat Minecraft. File yang checksum SHA-512-nya tidak cocok otomatis dibuang.
* **Dependensi**: hanya `required` yang dipasang. `optional` hanya ditampilkan sebagai saran, `incompatible` memunculkan peringatan, `embedded` diabaikan (sudah tertanam di jar).
* **Pilihan versi**: rilis stabil (`release`) diprioritaskan; jika belum ada, dipakai versi beta/alpha terbaru dengan pemberitahuan.

### B. Lokasi Folder Mods Cross-Platform
| OS | Path Folder `.minecraft/mods` |
| :--- | :--- |
| **Windows** | `%APPDATA%\.minecraft\mods` |
| **macOS** | `~/Library/Application Support/minecraft/mods` |
| **Linux** | `~/.minecraft/mods` |

Jika kamu memakai launcher lain (Prism, MultiMC, dll.) yang punya folder instance sendiri, arahkan CLI ke folder `mods` instance tersebut dengan `--dir <path>` atau `mcmod config set mods-dir <path>`.

### C. Struktur Proyek
```text
mc-mod-cli/
├── package.json
├── tsconfig.json
└── src/
    ├── constants.ts   # Nama app, versi, User-Agent, base URL API
    ├── types.ts       # Tipe data respons Modrinth & konfigurasi
    ├── utils.ts       # Path folder mods, hash file, baca/tulis config
    ├── modrinth.ts    # Klien API v2 (retry rate limit, unduh + verifikasi)
    ├── installer.ts   # Pindai folder, resolusi dependensi, pemasangan
    └── index.ts       # Entry point CLI (Commander + prompt interaktif)
```

---

## 7. Inisialisasi Proyek

### A. Install Dependencies
Hanya dua dependensi runtime, karena HTTP memakai `fetch` bawaan Node.js dan file system memakai `node:fs/promises`:
```bash
mkdir mc-mod-cli && cd mc-mod-cli
npm init -y
npm install commander @inquirer/prompts
npm install -D typescript @types/node tsx
mkdir src
```

| Paket | Kegunaan |
| :--- | :--- |
| `commander` | Parser perintah & opsi CLI |
| `@inquirer/prompts` | Prompt interaktif (pilih mod, konfirmasi) |
| `typescript`, `@types/node` | Kompilasi & tipe Node.js |
| `tsx` | Menjalankan TypeScript langsung saat pengembangan (mendukung ESM dengan baik) |

### B. `package.json`
Ubah/lengkapi field berikut (`"type": "module"` **wajib** karena kode memakai ES Modules dan `top-level await`):
```json
{
  "name": "mc-mod-cli",
  "version": "1.0.0",
  "description": "CLI mod manager Minecraft berbasis Modrinth API v2",
  "type": "module",
  "bin": { "mcmod": "./dist/index.js" },
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

### C. `tsconfig.json`
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
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```

---

## 8. Kode Sumber Lengkap

### A. `src/constants.ts`
```typescript
export const APP_NAME = 'mc-mod-cli';
export const APP_VERSION = '1.0.0';

// Ganti dengan username GitHub kamu (format User-Agent "Better/Best" dari dokumentasi Modrinth)
export const GITHUB_USER = 'hafiznovelrianto';

// Kontak opsional: set lewat env MCMOD_CONTACT (email/URL) agar Modrinth bisa menghubungi kamu
const contact = process.env.MCMOD_CONTACT;
export const USER_AGENT = `${GITHUB_USER}/${APP_NAME}/${APP_VERSION}${contact ? ` (${contact})` : ''}`;

// Bisa diganti ke staging untuk uji: MODRINTH_API_URL=https://staging-api.modrinth.com/v2
export const API_BASE_URL = process.env.MODRINTH_API_URL ?? 'https://api.modrinth.com/v2';
```

### B. `src/types.ts`
```typescript
export type DependencyType = 'required' | 'optional' | 'incompatible' | 'embedded';
export type VersionType = 'release' | 'beta' | 'alpha';

export interface ModSearchHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  downloads: number;
  versions: string[];
  categories: string[];
  project_type: string;
}

export interface SearchResponse {
  hits: ModSearchHit[];
  offset: number;
  limit: number;
  total_hits: number;
}

export interface ModVersionFile {
  hashes: { sha1: string; sha512: string };
  url: string;
  filename: string;
  primary: boolean;
  size: number;
}

export interface ModDependency {
  version_id: string | null;
  project_id: string | null;
  file_name?: string | null;
  dependency_type: DependencyType;
}

export interface ModVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  version_type: VersionType;
  game_versions: string[];
  loaders: string[];
  date_published: string;
  files: ModVersionFile[];
  dependencies: ModDependency[];
}

export interface ModProject {
  id: string;
  slug: string;
  title: string;
}

/** Filter kompatibilitas: versi Minecraft & mod loader */
export interface Filter {
  gameVersion?: string;
  loader?: string;
}

export interface Config {
  modsDir?: string;
  gameVersion?: string;
  loader?: string;
}
```

### C. `src/utils.ts`
Berisi deteksi folder mods per OS, hashing file secara *streaming* (hemat memori untuk jar besar), dan penyimpanan konfigurasi.
```typescript
import os from 'node:os';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import type { Config } from './types.js';

/** Folder .minecraft bawaan launcher resmi, sesuai OS */
export function getMinecraftDir(): string {
  const home = os.homedir();
  switch (process.platform) {
    case 'win32':
      return path.join(process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming'), '.minecraft');
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'minecraft');
    default:
      return path.join(home, '.minecraft');
  }
}

export function getDefaultModsDir(): string {
  return path.join(getMinecraftDir(), 'mods');
}

/** Prioritas: flag --dir > config > folder bawaan */
export function resolveModsDir(override: string | undefined, config: Config): string {
  return path.resolve(override ?? config.modsDir ?? getDefaultModsDir());
}

export async function hashFile(filePath: string, algorithm: 'sha1' | 'sha512'): Promise<string> {
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

export async function listJarFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.jar')).map((e) => e.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(n);
}

// ---------- Config (~/.mcmod/config.json) ----------
export const CONFIG_PATH = path.join(process.env.MCMOD_HOME ?? path.join(os.homedir(), '.mcmod'), 'config.json');

export async function loadConfig(): Promise<Config> {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8')) as Config;
  } catch {
    return {};
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
}
```

### D. `src/modrinth.ts`
Klien API: menambahkan `User-Agent` wajib, menangani `429`/`410`, memakai endpoint batch, dan mengunduh dengan verifikasi SHA-512.
```typescript
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { API_BASE_URL } from './constants.js';
import { hashFile } from './utils.js';
import type { Filter, ModProject, ModVersion, SearchResponse } from './types.js';

export class ModrinthError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ModrinthError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number>;
  body?: unknown;
}

export type SearchIndex = 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ModrinthClient {
  constructor(private readonly userAgent: string, private readonly baseUrl = API_BASE_URL) {}

  private async request<T>(endpoint: string, opts: RequestOptions = {}, attempt = 0): Promise<T> {
    const url = new URL(this.baseUrl + endpoint);
    for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, String(v));

    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        'User-Agent': this.userAgent, // wajib menurut aturan Modrinth
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    // Rate limit (300 req/menit per IP): tunggu sesuai X-Ratelimit-Reset lalu ulangi
    if (res.status === 429 && attempt < 3) {
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      await sleep((Number.isFinite(reset) && reset > 0 ? reset : 2) * 1000 + 250);
      return this.request<T>(endpoint, opts, attempt + 1);
    }

    if (!res.ok) {
      if (res.status === 410) {
        throw new ModrinthError('API versi ini sudah dihentikan (410 Gone). Perbarui aplikasi ke versi API terbaru.', 410);
      }
      const detail = await res.text().catch(() => '');
      throw new ModrinthError(`Modrinth API ${res.status} ${res.statusText} pada ${endpoint} ${detail}`.trim(), res.status);
    }
    return (await res.json()) as T;
  }

  // ---------- Projects ----------
  search(query: string, filter: Filter, limit = 10, index: SearchIndex = 'relevance'): Promise<SearchResponse> {
    const facets: string[][] = [['project_type:mod']]; // baris berbeda = AND
    if (filter.gameVersion) facets.push([`versions:${filter.gameVersion}`]);
    if (filter.loader) facets.push([`categories:${filter.loader}`]); // loader digabung dengan categories
    return this.request('/search', { query: { query, facets: JSON.stringify(facets), limit, index } });
  }

  getProject(idOrSlug: string): Promise<ModProject> {
    return this.request(`/project/${encodeURIComponent(idOrSlug)}`);
  }

  getProjects(ids: string[]): Promise<ModProject[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.request('/projects', { query: { ids: JSON.stringify(ids) } });
  }

  // ---------- Versions ----------
  async getProjectVersions(idOrSlug: string, filter: Filter): Promise<ModVersion[]> {
    const query: Record<string, string> = {};
    if (filter.gameVersion) query.game_versions = JSON.stringify([filter.gameVersion]);
    if (filter.loader) query.loaders = JSON.stringify([filter.loader]);
    const versions = await this.request<ModVersion[]>(`/project/${encodeURIComponent(idOrSlug)}/version`, { query });
    return versions.sort((a, b) => b.date_published.localeCompare(a.date_published)); // terbaru dulu
  }

  getVersion(versionId: string): Promise<ModVersion> {
    return this.request(`/version/${encodeURIComponent(versionId)}`);
  }

  // ---------- Version files (berdasarkan hash) ----------
  /** Identifikasi file .jar yang sudah terpasang: peta sha1 -> versi Modrinth */
  getVersionsByHashes(sha1Hashes: string[]): Promise<Record<string, ModVersion>> {
    if (sha1Hashes.length === 0) return Promise.resolve({});
    return this.request('/version_files', { method: 'POST', body: { hashes: sha1Hashes, algorithm: 'sha1' } });
  }

  /** Versi terbaru untuk banyak file sekaligus (dipakai perintah update) */
  getLatestByHashes(sha1Hashes: string[], filter: Required<Filter>, includePrerelease: boolean): Promise<Record<string, ModVersion>> {
    if (sha1Hashes.length === 0) return Promise.resolve({});
    return this.request('/version_files/update', {
      method: 'POST',
      body: {
        hashes: sha1Hashes,
        algorithm: 'sha1',
        loaders: [filter.loader],
        game_versions: [filter.gameVersion],
        version_types: includePrerelease ? ['release', 'beta', 'alpha'] : ['release'],
      },
    });
  }

  // ---------- Download ----------
  /** Unduh ke <dest>.part, verifikasi SHA-512, lalu rename atomik ke dest */
  async download(
    url: string,
    dest: string,
    opts: { sha512?: string; size?: number; onProgress?: (received: number, total: number) => void } = {},
  ): Promise<void> {
    await mkdir(path.dirname(dest), { recursive: true });
    const res = await fetch(url, { headers: { 'User-Agent': this.userAgent } });
    if (!res.ok || !res.body) throw new ModrinthError(`Gagal mengunduh (${res.status}): ${url}`, res.status);

    const total = Number(res.headers.get('content-length')) || opts.size || 0;
    const tmp = `${dest}.part`; // bukan .jar, jadi tidak akan dimuat Minecraft jika terputus
    let received = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        received += chunk.length;
        opts.onProgress?.(received, total);
        cb(null, chunk);
      },
    });

    try {
      await pipeline(Readable.fromWeb(res.body as unknown as WebReadableStream), counter, createWriteStream(tmp));
      if (opts.sha512) {
        const actual = await hashFile(tmp, 'sha512');
        if (actual.toLowerCase() !== opts.sha512.toLowerCase()) {
          throw new Error('Checksum SHA-512 tidak cocok, file dibatalkan (kemungkinan korup).');
        }
      }
      await rename(tmp, dest);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
  }
}
```

### E. `src/installer.ts`
Logika inti: memindai folder, menentukan versi terbaik, dan memasang mod beserta dependensi wajib secara rekursif.
```typescript
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { formatBytes, hashFile, listJarFiles } from './utils.js';
import type { ModrinthClient } from './modrinth.js';
import type { Filter, ModDependency, ModVersion } from './types.js';

export interface InstalledMod {
  filename: string;
  filePath: string;
  sha1: string;
  /** Terisi jika file dikenali Modrinth lewat hash */
  version?: ModVersion;
}

/** Pindai folder mods: hitung SHA-1 tiap .jar lalu identifikasi via Modrinth */
export async function scanInstalled(api: ModrinthClient, modsDir: string): Promise<InstalledMod[]> {
  const mods: InstalledMod[] = [];
  for (const filename of await listJarFiles(modsDir)) {
    const filePath = path.join(modsDir, filename);
    mods.push({ filename, filePath, sha1: await hashFile(filePath, 'sha1') });
  }
  const known = await api.getVersionsByHashes(mods.map((m) => m.sha1));
  for (const m of mods) m.version = known[m.sha1];
  return mods;
}

/** Pilih versi terbaik: utamakan release, jika tidak ada pakai yang terbaru apa pun tipenya */
export function pickBestVersion(versions: ModVersion[]): ModVersion | undefined {
  return versions.find((v) => v.version_type === 'release') ?? versions[0];
}

export interface InstallOptions {
  modsDir: string;
  filter: Filter;
  withDeps: boolean;
  dryRun: boolean;
}

export class Installer {
  private installedByProject = new Map<string, InstalledMod>();
  private handled = new Set<string>();
  readonly optionalDeps = new Set<string>();
  readonly summary = { installed: 0, skipped: 0, replaced: 0, failed: 0 };

  constructor(private readonly api: ModrinthClient, private readonly opts: InstallOptions) {}

  async init(): Promise<void> {
    for (const mod of await scanInstalled(this.api, this.opts.modsDir)) {
      if (mod.version) this.installedByProject.set(mod.version.project_id, mod);
    }
  }

  async installVersion(version: ModVersion, isDependency = false): Promise<void> {
    if (this.handled.has(version.project_id)) return; // cegah loop dependensi melingkar
    this.handled.add(version.project_id);

    const file = version.files.find((f) => f.primary) ?? version.files[0];
    if (!file) {
      console.warn(`⚠️  ${version.name}: tidak ada file untuk diunduh.`);
      this.summary.failed++;
      return;
    }

    const existing = this.installedByProject.get(version.project_id);
    const label = `${file.filename}${isDependency ? ' (dependensi)' : ''}`;

    if (existing?.version?.id === version.id) {
      console.log(`⏩ ${label} sudah terpasang dan identik.`);
      this.summary.skipped++;
    } else if (isDependency && existing) {
      console.log(`⏩ Dependensi ${label} sudah terpasang sebagai ${existing.filename}.`);
      this.summary.skipped++;
    } else if (this.opts.dryRun) {
      console.log(`🧪 [dry-run] akan mengunduh ${label} (${formatBytes(file.size)})`);
    } else {
      console.log(`⬇️  ${label} (${formatBytes(file.size)})`);
      const dest = path.join(this.opts.modsDir, file.filename);
      await this.api.download(file.url, dest, {
        sha512: file.hashes.sha512,
        size: file.size,
        onProgress: (got, total) => {
          if (process.stdout.isTTY && total > 0) {
            process.stdout.write(`\r   ${formatBytes(got)} / ${formatBytes(total)} (${Math.floor((got / total) * 100)}%)   `);
          }
        },
      });
      if (process.stdout.isTTY) process.stdout.write('\r' + ' '.repeat(60) + '\r');
      console.log(`✅ Terpasang: ${dest}`);

      if (existing && existing.filename !== file.filename) {
        await rm(existing.filePath, { force: true }); // hapus versi lama agar tidak ada duplikat
        console.log(`🗑️  Versi lama dihapus: ${existing.filename}`);
        this.summary.replaced++;
      } else {
        this.summary.installed++;
      }
    }

    await this.handleDependencies(version);
  }

  private async handleDependencies(version: ModVersion): Promise<void> {
    for (const dep of version.dependencies) {
      if (dep.dependency_type === 'incompatible' && dep.project_id && this.installedByProject.has(dep.project_id)) {
        console.warn(`⚠️  ${version.name} tidak kompatibel dengan mod terpasang: ${this.installedByProject.get(dep.project_id)!.filename}`);
      }
      if (dep.dependency_type === 'optional' && dep.project_id) this.optionalDeps.add(dep.project_id);
      if (dep.dependency_type !== 'required' || !this.opts.withDeps) continue;

      try {
        const depVersion = await this.resolveDependency(dep);
        if (depVersion) await this.installVersion(depVersion, true);
      } catch (err) {
        this.summary.failed++;
        console.warn(`⚠️  Gagal memproses dependensi ${dep.project_id ?? dep.version_id}: ${(err as Error).message}`);
      }
    }
  }

  private async resolveDependency(dep: ModDependency): Promise<ModVersion | undefined> {
    if (dep.project_id && this.installedByProject.has(dep.project_id)) return undefined; // sudah ada
    if (dep.version_id) return this.api.getVersion(dep.version_id); // versi dipatok pengembang mod
    if (dep.project_id) return pickBestVersion(await this.api.getProjectVersions(dep.project_id, this.opts.filter));
    return undefined;
  }
}
```

### F. `src/index.ts`
Entry point CLI dengan perintah `search`, `install`, `list`, `update`, `remove`, dan `config`.
```typescript
#!/usr/bin/env node
import { rm } from 'node:fs/promises';
import { Command } from 'commander';
import { confirm, input, select } from '@inquirer/prompts';
import { APP_VERSION, USER_AGENT } from './constants.js';
import { ModrinthClient } from './modrinth.js';
import { Installer, pickBestVersion, scanInstalled } from './installer.js';
import type { Config, Filter } from './types.js';
import { CONFIG_PATH, formatNumber, loadConfig, resolveModsDir, saveConfig } from './utils.js';

const api = new ModrinthClient(USER_AGENT);
const program = new Command();

const LOADERS = ['fabric', 'forge', 'neoforge', 'quilt'];
const CONFIG_KEYS: Record<string, keyof Config> = { 'mods-dir': 'modsDir', 'mc-version': 'gameVersion', loader: 'loader' };

interface CommonOpts {
  mcVersion?: string;
  loader?: string;
  dir?: string;
  dryRun?: boolean;
  yes?: boolean;
}

/** Ambil versi MC & loader dari flag > config > prompt interaktif */
async function ensureFilter(opts: CommonOpts, config: Config): Promise<Required<Filter>> {
  let gameVersion = opts.mcVersion ?? config.gameVersion;
  let loader = opts.loader ?? config.loader;
  if (gameVersion && loader) return { gameVersion, loader };

  if (!process.stdin.isTTY) {
    throw new Error('Versi Minecraft & loader belum ditentukan. Pakai -v/-l atau: mcmod config set mc-version 1.21.1');
  }
  gameVersion ??= (await input({ message: 'Versi Minecraft (contoh 1.21.1):', validate: (v) => v.trim() !== '' || 'Wajib diisi' })).trim();
  loader ??= await select({ message: 'Mod loader:', choices: LOADERS.map((l) => ({ name: l, value: l })) });
  return { gameVersion, loader };
}

function handle<A extends unknown[]>(fn: (...args: A) => Promise<void>) {
  return async (...args: A): Promise<void> => {
    try {
      await fn(...args);
    } catch (err) {
      if (err instanceof Error && err.name === 'ExitPromptError') return; // Ctrl+C saat prompt
      console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  };
}

program.name('mcmod').description('CLI Mod Manager Minecraft berbasis Modrinth API v2').version(APP_VERSION);

// ---------------- search ----------------
program
  .command('search')
  .description('Cari mod di Modrinth (tanpa memasang)')
  .argument('<query>', 'Kata kunci')
  .option('-v, --mc-version <version>', 'Versi Minecraft')
  .option('-l, --loader <loader>', 'fabric | forge | neoforge | quilt')
  .option('-n, --limit <n>', 'Jumlah hasil (maks 100)', '10')
  .option('-s, --sort <index>', 'relevance | downloads | follows | newest | updated', 'relevance')
  .action(
    handle(async (query: string, opts: CommonOpts & { limit: string; sort: string }) => {
      const config = await loadConfig();
      const filter: Filter = { gameVersion: opts.mcVersion ?? config.gameVersion, loader: opts.loader ?? config.loader };
      const res = await api.search(query, filter, Math.min(Number(opts.limit) || 10, 100), opts.sort as never);
      if (res.hits.length === 0) return console.log('❌ Mod tidak ditemukan.');
      console.log(`Ditemukan ${res.total_hits} mod (menampilkan ${res.hits.length}):\n`);
      for (const m of res.hits) {
        console.log(`• ${m.title} [${m.slug}] oleh ${m.author} — ⬇ ${formatNumber(m.downloads)}\n  ${m.description}`);
      }
    }),
  );

// ---------------- install ----------------
program
  .command('install')
  .description('Cari mod lalu pasang langsung ke folder mods (beserta dependensi wajib)')
  .argument('<mods...>', 'Kata kunci pencarian, atau slug/ID jika memakai --slug')
  .option('-v, --mc-version <version>', 'Versi Minecraft (contoh: 1.21.1)')
  .option('-l, --loader <loader>', 'Mod loader')
  .option('-d, --dir <path>', 'Folder mods kustom (mis. instance Prism/MultiMC)')
  .option('--slug', 'Perlakukan argumen sebagai slug/ID persis, lewati pencarian')
  .option('--no-deps', 'Jangan pasang dependensi wajib')
  .option('--dry-run', 'Simulasi tanpa mengunduh')
  .option('-y, --yes', 'Otomatis pilih hasil pertama tanpa bertanya')
  .action(
    handle(async (queries: string[], opts: CommonOpts & { slug?: boolean; deps: boolean }) => {
      const config = await loadConfig();
      const filter = await ensureFilter(opts, config);
      const modsDir = resolveModsDir(opts.dir, config);
      console.log(`📁 Folder mods : ${modsDir}\n🎮 Target      : Minecraft ${filter.gameVersion} / ${filter.loader}\n`);

      const installer = new Installer(api, { modsDir, filter, withDeps: opts.deps, dryRun: !!opts.dryRun });
      await installer.init();

      for (const query of queries) {
        let slug = query;
        if (!opts.slug) {
          console.log(`🔍 Mencari "${query}"...`);
          const { hits } = await api.search(query, filter, 10);
          if (hits.length === 0) {
            console.log(`❌ "${query}" tidak ditemukan untuk ${filter.gameVersion}/${filter.loader}.`);
            continue;
          }
          slug =
            opts.yes || hits.length === 1
              ? hits[0].slug
              : await select({
                  message: 'Pilih mod:',
                  choices: hits.map((m) => ({
                    name: `${m.title} (⬇ ${formatNumber(m.downloads)})`,
                    value: m.slug,
                    description: m.description,
                  })),
                });
        }

        const versions = await api.getProjectVersions(slug, filter);
        const best = pickBestVersion(versions);
        if (!best) {
          console.log(`❌ ${slug}: tidak ada versi untuk ${filter.gameVersion}/${filter.loader}.`);
          continue;
        }
        if (best.version_type !== 'release') console.log(`ℹ️  ${slug}: belum ada rilis stabil, memakai ${best.version_type} ${best.version_number}.`);
        console.log(`🚀 Memasang ${slug} ${best.version_number}`);
        await installer.installVersion(best);
      }

      const s = installer.summary;
      console.log(`\n✨ Selesai — baru: ${s.installed}, diperbarui: ${s.replaced}, dilewati: ${s.skipped}, gagal: ${s.failed}`);
      if (installer.optionalDeps.size > 0) {
        const projects = await api.getProjects([...installer.optionalDeps]);
        console.log(`💡 Dependensi opsional (tidak dipasang): ${projects.map((p) => p.slug).join(', ')}`);
      }
      if (s.installed + s.replaced > 0) console.log('ℹ️  Jika Minecraft sedang berjalan, restart agar mod dimuat.');
    }),
  );

// ---------------- list ----------------
program
  .command('list')
  .description('Tampilkan mod yang terpasang (dikenali lewat hash file)')
  .option('-d, --dir <path>', 'Folder mods kustom')
  .action(
    handle(async (opts: CommonOpts) => {
      const config = await loadConfig();
      const modsDir = resolveModsDir(opts.dir, config);
      const mods = await scanInstalled(api, modsDir);
      if (mods.length === 0) return console.log(`Folder kosong: ${modsDir}`);

      const projects = await api.getProjects([...new Set(mods.flatMap((m) => (m.version ? [m.version.project_id] : [])))]);
      const titleOf = new Map(projects.map((p) => [p.id, p.title]));
      console.log(`📁 ${modsDir}\n`);
      for (const m of mods) {
        const title = m.version ? titleOf.get(m.version.project_id) ?? m.version.project_id : '(tidak dikenal di Modrinth)';
        console.log(`• ${title}${m.version ? ` ${m.version.version_number}` : ''}  —  ${m.filename}`);
      }
      console.log(`\nTotal: ${mods.length} mod`);
    }),
  );

// ---------------- update ----------------
program
  .command('update')
  .description('Perbarui semua mod terpasang ke versi terbaru yang kompatibel')
  .option('-v, --mc-version <version>', 'Versi Minecraft')
  .option('-l, --loader <loader>', 'Mod loader')
  .option('-d, --dir <path>', 'Folder mods kustom')
  .option('--prerelease', 'Sertakan beta/alpha')
  .option('--dry-run', 'Hanya tampilkan pembaruan yang tersedia')
  .option('-y, --yes', 'Tanpa konfirmasi')
  .action(
    handle(async (opts: CommonOpts & { prerelease?: boolean }) => {
      const config = await loadConfig();
      const filter = await ensureFilter(opts, config);
      const modsDir = resolveModsDir(opts.dir, config);

      const known = (await scanInstalled(api, modsDir)).filter((m) => m.version);
      const latest = await api.getLatestByHashes(known.map((m) => m.sha1), filter, !!opts.prerelease);
      const updates = known.flatMap((m) => {
        const next = latest[m.sha1];
        // bandingkan tanggal agar tidak menurunkan mod yang lebih baru dari "rilis stabil terakhir"
        return next && next.id !== m.version!.id && next.date_published > m.version!.date_published ? [{ mod: m, next }] : [];
      });

      if (updates.length === 0) return console.log('✅ Semua mod sudah terbaru.');
      for (const { mod, next } of updates) console.log(`↑ ${mod.filename}  →  ${next.files[0]?.filename ?? next.version_number}`);
      if (opts.dryRun) return;
      if (!opts.yes && !(await confirm({ message: `Perbarui ${updates.length} mod?`, default: true }))) return;

      const installer = new Installer(api, { modsDir, filter, withDeps: true, dryRun: false });
      await installer.init();
      for (const { next } of updates) await installer.installVersion(next);
      console.log(`\n✨ Diperbarui: ${installer.summary.replaced}, gagal: ${installer.summary.failed}`);
    }),
  );

// ---------------- remove ----------------
program
  .command('remove')
  .alias('rm')
  .description('Hapus mod terpasang berdasarkan slug, judul, atau nama file')
  .argument('<name>', 'Slug / judul / nama file')
  .option('-d, --dir <path>', 'Folder mods kustom')
  .option('-y, --yes', 'Tanpa konfirmasi')
  .action(
    handle(async (name: string, opts: CommonOpts) => {
      const config = await loadConfig();
      const modsDir = resolveModsDir(opts.dir, config);
      const mods = await scanInstalled(api, modsDir);
      const projects = await api.getProjects([...new Set(mods.flatMap((m) => (m.version ? [m.version.project_id] : [])))]);
      const byId = new Map(projects.map((p) => [p.id, p]));

      const q = name.toLowerCase();
      const matches = mods.filter((m) => {
        const p = m.version ? byId.get(m.version.project_id) : undefined;
        return m.filename.toLowerCase().includes(q) || p?.slug.toLowerCase() === q || p?.title.toLowerCase().includes(q);
      });
      if (matches.length === 0) return console.log(`❌ Tidak ada mod yang cocok dengan "${name}".`);

      for (const m of matches) {
        if (!opts.yes && !(await confirm({ message: `Hapus ${m.filename}?`, default: false }))) continue;
        await rm(m.filePath, { force: true });
        console.log(`🗑️  Dihapus: ${m.filename}`);
      }
      console.log('ℹ️  Dependensi yang ikut terpasang tidak dihapus otomatis.');
    }),
  );

// ---------------- config ----------------
const cfg = program.command('config').description(`Kelola konfigurasi bawaan (${CONFIG_PATH})`);

cfg.command('show').action(
  handle(async () => {
    const config = await loadConfig();
    console.log(`File config : ${CONFIG_PATH}`);
    console.log(`mods-dir    : ${resolveModsDir(undefined, config)}${config.modsDir ? '' : '  (bawaan OS)'}`);
    console.log(`mc-version  : ${config.gameVersion ?? '(belum diatur)'}`);
    console.log(`loader      : ${config.loader ?? '(belum diatur)'}`);
  }),
);

cfg
  .command('set')
  .argument('<key>', Object.keys(CONFIG_KEYS).join(' | '))
  .argument('<value>')
  .action(
    handle(async (key: string, value: string) => {
      const field = CONFIG_KEYS[key];
      if (!field) throw new Error(`Key tidak dikenal. Pilihan: ${Object.keys(CONFIG_KEYS).join(', ')}`);
      const config = await loadConfig();
      config[field] = value;
      await saveConfig(config);
      console.log(`✅ ${key} = ${value}`);
    }),
  );

cfg
  .command('unset')
  .argument('<key>')
  .action(
    handle(async (key: string) => {
      const field = CONFIG_KEYS[key];
      if (!field) throw new Error(`Key tidak dikenal. Pilihan: ${Object.keys(CONFIG_KEYS).join(', ')}`);
      const config = await loadConfig();
      delete config[field];
      await saveConfig(config);
      console.log(`✅ ${key} dihapus`);
    }),
  );

await program.parseAsync(process.argv);
```

---

## 9. Menjalankan & Memakai CLI

### A. Mode Pengembangan
```bash
npx tsx src/index.ts --help
npx tsx src/index.ts install sodium -v 1.21.1 -l fabric
```

### B. Build & Jalankan
```bash
npm run build
node dist/index.js install iris -v 1.21.1 -l fabric
```

### C. Pasang Sebagai Perintah Global `mcmod`
```bash
npm run build
npm link          # membuat perintah global "mcmod" dari folder proyek
mcmod --help
```
Di Linux/macOS, file `dist/index.js` sudah memiliki baris `#!/usr/bin/env node` (shebang) dari `src/index.ts`, sehingga bisa dijalankan sebagai perintah.

### D. Contoh Penggunaan
```bash
# Simpan default sekali saja
mcmod config set mc-version 1.21.1
mcmod config set loader fabric

# Cari mod, urutkan berdasarkan unduhan terbanyak
mcmod search "minimap" --sort downloads -n 5

# Pasang beberapa mod sekaligus (memilih dari daftar hasil pencarian)
mcmod install sodium lithium

# Pasang tanpa bertanya (hasil pertama) atau dengan slug persis
mcmod install sodium -y
mcmod install --slug fabric-api

# Simulasi tanpa mengunduh
mcmod install iris --dry-run

# Folder mods kustom (mis. instance launcher lain)
mcmod install sodium -d "/path/ke/instance/minecraft/mods"

# Lihat, perbarui, hapus
mcmod list
mcmod update --dry-run
mcmod update -y
mcmod remove sodium
```

### E. Ringkasan Opsi
| Opsi | Berlaku di | Keterangan |
| :--- | :--- | :--- |
| `-v, --mc-version` | search, install, update | Versi Minecraft, mis. `1.21.1` |
| `-l, --loader` | search, install, update | `fabric`, `forge`, `neoforge`, `quilt` |
| `-d, --dir` | install, list, update, remove | Folder mods kustom |
| `--slug` | install | Anggap argumen sebagai slug/ID persis |
| `--no-deps` | install | Lewati dependensi wajib |
| `--dry-run` | install, update | Simulasi tanpa mengubah file |
| `--prerelease` | update | Sertakan versi beta/alpha |
| `-y, --yes` | install, update, remove | Lewati konfirmasi/pemilihan |

### F. Variabel Lingkungan
| Variabel | Fungsi |
| :--- | :--- |
| `MCMOD_CONTACT` | Email/URL kontak yang ditambahkan ke `User-Agent` (format "Best") |
| `MODRINTH_API_URL` | Mengganti base URL API, mis. `https://staging-api.modrinth.com/v2` untuk pengujian |
| `MCMOD_HOME` | Mengganti lokasi folder konfigurasi (default `~/.mcmod`) |

---

## 10. Pengujian

Kode pada panduan ini telah dikompilasi dengan `tsc` (mode `strict`) dan diuji end-to-end terhadap server Modrinth tiruan lokal dengan skenario berikut:

* `search` mengirim facets yang benar (`project_type` + `versions` + `categories`).
* `install` memasang mod beserta dependensi wajib, dan `--dry-run` tidak menyentuh folder.
* Memasang mod yang versi lamanya sudah ada → file lama terganti dan tidak ada duplikat.
* Menjalankan `install` dua kali → kedua kalinya dilewati karena sudah identik.
* `list` mengenali mod lewat hash dan menandai file asing sebagai "tidak dikenal".
* `update` menaikkan versi lalu melaporkan "sudah terbaru" pada run berikutnya.
* `remove` dan `config set/show/unset`, serta pesan error jelas bila versi/loader belum diatur di lingkungan non-interaktif.

> Pengujian di atas memakai server tiruan, **bukan** API Modrinth asli. Sebelum dipakai sungguhan, coba sekali di folder mods cadangan: `mcmod install sodium -v 1.21.1 -l fabric -d ./tes-mods`.

Untuk menguji terhadap API sungguhan tanpa menyentuh folder game, selalu gunakan `-d ./folder-uji` dan `--dry-run`. Untuk menguji dengan staging: `MODRINTH_API_URL=https://staging-api.modrinth.com/v2 mcmod search sodium`.

---

## 11. Troubleshooting

| Gejala | Penyebab & Solusi |
| :--- | :--- |
| `Versi Minecraft & loader belum ditentukan` | Jalankan di terminal interaktif, atau beri `-v`/`-l`, atau `mcmod config set ...` |
| `Mod tidak ditemukan` | Versi/loader tidak cocok dengan mod tersebut. Coba tanpa `-v`/`-l` di `search` untuk melihat versi yang didukung |
| `EBUSY` / `EPERM` saat memasang (Windows) | File jar sedang dipakai Minecraft. Tutup game lalu ulangi |
| `Checksum SHA-512 tidak cocok` | Unduhan korup. Ulangi; file `.part` sudah otomatis dihapus |
| `Modrinth API 429` berulang | Terlalu banyak permintaan; tunggu 1 menit. Klien sudah mengulang otomatis sampai 3 kali |
| `410 Gone` | Versi API yang dipakai sudah dihentikan. Periksa dokumentasi migrasi dan perbarui `API_BASE_URL` |
| Perintah `mcmod` tidak ditemukan setelah `npm link` | Pastikan `npm run build` sudah dijalankan dan folder bin global npm ada di `PATH` |

---

## 12. Ide Pengembangan Lanjutan

* **Prune dependensi yatim**: saat `remove`, hapus dependensi wajib yang tidak lagi dibutuhkan mod lain (butuh lockfile atau analisis grafik dependensi dari hash).
* **Unduhan paralel** dengan batas konkurensi (mis. 3–4 sekaligus) agar tetap jauh di bawah rate limit.
* **Mendukung tipe proyek lain**: `resourcepack` dan `shader` (folder `resourcepacks`/`shaderpacks`) dengan mengubah facet `project_type`.
* **Impor modpack `.mrpack`** (format modpack Modrinth).
* **Profil/instance ganda**: menyimpan beberapa kombinasi folder + versi + loader di config dan memilihnya dengan `--profile`.
* **Cache** hasil pencarian/versi di disk agar hemat permintaan.
* **Validasi versi Minecraft** dengan `GET /tag/game_version` dan loader dengan `GET /tag/loader` sebelum memanggil API lain.
* **Uji otomatis** (Vitest) dengan `fetch` yang di-mock, plus pipeline CI untuk build.

---

## Referensi
* Overview Modrinth API: https://docs.modrinth.com/api/
* Search projects: https://docs.modrinth.com/api/operations/searchprojects
* Latest versions from hashes: https://docs.modrinth.com/api/operations/getlatestversionsfromhashes
* List project's versions: https://docs.modrinth.com/api/operations/getprojectversions
* Panduan OAuth Modrinth: https://docs.modrinth.com/guide/oauth/