# Katalog & Panduan Keahlian Agen (Agent Skills) — LoadModer

Dokumen ini berisi indeks lengkap seluruh **Agent Skills** yang terpasang di dalam direktori [`.agent/skills/`](file:///c:/Users/LENOVO/LoadModer/.agent/skills). Setiap keahlian memberikan instruksi khusus, standar kualitas, serta pola arsitektur untuk memandu agen AI dalam mengembangkan, mereview, dan memelihara proyek **LoadModer**.

---

## 🗺️ Peta Kategori Skills

```
.agent/skills/
├── 🛡️ Anti-Slop & Human Experience
│   ├── antislop                     # Filter utama anti kode generik/berantakan
│   ├── antislop-code                # Higienitas komentar kode (tanpa komentar basi)
│   ├── antislop-copywriting         # Penulisan pesan, teks CLI, & dokumentasi
│   ├── antislop-human               # Aksesibilitas, kontras warna, & navigasi
│   └── antislop-ui                  # Tata letak visual, konsistensi warna terminal
├── 🏛️ Arsitektur & Desain Sistem
│   ├── system-design                # Desain batas layanan & pemodelan data
│   ├── software-architecture        # Prinsip Clean Architecture & DDD
│   ├── backend-patterns             # Pola server-side, API design, & stream I/O
│   └── c4-code                      # Dokumentasi struktur level C4 (Code)
├── ⚡ Bahasa & Scaffolding
│   ├── javascript-pro               # ES6+, Node.js asynchronous, streams & event loop
│   ├── javascript-typescript-typescript-scaffold # Setup boilerplate TypeScript & modern tooling
│   └── clean-code                   # Standar penulisan pragmatis & no over-engineering
├── 🔒 Kualitas, Keamanan & Performa
│   ├── performance-optimization     # Profiling memori, optimasi I/O, & pooling
│   ├── backend-security-coder       # Validasi input, sanitasi path traversal, rate-limit
│   ├── code-review                  # Review otomatis standar kode vs spesifikasi
│   └── git-workflow                 # Konvensi commit, percabangan, & rilis
└── 🎨 Desain Antarmuka & UX
    ├── ui-styling                   # Styling antarmuka & konsistensi tema
    └── ui-ux-pro-max                # Sistem desain menyeluruh, palet warna, & tipografi
```

---

## 1. Anti-Slop & Human Experience Suite

Kumpulan keahlian ini memastikan kode, teks, antarmuka, dan komentar tidak terkesan dibuat-buat atau mengandung "AI slop" (kode basi, bertele-tele, komentar dekoratif yang tidak perlu).

### 1. [`antislop`](file:///c:/Users/LENOVO/LoadModer/.agent/skills/antislop/SKILL.md)
* **Deskripsi**: Filter utama untuk menghentikan kode dan antarmuka generik buatan AI.
* **Kapan Digunakan**: Selalu aktif saat membangun fitur atau antarmuka baru.
* **Penerapan di LoadModer**: Mencegah pembuatan komponen visual yang berlebihan, memastikan CLI to-the-point, dan menghilangkan teks basa-basi pada pesan error atau konfirmasi.

### 2. [`antislop-code`](file:///c:/Users/LENOVO/LoadModer/.agent/skills/antislop-code/SKILL.md)
* **Deskripsi**: Higienitas komentar kode — menghapus komentar generik yang menjelaskan hal yang sudah jelas, mempertahankan komentar bernilai tinggi (alasan desain/algoritma).
* **Kapan Digunakan**: Saat menulis atau mengedit file TypeScript (`.ts`).
* **Penerapan di LoadModer**: Melarang komentar seperti `// increment counter` atau `// return response`. Hanya mendokumentasikan alasan non-trivial seperti *"alasan menunggu X-Ratelimit-Reset + 250ms buffer"*.

### 3. [`antislop-copywriting`](file:///c:/Users/LENOVO/LoadModer/.agent/skills/antislop-copywriting/SKILL.md)
* **Deskripsi**: Panduan penulisan teks, pesan peringatan, headline dokumentasi, dan Call-to-Action yang alami dan profesional.
* **Kapan Digunakan**: Menulis pesan log terminal, dokumentasi di `docs/`, dan deskripsi opsi `--help`.
* **Penerapan di LoadModer**: Pesan error terminal ringkas, langsung pada solusi: *"Gunakan -v 1.21.1 atau jalankan loadmoder init"*, bukan kalimat pasif berbelit-belit.

### 4. [`antislop-human`](file:///c:/Users/LENOVO/LoadModer/.agent/skills/antislop-human/SKILL.md)
* **Deskripsi**: Aksesibilitas, kontras warna, navigasi keyboard, dan penanganan kondisi nyata manusia.
* **Kapan Digunakan**: Saat merancang interaksi terminal CLI.
* **Penerapan di LoadModer**: Memastikan warna teks terminal di `picocolors` tetap terbaca pada tema terminal gelap (*dark mode*) maupun terang (*light mode*).

### 5. [`antislop-ui`](file:///c:/Users/LENOVO/LoadModer/.agent/skills/antislop-ui/SKILL.md)
* **Deskripsi**: Tata letak antarmuka, komponen, dekorasi terukur, dan hierarki visual.
* **Kapan Digunakan**: Merancang visual tabel data dan banner terminal.
* **Penerapan di LoadModer**: Menjaga agar tampilan progres unduhan dan ringkasan instalasi tidak memenuhi layar dengan karakter dekoratif yang tidak penting.

---

## 2. Arsitektur & Desain Sistem

### 6. [`system-design`](file:///c:/Users/LENOVO/LoadModer/.agent/skills/system-design/SKILL.md)
* **Deskripsi**: Desain sistem, batasan layanan (*service boundaries*), pemodelan data, dan arsitektur konkurensi.
* **Kapan Digunakan**: Merancang subsistem baru (misal: mesin modpack, cache offline).
* **Penerapan di LoadModer**: Merancang interaksi antara Modrinth API Client, Concurrency Pool, dan sistem penyimpanan Lockfile.

### 7. [`software-architecture`](file:///c:/Users/LENOVO/LoadModer/.agent/skills/software-architecture/SKILL.md)
* **Deskripsi**: Panduan arsitektur perangkat lunak berbasis Clean Architecture dan Domain-Driven Design (DDD).
* **Kapan Digunakan**: Menentukan struktur direktori `src/core/`, `src/commands/`, dan `src/api/`.
* **Penerapan di LoadModer**: Memastikan domain logika (Modpack, Dependency Graph) tidak bergantung langsung pada implementasi CLI UI (`commander` / `@clack/prompts`), sehingga logika dapat diuji secara independen tanpa simulasi terminal.

### 8. [`backend-patterns`](file:///c:/Users/LENOVO/LoadModer/.agent/skills/backend-patterns/SKILL.md)
* **Deskripsi**: Pola arsitektur server-side, desain API, streaming I/O, dan optimasi data di Node.js.
* **Kapan Digunakan**: Membangun pipeline download file dan ekstraksi arsip ZIP.
* **Penerapan di LoadModer**: Menggunakan streaming pipeline (`Readable.fromWeb` $\rightarrow$ `Transform` $\rightarrow$ `WriteStream`) untuk menghitung hash SHA-512 sambil mengunduh tanpa membebani memori RAM.

### 9. [`c4-code`](file:///c:/Users/LENOVO/LoadModer/.agent/skills/c4-code/SKILL.md)
* **Deskripsi**: Spesialis dokumentasi tingkat C4 (Code Level) untuk menganalisis tanda tangan fungsi, tipe argumen, dan dependensi modul.
* **Kapan Digunakan**: Menulis spesifikasi teknis fungsi-fungsi internal di `docs/`.

---

## 3. Bahasa & Scaffolding

### 10. [`javascript-pro`](file:///c:/Users/LENOVO/LoadModer/.agent/skills/javascript-pro/SKILL.md)
* **Deskripsi**: Penguasaan mendalam JavaScript/TypeScript modern (ES6+, async/await, Event Loop, Node.js streams).
* **Kapan Digunakan**: Optimasi asinkron, penanganan `AbortController`, dan stream buffering.
* **Penerapan di LoadModer**: Menangani pembatalan sinyal `Ctrl+C` (`SIGINT`) secara anggun agar proses rename file sementara `.part` tidak meninggalkan berkas sampah.

### 11. [`javascript-typescript-typescript-scaffold`](file:///c:/Users/LENOVO/LoadModer/.agent/skills/javascript-typescript-typescript-scaffold/SKILL.md)
* **Deskripsi**: Spesialis scaffolding proyek TypeScript Node.js berstandar produksi dengan tooling modern (`pnpm`/`npm`, `tsup`, `vitest`).
* **Kapan Digunakan**: Setup inisialisasi repositori, konfigurasi `tsconfig.json`, dan script `package.json`.
* **Penerapan di LoadModer**: Mengonfigurasi `tsup.config.ts` untuk mem-bundel seluruh kode menjadi satu file JavaScript mandiri dengan eksekusi instan.

### 12. [`clean-code`](file:///c:/Users/LENOVO/LoadModer/.agent/skills/clean-code/SKILL.md)
* **Deskripsi**: Standar kode pragmatis — ringkas, langsung, tanpa rekayasa berlebihan (*no over-engineering*).
* **Kapan Digunakan**: Setiap penulisan fungsi dan class baru.
* **Penerapan di LoadModer**: Memilih fungsi murni dan class sederhana daripada pola abstract factory yang rumit jika tidak dibutuhkan.

---

## 4. Kualitas, Keamanan & Performa

### 13. [`performance-optimization`](file:///c:/Users/LENOVO/LoadModer/.agent/skills/performance-optimization/SKILL.md)
* **Deskripsi**: Optimasi performa aplikasi, pengukuran profil memori (profiling), dan eliminasi bottleneck I/O.
* **Kapan Digunakan**: Mengoptimalkan kecepatan download dan waktu pemindaian folder mods.
* **Penerapan di LoadModer**: Membatasi konkurensi dengan `p-limit` agar tidak memicu throttling CPU dan menjaga konsumsi heap memori Node.js di bawah 40MB.

### 14. [`backend-security-coder`](file:///c:/Users/LENOVO/LoadModer/.agent/skills/backend-security-coder/SKILL.md)
* **Deskripsi**: Pakar keamanan backend, validasi input, sanitasi path, dan keamanan API.
* **Kapan Digunakan**: Memproses file modpack yang diunduh dari internet.
* **Penerapan di LoadModer**: **Sanitasi Path Traversal**. Mencegah modpack berbahaya mengekstrak file keluar dari folder game (misal path `../../Windows/System32`). Menggunakan Zod untuk memvalidasi setiap path di `modrinth.index.json`.

### 15. [`code-review`](file:///c:/Users/LENOVO/LoadModer/.agent/skills/code-review/SKILL.md)
* **Deskripsi**: Melakukan review kode sepanjang dua sumbu: Standar repositori dan Kesesuaian Spesifikasi (*Spec*).
* **Kapan Digunakan**: Sebelum menggabungkan fitur baru atau melakukan commit penting.

### 16. [`git-workflow`](file:///c:/Users/LENOVO/LoadModer/.agent/skills/git-workflow/SKILL.md)
* **Deskripsi**: Praktik terbaik Git, strategi percabangan (*branching*), konvensi Conventional Commits (`feat:`, `fix:`, `docs:`), dan resolusi konflik.
* **Kapan Digunakan**: Manajemen repositori dan rilis versi otomatis.

---

## 5. Desain Antarmuka & UX

### 17. [`ui-styling`](file:///c:/Users/LENOVO/LoadModer/.agent/skills/ui-styling/SKILL.md)
* **Deskripsi**: Penciptaan antarmuka visual yang indah, konsisten, dan mudah diakses.
* **Penerapan di LoadModer**: Penerapan warna status yang konsisten: Hijau untuk sukses (`✔`), Biru/Cyan untuk aksi aktif (`ℹ️`), Kuning untuk peringatan kompatibilitas (`⚠️`), dan Merah untuk kegagalan (`❌`).

### 18. [`ui-ux-pro-max`](file:///c:/Users/LENOVO/LoadModer/.agent/skills/ui-ux-pro-max/SKILL.md)
* **Deskripsi**: Intelijen desain UI/UX komprehensif (gaya, palet warna, tipografi, dan hierarki informasi).
* **Penerapan di LoadModer**: Menjamin hierarki informasi pada terminal: judul besar di atas (`intro()`), baris progres di tengah, dan catatan ringkasan aksi di bagian bawah (`outro()`).

---

## 📌 Ringkasan Penerapan Skills pada Siklus Hidup LoadModer

| Tahapan Pengembangan | Skill yang Diaktifkan |
| :--- | :--- |
| **Inisialisasi & Setup** | `javascript-typescript-typescript-scaffold`, `clean-code` |
| **Desain Mesin Inti** | `system-design`, `software-architecture`, `backend-patterns` |
| **Implementasi Jaringan & Zip** | `javascript-pro`, `backend-security-coder`, `performance-optimization` |
| **Penyusunan Tampilan Terminal** | `@clack/prompts`, `antislop-ui`, `antislop-human`, `ui-styling` |
| **Penyusunan Teks & Dokumen** | `antislop-copywriting`, `antislop-code`, `c4-code` |
| **Verifikasi & Rilis** | `code-review`, `git-workflow` |
