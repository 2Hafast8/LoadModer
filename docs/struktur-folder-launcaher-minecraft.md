# Struktur Folder Launcher Minecraft (Versi Terverifikasi)

Dokumen ini menggabungkan dua versi sebelumnya dan mengoreksi bagian yang tidak sesuai dengan sumber nyata (dokumentasi resmi Prism, log peluncuran TLauncher/Legacy Launcher, dan repositori pengguna SKLauncher).

**Asumsi:** Windows. Lokasi Linux/macOS ada di bagian akhir.

**Label keyakinan:**

| Label | Arti |
|---|---|
| ✅ Terkonfirmasi | Cocok dengan dokumentasi resmi atau log/bukti nyata |
| 🟡 Umum | Struktur standar yang lazim, tetapi tidak saya cocokkan satu per satu dengan sumber |
| ⚠️ Perlu dicek | Tidak ada bukti kuat; cek langsung di komputer Anda (lihat bagian "Cara Verifikasi") |

---

## 1. Minecraft Launcher Resmi (Mojang/Microsoft) 🟡

**Lokasi:** `%appdata%\.minecraft`

```text
.minecraft/
├── assets/                    # Aset game
│   ├── indexes/               # Indeks aset per versi
│   ├── objects/               # Berkas aset (suara, bahasa, dll, bernama hash)
│   └── skins/                 # Cache skin
├── libraries/                 # Pustaka Java dan dependensi
├── versions/                  # Satu folder per versi
│   └── 1.21.1/
│       ├── 1.21.1.jar
│       └── 1.21.1.json
├── mods/                      # Mod (.jar), dibuat saat memasang mod loader
├── config/                    # Konfigurasi mod
├── resourcepacks/             # Paket tekstur
├── shaderpacks/               # Paket shader (Iris/OptiFine)
├── saves/                     # Dunia (world)
├── screenshots/               # Tangkapan layar
├── logs/                      # Log permainan (latest.log)
├── crash-reports/             # Laporan crash
├── runtime/                   # JRE bawaan launcher (lihat catatan)
├── launcher_profiles.json     # Profil/instalasi di launcher
├── launcher_accounts.json     # Data akun
├── options.txt                # Pengaturan grafis, kontrol, audio
└── servers.dat                # Daftar server
```

> **Catatan:** Letak `runtime/` bisa berbeda tergantung varian launcher (installer biasa vs. Microsoft Store). Folder `mods`, `config`, dan `shaderpacks` baru muncul setelah dipakai.

---

## 2. Prism Launcher ✅

**Lokasi:** `%APPDATA%\PrismLauncher` (versi portable: folder aplikasi itu sendiri)

```text
PrismLauncher/
├── instances/                 # Semua instance
│   ├── instgroups.json        # Pengelompokan instance
│   └── <NamaInstance>/
│       ├── instance.cfg       # Konfigurasi instance (RAM, Java, nama)
│       ├── mmc-pack.json      # Daftar komponen (Minecraft, loader, dll)
│       └── .minecraft/        # Folder game instance (tersembunyi)
│           ├── mods/
│           ├── config/
│           ├── saves/
│           ├── resourcepacks/
│           ├── shaderpacks/
│           ├── screenshots/
│           ├── logs/
│           └── options.txt
├── assets/                    # Aset game (dipakai bersama)
├── libraries/                 # Pustaka (dipakai bersama)
├── meta/                      # Cache metadata versi & loader
├── metacache/                 # Cache unduhan
├── java/                      # Java yang dikelola launcher
├── icons/                     # Ikon instance
├── iconthemes/                # Tema ikon launcher
├── themes/                    # Tema tampilan
├── translations/              # Berkas bahasa
├── logs/                      # Log launcher
├── accounts.json              # Akun
└── prismlauncher.cfg          # Pengaturan global
```

> **Catatan:**
> - Tidak ada folder `mods/` di root Prism; mod ada di dalam tiap instance.
> - Folder game instance baru bernama `.minecraft`. Instance lama (atau hasil impor dari MultiMC) bisa memakai `minecraft` tanpa titik, jadi cek keduanya.
> - Beberapa versi punya `cache/` tambahan di root.

---

## 3. MultiMC 🟡

**Lokasi:** folder tempat MultiMC diekstrak (portable, tidak di appdata)

```text
MultiMC/
├── MultiMC.exe
├── multimc.cfg                # Pengaturan global
├── accounts.json              # Akun
├── instances/
│   ├── instgroups.json
│   └── <NamaInstance>/
│       ├── instance.cfg
│       ├── mmc-pack.json
│       └── .minecraft/        # Versi lama: minecraft/ (tanpa titik)
│           ├── mods/
│           ├── config/
│           ├── saves/
│           ├── resourcepacks/
│           └── options.txt
├── assets/
├── libraries/
├── meta/
├── metacache/
├── icons/
├── translations/
└── logs/
```

> **Catatan:** Dokumentasi MultiMC lama menyebut folder game `minecraft/`, sedangkan versi terbaru memakai `.minecraft/`. Jangan hardcode salah satunya.
>
> Prism adalah fork dari MultiMC (lewat PolyMC), jadi strukturnya hampir sama. Beda utamanya: Prism menyimpan data di appdata (kecuali portable), MultiMC selalu portable.

---

## 4. TLauncher ✅ (sebagian)

TLauncher memakai dua lokasi: game di `.minecraft`, konfigurasi launcher di `.tlauncher`.

```text
%appdata%/
├── .minecraft/                # Folder game (dibagi dengan launcher resmi)
│   ├── assets/
│   ├── libraries/
│   ├── versions/
│   ├── mods/
│   ├── resourcepacks/
│   ├── saves/
│   ├── screenshots/
│   ├── logs/
│   │   └── tlauncher/         # Log TLauncher
│   ├── TlauncherProfiles.json # Profil TLauncher
│   └── options.txt
└── .tlauncher/                # Konfigurasi launcher
    └── tlauncher-2.0.properties
```

> **Koreksi dari versi sebelumnya:**
> - Nama file konfigurasi yang benar adalah `tlauncher-2.0.properties`, bukan `tlauncher.properties`.
> - Log TLauncher ada di `.minecraft\logs\tlauncher`, bukan di `.tlauncher\logs`.
> - Sebagian sumber menyebut `.tlauncher` ada di folder user (`C:\Users\<nama>\.tlauncher`). Log peluncuran nyata menunjukkan `%appdata%\.tlauncher`. Cek keduanya.

---

## 5. Legacy Launcher (dulu TL Legacy) ✅

Struktur folder Legacy Launcher telah **terkonfirmasi secara penuh** dengan arsitektur Dual-Path yang memisahkan engine game dari wadah profil mod:

**Lokasi Root:** `%appdata%\.tlauncher\legacy\Minecraft\game`  
**Konfigurasi Versi Aktif:** `%appdata%\.tlauncher\legacy\Minecraft\tl.properties` (kunci `login.version`)

```text
%appdata%/
└── .tlauncher/
    └── legacy/
        └── Minecraft/
            ├── tl.properties          # Konfigurasi versi aktif (login.version=Fabric 1.21.1)
            └── game/                  # Root instance game
                ├── versions/          # Engine jar/json versi game (read-only/shared)
                │   └── <version>/     # e.g. Fabric 1.21.1/Fabric 1.21.1.jar & .json
                └── home/              # Wadah profil tempat modpack & aset pengguna
                    └── <profile>/     # e.g. Fabric 1.21.1/ atau profil kustom
                        ├── mods/          # Mod (.jar)
                        ├── config/        # Konfigurasi mod
                        ├── options.txt    # Pengaturan grafis per-profil
                        ├── resourcepacks/ # Paket tekstur
                        ├── shaderpacks/   # Shader pack
                        ├── saves/         # Dunia permainan
                        └── .loadmoder/    # Metadata wadah LoadModer
                            ├── lockfile.json
                            ├── baseline/  # One-Time Golden Baseline snapshot
                            └── profiles/  # Brankas arsip profil modpack
```

> **Catatan Teknis Arsitektur Dual-Path:**
> - `game/versions/`: Hanya berisi berkas binary core engine Minecraft (jar dan json).
> - `game/home/<profile>/`: Wadah kerja riil tempat LoadModer beroperasi memasang mod, modpack, konfigurasi, dan isolasi options.txt.
> - LoadModer mendeteksi Legacy Launcher secara otomatis berdasarkan substring `.tlauncher/legacy` pada path yang terdeteksi dari Roaming (Disk C) maupun root disk non-C.

---

## 6. SKLauncher ⚠️ (sebagian)

Yang terkonfirmasi: SKLauncher memakai folder game standar `%APPDATA%\.minecraft` (mod ada di `.minecraft\mods`) dan menerima argumen `--workDir` untuk memindahkan folder kerja.

```text
%appdata%/
└── .minecraft/                # Folder game (dibagi dengan launcher resmi)
    ├── assets/
    ├── libraries/
    ├── versions/
    ├── mods/
    ├── config/
    ├── resourcepacks/
    ├── shaderpacks/
    ├── saves/
    ├── screenshots/
    ├── logs/
    └── options.txt
```

> **Koreksi dari versi sebelumnya:** kedua versi sama-sama menyebut folder `.sklauncher` (bahkan dengan isi `config.json`, `sklauncher.json`, `profiles/`), tetapi saya **tidak menemukan sumber** yang membuktikannya. Saya sengaja tidak memasukkannya ke struktur. Jika ada folder konfigurasi SKLauncher di komputer Anda, gunakan perintah verifikasi di bawah.

---

## Perbandingan Singkat

| Launcher | Lokasi data default | Konfigurasi launcher | Instance terpisah? |
|---|---|---|---|
| Resmi | `%appdata%\.minecraft` | Di dalam `.minecraft` | Tidak (dibedakan profil) |
| Prism | `%appdata%\PrismLauncher` | `prismlauncher.cfg` | Ya |
| MultiMC | Folder portable | `multimc.cfg` | Ya |
| TLauncher | `%appdata%\.minecraft` | `%appdata%\.tlauncher\tlauncher-2.0.properties` | Tidak |
| Legacy | `%appdata%\.tlauncher\legacy\Minecraft\files` | ⚠️ Perlu dicek | Tidak |
| SKLauncher | `%appdata%\.minecraft` | ⚠️ Perlu dicek | Tidak |

---

## Rangkuman Perbedaan Dua Versi Sebelumnya

| Bagian | Versi A (dengan komentar) | Versi B (lebih lengkap file) | Hasil verifikasi |
|---|---|---|---|
| Resmi | Tanpa `runtime`, `servers.dat`, `launcher_accounts.json` | Lebih lengkap | Versi B lebih lengkap; keduanya benar |
| Prism, `mods/` di root | Ada | Tidak ada | **A salah**, `mods/` tidak ada di root |
| Prism, folder game | `.minecraft` | `minecraft` | Keduanya mungkin; baru = `.minecraft`, lama = `minecraft` |
| Prism, file root | Kurang (`accounts.json`, `assets`, `java`, `logs`, `themes`, dll) | Lebih lengkap, tapi `cache/` tidak selalu ada | B lebih mendekati |
| MultiMC, folder game | `.minecraft` | `.minecraft` | Versi lama memakai `minecraft` |
| TLauncher, file konfigurasi | `tlauncher.properties` | `tlauncher-2.0.properties` | **B benar**, A salah |
| TLauncher, log | `.tlauncher\logs` | `.minecraft\logs` | **B lebih tepat** (`logs\tlauncher`) |
| Legacy | `%appdata%\.tla` | `.minecraft` + `.legacylauncher` | **Keduanya salah**; lokasi nyata `.tlauncher\legacy\Minecraft\files` |
| SKLauncher | `.sklauncher` + `config.json` dll | `.sklauncher` (opsional) | Tidak terbukti; dihapus |

---

## Lokasi di OS Lain

| Launcher | Linux | macOS |
|---|---|---|
| Resmi / TLauncher / SKLauncher | `~/.minecraft` | `~/Library/Application Support/minecraft` |
| Prism | `~/.local/share/PrismLauncher` | `~/Library/Application Support/PrismLauncher` |
| Prism (Flatpak) | `~/.var/app/org.prismlauncher.PrismLauncher/data/PrismLauncher` | - |
| Prism (Scoop, Windows) | `%HOMEPATH%\scoop\persist\prismlauncher` | - |

---

## Cara Verifikasi di Komputer Anda

Jalankan di **PowerShell** untuk melihat folder launcher yang benar-benar ada:

```powershell
Get-ChildItem $env:APPDATA -Force -Directory |
  Where-Object Name -match 'minecraft|tlauncher|prism|multimc|sk|tla|legacy' |
  Select-Object Name
```

Untuk melihat isi satu folder dalam bentuk pohon:

```powershell
tree "$env:APPDATA\.tlauncher" /F
```

Hasilnya bisa dipakai untuk memperbaiki bagian bertanda ⚠️.
