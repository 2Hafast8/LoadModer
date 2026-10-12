# 03: Spesifikasi Perintah dan UX LoadModer

Dokumen ini mendefinisikan hierarki perintah lengkap, opsi flag, alur navigasi TUI, dan panduan antarmuka untuk LoadModer (`lm`).

---

## 1. Opsi dan Flag CLI

Flag berikut tersedia pada perintah-perintah yang relevan di LoadModer:

| Flag | Singkat | Deskripsi | Default |
| :--- | :---: | :--- | :--- |
| `--dir <path>` | `-d` | Path folder mods kustom | Folder mods instance aktif |
| `--mc-version <ver>` | `-v` | Menentukan versi Minecraft target (misal: `1.21.1`) | Versi instance aktif |
| `--loader <loader>` | `-l` | Menentukan mod loader target (`fabric`, `forge`, `neoforge`, `quilt`) | Loader instance aktif |
| `--type <type>` | `-t` | Tipe konten: `mod`, `modpack`, `shader`, `resourcepack` | `mod` |
| `--category <cat>` | `-c` | Filter kategori Modrinth (misal: `optimization`, `technology`) | Semua kategori |
| `--env <target>` | `-e` | Target lingkungan instalasi (`client` \| `server`) | `client` |
| `--no-deps` | - | Melewati instalasi dependensi library otomatis | `false` |
| `--dry-run` | - | Simulasi operasi tanpa menulis atau mengubah file di disk | `false` |
| `--yes` | `-y` | Menyetujui semua prompt konfirmasi secara otomatis | `false` |
| `--json` | - | Mengeluarkan output dalam format JSON murni | `false` |

> **Catatan Penggantian Instance / Profil:**  
> Untuk beralih ke instance launcher lain, gunakan perintah `lm config use <id>` atau `lm init`.  
> Untuk beralih versi Minecraft atau mod loader pada instance yang sama, gunakan sub-perintah `lm profile switch -v <ver> -l <loader>`.

---

## 2. Hierarki Perintah CLI

```text
loadmoder (alias: lm)
├── [tanpa argumen]           # Meluncurkan Dashboard Interaktif TUI
├── home                     # Buka antarmuka interaktif dashboard utama
├── init                     # Wizard pendeteksi launcher & inisialisasi instance
├── search <query>           # Mencari mod, modpack, shader, atau resource pack
├── install <targets...>     # Memasang mod atau modpack beserta library dependensinya
├── update [targets...]      # Memperbarui mod terpasang ke versi rilis terbaru
├── remove <targets...>      # Menghapus mod beserta pembersihan dependensi yatim (--prune)
├── list                     # Menampilkan tabel mod terpasang dan status lockfile
├── enable <mod>             # Mengaktifkan mod (.jar.disabled -> .jar)
├── disable <mod>            # Menonaktifkan mod (.jar -> .jar.disabled)
├── bisect <action>          # Investigasi biner mod penyebab crash (start|good|bad|reset)
├── diagnose                 # Pindai log & crash report untuk analisis akar masalah otomatis
├── watch                    # Memantau folder mods secara real-time untuk sinkronisasi
├── profile <action>         # Kelola snapshot profil versi game (list | switch)
├── modpack <action>         # Kelola profil modpack tersimpan (list | switch | disable)
└── config <action>          # Pengaturan konfigurasi (show | use | set)
```

---

## 3. Spesifikasi Detail Perintah

### 3.1 `lm` / `lm home` (Interactive TUI Dashboard)
Membuka antarmuka navigasi keyboard berbasis `@inquirer/prompts`:

```text
  LOADMODER v2.7.0 • Minecraft Mod & Modpack Manager • Nordic Clean TUI

  Instance Aktif : [Prism] Fabulously Optimized (1.21.1 / fabric)
  Mod Terpasang  : 14 Mod (14 Aktif) • Ukuran: 28.4 MB

  ? PILIH MENU DASHBOARD:
  ❯ 🔍  Cari & Eksplorasi Konten Modrinth
    ⭐  Mod Esensial & Populer
    📦  Jelajahi Modpack Populer
    ✨  Jelajahi Shader Pack
    🎨  Jelajahi Resource Pack
    ──────────────────────────────────────────────────────
    🗃️   Kelola Mod Terpasang (Status & Toggle)
    🔄  Periksa & Update Mod
    ⚙️   Kelola Profil & Versi Game (Snapshot & Switch)
    ──────────────────────────────────────────────────────
    🩺  Diagnostik Crash & Bisect Tool
    ❓  Pusat Bantuan & Panduan
    ──────────────────────────────────────────────────────
    [Keluar dari LoadModer]
```

Kontrol navigasi:
- `↑` / `↓` atau `j` / `k` : Menggeser pilihan
- `Enter` : Memilih menu
- `Ctrl+C` : Keluar aplikasi

### 3.2 Menjalankan Desktop GUI
Bagi pengguna antarmuka visual Windows:
```bash
# Mode pengembangan (otomatis rebuild main, preload, renderer dan jalankan Electron)
npm run desktop

# Kompilasi aplikasi mandiri .exe (NSIS Installer & Portable di dist-desktop/)
npm run dist:exe
```

### 3.3 `lm init`
Wizard interaktif untuk mendeteksi launcher Minecraft atau memilih folder `.minecraft`:
```bash
# Inisialisasi standar dengan deteksi otomatis launcher
lm init

# Pindai seluruh drive lokal (C:, D:, E:, ...) untuk folder .minecraft / instances
lm init --scan

# Tentukan path folder .minecraft secara langsung
lm init --path "D:\Games\.minecraft"
```

### 3.4 `lm search <query>`
Mencari konten di Modrinth dengan filter:
```bash
# Mencari mod optimasi untuk Fabric 1.21.1
lm search sodium -v 1.21.1 -l fabric

# Mencari shader pack
lm search complementary -t shader

# Mencari modpack dan mencetak format JSON
lm search "fabulously optimized" -t modpack --json
```

### 3.5 `lm install <targets...>`
Memasang mod, modpack (`.mrpack`), atau URL proyek Modrinth:
```bash
# Memasang mod dengan resolusi dependensi otomatis
lm install sodium iris fabric-api

# Memasang modpack dari file lokal atau slug Modrinth
lm install fabulously-optimized.mrpack
lm install zombie-apocalypse

# Simulasi pemasangan tanpa menulis ke disk
lm install sodium --dry-run

# Melewati pengunduhan library dependensi
lm install custom-mod --no-deps
```

#### Perlindungan Unduh Modpack Aktif (Zero-Overwrite Guard)
Ketika pengguna mencoba memasang modpack baru sementara wadah client aktif sudah menjalankan suatu profil modpack, sistem secara ketat **melarang penimpaan langsung (*zero-overwrite*)** demi mencegah konflik file atau kerusakan konfigurasi. LoadModer memunculkan dialog pencegahan:
1. **Batalkan Pemasangan Modpack**: Menghentikan proses unduh secara aman tanpa memodifikasi berkas disk wadah aktif.
2. **Bersihkan Wadah dan Pasang Modpack Baru (Clean Install)**: Mengarsipkan profil modpack saat ini ke brankas `.loadmoder/profiles/<id>/`, membersihkan folder kerja ke kondisi *clean state*, lalu memasang modpack baru secara bersih.

#### Pencadangan Baseline Satu Kali (One-Time Golden Baseline Snapshot)
Sebelum modpack pertama dipasang pada wadah client aktif, LoadModer secara otomatis membuat **One-Time Golden Baseline Snapshot** di `.loadmoder/baseline/`:
- Mencadangkan seluruh berkas konfigurasi murni bawaan awal (termasuk `options.txt` awal dan folder non-mod).
- Folder `mods/` diabaikan karena lingkungan dasar diasumsikan murni (*vanilla/clean*).
- Disimpan permanen dan tidak akan pernah dihapus (*zero-delete policy*) agar selalu tersedia saat wadah dikembalikan ke kondisi awal tanpa modpack.

#### Pilihan Mode Pemasangan Modpack
Saat memasang modpack, pengguna dapat memilih salah satu dari dua mode:
- **Full Modpack (Lengkap)**: Memasang seluruh komponen yang disediakan pembuat modpack (mods, overrides, configs, resourcepacks, shaders, dan defaultconfigs).
- **Ringan / Esensial**: Hanya mengekstrak mod inti dan konfigurasi wajib, melewati resource pack atau shader berukuran besar untuk menghemat ruang disk dan RAM.

### 3.6 `lm update`
Memeriksa versi mod lokal terhadap rilis terbaru di Modrinth:
```bash
# Memperbarui semua mod dengan konfirmasi otomatis
lm update -y

# Menyertakan versi prerelease (alpha/beta)
lm update --prerelease
```

### 3.7 `lm remove <targets...>`
Menghapus mod dan dependensi yang tidak lagi digunakan:
```bash
# Menghapus mod iris dan membersihkan library yatim yang tidak lagi dirujuk mod lain
lm remove iris --prune -y
```

### 3.8 `lm profile`
Mengisolasi dan beralih antar kombinasi versi game pada instance launcher:
```bash
# Menampilkan daftar snapshot profil tersimpan
lm profile list

# Beralih ke versi Minecraft 1.20.1 Forge (mod lama diarsipkan otomatis)
lm profile switch -v 1.20.1 -l forge
```

### 3.9 `lm bisect <action>`
Melacak mod penyebab crash menggunakan algoritma pencarian biner ($O(\log_2 N)$):
```bash
# Memulai sesi bisect (setengah mod dinonaktifkan sementara)
lm bisect start

# Laporkan jika game berhasil menyala tanpa crash
lm bisect good

# Laporkan jika game masih crash
lm bisect bad

# Kembalikan semua mod ke kondisi semula sebelum bisect
lm bisect reset
```

### 3.10 `lm watch`
Memantau folder `mods/` secara real-time dan menyinkronkan status lockfile saat ada perubahan manual:
```bash
lm watch
```

### 3.11 `lm modpack <action>`
Mengelola brankas profil modpack pada wadah client aktif (`.loadmoder/profiles/`):
```bash
# Menampilkan tabel profil modpack tersimpan di wadah aktif beserta status aktif
lm modpack list

# Beralih ke profil modpack lain dari brankas secara instan tanpa mengunduh ulang
lm modpack switch <profile-id>

# Mengarsipkan modpack yang sedang aktif ke brankas, membersihkan wadah kerja (clean state),
# dan memulihkan lingkungan wadah dari One-Time Golden Baseline (.loadmoder/baseline/)
lm modpack disable
```

### 3.12 `lm config <action>`
Menampilkan atau mengubah konfigurasi lokal LoadModer:
```bash
# Menampilkan konfigurasi instance aktif saat ini
lm config show

# Mengarahkan LoadModer ke ID instance tertentu
lm config use <instance-id>

# Mengatur opsi konfigurasi global
lm config set defaultLoader fabric
```

### 3.13 `lm diagnose` (Crash Log Analyzer)
Menganalisis berkas `latest.log` atau `crash-reports/crash-*.txt` terbaru secara otomatis untuk mendeteksi akar penyebab crash:
```bash
# Analisis otomatis pada instance aktif
lm diagnose

# Analisis instance pada folder tertentu
lm diagnose -d "D:\Games\.minecraft"

# Cetak isi teks log mentah
lm diagnose --raw

# Keluarkan laporan diagnostik dalam format JSON terstruktur
lm diagnose --json
```

