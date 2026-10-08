# Changelog

Semua perubahan penting pada proyek **LoadModer** dicatat dalam dokumen ini.
Format ini mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mematuhi [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.5.0] - 2026-10-08

### Added
- **Official Minecraft Vanilla Priority**: Menetapkan Official Minecraft (`vanilla-default`) sebagai launcher resmi bawaan utama saat inisialisasi awal.
- **Additive Launcher Co-existence**: Memastikan penambahan konfigurasi instance bersifat aditif murni tanpa pernah mengubah atau menghapus instansi yang sudah ada di `config.json`.
- **Smart Shared Container Detection**: Logika deteksi pintar pada direktori `%APPDATA%\.minecraft` yang memprioritaskan marker spesifik TLauncher (`TLauncher.exe`, `TlauncherProfiles.json`, dll.) sebelum mengasumsikan instalasi resmi Mojang.
- **NPM Package Distribution Readiness**: Penambahan metadata npm (`files`, `license`, `repository`, `keywords`, `author`) dan lifecycle guard `prepublishOnly` untuk persiapan rilis global di npm registry (`npm install -g loadmoder` / `npx loadmoder`).

### Changed
- Membersihkan label `(Default)` pada nama launcher pihak ketiga (TLauncher, SKLauncher) agar penamaan konsisten dan label `(Default)` dikhususkan hanya untuk Official Minecraft saat inisialisasi awal.
- Pembaruan unit testing Vitest untuk mencakup skenario pembedaan marker shared container TLauncher vs Vanilla murni.

### Fixed
- Menghapus logika rekonsiliasi destruktif di `src/ui/dashboard/home.ts` yang sebelumnya dapat menghapus instance `tlauncher-default`.

---

## [2.4.0] - 2026-10-07

### Added
- **Legacy Launcher Dual-Path Architecture**: Mendukung struktur folder Legacy Launcher baik pada `.tlauncher/legacy/Minecraft/game` maupun `files/`.
- **One-Time Golden Baseline Backup**: Pembuatan snapshot dasar satu kali untuk memulihkan file engine asli setelah penonaktifan modpack (`lm modpack disable`).
- **Zero-Overwrite Guard**: Perlindungan berkas bawaan launcher agar tidak tertimpa saat ekstraksi modpack atau pembersihan wadah.
- **Launcher Capability Matrix**: Peta kemampuan per launcher (`supportsModpack`, `supportsContainers`, `supportsModeSwitch`, `modpackStrategy`).

---

## [2.3.0] - 2026-10-07

### Added
- **Multi-Launcher Folder Adaptation**: Deteksi dan adaptasi otomatis untuk Prism Launcher, MultiMC, SKLauncher, Modrinth App (Theseus), CurseForge, dan Vanilla.
- **Decoupled Modpack Containers**: Pemisahan logika container engine per jenis launcher agar tidak terjadi kebocoran dependensi antar instance.
- **Unified UI/UX Mode Switcher**: Kemampuan beralih antar mode default dan mode modpack secara transparan pada dashboard TUI.

---

## [2.2.0] - 2026-10-06

### Added
- **TLauncher Profile Vault**: Brankas profil lokal di `.loadmoder/profiles/` untuk menyimpan dan mengganti modpack tanpa unduh ulang.
- **Active Download Guard**: Pengecekan status download aktif dan pencegahan tabrakan saat operasi jaringan berlangsung.
- **Container Isolation**: Pengisolasian file mod dan konfigurasi dalam sub-folder versi game.

---

## [2.1.0] - 2026-10-05

### Added
- **Nordic Clean TUI Redesign**: Antarmuka terminal interaktif modern dengan palet warna terstandar Nord (Snow Storm, Polar Night, Frost).
- **Concurrent Installed Status Checker**: Pengecekan status mod terpasang secara paralel menggunakan worker pool `p-limit`.
- **Accessibility Mode**: Dukungan mode aksesibilitas (`ACCESSIBLE=true`) dan deteksi otomatis terminal berlatar belakang terang.

---

## [2.0.5] - 2026-10-02

### Added
- Pipeline GitHub Actions CI untuk verifikasi build, type-check, dan pengujian otomatis lintas platform.
- Standar komunitas: `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`, dan konfigurasi Linguist.

---

## [2.0.4] - 2026-10-02

### Fixed
- Remediasi 10 temuan bug audit (BUG-001 hingga BUG-010): penanganan race condition, boundary error, dan pembatalan operasi.
- Remediasi 11 temuan arsitektur dan kualitas kode (ARCH-003 hingga ARCH-013): decoupling domain logic dari UI prompts.

---

## [2.0.3] - 2026-10-02

### Optimized
- Optimasi hashing streaming berkas besar menggunakan SHA-1 dan SHA-512 dengan backpressure stream.
- Resolusi dependensi I/O berbasis cache manifest di memori.
- Percepatan startup CLI di bawah 100ms.

---

## [2.0.2] - 2026-10-02

### Security
- Pencegahan path traversal pada nama file arsip `.mrpack`.
- Perlindungan terhadap companion mod deletion yang tidak sah.
- Pencegahan SSRF pada URL unduhan Modrinth API.
- Sanitasi ANSI terminal escape injection pada nama mod yang ditampilkan.

### Added
- Fitur otomatisasi pelacakan crash `bisect` berbasis binary search ($O(\log_2 N)$).

---

## [2.0.1] - 2026-09-30

### Added
- Pemantauan real-time folder `mods` menggunakan `node:fs` watcher dengan rekonsiliasi disk otomatis.
- Fetching dinamis versi Minecraft dari Modrinth tag API dengan semver comparator.
- Filter pencarian mod lanjutan (kategori, lingkungan client/server).
- Manajemen snapshot versi game untuk isolasi profil.

---

## [2.0.0] - 2026-09-30

### Added
- Rilis perdana platform LoadModer v2 — CLI/TUI manajer mod, modpack (`.mrpack`), shader, dan resource pack Minecraft berbasis Modrinth API v2.
- Dukungan Directed Acyclic Graph (DAG) untuk pelacakan dependensi dan pembersihan dependensi yatim (*orphan pruning*).
- Penulisan state atomik menggunakan `write-file-atomic` (`loadmoder.lock.json` dan `config.json`).

