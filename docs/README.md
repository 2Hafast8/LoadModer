# Dokumentasi LoadModer

Pusat dokumentasi teknis, spesifikasi arsitektur, dan panduan pengembang LoadModer (`lm`): CLI, TUI, dan Desktop GUI package manager untuk mod, modpack (`.mrpack`), shader, dan resource pack Minecraft berbasis Modrinth API v2.

---

## Peta Dokumentasi

| Dokumen | Topik dan Cakupan |
| :--- | :--- |
| **[01. Arsitektur dan Visi Sistem](01-architecture-and-vision.md)** | Arsitektur berlapis, domain engines (Dynamic Versions, Auto-Resolver, Profile Snapshots), Desktop GUI IPC bridge, alur data, dan penanganan rate limit API. |
| **[02. Kurasi Tech Stack dan Pustaka](02-tech-stack-and-libraries.md)** | Rationale pemilihan pustaka runtime CLI (Commander, Inquirer, Clack, Zod) dan Desktop GUI (Electron 32, React 19, Vite, Tailwind CSS, electron-builder). |
| **[03. Spesifikasi Perintah dan UX CLI](03-cli-commands-and-ux.md)** | Hierarki perintah lengkap (`init`, `search`, `install`, `list`, `update`, `remove`, `enable`/`disable`, `bisect`, `watch`, `modpack`, `profile`, `config`, `home`), flag CLI, dan integrasi desktop. |
| **[04. Mesin Modpack (.mrpack Engine)](04-modpack-engine.md)** | Standar format `.mrpack`, parsing streaming `modrinth.index.json`, penanganan `overrides/`, modpack exporter, brankas profil (`.loadmoder/profiles/`), Zero-Overwrite Guard, dan baseline snapshot. |
| **[05. Integrasi Multi-Launcher](05-multi-launcher-integration.md)** | Algoritma auto-discovery Official Minecraft (Vanilla Default), Prism Launcher, MultiMC, Modrinth App (Theseus), CurseForge, TLauncher, dan Legacy Launcher. Matriks kapabilitas launcher adaptif dan kebijakan mutasi aditif. |
| **[06. Dependency Graph dan Lockfile](06-dependency-graph-and-lockfile.md)** | Resolusi dependensi otomatis (`resolver.ts`), struktur `loadmoder.lock.json`, Directed Acyclic Graph (DAG), reference counting, dan orphan pruning. |
| **[07. Diagnostik Crash dan Bisect Engine](07-troubleshooting-and-bisect.md)** | Sistem isolasi mod (`.disabled`), Crash Log Analyzer berbasis regex stack trace, dan algoritma pencarian biner ($O(\log_2 N)$) untuk melacak mod penyebab crash. |
| **[08. Panduan Pengembang dan Distribusi Binary](08-developer-guide-and-api.md)** | Struktur direktori proyek lengkap, skrip npm, variabel lingkungan, konfigurasi build tsup, packaging standalone Windows `.exe` via electron-builder, dan panduan pengujian Vitest. |
| **[09. Spesifikasi Desain UI/UX](09-ui-ux-design-specification.md)** | Bahasa visual Nordic Clean pada TUI dan Desktop GUI, token warna, aksesibilitas WCAG 2.2 AA, dan spesifikasi komponen visual. |
| **[C4 Architecture Specification](c4-architecture.md)** | Dokumentasi C4 Model resmi (System Context, Container, Component, dan Code Data Flow) untuk arsitektur CLI dan Desktop subsystem. |
| **[Katalog Agent Skills](SKILL.md)** | Indeks 18 skill agen (`.agent/skills/`) yang memandu kualitas kode, anti-slop, dan standar arsitektur. |

---

## Prinsip Rekayasa Sistem

1. **Operasi Multi-Interface**:
   - **Desktop GUI**: Aplikasi native Windows berbasis Electron 32 dan React 19 dengan drag-and-drop installer, inspeksi otomatis berkas arsip ZIP, dan dukungan dwibahasa (ID/EN).
   - **Interactive TUI**: Dipanggil tanpa argumen (`lm` atau `lm home`), menyediakan antarmuka keyboard panah (`↑`/`↓` atau `j`/`k`), filter chip cepat, dan live badges.
   - **Direct CLI**: Dipanggil dengan argumen langsung (`lm install sodium`, `lm update -y`) untuk integrasi terminal dan skrip otomasi.
2. **Pendeteksi Launcher Otomatis**:
   - Memindai launcher dan instance aktif secara otomatis tanpa mewajibkan pemain menyalin path folder `%APPDATA%\.minecraft\mods`.
3. **Penyelarasan Profil dan Isolasi Versi**:
   - Pemasangan mod diverifikasi terhadap versi game dan mod loader aktif.
   - Pergantian versi atau loader (`lm profile switch`) secara otomatis mengisolasi dan memulihkan berkas mod yang sesuai melalui snapshot manager.
4. **Pembersihan Dependensi Yatim (Orphan Pruning)**:
   - Hubungan dependensi dicatat dalam `loadmoder.lock.json`. Menghapus mod utama dengan opsi `--prune` membersihkan library yang tidak lagi dirujuk oleh mod lain.
5. **Integritas Berkas**:
   - Pengunduhan berkas selalu diverifikasi melalui checksum SHA-512 streaming dan penamaan atomik `.part` ke `.jar` untuk mencegah kerusakan berkas akibat koneksi terputus.
6. **Brankas Profil Modpack dan Baseline Snapshot**:
   - Modpack disimpan secara terisolasi di `.loadmoder/profiles/<id>/` pada setiap wadah instance.
   - Sebelum modpack dipasang, sistem mencadangkan snapshot baseline awal (`.loadmoder/baseline/`) satu kali. Saat modpack dinonaktifkan (`lm modpack disable`), lingkungan game live dibersihkan dan dipulihkan kembali ke kondisi baseline asli. Beralih modpack dapat dilakukan secara instan tanpa mengunduh ulang master pack.
