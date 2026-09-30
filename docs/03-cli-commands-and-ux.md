# 03 — Spesifikasi Perintah & UX CLI LoadModer

Dokumen ini mendefinisikan hierarki perintah lengkap, opsi/flag global, standar interaksi visual, serta panduan antarmuka (UX) untuk CLI & TUI **LoadModer**.

---

## 1. Opsi & Flag Global

Flag berikut tersedia untuk mengontrol perilaku perintah LoadModer:

| Flag | Singkat | Deskripsi | Default |
| :--- | :---: | :--- | :--- |
| `--dir <path>` | `-d` | Path folder instance Minecraft atau folder `mods` kustom | Instance aktif / Bawaan OS |
| `--profile <name>` | `-p` | Memilih instance/profil yang tersimpan | Profil aktif |
| `--mc-version <ver>` | `-v` | Menentukan versi Minecraft target (misal: `1.21.1`) | Dari profil aktif |
| `--loader <loader>` | `-l` | Menentukan mod loader target (`fabric`, `forge`, `neoforge`, `quilt`) | Dari profil aktif |
| `--type <type>` | `-t` | Tipe konten: `mod`, `modpack`, `shader`, `resourcepack` | `mod` |
| `--category <cat>` | `-c` | Kategori Modrinth (misal: `optimization`, `technology`) | Semua |
| `--env <target>` | `-e` | Target lingkungan instalasi (`client` \| `server`) | `client` |
| `--no-deps` | - | Melewati instalasi dependensi library otomatis | `false` |
| `--dry-run` | - | Simulasi operasi tanpa menulis atau mengubah file di disk | `false` |
| `--yes` | `-y` | Menyetujui semua prompt konfirmasi secara otomatis | `false` |
| `--json` | - | Mengeluarkan output dalam format JSON murni untuk scripting | `false` |

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
├── watch                    # Memantau folder mods secara real-time untuk sinkronisasi
├── profile <action>         # Kelola snapshot profil versi game (list | switch)
└── config <action>          # Pengaturan global (show | use | set)
```

---

## 3. Spesifikasi Detail Perintah

### 3.1 `lm` / `lm home` (Interactive TUI Dashboard)
Membuka antarmuka navigasi keyboard berbasis `@inquirer/prompts` dan `@clack/prompts`:

```text
  ██╗      ██████╗  █████╗ ██████╗ ███╗   ███╗ ██████╗ ██████╗ ███████╗██████╗ 
  ██║     ██╔═══██╗██╔══██╗██╔══██╗████╗ ████║██╔═══██╗██╔══██╗██╔════╝██╔══██╗
  ██║     ██║   ██║███████║██║  ██║██╔████╔██║██║   ██║██║  ██║█████╗  ██████╔╝
  ██║     ██║   ██║██╔══██║██║  ██║██║╚██╔╝██║██║   ██║██║  ██║██╔══╝  ██╔══██╗
  ███████╗╚██████╔╝██║  ██║██████╔╝██║ ╚═╝ ██║╚██████╔╝██████╔╝███████╗██║  ██║
  ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝
  v2.0.0  •  Minecraft Mod & Modpack Manager CLI  •  Modrinth API v2

  Instance Aktif: [1.21.1 / Fabric] (3 mods terpasang)

  ┌─────────────────────────────────────────────────────────────┐
  │                    FILTER PENCARIAN AKTIF                   │
  ├───────────────────┬─────────────────────────────────────────┤
  │ Versi Minecraft   │ 1.21.1                                  │
  │ Mod Loader        │ fabric                                  │
  │ Tipe Proyek       │ mod                                     │
  │ Kategori          │ Semua                                   │
  │ Environment       │ client                                  │
  └───────────────────┴─────────────────────────────────────────┘

🎮 MENU NAVIGASI:
  ❯ 🔍 Jelajahi & Cari Mod / Modpack
    🌟 Mod Terpopuler
    📦 Jelajahi Modpack Rekomendasi
    ⚙️  Atur Filter Pencarian
    📁 Kelola Mod Terpasang (Status & Toggle)
    🔄 Periksa Pembaruan Mod
    🎮 Beralih Profil / Versi Minecraft
    🩺 Diagnostik Crash (Bisect Engine)
    ❓ Bantuan & Dokumentasi
    ────────────────────────────────────────
    🚪 Keluar dari LoadModer
```

### 3.2 `lm search <query>`
Mencari mod, modpack, shader, atau resource pack di Modrinth dengan filter presisi:
```bash
# Pencarian mod dengan filter versi dan loader
lm search sodium -v 1.21.1 -l fabric

# Pencarian shader pack
lm search complementary -t shader

# Pencarian modpack dengan format JSON
lm search "fabulously optimized" -t modpack --json
```

### 3.3 `lm install <targets...>`
Memasang satu atau lebih target mod, file `.mrpack`, atau URL Modrinth:
```bash
# Memasang mod dengan resolusi dependensi otomatis
lm install sodium iris fabric-api

# Memasang modpack Modrinth
lm install fabulously-optimized.mrpack

# Memasang tanpa dependensi otomatis
lm install custom-mod --no-deps
```
*Catatan Alur*: Jika mod membutuhkan library tambahan (misalnya Fabric API atau Cloth Config), resolver otomatis mendeteksi, memeriksa folder `mods/`, dan mengunduh versi yang kompatibel.

### 3.4 `lm update`
Memeriksa status versi seluruh mod yang terpasang di instance aktif dan melakukan pembaruan massal:
```bash
# Memperbarui semua mod dengan konfirmasi otomatis
lm update -y

# Menyertakan rilis beta/alpha
lm update --prerelease
```

### 3.5 `lm remove <targets...>`
Menghapus mod terpasang dengan opsi pembersihan dependensi yatim (*orphan pruning*):
```bash
# Hapus mod dan bersihkan library yang tidak lagi dirujuk mod lain
lm remove iris --prune -y
```

### 3.6 `lm profile`
Mengelola snapshot profil versi game dan mod loader secara terisolasi:
```bash
# Menampilkan daftar snapshot profil tersimpan
lm profile list

# Beralih ke versi Minecraft 1.20.1 Forge
lm profile switch -v 1.20.1 -l forge
```
*Catatan*: Saat berpindah profil, isi folder `mods/` saat ini disimpan ke snapshot profil aktif, lalu file mod milik profil target dipulihkan secara otomatis.

### 3.7 `lm bisect <action>`
Melacak mod penyebab crash menggunakan algoritma pencarian biner:
```bash
# Memulai sesi bisect (setengah mod akan dinonaktifkan sementara)
lm bisect start

# Laporkan jika game berhasil berjalan tanpa crash
lm bisect good

# Laporkan jika game masih crash
lm bisect bad

# Mengembalikan seluruh file mod ke kondisi semula
lm bisect reset
```

### 3.8 `lm watch`
Memantau folder `mods/` secara real-time dan menyinkronkan data saat file diubah, ditambah, atau dihapus secara manual di luar CLI:
```bash
lm watch
```
