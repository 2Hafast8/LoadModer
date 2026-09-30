# 🚀 LoadModer (`lm`)

> **High-Performance Minecraft Mod & Modpack Manager CLI powered by Modrinth API v2.**  
> Built with modern TypeScript, Nordic Minimalist Clean TUI, bidirectional DAG dependency resolution, and multi-launcher auto-discovery.

[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-38bdf8.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-34d399.svg)](LICENSE)
[![Modrinth API](https://img.shields.io/badge/API-Modrinth%20v2-00af5c.svg)](https://docs.modrinth.com/api-spec/)

---

## ❄️ Filosofi & Keunggulan

LoadModer hadir untuk menghadirkan pengalaman layaknya **Cargo (Rust)** atau **pnpm (Node.js)** bagi ekosistem modding Minecraft.

* **🎯 Dual-Mode Operation**:
  - **Interactive TUI Dashboard**: Cukup ketik `lm` untuk navigasi menu panah keyboard (`↑`/`↓` atau `j`/`k`) dengan desain **Nordic Minimalist Clean**, paginasi cerdas, dan pencarian instan.
  - **Direct Command Line**: Jalankan `lm install`, `lm search`, `lm update` langsung dengan flag untuk scripting atau otomasi CI/CD.
* **🔍 Auto-Discovery Multi-Launcher**: Otomatis mendeteksi profil dan folder mods dari **Prism Launcher**, **MultiMC**, **Modrinth App (Theseus)**, **CurseForge**, dan **Vanilla / TLauncher** (`.minecraft`).
* **📦 First-Class Modpack Engine (`.mrpack`)**: Ekstraksi dan resolusi modpack streaming hemat memori dengan validasi skema Zod dan pemisahan file client vs server.
* **🔒 Lockfile & DAG Dependency Graph (`loadmoder.lock.json`)**: Melacak silsilah dependensi wajib, mencegah duplikasi versi, dan membersihkan dependensi yatim (*orphan pruning*).
* **🩺 Crash Bisect Engine ($O(\log_2 N)$)**: Menemukan mod perusak/penyebab crash secara otomatis menggunakan algoritma pencarian biner dalam hitungan langkah.

---

## ⚡ Quick Start

### 1. Instalasi & Setup Lokal
```bash
# Clone repository
git clone https://github.com/2Hafast8/LoadModer.git
cd LoadModer

# Instal dependensi
npm install

# Kompilasi project
npm run build

# Hubungkan perintah global "lm" ke sistem terminal
npm link
```

### 2. Jalankan Dashboard Interaktif
```bash
lm
```

---

## 🛠️ Ringkasan Perintah Utama

| Perintah | Deskripsi |
| :--- | :--- |
| `lm` / `lm home` | Membuka Dashboard TUI interaktif dengan navigasi keyboard |
| `lm init` | Wizard deteksi launcher Minecraft dan pemilihan instance target |
| `lm search <query>` | Mencari mod, modpack, shader, atau resource pack di Modrinth |
| `lm install <slug...>` | Memasang mod atau modpack (`.mrpack`) beserta dependensinya |
| `lm list` | Menampilkan tabel status mod terpasang, ukuran file, dan lockfile |
| `lm update` | Memeriksa & memperbarui seluruh mod ke versi stabil terbaru |
| `lm remove <slug...>` | Menghapus mod beserta pembersihan otomatis dependensi yatim |
| `lm enable <mod>` | Mengaktifkan mod yang dinonaktifkan (`.jar.disabled` $\rightarrow$ `.jar`) |
| `lm disable <mod>` | Menonaktifkan mod tanpa menghapus file (`.jar` $\rightarrow$ `.jar.disabled`) |
| `lm bisect <action>` | Investigasi biner mod penyebab game crash (`start` \| `good` \| `bad` \| `reset`) |
| `lm config` | Mengatur profil aktif dan konfigurasi global LoadModer |

---

## 📚 Dokumentasi Lengkap

Dokumentasi arsitektur dan teknis mendalam tersedia di folder [`docs/`](file:///c:/Users/LENOVO/LoadModer/docs/README.md):
- [**01. Arsitektur & Visi Sistem**](file:///c:/Users/LENOVO/LoadModer/docs/01-architecture-and-vision.md)
- [**02. Kurasi Tech Stack & Pustaka**](file:///c:/Users/LENOVO/LoadModer/docs/02-tech-stack-and-libraries.md)
- [**03. Spesifikasi Perintah & UX CLI**](file:///c:/Users/LENOVO/LoadModer/docs/03-cli-commands-and-ux.md)
- [**04. Mesin Modpack (.mrpack Engine)**](file:///c:/Users/LENOVO/LoadModer/docs/04-modpack-engine.md)
- [**05. Integrasi Multi-Launcher**](file:///c:/Users/LENOVO/LoadModer/docs/05-multi-launcher-integration.md)
- [**06. Dependency Graph & Lockfile**](file:///c:/Users/LENOVO/LoadModer/docs/06-dependency-graph-and-lockfile.md)
- [**07. Diagnostik Crash & Bisect Engine**](file:///c:/Users/LENOVO/LoadModer/docs/07-troubleshooting-and-bisect.md)
- [**08. Panduan Pengembang & Distribusi Binary**](file:///c:/Users/LENOVO/LoadModer/docs/08-developer-guide-and-api.md)
- [**Indeks Skills & Arsitektur**](file:///c:/Users/LENOVO/LoadModer/docs/LOADMODER_ARCHITECTURE.md)

---

## 🧪 Testing

```bash
# Menjalankan unit test dengan Vitest
npm test

# Menjalankan dalam mode dev tanpa compile
npm run dev
```

---

## 📄 Lisensi
Didistribusikan di bawah Lisensi MIT.
