# Changelog

Semua perubahan penting pada proyek **LoadModer** dicatat dalam dokumen ini.
Format ini mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mematuhi [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.11.2] - 2026-10-29

### Fixed
- **Responsivitas Tata Letak & Batasan Skala Zoom Aplikasi (`src/desktop/main/index.ts`, `src/desktop/renderer/src/App.tsx`, `src/desktop/renderer/src/components/TopBar.tsx`)**:
  - Menetapkan batas aman penskalaan zoom antarmuka (`ZOOM_MIN = 0.8` hingga `ZOOM_MAX = 1.25`) dengan toleransi presisi floating-point dan pembulatan langkah 0.05 untuk mencegah kerusakan visual akibat zoom berlebih.
  - Menambahkan dukungan pintasan keyboard (`Ctrl++`, `Ctrl+=`, `Ctrl+-`, `Ctrl+0`) serta penanganan zoom berbasis roda mouse (`Ctrl + Wheel`) yang sinkron antara Electron main process dan web frame renderer.
  - Mengoptimalkan tata letak responsif pada `TopBar`, `ExploreView`, `InstancesView`, modal dialog, dan kartu detail dengan penataan flex wrap, horizontal scrollbar tersembunyi, dan truncate protektif agar teks bahasa Indonesia (yang relatif lebih panjang) dan bahasa Inggris tidak terpotong pada berbagai resolusi layar.
- **Lokalisasi Penuh Bahasa Inggris & Dwibahasa Dinamis (`src/desktop/renderer/src/views/ExploreView.tsx`, `src/desktop/renderer/src/i18n/translations.ts`, `src/desktop/renderer/src/components/UpdateModal.tsx`)**:
  - Menyediakan kamus kategori dwibahasa terpisah `CATEGORIES_BY_TYPE_EN` dan `CATEGORIES_BY_TYPE_ID` untuk semua tipe proyek (*mods, modpacks, shaders, resourcepacks*) sehingga dropdown kategori di tab Explore tampil sepenuhnya dalam bahasa Inggris saat English Mode aktif.
  - Menyelaraskan label ukuran paginasi Explore (`Show: 24 per page` / `Tampilkan: 24 per halaman`) menggunakan key i18n dinamis `{t.explore.pageSizeLabel}`.
  - Memperbaiki seluruh atribut `title` (tooltip) pada filter Explore dan modal pembaruan aplikasi (`UpdateModal.tsx`) agar mengikuti bahasa aktif.
  - Menghapus string hardcoded bahasa Indonesia yang tersisa pada berbagai komponen desktop (`TourOverlay`, `OnboardingModal`, `HelpView`, `CrashLogViewer`, `InstancesView`, `DeleteInstanceModal`, `ExportModpackModal`, `RestorePointsPanel`, `SwitchModeModal`).

### Changed
- **Peningkatan SemVer**: Pembaruan nomor versi aplikasi menjadi `2.11.2` secara konsisten pada `package.json`, `package-lock.json`, `src/constants.ts`, `TopBar.tsx`, `SettingsView.tsx`, dan seluruh dokumentasi resmi.

---

## [2.11.1] - 2026-10-29

### Fixed
- **Perbaikan Kecepatan Scroll Tur Spotlight (`src/desktop/renderer/src/components/TourOverlay.tsx`)**:
  - Menghilangkan delay floaty 250ms dan perilaku smooth-scroll bawaan (500–800ms) Chromium pada tur interaktif.
  - Menerapkan deteksi instan viewport (`isInViewport`): jika elemen sudah terlihat di layar, posisi spotlight diperbarui instan pada frame 0 tanpa memicu scroll berlebih.
  - Menggunakan scroll instan direct (`behavior: 'auto'`) saat elemen berada di luar layar, serta menyelaraskan animasi transisi spotlight ke `duration-200` yang jauh lebih responsif.
- **Perbaikan Ulang Tur di Pengaturan (`src/desktop/renderer/src/App.tsx`, `src/desktop/renderer/src/views/SettingsView.tsx`)**:
  - Tombol "Mulai Tur" / "Ulangi Tur" di halaman Pengaturan kini mereset seluruh state onboarding dan tur halaman secara komprehensif (`loadmoder_onboarding_welcomed` dan seluruh `loadmoder_tour_*`).
  - Secara otomatis mengarahkan kembali ke tab Mods dan memunculkan modal selamat datang (`OnboardingModal`), memberikan pengalaman onboarding penuh persis seperti saat pertama kali membuka aplikasi.
- **Penyelarasan Target Spotlight & Highlight Razor-Sharp (`src/desktop/renderer/src/components/TourOverlay.tsx`)**:
  - Mengganti teknik full-screen backdrop dengan *Massive Box-Shadow Cutout* (`box-shadow: 0 0 0 9999px rgba(10, 15, 13, 0.82)`) sehingga elemen yang disorot tampil tajam dan bebas efek blur.
  - Memberikan atribut `data-tour` spesifik pada seluruh komponen di tab Mods, Explore, Instances, Bisect, Help, dan Settings untuk memastikan spotlight terarah tepat pada elemen target.
  - Menambahkan pembatasan batas layar (*viewport clamping*) pada kartu tooltip tur agar tombol dan teks tidak pernah keluar atau terpotong di tepi layar.

### Changed
- **Peningkatan SemVer**: Pembaruan nomor versi aplikasi menjadi `2.11.1` secara konsisten pada `package.json`, `package-lock.json`, `src/constants.ts`, `TopBar.tsx`, `SettingsView.tsx`, dan seluruh dokumentasi proyek.

---

## [2.11.0] - 2026-10-29

### Added
- **Halaman Pengaturan Terpadu (`src/desktop/renderer/src/views/SettingsView.tsx`)**:
  - Halaman mandiri terpusat untuk mengelola konfigurasi aplikasi, Update Hub, pemilih bahasa antarmuka (Bahasa Indonesia & English), reset tur panduan spotlight, serta informasi lisensi open-source dan pengembang resmi: **Hafiz Noval Rianto (`2Hafast8`) & Tim Kontributor LoadModer**.
  - Status pembaruan dipindahkan dari TopBar ke dalam Settings, menjadikan tampilan header lebih bersih dengan badge versi statis `v2.11.0`.
- **Pusat Bantuan & Launcher Structure Guide (`src/desktop/renderer/src/views/HelpView.tsx`)**:
  - Halaman Bantuan baru yang dilengkapi pencarian FAQ real-time, panduan struktur direktori launcher Minecraft, pemecahan masalah umum, tombol salin info sistem, serta akses cepat ke folder konfigurasi `.loadmoder`.
- **Penganalisis Crash Report Cerdas (`src/core/troubleshoot/logAnalyzer.ts`, `src/desktop/renderer/src/components/CrashLogViewer.tsx`)**:
  - Mesin diagnosa crash log yang diperluas dengan pendeteksian akar masalah mendalam (Java runtime mismatch, alokasi memori heap, benturan mixin/dependensi) serta penyajian saran perbaikan yang konkret dan langsung dapat ditindaklanjuti.
- **Ekspor Profil Modpack ke Arsip `.zip` (`src/desktop/renderer/src/components/ExportModpackModal.tsx`, `src/desktop/renderer/src/views/InstancesView.tsx`)**:
  - Tombol ekspor profil modpack langsung dari kartu instansi.
  - Opsi ekspor selektif untuk mode default (`mods`, `resourcepacks`, `shaderpacks`) dengan penyesuaian otomatis versi Minecraft, mod loader, nama paket, versi, dan deskripsi arsip zip.
- **Pagination & Pengurutan Ukuran Berkas Mod (`src/desktop/renderer/src/views/ModsView.tsx`)**:
  - Navigasi halaman mods dengan opsi ukuran batas 25, 50, dan 100 mod per halaman.
  - Filter pengurutan dinamis berdasarkan ukuran berkas (*terbesar ke terkecil* dan *terkecil ke terbesar*).
  - Penguncian tombol periksa update saat berada dalam mode modpack terisolasi untuk menjaga integritas paket.
- **Isolasi Folder Shaderpack & Resourcepack pada Mode Modpack (`src/desktop/main/ipcHandlers.ts`)**:
  - Pemetaan otomatis direktori shader dan resourcepack ke dalam folder profil modpack yang sedang aktif, dan otomatis kembali ke direktori normal saat beralih ke mode default.
- **Validasi Keamanan Pergantian Launcher & Captcha Acak (`src/desktop/renderer/src/components/SwitchModeModal.tsx`, `src/desktop/renderer/src/components/DeleteInstanceModal.tsx`)**:
  - Modal konfirmasi pencegahan klik tidak sengaja saat beralih launcher mode, dengan tombol khusus "Kembali ke Mode Default".
  - Captcha acak 6–8 karakter (kombinasi huruf besar, kecil, angka, dan simbol) untuk validasi penghapusan profil instansi secara aman.
- **Panduan Onboarding & Tur Interaktif Spotlight (`src/desktop/renderer/src/components/OnboardingModal.tsx`, `src/desktop/renderer/src/components/TourOverlay.tsx`)**:
  - Dialog selamat datang saat pertama kali memasang aplikasi dengan validasi keikutsertaan tur panduan.
  - Tur visual berbasis spotlight yang memandu fitur-fitur kunci di setiap halaman secara terarah.
- **Widget Download Center Melayang & Magnetik (`src/desktop/renderer/src/components/DownloadCenter.tsx`)**:
  - Widget unduhan mengambang yang dapat digeser bebas dengan magnet snap halus ke tepi kanan dan kiri layar.
  - Dropdown berorientasi otomatis (mengembang ke atas bila di bawah layar, dan ke bawah bila di atas layar).

### Fixed
- **Perbaikan Animasi Magnet & Jump Dropdown Download Center (`src/desktop/renderer/src/components/DownloadCenter.tsx`)**:
  - Mengubah dropdown menjadi `position: absolute` sehingga tombol pemicu tidak lagi terdorong atau berkedip saat dropdown dibuka di posisi bawah layar.
  - Menyatukan sistem koordinat horizontal ke properti `left` tunggal dengan kurva `0.35s cubic-bezier(0.2, 0.8, 0.2, 1)`, menghasilkan animasi snapping magnet kanan yang simetris dan mulus seperti magnet kiri.
  - Clamping vertikal aman pada `window.innerHeight - 56px` dengan perhitungan delta drag murni mencegah widget hilang dari layar.
  - Menambahkan pendeteksi klik di luar (*click outside to close*) untuk menutup panel unduhan secara intuitif.
- **Perbaikan Freeze Kolom Pencarian Mods (`src/desktop/renderer/src/views/ModsView.tsx`)**:
  - Mengganti dialog konfirmasi hapus mod bawaan sistem yang memblokir render thread dengan modal in-app non-blocking, memastikan input pencarian tetap responsif dan dapat langsung diklik setelah menghapus mod.
- **Perbaikan Layout & Informasi Tim Pengembang (`src/desktop/renderer/src/views/SettingsView.tsx`, `src/desktop/renderer/src/i18n/translations.ts`)**:
  - Menyelaraskan layout kartu pengaturan dengan container terpusat (`max-w-5xl mx-auto`).
  - Menambahkan kelengkapan lokalisasi dwibahasa (ID/EN) untuk seluruh pengaturan aplikasi.

### Changed
- **Peningkatan SemVer**: Pembaruan nomor versi aplikasi menjadi `2.11.0` secara konsisten pada `package.json`, `package-lock.json`, `src/constants.ts`, `TopBar.tsx`, dan seluruh dokumentasi proyek.

---

## [2.10.3] - 2026-10-28

### Fixed
- **Perbaikan Pembuatan Checksum CI/CD GitHub Actions (`.github/workflows/release.yml`)**:
  - Mengoreksi penulisan `SHA256SUMS.txt` di PowerShell CI yang sebelumnya menggunakan `Format-Table -AutoSize` sehingga memotong path panjang dengan elipsis (`…`). Diganti dengan looping `ForEach-Object` format standar `<sha256>  <filename>`.
  - Mengembalikan validasi integritas SHA-256 yang sempat terlewat akibat hilangnya ekstensi biner pada file checksum rilis.
- **Eksekusi Installer UAC Windows (`src/desktop/main/updaterService.ts`)**:
  - Mengganti `spawn()` mentah dengan `shell.openPath(filePath)` yang memanggil API native Windows `ShellExecuteExW` untuk memicu dialog elevasi hak akses UAC (User Account Control) secara andal tanpa galat `ERROR_ELEVATION_REQUIRED` (Win32 Error 740).
  - Melepaskan kunci *single instance lock* sebelum aplikasi ditutup agar proses installer NSIS dapat menimpa berkas eksekutabel tanpa konflik file lock.

### Added
- **Sistem Notifikasi Update Unambigu & Floating Toast Banner (`src/desktop/renderer/src/App.tsx`, `src/desktop/renderer/src/components/TopBar.tsx`)**:
  - Penambahan banner notifikasi melayang (*floating card*) di pojok kanan bawah yang muncul otomatis saat aplikasi mendeteksi versi baru, lengkap dengan tombol `[Lihat & Perbarui]` dan `[Nanti]`.
  - Indikator status TopBar yang tegas: `v2.10.3 • Terkini ✓` saat aplikasi sudah versi terbaru, dan `✨ Update vX.Y.Z Tersedia` dengan efek denyut lembut saat update siap dipasang.
- **Pemisahan Layar Modal Update (Strict State Separation) (`src/desktop/renderer/src/components/UpdateModal.tsx`)**:
  - Tampilan khusus "Aplikasi Sudah Versi Terbaru" dengan kartu konfirmasi hijau (`ShieldCheck`), status terkini, tombol periksa ulang (`Periksa Ulang`), dan menu lipat catatan rilis. Menghilangkan total tombol unduh saat aplikasi sudah mutakhir untuk mencegah kebingungan pengguna.
  - Tautan darurat *"Kendala jaringan atau firewall? Unduh manual via GitHub"* pada modal update untuk memudahkan pengunduhan langsung via peramban web.
  - Tombol *"Buka Folder"* (`FolderOpen`) di File Explorer saat berkas installer selesai diunduh.

### Changed
- **Peningkatan SemVer**: Pembaruan nomor versi aplikasi menjadi `2.10.3` secara konsisten pada `package.json`, `package-lock.json`, `src/constants.ts`, dan dokumentasi proyek.

---

## [2.10.2] - 2026-10-27

### Fixed
- **Perbaikan Menyeluruh Sistem Drag & Drop Berkas Mod / Modpack (`src/desktop/renderer/src/App.tsx`, `src/desktop/preload/index.ts`)**:
  - Mengatasi masalah di mana berkas mod/modpack yang ditarik (*drag & drop*) dari Windows Explorer maupun peramban web (*download shelf/bubble*) tidak masuk atau tidak memberikan respons apa pun.
  - Memperbaiki ketiadaan pembacaan jalur fisik berkas akibat penghapusan properti `File.path` pada Chromium 128 / Electron 32 dengan bermigrasi ke modul resmi `webUtils.getPathForFile(file)` di preload script.
  - Menghilangkan perilaku *silent return* saat berkas dijatuhkan, menggantikannya dengan penanganan galat dan umpan balik visual yang informatif di antarmuka `DropZoneOverlay`.

### Added
- **Dukungan Berkas Virtual & Buffer In-Memory (`src/desktop/main/ipcHandlers.ts`)**:
  - Handler IPC baru `mods:installDroppedBuffers` untuk memproses berkas yang ditarik dari web atau aplikasi lain dalam bentuk *in-memory blob* via `file.arrayBuffer()`, menuliskannya ke direktori aman `%TEMP%\loadmoder-dropped` dan menginstalnya ke instance aktif.
- **Dukungan Drag & Drop Tautan/URL Web Langsung (`src/desktop/main/ipcHandlers.ts`)**:
  - Handler IPC baru `mods:installDroppedUrl` untuk mendeteksi penarikan tautan unduhan langsung (`.jar`, `.mrpack`, `.zip`) dari situs web seperti Modrinth atau CurseForge, mengunduhnya secara otomatis dan memasangnya ke instance aktif.
- **Lokalisasi Umpan Balik Drag & Drop (`src/desktop/renderer/src/i18n/translations.ts`)**:
  - Menambahkan string `invalidFiles` untuk pesan kegagalan berkas tidak valid atau jalur tidak dapat diakses (ID & EN).

### Changed
- **Peningkatan SemVer**: Pembaruan nomor versi aplikasi menjadi `2.10.2` secara konsisten pada `package.json`, `package-lock.json`, dan `src/constants.ts`.
- **Pengujian Instalasi Berkas Lokal (`tests/localInstaller.test.ts`)**: Menambahkan pengujian otomatis untuk pemasangan berkas drop dari direktori sementara.

---

## [2.10.1] - 2026-10-27

### Fixed
- **Pencegahan Korupsi Unduhan Auto-Updater & Eliminasi NSIS Error (`src/core/updater/downloader.ts`, `src/desktop/main/updaterService.ts`)**:
  - Mengatasi masalah popup Windows `NSIS Error: Installer integrity check has failed` yang terjadi ketika unduhan pembaruan installer terpotong beberapa byte sebelum transfer selesai sempurna pada jaringan berlatensi tinggi atau terganggu proteksi antivirus pihak ketiga.
  - Menghapus celah kode di mana berkas sementara `.part` langsung di-*rename* menjadi `.exe` meskipun stream transfer data terputus di tengah jalan.
  - Memastikan seluruh buffer disk Windows OS dan antivirus selesai di-flush secara tuntas dengan menunggu sinkronisasi event `close` pada file descriptor sebelum pemindahan biner.
  - Pembersihan proaktif berkas sementara `.part` dan berkas installer lama yang rusak di direktori `%TEMP%\loadmoder-update` setiap kali unduhan baru dimulai atau gagal.

### Security
- **Sistem Pertahanan Integritas Biner 5 Lapis (5-Layer Defense-in-Depth)**:
  - **Lapis 1 (`Content-Length` Matching)**: Memvalidasi bahwa jumlah byte yang terunduh sama persis dengan header HTTP `Content-Length`. Selisih 1 byte pun langsung menggagalkan proses dan menghapus berkas cacat.
  - **Lapis 2 (Metadata `expectedSize` GitHub Release API)**: Menggunakan ukuran byte mutlak dari API resmi GitHub sebagai acuan validasi ukuran primer.
  - **Lapis 3 (Guard Ukuran Biner Minimum)**: Menolak berkas installer `.exe` di bawah 30 MB untuk mencegah eksekusi respons error HTML atau biner terpotong parah.
  - **Lapis 4 (Verifikasi SHA-256 Wajib)**: Membandingkan hash kalkulasi streaming dengan hash checksum resmi dari `SHA256SUMS.txt`.
  - **Lapis 5 (Validasi Header Eksekutabel Windows `MZ`)**: Memeriksa keberadaan *magic bytes* Windows PE (`MZ`, `0x4D, 0x5A`) pada berkas sebelum di-rename dan sebelum peluncuran `spawn()` di `updaterService.ts`.

### Changed
- **Peningkatan SemVer**: Pembaruan nomor versi aplikasi menjadi `2.10.1` secara konsisten pada `package.json`, `package-lock.json`, dan `src/constants.ts`.
- **Integrasi Metadata Ukuran Aset**: Handler IPC `updater:download` dan antarmuka Desktop `UpdateModal.tsx` kini meneruskan ukuran `targetAsset.size` ke modul downloader untuk validasi ukuran otomatis.
- **Test Suite Integritas Unduhan (`tests/updaterDownloader.test.ts`)**: Menambahkan 7 skenario pengujian komprehensif untuk memverifikasi penolakan unduhan terpotong, mismatch ukuran, threshold minimum, validasi header `MZ`, kecocokan SHA-256, dan pembersihan berkas usang.

---

## [2.10.0] - 2026-10-27

### Added
- **Content-Based Launcher Signatures & Smart Path Resolution (`src/core/instance/detector.ts`, `src/core/instance/driveScanner.ts`)**:
  - Deteksi launcher Minecraft berbasis berkas signature resmi (`inspectFolderSignature` dan `detectLauncherFromFolder`) mengacu pada `docs/struktur-folder-launcaher-minecraft.md`.
  - Mengatasi masalah direktori kustom TLauncher (misal `D:\Games\Minecraft`) yang sebelumnya salah dideteksi sebagai "Vanilla" atau "Custom", dengan membaca keberadaan file signature `tlauncher-2.0.properties`, `TlauncherProfiles.json`, `TLauncher.exe`, atau `TLauncherAdditional.json` di dalam subfolder `versions/`.
  - Fungsi `resolveManualMinecraftPath` secara otomatis mengarahkan ke root folder Minecraft jika pengguna memilih folder `versions` atau subfolder modpack `versions/<pack>`.
- **Penyempurnaan Penemuan Wadah Modpack TL-Mods (`src/core/modpack/tlauncher/tlauncherStrategy.ts`)**:
  - Menghapus pembatasan nama wadah `mypack`. Seluruh subfolder di dalam `versions/` yang memiliki folder fisik `mods/` atau berkas metadata versi kini otomatis diakui sebagai wadah modpack TL-Mods dengan deteksi loader dan versi game otomatis.
- **Pemetaan Jalur Folder Kustom / Custom Paths Mapping (`src/desktop/renderer/src/components/ConfigurePathsModal.tsx`)**:
  - Fitur bagi pengguna untuk mengarahkan direktori penyimpanan `mods`, `resourcepacks`, `shaderpacks`, dan `modpacks` (wadah/versions/instances) secara mandiri ke drive atau folder lain.
  - Komponen modal dialog `ConfigurePathsModal` dengan tombol *Browse* folder dan *Reset ke Default Launcher*.
  - Penyimpanan jalur kustom secara atomik di `config.json` dan badge indikator status jalur kustom pada kartu instance.
- **Fitur Hapus Profil Launcher untuk Semua Launcher (`src/desktop/renderer/src/components/DeleteInstanceModal.tsx`)**:
  - Dukungan penghapusan profil launcher apa pun dari LoadModer tanpa terkecuali (termasuk instance vanilla).
  - Penyimpanan riwayat instance yang dihapus ke array `deletedInstances` di `config.json` agar pemindai otomatis tidak memunculkan kembali profil yang sengaja dihapus pengguna.
  - **Dua Langkah Validasi Keamanan Ketat (Membuat Pengguna Berpikir Dua Kali):**
    - Validasi 1: Checkbox persetujuan sadar risiko bahwa data di disk tidak terhapus.
    - Validasi 2: Pengetikan manual kalimat konfirmasi panjang (`SAYA BENAR-BENAR YAKIN INGIN MENGHAPUS PROFIL <NAMA> DARI LOADMODER`) dengan fitur paste dinonaktifkan (`anti-copy-paste`) dan penghitung progres karakter.
- **Panduan Struktur Folder Launcher di UI (`src/desktop/renderer/src/components/LauncherStructureModal.tsx`)**:
  - Tombol pintasan di header antarmuka untuk membuka panduan arsitektur folder dan pohon berkas resmi untuk setiap launcher Minecraft langsung dari aplikasi.
- **Optimasi Caching Process Guard (`src/core/instance/processGuard.ts`)**:
  - Menambahkan caching 1000ms pada pengecekan proses Windows `javaw.exe` untuk mengeliminasi bottleneck pemanggilan `tasklist.exe` berulang-ulang saat operasi disk beruntun.

### Changed
- **Peningkatan SemVer**: Pembaruan nomor versi aplikasi menjadi `2.10.0` secara konsisten pada `package.json`, `package-lock.json`, dan `src/constants.ts`.
- **Dukungan Path Kustom pada Aset**: `mods:listPacks`, `mods:remove`, dan `instances:getContainers` kini memanfaatkan jalur override kustom `resourcepacksDir`, `shaderpacksDir`, dan `modpacksDir` jika ditentukan.

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

