# Struktur Folder Launcher Minecraft (Versi Terverifikasi)

Dokumen ini memetakan arsitektur dan struktur folder launcher Minecraft berdasarkan dokumentasi resmi, analisis disk, dan bukti log peluncuran nyata.

---

## 📌 Klasifikasi Arsitektur Launcher

Dalam ekosistem Minecraft dan platform **LoadModer**, seluruh launcher dibagi secara tegas ke dalam dua kategori:

1. **Launcher Resmi (Official / First-Party)**:
   - **Minecraft Launcher Resmi (Mojang Studios / Microsoft)**: Merupakan satu-satunya launcher resmi bawaan dari game Minecraft. Menggunakan folder data standar `%appdata%\.minecraft`. Ini adalah **default launcher utama** di LoadModer untuk pengelolaan mod, shader pack, dan resource pack vanilla.

2. **Launcher Pihak Ketiga (Third-Party Launchers)**:
   - **Semua launcher selain Official Minecraft adalah launcher third-party (pihak ketiga)**, termasuk:
     - **Prism Launcher** (Third-Party, multi-instance)
     - **MultiMC** (Third-Party, portable multi-instance)
     - **TLauncher** (Third-Party, shared directory)
     - **Legacy Launcher** (Third-Party, dual-path architecture)
     - **SKLauncher** (Third-Party, custom directory)
     - **Modrinth App & CurseForge** (Third-Party, managed app instances)
   - Launcher third-party menyediakan fitur kustom (seperti pengelolaan multi-akun, isolasi instance portable, atau wadah modpack), namun bukan merupakan instalasi resmi dari Mojang Studios.

---

**Label Keyakinan:**

| Label | Arti |
|---|---|
| ✅ Terkonfirmasi | Cocok dengan dokumentasi resmi atau log/bukti nyata pada disk |
| 🟡 Umum | Struktur standar yang lazim, tetapi mengikuti konvensi resmi Mojang |
| ⚠️ Perlu dicek | Lokasi tentatif; diverifikasi berkala |

---

## BAGIAN I: LAUNCHER RESMI (OFFICIAL / FIRST-PARTY)

### 1. Minecraft Launcher Resmi (Mojang/Microsoft) 🟡
**Kategori:** Official / First-Party (Default Launcher Utama)  
**Lokasi Data:** `%appdata%\.minecraft`

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

## BAGIAN II: LAUNCHER PIHAK KETIGA (THIRD-PARTY LAUNCHERS)

### 2. Prism Launcher (Third-Party) ✅
**Kategori:** Third-Party (Multi-Instance Isolated Launcher)  
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

### 3. MultiMC (Third-Party) 🟡
**Kategori:** Third-Party (Portable Multi-Instance Launcher)  
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

### 4. TLauncher (Third-Party) ✅ (sebagian)
**Kategori:** Third-Party (Shared Directory Launcher)  
**Lokasi Data:** `%appdata%\.minecraft` (berbagi dengan launcher resmi)  
**Lokasi Konfigurasi:** `%appdata%\.tlauncher`

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

### 5. Legacy Launcher (Third-Party — Dulu TL Legacy) ✅
**Kategori:** Third-Party (Dual-Path Engine & Container Launcher)  

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

### 6. SKLauncher (Third-Party) ⚠️ (sebagian)
**Kategori:** Third-Party (Custom Directory Launcher)  

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

### 7. Launcher Third-Party Lainnya (Modrinth App & CurseForge) ✅
**Kategori:** Third-Party (Managed App Instances)

#### A. Modrinth App
- **Windows:** `%APPDATA%\com.modrinth.theseus\profiles\<ProfileName>`
- **Linux:** `~/.local/share/com.modrinth.theseus/profiles/<ProfileName>`
- **macOS:** `~/Library/Application Support/com.modrinth.theseus/profiles/<ProfileName>`
- Setiap instance/profil memiliki folder permainan mandiri (`mods/`, `config/`, `resourcepacks/`, `options.txt`).

#### B. CurseForge App
- **Windows:** `%USERPROFILE%\curseforge\minecraft\Instances\<ProfileName>`
- Tiap instance memiliki sub-folder game terisolasi per modpack.

---

## Perbandingan Singkat

| Launcher | Kategori | Lokasi data default | Konfigurasi launcher | Wadah / Instance terpisah? |
|---|---|---|---|---|
| Resmi (Mojang/MS) | **Official (First-Party)** | `%appdata%\.minecraft` | Di dalam `.minecraft` | Tidak (profil versi berbagi folder root) |
| Prism Launcher | **Third-Party** | `%appdata%\PrismLauncher\instances` | `prismlauncher.cfg` | Ya (instance per-folder) |
| MultiMC | **Third-Party** | Folder portable (`instances/`) | `multimc.cfg` | Ya (instance per-folder portable) |
| TLauncher | **Third-Party** | `%appdata%\.minecraft` | `%appdata%\.tlauncher\tlauncher-2.0.properties` | Wadah versi (`versions/<mypack>`) |
| Legacy Launcher | **Third-Party** | `%appdata%\.tlauncher\legacy\Minecraft\game` | `tl.properties` (`login.version`) | Ya (Dual-Path: `versions/` & `home/<profile>/`) |
| SKLauncher | **Third-Party** | `%appdata%\.minecraft` (opsional kustom) | Di dalam `.minecraft` / argumen `--workDir` | Tidak bawaan |
| Modrinth App | **Third-Party** | `%appdata%\com.modrinth.theseus\profiles` | `profiles/<profile>/profile.json` | Ya (instance per-profil) |
| CurseForge | **Third-Party** | `%USERPROFILE%\curseforge\minecraft\Instances` | `minecraftinstance.json` | Ya (instance per-modpack) |

---

## 💡 Implikasi Desain pada LoadModer

1. **Official Minecraft sebagai Default Instance Utama:**
   - Karena Minecraft Launcher Resmi (Mojang) adalah satu-satunya launcher first-party resmi, LoadModer secara otomatis menjadikannya sebagai **default active launcher** (`vanilla-default`).
   - Pada Official Minecraft, LoadModer menyajikan menu dan navigasi murni untuk mod individual (.jar), shader pack, dan resource pack tanpa kebisingan opsi modpack (.mrpack) atau pergantian mode wadah.

2. **Launcher Third-Party sebagai Instance Spesifik / Lanjutan:**
   - Launcher pihak ketiga (seperti Legacy Launcher dan TLauncher) memanfaatkan strategi wadah modpack khusus (`modpackStrategy: "legacy"` atau `"tlauncher"`).
   - Menu modpack (`📦 Jelajahi & Unduh Modpack`) dan brankas profil (`📦 Brankas Profil Modpack`) diaktifkan secara dinamis hanya saat pengguna beralih ke instance launcher third-party tersebut.

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
