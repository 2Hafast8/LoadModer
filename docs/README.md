# 📚 LoadModer Documentation Hub

Pusat dokumentasi arsitektur, spesifikasi teknis, dan panduan pengembang **LoadModer** (`lm`) — CLI & TUI package manager untuk mod, modpack (`.mrpack`), shader, dan resource pack Minecraft berbasis Modrinth API v2.

---

## 🗺️ Peta Navigasi Dokumentasi

| Dokumen | Topik & Cakupan Utama |
| :--- | :--- |
| **[01. Arsitektur & Visi Sistem](01-architecture-and-vision.md)** | Arsitektur berlapis, domain engines (Dynamic Versions, Auto-Resolver, Profile Snapshots), alur data, dan penanganan rate limit API. |
| **[02. Kurasi Tech Stack & Pustaka](02-tech-stack-and-libraries.md)** | Rationale pemilihan pustaka (Commander, Inquirer Prompts, Clack Prompts, Vitest, Picocolors, P-Limit, Unzipper, Zod, Tsup). |
| **[03. Spesifikasi Perintah & UX CLI](03-cli-commands-and-ux.md)** | Hierarki perintah lengkap (`init`, `search`, `install`, `list`, `update`, `remove`, `enable`/`disable`, `bisect`, `watch`, `profile`, `config`, `home`) dan flag CLI. |
| **[04. Mesin Modpack (.mrpack Engine)](04-modpack-engine.md)** | Standar format `.mrpack`, parsing streaming `modrinth.index.json`, penanganan `overrides/`, filtering client vs server, dan rollback atomik. |
| **[05. Integrasi Multi-Launcher](05-multi-launcher-integration.md)** | Algoritma auto-discovery Prism Launcher, MultiMC, Modrinth App (Theseus), CurseForge, dan Vanilla. Isolasi mod antar profil dan versi game. |
| **[06. Dependency Graph & Lockfile](06-dependency-graph-and-lockfile.md)** | Resolusi dependensi otomatis (`resolver.ts`), struktur `loadmoder.lock.json`, Directed Acyclic Graph (DAG), reference counting, dan *orphan pruning*. |
| **[07. Diagnostik Crash & Bisect Engine](07-troubleshooting-and-bisect.md)** | Sistem isolasi mod (`.disabled`) dan algoritma pencarian biner ($O(\log_2 N)$) untuk melacak mod penyebab crash. |
| **[08. Panduan Pengembang & API](08-developer-guide-and-api.md)** | Struktur direktori proyek, skrip npm, variabel lingkungan, konfigurasi build tsup, dan panduan pengujian Vitest. |
| **[09. Spesifikasi Desain UI/UX](09-ui-ux-design-specification.md)** | Filosofi visual Nordic Clean TUI, palet warna, aksesibilitas WCAG AA, dan spesifikasi komponen TUI. |
| **[Cetak Biru Arsitektur LoadModer](LOADMODER_ARCHITECTURE.md)** | Cetak biru arsitektur menyeluruh dan pilar rekayasa sistem. |
| **[Panduan Integrasi Modrinth API](modrinth-cli-guide.md)** | Referensi spesifikasi Labrinth API v2, otentikasi, pagination, dan aturan kuota request. |
| **[Katalog Agent Skills](SKILL.md)** | Indeks 18 skill agen (`.agent/skills/`) yang memandu kualitas kode dan standar arsitektur. |
| **[Laporan Audit Dokumentasi](audits/documentation-knowledge-audit-2026-10-02.md)** | Hasil audit dokumentasi menyeluruh dengan temuan dan baseline kesehatan sistem. |

---

## ⚡ Prinsip Rekayasa LoadModer

1. **Operasi Dual-Mode**:
   - **Interactive TUI**: Dipanggil tanpa argumen (`lm` atau `lm home`), menyediakan antarmuka navigasi keyboard panah (`↑`/`↓` atau `j`/`k`), filter cepat, dan penjelajah katalog.
   - **Direct CLI**: Dipanggil dengan argumen langsung (`lm install sodium`, `lm update -y`) untuk integrasi terminal maupun skrip otomatisasi.
2. **Pendeteksi Launcher Otomatis**:
   - Mendeteksi launcher dan profil aktif secara mandiri tanpa mewajibkan pemain menyalin path folder `%APPDATA%\.minecraft\mods`.
3. **Penyelarasan Profil & Isolasi Versi**:
   - Pemasangan mod diverifikasi terhadap versi game dan mod loader aktif.
   - Penggantian versi atau loader (`lm profile switch`) secara otomatis mengisolasi dan memulihkan file mod yang sesuai melalui snapshot manager.
4. **Pembersihan Dependensi Yatim (Orphan Pruning)**:
   - Silsilah dependensi dicatat dalam `loadmoder.lock.json`. Menghapus mod utama dengan opsi `--prune` akan membersihkan library yang tidak lagi dirujuk oleh mod lain.
5. **Integritas File**:
   - Pengunduhan berkas selalu diverifikasi melalui checksum SHA-512 streaming dan penamaan atomik `.part` $\rightarrow$ `.jar` untuk mencegah kerusakan berkas akibat koneksi terputus.
