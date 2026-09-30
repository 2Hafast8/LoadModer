# LoadModer Documentation Hub 📚

Selamat datang di dokumentasi resmi arsitektur dan teknis **LoadModer** — platform CLI/CMD modern untuk manajemen mod, modpack (`.mrpack`), shader, dan resource pack Minecraft berbasis Modrinth API.

Dokumentasi ini dirancang sebagai panduan komprehensif mulai dari konsep arsitektur tingkat tinggi, detail teknis pustaka (tech stack), spesifikasi perintah CLI, hingga implementasi mesin inti (modpack engine, multi-launcher discovery, dependency graph, dan crash bisect).

---

## 🗺️ Peta Navigasi Dokumentasi

Dokumentasi ini dibagi menjadi 8 modul spesifik di dalam folder `docs/`:

| Dokumen | Topik & Cakupan |
| :--- | :--- |
| **[01. Arsitektur & Visi Sistem](file:///c:/Users/LENOVO/LoadModer/docs/01-architecture-and-vision.md)** | Visi platform "Cargo/NPM untuk Minecraft", arsitektur modular, 7 pilar utama, diagram alur data, dan manajemen kuota Modrinth API. |
| **[02. Kurasi Tech Stack & Pustaka](file:///c:/Users/LENOVO/LoadModer/docs/02-tech-stack-and-libraries.md)** | Pemilihan stack terbaik (Golden Stack), komparasi mendalam pustaka (Commander vs others, @clack vs Inquirer, picocolors vs chalk, p-limit, streaming unzip, tsup, dan binary compilation). |
| **[03. Spesifikasi Perintah & UX CLI](file:///c:/Users/LENOVO/LoadModer/docs/03-cli-commands-and-ux.md)** | Hierarki perintah lengkap (`init`, `install`, `search`, `list`, `update`, `remove`, `bisect`, `export`, dll.), flag, argumen, serta desain visual antarmuka terminal. |
| **[04. Mesin Modpack (.mrpack Engine)](file:///c:/Users/LENOVO/LoadModer/docs/04-modpack-engine.md)** | Bedah format standar `.mrpack`, parsing streaming `modrinth.index.json`, mapping `overrides/`, filtering client vs server, dan atomic extraction. |
| **[05. Integrasi Multi-Launcher](file:///c:/Users/LENOVO/LoadModer/docs/05-multi-launcher-integration.md)** | Algoritma auto-discovery instance Prism Launcher, MultiMC, Modrinth App (Theseus), CurseForge, dan Vanilla. Parsing `mmc-pack.json` & `profile.json`. |
| **[06. Dependency Graph & Lockfile](file:///c:/Users/LENOVO/LoadModer/docs/06-dependency-graph-and-lockfile.md)** | Struktur `loadmoder.lock.json`, resolusi DAG, algoritma reference counting untuk dependensi, deteksi inkompatibilitas, dan *orphan pruning* (garbage collection). |
| **[07. Diagnostik Crash & Bisect Engine](file:///c:/Users/LENOVO/LoadModer/docs/07-troubleshooting-and-bisect.md)** | Sistem isolasi mod (`.disabled`), algoritma pencarian biner (*binary search bisect*) untuk menemukan mod penyebab crash otomatis dalam hitungan langkah. |
| **[08. Panduan Pengembang & Distribusi Binary](file:///c:/Users/LENOVO/LoadModer/docs/08-developer-guide-and-api.md)** | Panduan setup repository TypeScript, skrip npm, struktur folder modul, pengujian, bundling dengan `tsup`, dan kompilasi menjadi file mandiri `.exe` tanpa perlu Node.js. |
| **[Katalog Agent Skills](file:///c:/Users/LENOVO/LoadModer/docs/SKILL.md)** | Indeks dan panduan lengkap 18 skills dari folder `.agent/skills/` (Anti-Slop, Clean Code, Arsitektur, Security, UI/UX, Performance) yang memandu pengembangan proyek ini. |

---

## 🚀 Gambaran Singkat: Filosofi LoadModer

1. **Dual-Mode Operation (Interactive & Direct CLI)**:
   - **Mode Interaktif Penuh (seperti `anichi`)**: Cukup ketik `lm` atau `loadmoder`, dashboard interaktif dengan navigasi panah keyboard ($\uparrow/\downarrow$) dan tema neon cyberpunk akan muncul.
   - **Mode Perintah Langsung**: Semua perintah (`lm install`, `lm search`, `lm update`) siap dipanggil langsung dengan flag untuk scripting atau otomasi CI/CD.
2. **Zero-Configuration by Default**: Pengguna tidak perlu menghafal path folder `%APPDATA%\.minecraft\mods`. LoadModer mendeteksi launcher (Prism, MultiMC, Modrinth App, CurseForge, Vanilla) dan instance yang ada di komputer secara otomatis.
3. **First-Class Modpack Support**: Tidak hanya mod individual, modpack berukuran ratusan megabyte (`.mrpack`) dapat diinstal dan diperbarui dalam satu perintah.
4. **Resilient & High Performance**: Unduhan berjalan paralel dengan pembatas konkurensi (`p-limit`), verifikasi hash SHA-512 streaming, dan perlindungan dari pemutusan koneksi di tengah jalan.
5. **Clean File System & Anti-Crash**: Menggunakan `loadmoder.lock.json` untuk mencegah file dependensi yatim (*orphan*), toggle mod instan (`.jar.disabled`), serta alat bantu pelacak crash otomatis via pencarian biner (*bisect*).
6. **Alias Eksekusi Ringkas**: Mendukung perintah cepat **`lm`** selain `loadmoder`.
