# Changelog

Semua perubahan penting pada proyek **LoadModer** dicatat dalam dokumen ini.
Format ini mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mematuhi [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.9.0] - 2026-10-22

### Added
- **Official App Branding & Logo Integration**:
  - Pemasangan logo dan icon resmi LoadModer pada executable Windows installer & portable (`assets/icon.ico` via `electron-builder.json`).
  - Penambahan window & taskbar icon pada jendela utama Electron (`BrowserWindow` icon fallback resolver).
  - Integrasi favicon lengkap (`favicon.ico`, `favicon-32x32.png`, `favicon-16x16.png`, `apple-touch-icon.png`, `site.webmanifest`) pada desktop renderer.
  - Tampilan brand icon resmi pada header bar navigasi aplikasi Desktop (`TopBar.tsx`).
- **Anti-File Lock & Process Guard (`src/core/instance/processGuard.ts`)**:
  - Deteksi otomatis proses Minecraft (`javaw.exe`, `java.exe`, `minecraft`) di Windows via `tasklist` dan Unix via `pgrep`.
  - Proteksi integritas file disk: Mencegah operasi mutasi file (`switchMode`, `activateProfile`, `clearContainerLiveFiles`, `saveActiveToProfile`, `toggleMod`, `mods:remove`, `baseline:restore`, dan `snapshots:switchProfile`) saat game Minecraft sedang aktif guna mencegah korupsi data disk dan error `EBUSY`/`EPERM`.
- **Auto Updater Resilience & SmartScreen Guidance**:
  - Tombol **"Buka Folder Unduhan"** (`FolderOpen`) pada modal pembaruan untuk pengguna versi Portable sehingga file `.exe` yang baru diunduh langsung dapat dipindahkan ke folder permanen.
  - Banner panduan Windows SmartScreen pada modal pembaruan untuk membantu pengguna jika Windows menampilkan prompt keamanan "Windows protected your PC".
  - Proteksi network timeout (10 detik via `AbortSignal.timeout`) dan penanganan khusus pesan kesalahan saat batas kuota GitHub API rate limit (HTTP 403) tercapai.
- **Operation Loading Overlay Screen Guard & Emergency Unlock**:
  - Tombol **"Buka Kunci Layar / Batalkan"** darurat dengan timer 45 detik untuk mencegah antarmuka terkunci permanen saat disk I/O lambat atau hang.
  - Penyesuaian layout overlay (`top-11 fixed inset-x-0 bottom-0 z-40`) agar tombol kontrol jendela (Minimize, Maximize, Close) tetap dapat diakses selama operasi berlangsung.
- **Drag-and-Drop Local Installer Error Classification**:
  - Klasifikasi spesifik untuk kegagalan ekstraksi berkas ZIP yang terenkripsi / ber-password atau berkas rusak / terpotong saat diunduh.
- **BisectView Crash Diagnostic Testing Tips**:
  - Kartu panduan pengujian crash non-deterministik (memory leak / race conditions) dan panduan investigasi crash konflik ganda menggunakan Crash Log Analyzer.

### Changed
- **Peningkatan SemVer**: Pembaruan nomor versi aplikasi menjadi `2.9.0` secara konsisten pada `package.json`, `package-lock.json`, dan `src/constants.ts`.
- **Error Handling Profil**: Penggantian blok `catch` kosong dengan penanganan error eksplisit saat penyalinan berkas arsip modpack profile.

---

## [2.8.0] - 2026-10-20

### Added
- **Native In-App Auto Updater (Desktop & CLI)**:
  - **Pemeriksaan Otomatis GitHub Releases**: Integrasi dengan endpoint resmi GitHub Releases (`2Hafast8/LoadModer`) untuk mendeteksi rilis baru secara asinkron (non-blocking) saat aplikasi dibuka.
  - **Modal Pembaruan Interaktif (`UpdateModal`)**: Menampilkan perbandingan versi, catatan rilis (changelog markdown), bilah unduhan berkecepatan tinggi dengan estimasi kecepatan (MB/s) & ukuran byte, dan verifikasi checksum SHA-256 otomatis sebelum instalasi.
  - **1-Click Auto Install & Restart**: Otomatis mengeksekusi installer Windows (`LoadModer-Setup-*.exe`) secara terpisah (`detached spawn`) dan menutup aplikasi lama dengan mulus.
  - **Dukungan Dual-Format Windows**: Opsi langsung mengunduh binary NSIS Setup Wizard atau Portable Standalone Executable (`.exe`).
  - **Dynamic TopBar Update Badge**: Indikator hijau berkilau `✨ vX.Y.Z` saat rilis baru tersedia, serta tombol klik untuk melakukan pengecekan pembaruan manual kapan saja.
  - **Non-Blocking CLI Update Notifier**: Pengecekan asinkron ringan via npm registry dengan cache lokal 24 jam (`~/.loadmoder/cache/cli_update_check.json`), menampilkan banner ramah saat pembaruan tersedia.
- **Operation Loading Overlay (Screen Lock Guard)**:
  - Komponen overlay pengaman layar penuh (`OperationLoadingOverlay`) yang memblokir interaksi klik liar (`pointer-events-auto`) selama proses berat berlangsung (perpindahan mode launcher, penyimpanan profil modpack, disable modpack, restorasi baseline, dan switch profil versi).
  - Dilengkapi spinner animasi, target badge, status deskripsi dinamis, pulse bar shimmer, dan peringatan keselamatan ("Proses sedang berjalan • Mohon jangan menutup aplikasi").
- **Manual Modpack Profile Save untuk TL-Mods**:
  - Tombol aksi simpan profil manual khusus wadah TL-Mods (`ModpackProfileManager.manualSaveTLModsProfile`) untuk mencadangkan seluruh mod, konfigurasi, dan shaderpack ke arsip profil snapshot baru secara aman.
- **Auto-Healing & Clean State Modpack Detection**:
  - Pengecekan fisik keberadaan mod live (`hasLiveMods`) pada wadah TL-Mods. Jika wadah bersih dari mod, status profil otomatis disetel ke `null` (tidak aktif), menampilkan tombol `[Pasang / Install]` dan tombol pulihkan cepat (`Restore`).

### Changed
- **Launcher Mode Card Grid & Responsive Pagination**:
  - Penyederhanaan tampilan wadah launcher dari susunan horizontal menjadi kartu grid responsif (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) dengan badge loader berwarna (Forge 🟧, Fabric 🟦, NeoForge 🟪, Quilt 🟩), versi Minecraft, status aktif, dan filter pencarian real-time saat > 4 wadah.
  - Paginasi 6 item (`PAGE_SIZE = 6`) dengan tombol Sebelumnya/Berikutnya dan indikator halaman pada daftar *Saved Modpack Containers* dan *Profile Versions*.
- **SemVer Bump**: Peningkatan versi resmi aplikasi ke `2.8.0`.

### Fixed
- **Status Aktivasi Profil pada Wadah Bersih (Clean State)**: Memperbaiki inkonsistensi status aktif pada profil TL-Mods ketika wadah telah dibersihkan sehingga pengguna dapat langsung memasang atau memulihkan profil.
- **TypeScript Type Safety**: Resolusi seluruh parameter deklarasi preload dan interface IPC updater.

---

## [2.7.0] - 2026-10-12

### Added
- **CLI Diagnostics & Crash Log Analyzer (`lm diagnose` / `lm diagnostics`)**: Perintah CLI baru untuk menganalisis log Minecraft (`latest.log`) dan crash report (`crash-reports/crash-*.txt`), mendeteksi akar penyebab crash (incompatible mod, missing dependencies, JVM incompatibility), menampilkan visualisasi stack trace berbasis tema Nordic Clean, serta mendukung flag `--raw` dan `--json`.
- **Diagnostics Parity di TUI Dashboard**: Menu Troubleshoot & Diagnostics interaktif di TUI dashboard (`lm` / `lm home`) dengan opsi langsung menonaktifkan mod bermasalah (.jar -> .jar.disabled) tanpa keluar dari terminal.
- **Bulk Mod Updates pada Desktop App**: Tombol "Update All" pada tab Mods untuk memperbarui seluruh mod kadaluarsa secara serentak dengan visualisasi progress dan resolusi dependensi otomatis.
- **Enhanced Explore Screen & Dual-Tier Toolbar**: Toolbar 2-tingkat dengan pencarian real-time, selector versi Minecraft & loader, filter kategori dinamis per tipe konten (otomatis menyembunyikan filter loader untuk Shaders dan Resource Packs), sort dropdown, serta sistem paginasi lengkap (previous, next, dan direct page navigation).
- **Edit Version Loader Modal**: Modal UI baru di Desktop App untuk memodifikasi konfigurasi loader dan versi Minecraft instance langsung dari antarmuka visual.
- **Desktop Notification Auto-Dismiss**: Durasi dismiss otomatis 3000ms (3 detik) untuk seluruh toast notifikasi sistem di Desktop GUI.
- **Adaptive Modpack Exporter**: Penyesuaian struktur ekspor modpack sesuai arsitektur launcher (Official Minecraft, Legacy, TLauncher, CurseForge, Modrinth App).

### Changed
- **Version Profile Auto-Sync**: Sistem secara cerdas mendeteksi perubahan mod live (`hasLiveChanges`) dan otomatis memperbarui arsip profil aktif (`syncActiveProfile`) sebelum perpindahan profil pada mode default.
- **Archive Pruning pada Snapshot Profile**: Pembersihan arsip snapshot profil saat penyimpanan (`saveCurrentSnapshot`) untuk mencegah duplikasi file `.jar` dan `.jar.disabled` serta menghapus ghost files yang sudah dihapus pengguna di lingkungan live.
- **Layout Responsif Explore Fullscreen**: Penyesuaian grid kartu konten hingga 4 kolom (`2xl:grid-cols-4`) pada layar resolusi tinggi/fullscreen.
- **SemVer Bump**: Peningkatan versi resmi aplikasi ke `2.7.0`.

### Fixed
- **Version Profile Switching Parity**: Memperbaiki perpindahan profil versi agar membersihkan mod dari profil sebelumnya secara atomik dan konsisten.
- **Desktop Download Parity**: Memastikan pengunduhan mod di Desktop App menyelesaikan dependensi wajib secara otomatis melalui DAG resolver Modrinth API v2 setara dengan CLI.

---

## [2.6.0] - 2026-10-11

### Added
- **Standalone Windows Executables (`.exe`)**: Konfigurasi packaging `electron-builder` menghasilkan dual-format untuk Windows: NSIS Setup Wizard (`LoadModer-Setup-2.6.0.exe`) dan Portable Standalone Executable (`LoadModer-2.6.0-Portable.exe`).
- **Automated GitHub Releases Workflow**: Workflow CI/CD (`.github/workflows/release.yml`) yang memicu kompilasi bundle otomatis, pembuatan checksum SHA-256, dan publikasi aset `.exe` ke GitHub Releases saat push tag `v*` atau pemicu manual.
- **Drag-and-Drop Installer GUI**: Dukungan instalasi instan dengan menarik berkas `.jar`, `.mrpack`, atau `.zip` langsung ke dalam jendela aplikasi, dilengkapi indikator *frosted glass* Nordic Clean.
- **Smart Archive Type Inspection**: Deteksi pintar isi arsip `.zip` secara in-memory (memeriksa `shaders/`, `pack.mcmeta`, atau manifest `modrinth.index.json`) untuk mendistribusikan berkas ke folder yang tepat (`shaderpacks/`, `resourcepacks/`, atau `mods/`).
- **Modern Desktop GUI**: Aplikasi desktop Electron + React 19 dengan tema Nordic Clean, live directory watcher, dukungan penuh dwibahasa (English & Indonesia), Crash Log Analyzer, Restore Points Panel, dan Modpack Exporter.
- **C4 Architecture Documentation**: Spesifikasi arsitektur komprehensif pada `docs/c4-architecture.md` mencakup System Context, Container, Component, dan Code Data Flow.

### Changed
- **Auto-Rebuild Sync on `npm run desktop`**: Script `desktop` pada `package.json` kini otomatis mengeksekusi `desktop:build` sebelum menjalankan Electron launcher, memastikan bundle tidak pernah usang.
- **SemVer Bump**: Peningkatan versi resmi aplikasi ke `2.6.0`.

### Fixed
- Memperbaiki kompatibilitas ESM pada engine ekspor modpack dengan mengimpor `ZipArchive` langsung dari library `archiver`.
- Mengisolasi logika instalasi lokal ke modul domain murni `src/core/instance/localInstaller.ts` agar decoupling domain logic terjaga 100%.

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
- Rilis perdana platform LoadModer v2: CLI/TUI manajer mod, modpack (`.mrpack`), shader, dan resource pack Minecraft berbasis Modrinth API v2.
- Dukungan Directed Acyclic Graph (DAG) untuk pelacakan dependensi dan pembersihan dependensi yatim (*orphan pruning*).
- Penulisan state atomik menggunakan `write-file-atomic` (`loadmoder.lock.json` dan `config.json`).

