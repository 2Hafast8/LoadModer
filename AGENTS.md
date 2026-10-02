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
