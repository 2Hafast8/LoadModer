# 03 — Spesifikasi Perintah & UX CLI LoadModer

Dokumen ini mendefinisikan hierarki perintah lengkap, opsi/flag global, standar interaksi visual, serta panduan UX untuk CLI **LoadModer**.

---

## 1. Opsi & Flag Global

Flag berikut berlaku untuk hampir semua perintah LoadModer:

| Flag | Singkat | Deskripsi | Default |
| :--- | :---: | :--- | :--- |
| `--dir <path>` | `-d` | Path folder instance Minecraft atau folder `mods` kustom | Instance aktif / Bawaan OS |
| `--profile <name>` | `-p` | Memilih instance yang tersimpan di konfigurasi LoadModer | `default` |
| `--mc-version <ver>` | `-v` | Memaksa versi Minecraft (mis. `1.21.1`) | Dari instance / config |
| `--loader <loader>` | `-l` | Memaksa mod loader (`fabric`, `forge`, `neoforge`, `quilt`) | Dari instance / config |
| `--env <target>` | `-e` | Target lingkungan instalasi (`client` \| `server`) | `client` |
| `--dry-run` | - | Melakukan simulasi tanpa mengunduh atau mengubah berkas di disk | `false` |
| `--yes` | `-y` | Menyetujui semua konfirmasi otomatis (mode non-interaktif) | `false` |
| `--json` | - | Mengeluarkan output dalam format JSON murni (cocok untuk otomasi / script) | `false` |
| `--verbose` | - | Menampilkan log detail HTTP header dan proses streaming | `false` |

---

## 2. Hierarki & Spesifikasi Perintah Lengkap

```text
loadmoder (atau alias: lm)
├── [tanpa argumen]           # Otomatis meluncurkan Dashboard Interaktif TUI
├── home                     # Buka antarmuka interaktif dashboard utama
├── init                     # Wizard deteksi launcher & konfigurasi instance
├── search <query>           # Mencari aset di Modrinth (mod, pack, shader, resourcepack)
├── install <targets...>     # Memasang mod, URL Modrinth, atau modpack .mrpack
├── update [targets...]      # Memperbarui mod terpasang ke versi stabil terbaru
├── remove <targets...>      # Menghapus mod beserta pembersihan dependensi yatim
├── list                     # Menampilkan tabel aset terpasang & status dependensi
├── enable <mod>             # Mengaktifkan mod (.jar.disabled -> .jar)
├── disable <mod>            # Menonaktifkan mod (.jar -> .jar.disabled)
├── bisect <subcommand>      # Alat investigasi pencarian biner mod penyebab crash
├── export                   # Ekspor instance lokal ke .mrpack atau manifest JSON
├── sync                     # Sinkronisasi instan instance dari lockfile / manifest
└── config <subcommand>      # Pengaturan global & registrasi instance kustom
```

### 2.1 Mode Utama: Interactive Home Dashboard (`lm` atau `lm home`)

Jika LoadModer dipanggil tanpa argumen tambahan di terminal (mirip dengan `anichi` atau `an`), aplikasi akan otomatis menampilkan dashboard menu navigasi keyboard yang memukau:

```text
  ██╗      ██████╗  █████╗ ██████╗ ███╗   ███╗ ██████╗ ██████╗ ███████╗██████╗ 
  ██║     ██╔═══██╗██╔══██╗██╔══██╗████╗ ████║██╔═══██╗██╔══██╗██╔════╝██╔══██╗
  ██║     ██║   ██║███████║██║  ██║██╔████╔██║██║   ██║██║  ██║█████╗  ██████╔╝
  ██║     ██║   ██║██╔══██║██║  ██║██║╚██╔╝██║██║   ██║██║  ██║██╔══╝  ██╔══██╗
  ███████╗╚██████╔╝██║  ██║██████╔╝██║ ╚═╝ ██║╚██████╔╝██████╔╝███████╗██║  ██║
  ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝
  v2.0.0  •  Minecraft Mod & Modpack Manager CLI  •  Modrinth API v2

  Instance Aktif: [Prism: 1.21.1-Fabric-SMP]  •  Ketik "lm home" untuk menu interaktif

🎮 MENU UTAMA LOADMODER

 ❯  1. 🔍 Cari & Pasang Mod / Modpack
    2. 🌟 Mod Terpopuler (Sodium, Iris, Fabric API, dll)
    3. 📦 Jelajahi Modpack Rekomendasi (Fabulously Optimized, dll)
    4. 📁 Kelola Mod Terpasang (Lihat / Enable / Disable / Hapus)
    5. 🔄 Periksa & Perbarui Seluruh Mod
    6. 🎮 Pilih / Ganti Instance Minecraft
    7. 🛠️  Diagnostik Crash & Bisect Tool
    8. ❓ FAQ & Panduan Bantuan
  ──────────────────────────────────────────────────────────────────────
    [Keluar dari LoadModer]

  ↑↓ Navigasi  •  Enter Pilih  •  Ctrl+C Keluar
```

**Kontrol Navigasi Keyboard:**
* **$\uparrow / \downarrow$ (Arrow Keys)**: Menggeser kursor pemilihan naik/turun dengan animasi pointer `❯` dan penyorotan baris latar belakang `#0f172a`.
* **Enter**: Mengonfirmasi dan membuka submenu/aksi yang dipilih.
* **Ctrl+C**: Keluar dari aplikasi dengan aman tanpa merusak konfigurasi.

---

## 3. Rincian Perintah & Contoh Interaksi UX

### A. `loadmoder init`
Memulai wizard deteksi otomatis untuk menemukan launcher Minecraft yang terpasang di komputer pengguna.

**Alur Tampilan di Terminal:**
```text
┌  LOADMODER  Inisialisasi Lingkungan
│
◇  Memindai instance launcher di komputer Anda...
│  ✔ Ditemukan 3 instance aktif
│
◆  Pilih instance Minecraft target:
│  ● [Prism] 1.21.1-Fabric-SMP (Fabric 0.16.5 | MC 1.21.1)
│  ○ [Modrinth App] Cobblemon-Pack (Forge 47.2.0 | MC 1.20.1)
│  ○ [Vanilla] Official Launcher (.minecraft)
│  ○ Tambah path kustom secara manual...
└
```
Setelah dipilih, LoadModer mencatat path, versi Minecraft, dan loader ke `~/.loadmoder/config.json`. Pengguna tidak perlu lagi memasukkan flag `-v` atau `-l` di perintah berikutnya.

---

### B. `loadmoder search <query>`
Mencari mod, modpack, shader, atau resource pack di Modrinth dengan filter otomatis yang disesuaikan dengan instance aktif.

**Opsi Khusus:**
* `--type <tipe>`: `mod` (default), `modpack`, `shader`, `resourcepack`, `datapack`.
* `--sort <urutan>`: `relevance` (default), `downloads`, `follows`, `newest`, `updated`.
* `--limit <n>`: Jumlah hasil maksimal (default: 10, max: 50).

**Contoh Output:**
```bash
loadmoder search "minimap" --sort downloads -n 3
```
```text
┌  Hasil Pencarian Modrinth: "minimap" (Filter: 1.21.1 / Fabric)
│
◇  1. Xaero's Minimap [xaeros-minimap]
│     Penulis: xaero96 | ⬇ 42.5M | Rilis: 2026-09-15
│     Menampilkan peta mini interaktif dengan penanda waypoint dan entitas.
│
◇  2. JourneyMap [journeymap]
│     Penulis: techbrew | ⬇ 38.1M | Rilis: 2026-09-10
│     Peta real-time dalam game dan di browser eksternal.
│
◇  3. Map Atlases [map-atlases]
│     Penulis: Selim_042 | ⬇ 2.4M | Rilis: 2026-08-20
│     Peta bergaya vanila berbentuk buku atlas.
└  Gunakan "loadmoder install <slug>" untuk memasang.
```

---

### C. `loadmoder install <targets...>`
Perintah paling utama untuk memasang mod tunggal, banyak mod sekaligus, link URL Modrinth, atau file modpack lokal `.mrpack`.

**Contoh Penggunaan:**
```bash
# Memasang satu atau beberapa mod sekaligus
loadmoder install sodium iris lithium

# Memasang langsung dari URL Modrinth
loadmoder install https://modrinth.com/mod/ferrite-core

# Memasang file modpack lokal
loadmoder install ./fabulously-optimized.mrpack

# Memasang modpack langsung dari slug Modrinth
loadmoder install fabulously-optimized --type modpack

# Memasang hanya mod yang kompatibel dengan server (tanpa mod client)
loadmoder install cobblemon --env server
```

**Alur Tampilan Terminal saat Instalasi Berlangsung:**
```text
┌  LOADMODER  Memasang Aset
│
◇  Target: Prism Instance (1.21.1 / Fabric)
◇  Memeriksa dependensi untuk "sodium", "iris"...
│  ✔ Ditemukan dependensi wajib: fabric-api
│
◇  Ringkasan Instalasi (3 file, total 14.8 MB):
│  • sodium-fabric-0.6.0+mc1.21.1.jar (Root)
│  • iris-fabric-1.7.5+mc1.21.1.jar (Root)
│  • fabric-api-0.102.0+1.21.1.jar (Dependensi wajib)
│
⠋ Mengunduh file (3 koneksi paralel)...
  [████████████████████████████] 100% | sodium-fabric-0.6.0.jar | 1.2/1.2 MB
  [████████████████████████████] 100% | iris-fabric-1.7.5.jar    | 3.4/3.4 MB
  [████████████████████████████] 100% | fabric-api-0.102.0.jar   | 10.2/10.2 MB
│
✔ Verifikasi SHA-512 valid untuk seluruh berkas.
✔ Menulis snapshot ke loadmoder.lock.json.
└  Instalasi selesai! Restart Minecraft untuk memuat perubahan.
```

---

### D. `loadmoder update [targets...]`
Memeriksa pembaruan mod yang kompatibel dengan versi game saat ini menggunakan endpoint batch Modrinth (`POST /version_files/update`).

* Jika dijalankan tanpa argumen (`loadmoder update`), LoadModer akan memeriksa seluruh mod yang ada di folder.
* Jika diberikan nama mod (`loadmoder update sodium`), hanya mod tersebut yang dicek.

**Alur Interaksi:**
```text
┌  LOADMODER  Pembaruan Mod
│
◇  Memindai 24 mod terpasang...
│  ✔ Ditemukan 2 pembaruan yang kompatibel:
│
│  • sodium-fabric: 0.5.8 -> 0.6.0+mc1.21.1
│  • iris-fabric:   1.7.0 -> 1.7.5+mc1.21.1
│
◆  Lanjutkan pembaruan 2 berkas ini?
│  ● Ya (Ganti berkas lama)
│  ○ Tidak (Batalkan)
└
```
Saat diperbarui, berkas `.jar` versi lama otomatis dihapus dari folder mods agar tidak terjadi duplikasi versi.

---

### E. `loadmoder remove <targets...> [--prune]`
Menghapus mod yang terpasang. Fitur pembeda LoadModer adalah **Orphan Pruning**.

**Contoh Interaksi:**
```bash
loadmoder remove iris --prune
```
```text
┌  LOADMODER  Penghapusan Mod
│
◇  Menghapus iris-fabric-1.7.5+mc1.21.1.jar...
│  ✔ Berkas berhasil dihapus.
│
◇  Analisis Dependensi:
│  Pustaka "sodium" yang sebelumnya dibutuhkan oleh "iris" kini memiliki 0 referensi.
│
◆  Hapus pustaka yatim "sodium" agar folder tetap bersih?
│  ● Ya, bersihkan dependensi yatim (Rekomendasi)
│  ○ Jangan hapus, biarkan tetap terpasang
└
```

---

### F. `loadmoder list`
Menampilkan tabel status seluruh aset yang terpasang di instance aktif.

**Contoh Output:**
```bash
loadmoder list
```
```text
┌────────────────────┬───────────┬─────────┬──────────────┬──────────┐
│ Nama Mod           │ Versi     │ Status  │ Tipe         │ Ukuran   │
├────────────────────┼───────────┼─────────┼──────────────┼──────────┤
│ Sodium             │ 0.6.0     │ Aktif   │ Root         │ 1.2 MB   │
│ Iris Shaders       │ 1.7.5     │ Aktif   │ Root         │ 3.4 MB   │
│ Fabric API         │ 0.102.0   │ Aktif   │ Dependensi   │ 10.2 MB  │
│ FreeCam            │ 1.2.1     │ Nonaktif│ Root         │ 850 KB   │
└────────────────────┴───────────┴─────────┴──────────────┴──────────┘
Total: 4 Mod (3 Aktif, 1 Dinonaktifkan via .disabled)
```

---

### G. `loadmoder disable <mod>` & `loadmoder enable <mod>`
Mengaktifkan atau mematikan mod seketika tanpa menghapus file dari disk.
* `loadmoder disable freecam` $\rightarrow$ mengubah `freecam-1.2.1.jar` menjadi `freecam-1.2.1.jar.disabled`. Minecraft otomatis mengabaikan file ini saat boot.
* `loadmoder enable freecam` $\rightarrow$ mengembalikan nama file menjadi `.jar`.

---

### H. `loadmoder bisect <start|good|bad|reset>`
Wizard pemecahan masalah (*troubleshooting*) saat game mengalami crash mendadak akibat konflik mod.
1. `loadmoder bisect start`: Mematikan separuh (50%) dari total mod aktif.
2. Pengguna menjalankan Minecraft:
   * Jika game **berhasil jalan tanpa crash**: ketik `loadmoder bisect good`. CLI tahu mod penyebab crash ada di 50% yang sedang dimatikan.
   * Jika game **masih crash**: ketik `loadmoder bisect bad`. CLI tahu mod perusak ada di 50% yang masih aktif.
3. Proses berulang secara logaritmik $\log_2(N)$ hingga mod perusak ditemukan.
4. `loadmoder bisect reset`: Mengembalikan semua nama file mod ke status awal.

---

### I. `loadmoder watch`
Memantau folder `mods/` secara *real-time*. Jika pengguna menghapus, mengubah, atau menambahkan file mod secara manual melalui Windows File Explorer:
* Sistem secara otomatis mendeteksi event berkas (`file-event`).
* Secara instan melakukan rekonsiliasi lockfile (`reconcileWithDisk`), menghapus mod yang hilang dari `loadmoder.lock.json`, dan membersihkan dependensi yatim (*orphan*).
* Menampilkan visual log aktivitas real-time dengan tema Nordic Clean.

---

### J. `loadmoder export` & `loadmoder sync`
* `loadmoder export --format mrpack`: Mengemas folder mods dan configs lokal menjadi file `.mrpack` resmi yang bisa langsung diunggah ke Modrinth atau dibagikan ke teman.
* `loadmoder export --format json`: Menghasilkan manifes teks ringan yang berisi daftar ID proyek dan hash file.
* `loadmoder sync`: Mengunduh ulang seluruh mod persis seperti yang tertulis di `loadmoder.lock.json` pada komputer lain.

---

## 4. Standar UX & Penanganan Non-Interactive Mode (CI / Scripting)

1. **Deteksi Lingkungan TTY**:
   Sebelum menampilkan prompt interaktif (`select`, `text`), kode selalu memeriksa:
   ```typescript
   if (!process.stdin.isTTY && !options.yes) {
     throw new Error("Sesi terminal non-interaktif terdeteksi. Gunakan flag -y atau tentukan argumen secara eksplisit.");
   }
   ```
2. **Kode Keluar Standar POSIX (Exit Codes)**:
   * `0`: Operasi selesai dengan sukses.
   * `1`: Kesalahan aplikasi umum (mod tidak ditemukan, file korup, dll).
   * `2`: Kesalahan sintaks argumen perintah / flag tidak dikenal.
   * `130`: Pengguna membatalkan proses via tombol keyboard `Ctrl+C` (`SIGINT`).

---

## 5. Sistem Desain Antarmuka: Nordic Minimalist Clean (Tema C)

LoadModer mengadopsi standar visual **Nordic Minimalist Clean** yang berfokus pada keterbacaan tinggi, kontras seimbang, dan penekanan tipografi terminal modern (terinspirasi dari alat modern seperti Bun, lazygit, dan Turborepo).

### 5.1 Palet Warna & Token Visual

| Token Desain | Nilai Hex | Fungsi / Penggunaan |
| :--- | :--- | :--- |
| `primary` | `#38bdf8` (Ice Blue) | Kursor penunjuk `❯`, judul aktif, aksi utama |
| `secondary` | `#818cf8` (Lavender Indigo) | Header grup, badge tipe, sub-judul |
| `success` | `#34d399` (Mint Green) | Status mod aktif `● Aktif`, unduhan berhasil |
| `warning` | `#fbbf24` (Amber Gold) | Peringatan dependensi, versi beta |
| `error` | `#f87171` (Coral Rose) | Status dinonaktifkan `○ Nonaktif`, kegagalan |
| `info` | `#67e8f9` (Polar Cyan) | Ukuran berkas, metadata teknis |
| `text` | `#f1f5f9` (Slate Light) | Teks utama label menu & judul mod |
| `textMuted` | `#94a3b8` (Slate Gray) | Teks sekunder, deskripsi singkat, kategori |
| `muted` | `#64748b` (Deep Slate) | Garis pemisah (`─`), nomor urut, hint |
| `border` | `#334155` (Slate 700) | Bingkai kotak card & tabel |
| `activeBg` | `#1e293b` (Slate 800) | Latar belakang baris kursor terpilih |

### 5.2 Komponen Kunci Antarmuka

1. **Card Status Instance Dinamis (`renderInstanceHeader`)**:
   Menampilkan ringkasan instan profil Minecraft aktif di baris teratas dashboard tanpa membebani memori terminal:
   - Nama instance & launcher yang digunakan
   - Loader (`Fabric`/`Forge`) & versi target Minecraft
   - Jumlah mod aktif vs total berkas
   - Total konsumsi penyimpanan folder `mods/`
2. **Windowed Table Scroller**:
   Menampilkan 10 item sekaligus dengan indikator smooth scroll `▲ N item di atas...` dan `▼ N item di bawah...`, mencegah terminal berantakan saat mengelola ratusan mod.
3. **Sticky Hotkeys Footer**:
   Baris panduan tombol keyboard yang konsisten dan informatif di bagian bawah antarmuka:
   `[↑↓] Geser  •  [Enter] Pilih  •  [Ctrl+C] Keluar`

