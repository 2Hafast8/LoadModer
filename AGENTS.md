# LoadModer — AI Coding Agent Guidelines (`AGENTS.md`)

This document defines architectural boundaries, quality standards, testing protocols, and engineering practices for AI coding agents operating on **LoadModer**.

---

## 1. Project Overview & Architecture

LoadModer (`lm`) is a standalone TypeScript CLI/TUI application for managing Minecraft mods, modpacks (`.mrpack`), shaders, and resource packs via Modrinth API v2.

### Module Boundaries
```text
src/
├── api/          # Modrinth API v2 client, rate-limit backoff, memory cache
├── commands/     # Commander action handlers (CLI presentation logic)
├── core/         # Pure domain logic (isolated from terminal/UI prompts)
│   ├── dependency/   # Directed Acyclic Graph (DAG), resolver, orphan pruning
│   ├── instance/     # Launcher auto-discovery, persistent config manager
│   ├── minecraft/    # Dynamic version fetching, semver-like comparator, cache
│   ├── modpack/      # .mrpack streaming unpacker, Zod validation, overrides
│   ├── profile/      # Version isolation snapshot manager, file migration
│   ├── troubleshoot/ # Mod disabler, binary search crash bisect engine
│   └── watcher/      # Real-time directory monitor (node:fs watch)
├── types/        # Zod schemas and TypeScript interfaces (single source of truth)
├── ui/           # Terminal UI, Inquirer menus, Clack prompts, Nordic theme
└── utils/        # Streaming SHA-1/SHA-512 hashing, formatters, markdown viewer
```

### Core Architectural Rules
1. **Domain Decoupling:** Modules in `src/core/` must NEVER import UI libraries (`@clack/prompts`, `@inquirer/prompts`, `figlet`, `boxen`). Domain logic must be pure and testable without simulating terminal prompts.
2. **Atomic Writes:** All state-modifying disk operations (`config.json`, `loadmoder.lock.json`, snapshots) must use `write-file-atomic` to prevent file corruption during crashes or abrupt exits.
3. **Integrity Before Writes:** Remote files must be downloaded to temporary `.part` paths and verified against SHA-512 checksums before moving to final destinations.
4. **No External Databases:** LoadModer is a standalone client tool. State is stored locally in JSON files (`~/.loadmoder/config.json`, `<instance>/loadmoder.lock.json`). Do not introduce database drivers or background daemons.

---

## 2. Verification Protocol (Mandatory Before Submitting Work)

Whenever code or tests are modified, execute the following commands in order:

```bash
# 1. Type-checking validation (must exit with 0 errors)
npx tsc --noEmit

# 2. Run full test suite (all tests must pass)
npm test

# 3. Build bundle validation (must succeed without esbuild warnings)
npm run build
```

Never report a task as complete if any test or type check fails.

---

## 3. Anti-Slop & Code Quality Rules

Follow the guidelines in `.agent/skills/`:
- **No Useless Comments (`antislop-code`):** Do not write comments that narrate syntax (e.g. `// increment count`, `// return result`). Only document non-obvious engineering decisions, constraints, or subtle edge cases.
- **No Speculative Abstractions (`clean-code`):** Do not create unnecessary wrapper classes, redundant helper utilities, or generic interfaces for single-use functions.
- **Concise Copy (`antislop-copywriting`):** In terminal messages, error logs, and documentation, avoid AI buzzwords (*"seamless"*, *"elevate"*, *"robust"*, *"revolutionary"*, *"game-changer"*). Write direct, factual, and actionable sentences.
- **Consistent Terminal UI (`antislop-ui`):** Use the established Nordic Clean palette (`src/ui/theme.ts`). Do not invent ad-hoc colors or add excessive decorative borders.

---

## 4. Agent Skills Catalog

LoadModer maintains 18 specialized engineering skills located in `.agent/skills/`. For full descriptions, consult [`docs/SKILL.md`](docs/SKILL.md):

- **Architecture:** `software-architecture`, `system-design`, `backend-patterns`, `c4-code`
- **Code Hygiene & Anti-Slop:** `antislop`, `antislop-code`, `antislop-copywriting`, `antislop-human`, `antislop-ui`, `clean-code`
- **Quality & Performance:** `code-review`, `performance-optimization`, `backend-security-coder`, `git-workflow`
- **TypeScript & Scaffolding:** `javascript-pro`, `javascript-typescript-typescript-scaffold`

---

## 5. Mandatory Pre-Push Protocol (Wajib Sebelum Melakukan Git Push)

Setiap kali pengguna meminta untuk melakukan `git push` (baik ke branch `dev`, `main`, maupun branch lainnya), agen **WAJIB** menyelesaikan dan memverifikasi langkah-langkah persiapan berikut secara berurutan:

### 1. Persiapan & Penyesuaian Versi Aplikasi (SemVer)
- Evaluasi seluruh perubahan dan commit yang dibuat sejak rilis sebelumnya.
- Naikkan nomor versi aplikasi (`MAJOR.MINOR.PATCH`) secara konsisten pada:
  - `package.json` (`"version"`)
  - `package-lock.json` (`"version"`)
  - `src/constants.ts` (`APP_VERSION`)
- Pastikan versi baru dan rincian perubahannya terdokumentasi di [`CHANGELOG.md`](CHANGELOG.md) mengikuti standar *Keep a Changelog*.

### 2. Pembaruan Menyeluruh Seluruh Berkas Markdown (`.md`)
- Periksa dan perbarui semua berkas dokumentasi markdown:
  - [`README.md`](README.md): pastikan petunjuk instalasi, badge status/test, ringkasan fitur, dan panduan penggunaan selalu akurat.
  - [`CHANGELOG.md`](CHANGELOG.md): pastikan rilis baru memiliki catatan perubahan yang lengkap (Added, Changed, Fixed, Security).
  - Folder `docs/` (`docs/*.md`): pastikan dokumen spesifikasi arsitektur, tech stack, UX/UI, dan panduan launcher selaras dengan kode nyata.
- **Dilarang keras** melakukan push dengan dokumentasi yang tertinggal atau bertentangan dengan implementasi kode (*out-of-sync*).

### 3. Eksekusi Protokol Verifikasi (0 Toleransi Kegagalan)
Jalankan urutan perintah verifikasi berikut hingga seluruhnya sukses:
```bash
# 1. Type-checking (wajib exit code 0)
npx tsc --noEmit

# 2. Test suite lengkap (seluruh unit & integration tests wajib lulus)
npm test

# 3. Kompilasi bundle distribusi (wajib sukses tanpa warning/error)
npm run build

# 4. Validasi tarball paket distribusi (pastikan whitelist 'files' bersih)
npm pack --dry-run
```

### 4. Walkthrough & Konfirmasi Pengguna
- Selalu buat berkas walkthrough sebelum tindakan signifikan dan tunggu perintah pengguna sebelum mengeksekusi push akhir.
