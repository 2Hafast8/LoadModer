# 📚 LoadModer Documentation Hub

Selamat datang di pusat dokumentasi resmi arsitektur, spesifikasi teknis, dan panduan pengembang **LoadModer** — platform CLI dan TUI modern untuk manajemen mod, modpack (`.mrpack`), shader, dan resource pack Minecraft berbasis Modrinth API v2.

---

## 🗺️ Peta Navigasi Dokumentasi

Dokumentasi LoadModer terstruktur ke dalam modul-modul berikut:

| Dokumen | Topik & Cakupan Utama |
| :--- | :--- |
| **[01. Arsitektur & Visi Sistem](01-architecture-and-vision.md)** | Filosofi "Cargo/NPM untuk Minecraft", arsitektur berlapis, domain engines (Dynamic Versions, Auto-Resolver, Profile Snapshots), diagram alur data, dan penanganan rate limit API. |
| **[02. Kurasi Tech Stack & Pustaka](02-tech-stack-and-libraries.md)** | Penjelasan *The Golden Stack* (Commander, Inquirer Raw Mode, Clack Prompts, Chokidar, Vitest, Picocolors, P-Limit, Unzipper, Zod, Tsup). |
| **[03. Spesifikasi Perintah & UX CLI](03-cli-commands-and-ux.md)** | Hierarki perintah lengkap (`init`, `search`, `install`, `list`, `update`, `remove`, `enable`/`disable`, `bisect`, `watch`, `profile`, `config`, `home`), opsi global, dan desain tabel vertikal. |
| **[04. Mesin Modpack (.mrpack Engine)](04-modpack-engine.md)** | Standar format `.mrpack`, parsing streaming `modrinth.index.json`, penanganan `overrides/`, filtering client vs server, dan rollback atomik. |
| **[05. Integrasi Multi-Launcher](05-multi-launcher-integration.md)** | Algoritma auto-discovery Prism Launcher, MultiMC, Modrinth App (Theseus), CurseForge, dan Vanilla. Isolasi mod antar profil dan versi game. |
| **[06. Dependency Graph & Lockfile](06-dependency-graph-and-lockfile.md)** | Mesin resolusi dependensi otomatis (`resolver.ts`), struktur `loadmoder.lock.json`, Directed Acyclic Graph (DAG), reference counting, dan *orphan pruning*. |
| **[07. Diagnostik Crash & Bisect Engine](07-troubleshooting-and-bisect.md)** | Sistem isolasi mod (`.disabled`), algoritma pencarian biner ($O(\log_2 N)$) untuk melacak mod penyebab crash otomatis. |
| **[08. Panduan Pengembang & API](08-developer-guide-and-api.md)** | Struktur direktori proyek lengkap, skrip npm, konfigurasi build tsup, dan panduan pengujian Vitest (36 unit/integration tests). |
| **[Cetak Biru Arsitektur LoadModer](LOADMODER_ARCHITECTURE.md)** | Cetak biru arsitektur menyeluruh, spesifikasi teknis platform kelas produksi, dan pilar rekayasa sistem. |
| **[Panduan Integrasi Modrinth API](modrinth-cli-guide.md)** | Referensi spesifikasi Labrinth API v2, otentikasi, pagination, dan aturan kuota request. |
| **[Katalog Agent Skills](SKILL.md)** | Indeks 18 skill agen (.agent/skills/) yang memandu kualitas kode, anti-slop, keamanan backend, dan UX sistem. |

---

## ⚡ Prinsip & Karakteristik LoadModer

1. **Dual-Mode User Experience**:
   - **Interactive TUI**: Dipanggil tanpa argumen (`lm` atau `lm home`), menyediakan antarmuka navigasi keyboard panah (`↑`/`↓` atau `j`/`k`), filter cepat, dan penjelajah katalog.
   - **Direct Scriptable CLI**: Dipanggil dengan argumen langsung (`lm install sodium`, `lm update -y`) untuk integrasi terminal maupun skrip CI/CD.
2. **Zero-Configuration by Default**:
   - Mendeteksi launcher dan profil aktif secara otomatis tanpa mewajibkan pemain menyalin path folder `%APPDATA%\.minecraft\mods`.
3. **Penyelarasan Profil & Versi Otomatis**:
   - Pemasangan mod secara ketat diverifikasi terhadap profil aktif (versi Minecraft & mod loader).
   - Penggantian versi atau loader (`lm profile switch`) secara otomatis mengisolasi dan memulihkan file mod yang sesuai melalui snapshot manajer.
4. **Pencegahan Berkas Sampah (Zero Orphan Guarantee)**:
   - Silsilah dependensi dicatat dalam `loadmoder.lock.json`. Menghapus mod utama dengan opsi `--prune` akan membersihkan library yang tidak lagi dirujuk oleh mod lain.
5. **Keamanan & Integritas File**:
   - Pengunduhan berkas selalu diverifikasi melalui checksum SHA-512 streaming dan penamaan atomik `.part` $\rightarrow$ `.jar` untuk mencegah kerusakan berkas akibat koneksi terputus.
