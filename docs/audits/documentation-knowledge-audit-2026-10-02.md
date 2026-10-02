# Documentation & Project Knowledge Audit Report

**Repository:** [2Hafast8/LoadModer](https://github.com/2Hafast8/LoadModer)  
**Audit Date:** 2026-10-02  
**Auditor:** Antigravity AI Engineering System  
**Audit Type:** Deep, Systematic, Evidence-Based Production Knowledge Audit  

---

# 1. Executive Summary & Documentation Health Rating

### Project Profile
- **Project Name:** LoadModer (CLI binary: `loadmoder`, alias: `lm`)
- **Version:** 2.0.0
- **Type:** Command Line Interface (CLI) & Terminal User Interface (TUI) application
- **Domain:** High-performance Minecraft mod, modpack (`.mrpack`), shader, and resource pack manager powered by Modrinth API v2
- **Stack:** Node.js (>= 20.0.0, ESM), TypeScript 5.5+, Commander 12, Inquirer Prompts, Clack Prompts, Zod, Unzipper, P-Limit, Vitest, Tsup

### Repository Snapshot
```text
Audit date:                  2026-10-02
Repository:                  LoadModer (2Hafast8/LoadModer)
Branch:                      main
Commit SHA:                  f89edba (f89edbad963ba15b0b2e88a0ce123f858fa394a1)
Working tree state:          Clean
Project type:                CLI / TUI Developer & Gaming Utility
Project maturity:            Production-ready (v2.0.0)
Audience:                    Public Open Source
Command execution available: Yes (Local PowerShell sandbox)
Network access available:    Yes (Public npm / Modrinth API)
Prior audits found:          None
```

### Critical Path Evaluation
The critical lifecycle path for a contributor on this project is:
$$\text{Clone} \longrightarrow \text{Install (npm ci)} \longrightarrow \text{Configure (lm init)} \longrightarrow \text{Build (npm run build)} \longrightarrow \text{Test (npm test)} \longrightarrow \text{Execute (lm / lm home)}$$

Every step in this critical path is executable and supported by code. Running `npm test` verified 36/36 tests passing, and `npx tsc --noEmit` verified 0 TypeScript compilation errors.

### Overall Documentation Health Rating: Level 4 — Solid

> **Rating Justification:**  
> The repository features exceptionally comprehensive, highly technical, and well-organized architecture documentation under `docs/` and `README.md`. Domain concepts (such as the Directed Acyclic Graph lockfile, dynamic version fetching, and binary search crash bisect) are documented with accurate diagrams, schemas, and rationale. No confirmed CRITICAL defects and no blocking HIGH onboarding defects were identified. However, several confirmed documentation drifts exist—including hardcoded local developer paths in `docs/SKILL.md`, a legacy 52KB guide (`docs/modrinth-cli-guide.md`) referencing an obsolete prototype CLI name (`mcmod`), and slight drift between documented libraries (`chokidar` vs native `node:fs`).

### Summary of Findings
- **Confirmed Documentation Problems:** 8
  - **CRITICAL:** 0
  - **HIGH:** 2
  - **MEDIUM:** 3
  - **LOW:** 3
  - **INFORMATIONAL:** 0
- **Potential Documentation Improvements:** 3 (Separated in Section 14)

### Top 3 Most Important Confirmed Findings
1. **[DOC-001] Hardcoded Local Developer Absolute Paths in `docs/SKILL.md` (HIGH):**  
   All 18 markdown links to `.agent/skills/` are hardcoded to `file:///c:/Users/LENOVO/LoadModer/...`, which break on all other developer machines and in GitHub web renderers.
2. **[DOC-002] Legacy Prototype Artifact `docs/modrinth-cli-guide.md` Using Obsolete Name `mcmod` (HIGH):**  
   A 52KB guide teaches commands (`mcmod install`), config paths (`~/.mcmod`), and environment variables (`MCMOD_HOME`) that do not match the current LoadModer v2 implementation.
3. **[DOC-003] Library Implementation Drift: `chokidar` vs Native `node:fs` (MEDIUM):**  
   Documentation and the Golden Stack table claim real-time directory watching is powered by `chokidar`, but `chokidar` is not in `package.json` and the code in `src/core/watcher/modsWatcher.ts` directly uses native `node:fs.watch()`.

---

# 2. Documentation Overview

### Current Documentation Architecture
The repository separates documentation into two primary tiers:
1. **Root Documentation:** [README.md](file:///c:/Users/DELL/Downloads/LoadModer/README.md) acts as the high-level onboarding hub, providing feature highlights, installation steps, quick-start commands, and architectural layer diagrams.
2. **Technical Architecture Hub (`docs/`):** 11 dedicated markdown files covering each architectural pillar in depth:
   - [01-architecture-and-vision.md](file:///c:/Users/DELL/Downloads/LoadModer/docs/01-architecture-and-vision.md)
   - [02-tech-stack-and-libraries.md](file:///c:/Users/DELL/Downloads/LoadModer/docs/02-tech-stack-and-libraries.md)
   - [03-cli-commands-and-ux.md](file:///c:/Users/DELL/Downloads/LoadModer/docs/03-cli-commands-and-ux.md)
   - [04-modpack-engine.md](file:///c:/Users/DELL/Downloads/LoadModer/docs/04-modpack-engine.md)
   - [05-multi-launcher-integration.md](file:///c:/Users/DELL/Downloads/LoadModer/docs/05-multi-launcher-integration.md)
   - [06-dependency-graph-and-lockfile.md](file:///c:/Users/DELL/Downloads/LoadModer/docs/06-dependency-graph-and-lockfile.md)
   - [07-troubleshooting-and-bisect.md](file:///c:/Users/DELL/Downloads/LoadModer/docs/07-troubleshooting-and-bisect.md)
   - [08-developer-guide-and-api.md](file:///c:/Users/DELL/Downloads/LoadModer/docs/08-developer-guide-and-api.md)
   - [LOADMODER_ARCHITECTURE.md](file:///c:/Users/DELL/Downloads/LoadModer/docs/LOADMODER_ARCHITECTURE.md)
   - [SKILL.md](file:///c:/Users/DELL/Downloads/LoadModer/docs/SKILL.md)
   - [modrinth-cli-guide.md](file:///c:/Users/DELL/Downloads/LoadModer/docs/modrinth-cli-guide.md)

### Authority Relationships
| Domain | Authoritative Source | Documentation Status |
| :--- | :--- | :--- |
| **CLI Commands & Flags** | [src/index.ts](file:///c:/Users/DELL/Downloads/LoadModer/src/index.ts) | Mostly accurate; one phantom global flag (`--profile`) documented |
| **Data Schemas & Types** | [src/types/](file:///c:/Users/DELL/Downloads/LoadModer/src/types/) | Fully consistent with `docs/04` and `docs/06` |
| **Dependency Resolution** | [src/core/dependency/resolver.ts](file:///c:/Users/DELL/Downloads/LoadModer/src/core/dependency/resolver.ts) | Fully consistent with `docs/06` |
| **Launcher Detection** | [src/core/instance/detector.ts](file:///c:/Users/DELL/Downloads/LoadModer/src/core/instance/detector.ts) | Consistent logic; minor class name drift in docs |
| **Runtime Environment** | [src/constants.ts](file:///c:/Users/DELL/Downloads/LoadModer/src/constants.ts) | Implementation has undocumented env vars (`LOADMODER_CONTACT`, `LOADMODER_HOME`) |
| **External API Spec** | Modrinth API v2 (`api.modrinth.com/v2`) | Accurate client implementation in `src/api/client.ts` |

---

# 3. Documentation Inventory

| File / Resource | Location | Purpose & Audience | Status / Health |
| :--- | :--- | :--- | :--- |
| **Root README** | `README.md` | Primary entry point, quick-start, CLI table, architecture diagram | Excellent; high clarity |
| **Docs Hub Index** | `docs/README.md` | Table of contents linking all architectural modules | Solid; all relative links work |
| **Architecture & Vision** | `docs/01-architecture-and-vision.md` | System design, 4-tier layered architecture, sequence diagrams | High quality; minor TTL drift |
| **Tech Stack & Libraries** | `docs/02-tech-stack-and-libraries.md` | Selection rationale for libraries (Commander, Zod, Unzipper, etc.) | High quality; drift on `chokidar` |
| **CLI Commands & UX** | `docs/03-cli-commands-and-ux.md` | Detailed command flag specs and TUI menu designs | Good; documents phantom `-p` flag |
| **Modpack Engine** | `docs/04-modpack-engine.md` | `.mrpack` unpacking, Zod validation, overrides processing | Exemplary; matches code 100% |
| **Multi-Launcher** | `docs/05-multi-launcher-integration.md` | Discovery paths for Prism, Modrinth, CurseForge, Vanilla | Solid; minor class name drift |
| **Lockfile & DAG** | `docs/06-dependency-graph-and-lockfile.md` | DAG algorithm, reference counting, orphan pruning | Exemplary; matches code 100% |
| **Crash Bisect** | `docs/07-troubleshooting-and-bisect.md` | Mod toggle `.disabled` and binary search crash isolation | Solid; class name drift |
| **Developer Guide** | `docs/08-developer-guide-and-api.md` | Project structure, npm scripts, tsup build, test guide | Accurate; verified via execution |
| **Architecture Blueprint** | `docs/LOADMODER_ARCHITECTURE.md` | 8 development pillars, platform blueprint | High value; minor drifts inherited |
| **Skills Catalog** | `docs/SKILL.md` | Directory of 18 agent skills in `.agent/skills/` | Broken links (hardcoded LENOVO paths) |
| **Modrinth CLI Guide** | `docs/modrinth-cli-guide.md` | Comprehensive Modrinth API reference and CLI guide | Legacy artifact (uses `mcmod`) |
| **Agent Skills** | `.agent/skills/*/SKILL.md` | 18 specialized AI engineering skills | Complete and functional |

---

# 4. Onboarding Assessment

A clean-room simulation of the contributor onboarding workflow was conducted:
```text
Step 1: Clone repo          -> Passed
Step 2: Inspect prerequisites -> Passed (Node >= 20.0.0 required)
Step 3: Install dependencies -> Passed (npm ci completed in 13s, 217 packages added)
Step 4: Type-checking        -> Passed (npx tsc --noEmit executed with 0 errors)
Step 5: Run tests            -> Passed (npm test ran 6 test files, 36 passed in 2.23s)
Step 6: Execute application  -> Passed (tsx src/index.ts --help works cleanly)
```

### Onboarding Friction Points & Blockers
- **No blocking code defect:** The developer experience from clone to running tests is zero-friction.
- **Missing License File:** The `README.md` badge links to `LICENSE`, but no `LICENSE` file is committed to the repository root.
- **Missing `.env.example`:** Although LoadModer does not strictly require environment variables to run, `src/constants.ts` supports `LOADMODER_CONTACT`, `LOADMODER_HOME`, and `MODRINTH_API_URL`. There is no `.env.example` or dedicated configuration reference explaining these variables.

---

# 5. Documentation Accuracy

The following specific inaccuracies and mismatches between code and documentation were confirmed through direct source inspection:

### [DOC-003] Library Implementation Drift: `chokidar` vs Native `node:fs`
- **Documented:** `README.md` (L32), `docs/README.md` (L14), `docs/LOADMODER_ARCHITECTURE.md` (L79), and `docs/02-tech-stack-and-libraries.md` state that directory watching is implemented using `chokidar`.
- **Actual Code:** `src/core/watcher/modsWatcher.ts` (L1) imports and uses native Node.js `fs.watch`:
  ```typescript
  import { watch, type FSWatcher } from 'node:fs';
  ```
  `package.json` does not include `chokidar` as a direct dependency.

### [DOC-004] Phantom Global Flag `--profile` / `-p` in CLI Command Specification
- **Documented:** `docs/03-cli-commands-and-ux.md` (L14) lists `--profile <name>` (`-p`) in Table 1 ("Opsi & Flag Global") with description *"Memilih instance/profil yang tersimpan"*.
- **Actual Code:** In `src/index.ts`, `program` does not define a global `-p` / `--profile` option, nor do subcommands (`install`, `search`, `list`, `update`) define a `-p` flag. Instance profile switching is exclusively handled by `lm profile switch` or `lm init`.

### [DOC-005] Class & Type Naming Drift in Architecture Documentation
- **Documented:** `docs/07-troubleshooting-and-bisect.md` (L79) shows `export class BisectEngine`. `docs/05-multi-launcher-integration.md` (L88) shows `export class LauncherDetector` and `DiscoveredInstance`.
- **Actual Code:** 
  - `src/core/troubleshoot/bisect.ts` (L11) defines `export class BisectRunner`.
  - `src/core/instance/detector.ts` (L6) defines `export class InstanceDetector`.
  - `src/types/instance.ts` defines `MinecraftInstance`.

### [DOC-006] Minecraft Version Cache TTL Discrepancy
- **Documented:** `README.md` (L25), `docs/01-architecture-and-vision.md` (L69), `docs/LOADMODER_ARCHITECTURE.md` (L71), and `docs/08-developer-guide-and-api.md` (L34) state that dynamic Minecraft release versions are cached locally for **24 jam** (24 hours).
- **Actual Code:** `src/core/minecraft/versions.ts` (L9) explicitly sets TTL to 1 hour:
  ```typescript
  const CACHE_TTL_MS = 60 * 60 * 1000; // 1 jam TTL cache
  ```

---

# 6. Documentation Gaps

### Confirmed Missing Knowledge
1. **[DOC-007] Undocumented Active Environment Variables:**
   - `LOADMODER_CONTACT`: Read by `src/constants.ts` (L9) to append contact information to the HTTP `User-Agent` sent to Modrinth API.
   - `LOADMODER_HOME`: Read by `src/constants.ts` (L16) to override the default global config directory `~/.loadmoder`.
   Neither variable is documented in the primary documentation or developer guide.
2. **[DOC-008] Missing `LICENSE` File:**
   - `README.md` has an MIT license badge pointing to `LICENSE`, but the file is physically absent from the repository.
3. **[DOC-009] Missing Root AI Instruction Entry Point (`AGENTS.md`):**
   - The repository provides 18 skills in `.agent/skills/` and a catalog in `docs/SKILL.md`, but lacks an `AGENTS.md` file in the root directory to define tool invocation rules, skill loading priorities, and testing expectations for coding agents.

### Potential Improvements (Non-blocking)
- Lack of an explicit `CHANGELOG.md` file tracking the transition from v1 to v2.0.0.
- Lack of a dedicated `CONTRIBUTING.md` defining pull request conventions, branch naming, and code formatting rules.

---

# 7. Documentation Drift

### [DOC-001] Hardcoded Local Developer Absolute Paths in `docs/SKILL.md`
- **Location:** `docs/SKILL.md` (L3, L42, L47, L52, L57, L62, L71, L76, L81, L86, L94, L99, L104, L113, L118, L123, L127, L135, L139).
- **Evidence:** Links are written as:
  ```markdown
  file:///c:/Users/LENOVO/LoadModer/.agent/skills/antislop/SKILL.md
  ```
  This path reflects a specific developer machine (`LENOVO`) and fails on any other machine or inside GitHub's markdown viewer.
- **Fix:** Convert all links to relative paths:
  ```markdown
  [antislop](../.agent/skills/antislop/SKILL.md)
  ```

### [DOC-002] Legacy Prototype Artifact: `docs/modrinth-cli-guide.md`
- **Location:** `docs/modrinth-cli-guide.md` (52 KB, 1,128 lines).
- **Evidence:** This entire document describes an older CLI prototype named `mcmod`:
  - Table of commands: `mcmod search`, `mcmod install`, `mcmod list`, `mcmod update`.
  - Config paths: `~/.mcmod/config.json`.
  - Environment variables: `MCMOD_CONTACT`, `MCMOD_HOME`.
  - Binary registration: `npm link` creating `mcmod`.
- **Impact:** New developers or AI agents reading `docs/modrinth-cli-guide.md` will assume the binary name is `mcmod` and use outdated configuration commands.

---

# 8. API & Database Documentation

### API Documentation Assessment
- **Status:** **Exemplary / Complete.**
- LoadModer is a standalone client tool; it does not host a server API.
- All outbound interactions with **Modrinth API v2** are clearly documented in `docs/01-architecture-and-vision.md` and `docs/04-modpack-engine.md`, detailing rate limits (300 req/min), `X-Ratelimit-Reset` handling, HTTP 429 backoff retry loops, and endpoint specs.

### Database Documentation Assessment
- **Status:** **Not Applicable (Documented Flat-File Architecture).**
- LoadModer does not use an external SQL or NoSQL database.
- Persistent state management is accurately documented in `docs/06-dependency-graph-and-lockfile.md`:
  - `~/.loadmoder/config.json`: Instance metadata and active pointer.
  - `loadmoder.lock.json`: Directed Acyclic Graph state with reference counting.
  - `.loadmoder/snapshots/`: Version-isolated archive directories.

---

# 9. Deployment & Operations Documentation

### Build & Package Distribution
- **Status:** **Solid.**
- `docs/08-developer-guide-and-api.md` documents:
  - `npm run build`: Bundling via `tsup` targeting Node 20 ESM (`dist/index.js`).
  - `npm link`: Registering global CLI binaries `loadmoder` and `lm`.
  - Single-file binary distribution via `@yao-pkg/pkg` or Node.js Single Executable Applications (SEA).
- CI/CD workflow files are currently absent from `.github/workflows/` (potential improvement).

---

# 10. Troubleshooting Documentation

### Crash & Failure Diagnostic Knowledge
- **Status:** **High Quality.**
- `docs/07-troubleshooting-and-bisect.md` documents the exact operation of `lm bisect`:
  - State machine diagram (Mermaid).
  - Step-by-step walkthrough of binary search ($O(\log_2 N)$).
  - Mod disabler mechanism (`.jar.disabled`).
- Terminal error handling in `src/index.ts` cleanly wraps all actions with user-friendly red banners (`❌ Kesalahan: <message>`).

---

# 11. AI Project Knowledge

### Evaluation of Agent Instructions & Skills
- **Skills Presence:** The repository contains a rich set of 18 domain-specific skills in `.agent/skills/`, including anti-slop filters, architecture standards, security reviews, and TypeScript scaffolding.
- **Gaps Identified:**
  - **No root `AGENTS.md`:** AI coding assistants entering the workspace lack an immediate root instruction file directing them to the skills in `.agent/skills/`.
  - **Hardcoded links in `docs/SKILL.md`:** Impedes agent navigation when resolving skill documentation on non-LENOVO machines.

---

# 12. Documentation Organization

### Strengths
1. **Consistent Numeric Prefixing:** Files in `docs/` (`01-`, `02-`, ..., `08-`) provide a clear, logical reading order from high-level vision down to developer guides.
2. **Modular Topic Separation:** Architecture, tech stack, UX, modpack engine, launcher integration, dependency resolution, troubleshooting, and developer guides are kept in separate, cohesive documents.
3. **Rich Visual Schemas:** Excellent use of ASCII architecture maps, tables, sequence diagrams, and JSON schemas.

### Weaknesses
1. **Redundancy & Overlapping Blueprints:** Both `docs/01-architecture-and-vision.md` and `docs/LOADMODER_ARCHITECTURE.md` cover overlapping architectural concepts and ASCII diagrams.
2. **Orphaned Prototype Guide:** `docs/modrinth-cli-guide.md` sits alongside official docs without a clear deprecation disclaimer, causing confusion between `loadmoder` and `mcmod`.

---

# 13. Security & Privacy Issues

- **Secret Exposure:** **Zero.** No hardcoded API keys, tokens, or credentials were found in any documentation, source files, or tests.
- **Safe API Defaults:** Client requests properly use Modrinth's public read API and validate SHA-512 hashes before committing downloaded files.
- **Path Traversal Protection:** Accurately documented in `docs/04-modpack-engine.md` and enforced in `src/types/mrpack.ts` via Zod refinements rejecting paths containing `..`.

---

# 14. Findings by Severity

## Confirmed Documentation Problems

### [DOC-001] Hardcoded Developer-Specific Absolute Paths in `docs/SKILL.md`
- **Severity:** HIGH
- **Confidence:** Confirmed Documentation Problem
- **Location:** `docs/SKILL.md` (Lines 3, 42, 47, 52, 57, 62, 71, 76, 81, 86, 94, 99, 104, 113, 118, 123, 127, 135, 139)
- **Problem:** All 18 skill references use hardcoded absolute URLs formatted as `file:///c:/Users/LENOVO/LoadModer/.agent/skills/<skill>/SKILL.md`.
- **Evidence:** Grep search confirmed 19 occurrences of `file:///c:/Users/LENOVO/`.
- **Impact:** Links are broken for all other collaborators, contributors, CI environments, and GitHub web viewers.
- **Recommendation:** Replace all absolute URLs with relative paths: `../.agent/skills/<skill>/SKILL.md`.
- **Verification:** Inspect `docs/SKILL.md` and verify that clicking the links resolves locally regardless of workspace path.

---

### [DOC-002] Legacy Prototype Artifact `docs/modrinth-cli-guide.md` Using Obsolete Name `mcmod`
- **Severity:** HIGH
- **Confidence:** Confirmed Documentation Problem
- **Location:** `docs/modrinth-cli-guide.md` (Lines 12–17, 262, 302–303, 439–440, 795, 1036–1070, 1088–1090)
- **Problem:** The guide is an un-migrated prototype reference that refers to the application as `mcmod`, uses `~/.mcmod` for config paths, and specifies environment variables `MCMOD_CONTACT` and `MCMOD_HOME`.
- **Evidence:** Grep search confirmed 32 occurrences of `mcmod` in `docs/modrinth-cli-guide.md`.
- **Impact:** Misleads developers into running nonexistent commands (`mcmod install`) and configuring obsolete environment variables.
- **Recommendation:** Either update all references in `docs/modrinth-cli-guide.md` from `mcmod` to `loadmoder` / `lm`, or add a prominent deprecation header marking it as an early design reference.
- **Verification:** Search `docs/modrinth-cli-guide.md` to ensure zero conflicting command references remain.

---

### [DOC-003] Library Implementation Drift: `chokidar` vs Native `node:fs`
- **Severity:** MEDIUM
- **Confidence:** Confirmed Documentation Problem
- **Location:** `README.md` (L32), `docs/README.md` (L14), `docs/LOADMODER_ARCHITECTURE.md` (L79), `docs/02-tech-stack-and-libraries.md` (L16)
- **Problem:** Documentation states that real-time directory watching is implemented using `chokidar`.
- **Evidence:** `package.json` does not list `chokidar` as a direct dependency. `src/core/watcher/modsWatcher.ts` (L1) uses native `node:fs.watch`.
- **Impact:** Developers reviewing the stack expect `chokidar` APIs and configuration, whereas Node's native watcher is used.
- **Recommendation:** Update documentation to state: *"Memantau folder mods secara real-time via Node.js native `fs.watch` dengan debouncing otomatis."*
- **Verification:** Verify consistent terminology across `README.md`, `docs/README.md`, and `docs/02-tech-stack-and-libraries.md`.

---

### [DOC-004] Undocumented/Phantom Global Flag `--profile` (`-p`) in Command Specs
- **Severity:** MEDIUM
- **Confidence:** Confirmed Documentation Problem
- **Location:** `docs/03-cli-commands-and-ux.md` (Table 1, Line 14)
- **Problem:** Table 1 lists `--profile <name>` (`-p`) as a global option for choosing instances.
- **Evidence:** `src/index.ts` does not register a global `-p` / `--profile` option, nor do subcommands have a `-p` flag.
- **Impact:** Users attempting to run `lm install sodium -p my-instance` will receive an unknown option error from Commander.
- **Recommendation:** Remove `--profile` from Table 1, or implement the global option in `src/index.ts` to forward to `instanceConfig.setActiveInstance()`.
- **Verification:** Run `node dist/index.js --help` and compare registered options against Table 1.

---

### [DOC-007] Undocumented Active Environment Variables (`LOADMODER_CONTACT`, `LOADMODER_HOME`)
- **Severity:** MEDIUM
- **Confidence:** Confirmed Documentation Problem
- **Location:** `src/constants.ts` (Lines 9, 16)
- **Problem:** `LOADMODER_CONTACT` and `LOADMODER_HOME` are actively read by the codebase but omitted from `docs/01`, `docs/03`, and `docs/08`.
- **Evidence:** Grep search in `docs/` returned zero references to `LOADMODER_CONTACT` or `LOADMODER_HOME`.
- **Impact:** Users and automated test runners cannot discover how to redirect config paths or supply custom contact headers to Modrinth.
- **Recommendation:** Add an "Environment Variables" section to `docs/08-developer-guide-and-api.md` and `README.md`.
- **Verification:** Confirm both variables appear with descriptions and default fallback values in docs.

---

### [DOC-005] Class & Type Naming Drift in Architecture Documentation
- **Severity:** LOW
- **Confidence:** Confirmed Documentation Problem
- **Location:** `docs/05-multi-launcher-integration.md` (L88), `docs/07-troubleshooting-and-bisect.md` (L79)
- **Problem:** Code snippets in architecture docs use stale class/type names: `LauncherDetector` (code: `InstanceDetector`), `DiscoveredInstance` (code: `MinecraftInstance`), `BisectEngine` (code: `BisectRunner`).
- **Evidence:** Compared snippets in docs against `src/core/instance/detector.ts` and `src/core/troubleshoot/bisect.ts`.
- **Impact:** Minor cognitive friction for developers navigating between docs and implementation.
- **Recommendation:** Align class names in code snippets to match the source files exactly.
- **Verification:** Re-check diff between snippet class declarations and source exports.

---

### [DOC-006] Minecraft Version Cache TTL Discrepancy
- **Severity:** LOW
- **Confidence:** Confirmed Documentation Problem
- **Location:** `README.md` (L25), `docs/01-architecture-and-vision.md` (L69), `docs/LOADMODER_ARCHITECTURE.md` (L71), `docs/08-developer-guide-and-api.md` (L34)
- **Problem:** Documentation claims version list is cached for 24 hours ("cache lokal 24 jam").
- **Evidence:** `src/core/minecraft/versions.ts` (L9) defines `const CACHE_TTL_MS = 60 * 60 * 1000; // 1 jam TTL cache`.
- **Impact:** Misunderstanding regarding how frequently the CLI checks Modrinth for newly released Minecraft versions.
- **Recommendation:** Update documentation from "24 jam" to "1 jam" (or adjust code constant if 24 hours was intended).
- **Verification:** Confirm TTL value in documentation matches `CACHE_TTL_MS`.

---

### [DOC-008] Missing `LICENSE` File Referenced in README Badge
- **Severity:** LOW
- **Confidence:** Confirmed Documentation Problem
- **Location:** `README.md` (Line 9)
- **Problem:** The README displays an MIT license badge hyperlinked to `LICENSE`, but no `LICENSE` file exists in the repository.
- **Evidence:** File inspection verified `Test-Path LICENSE` returns `False`.
- **Impact:** Clicking the badge results in a 404 in web repositories; legal terms are technically uncommitted.
- **Recommendation:** Add a standard MIT `LICENSE` file with copyright holder Hafiz Novelrianto / LoadModer contributors.
- **Verification:** Verify `LICENSE` exists in root and badge link resolves.

---

## Potential Documentation Improvements

### [DOC-P01] Missing Root `AGENTS.md` File
- **Severity:** MEDIUM
- **Confidence:** Potential Documentation Improvement
- **Location:** Repository root
- **Observation:** The repository contains `.agent/skills/` and `docs/SKILL.md`, but lacks an `AGENTS.md` file in the root directory. Creating `AGENTS.md` would provide automated instructions for AI agents regarding testing, validation, and coding boundaries.

### [DOC-P02] Redundancy Between `docs/01` and `docs/LOADMODER_ARCHITECTURE.md`
- **Severity:** LOW
- **Confidence:** Potential Documentation Improvement
- **Location:** `docs/01-architecture-and-vision.md` and `docs/LOADMODER_ARCHITECTURE.md`
- **Observation:** Both documents contain nearly identical architecture diagrams and descriptions of the 8 pillars. Consolidating or cross-referencing them would reduce future documentation maintenance burden.

### [DOC-P03] Missing `CHANGELOG.md`
- **Severity:** LOW
- **Confidence:** Potential Documentation Improvement
- **Location:** Repository root
- **Observation:** The project is at version 2.0.0. A changelog tracking new features (TUI dashboard, dynamic MC versions, snapshot isolation) would assist users upgrading from earlier iterations.

---

# 15. Recommended Documentation Structure

To maintain maximum clarity, zero drift, and eliminate legacy confusion, the recommended documentation layout is:

```text
LoadModer/
├── README.md                          # Main project presentation, quick-start, CLI table
├── LICENSE                            # MIT License file (currently missing)
├── AGENTS.md                          # AI coding agent entry instructions & skill map
├── docs/
│   ├── README.md                      # Documentation Hub & Navigation index
│   ├── 01-architecture-and-vision.md  # Layered architecture, domain model, end-to-end data flow
│   ├── 02-tech-stack-and-libraries.md # Curated tech stack rationale (clean of chokidar drift)
│   ├── 03-cli-commands-and-ux.md      # Command specifications, flags, TUI layouts
│   ├── 04-modpack-engine.md           # .mrpack engine, overrides, streaming Zod validation
│   ├── 05-multi-launcher-integration.md # Launcher auto-discovery & profile snapshots
│   ├── 06-dependency-graph-and-lockfile.md # DAG, reference counting, orphan pruning
│   ├── 07-troubleshooting-and-bisect.md # Mod toggle & binary search crash isolation
│   ├── 08-developer-guide.md          # Onboarding, environment vars, build, Vitest guide
│   ├── SKILL.md                       # Catalog of 18 agent skills (using relative links)
│   └── audits/                        # Historical documentation audits
│       └── documentation-knowledge-audit-2026-10-02.md
```

---

# 16. Quick Wins (High Impact, Low Effort)

These 4 corrections can be implemented in under 15 minutes without architectural risk:
1. **Fix relative links in `docs/SKILL.md` (DOC-001):** Replace all 19 occurrences of `file:///c:/Users/LENOVO/LoadModer/` with `../`.
2. **Add standard `LICENSE` file (DOC-008):** Commit a standard MIT license in the root directory to fix the README badge.
3. **Correct `chokidar` reference (DOC-003):** Update `README.md` and `docs/02` to state Node.js native `fs.watch`.
4. **Synchronize cache TTL documentation (DOC-006):** Update `README.md` and `docs/01` to reflect the 1-hour cache TTL.

---

# 17. Important Documentation Work

1. **Remediate or Deprecate `docs/modrinth-cli-guide.md` (DOC-002):**  
   Perform a find-and-replace to update `mcmod` to `loadmoder` / `lm`, update `~/.mcmod` to `~/.loadmoder`, or add a prominent disclaimer indicating that this is a conceptual guide.
2. **Document Environment Variables (DOC-007):**  
   Add a dedicated section in `docs/08-developer-guide-and-api.md` explaining `LOADMODER_CONTACT`, `LOADMODER_HOME`, and `MODRINTH_API_URL`.
3. **Align Code Snippets in `docs/05` and `docs/07` (DOC-005):**  
   Update `LauncherDetector` $\rightarrow$ `InstanceDetector` and `BisectEngine` $\rightarrow$ `BisectRunner`.
4. **Create Root `AGENTS.md` (DOC-P01):**  
   Define agent rules, validation commands (`npm test`, `npx tsc --noEmit`), and pointers to `.agent/skills/`.

---

# 18. Final Documentation Roadmap

| Priority | Task | Affected Files | Expected Outcome |
| :---: | :--- | :--- | :--- |
| **P1** | Convert `docs/SKILL.md` links to relative paths | `docs/SKILL.md` | Fixes broken navigation on all non-LENOVO machines |
| **P1** | Add `LICENSE` file | `LICENSE` | Resolves broken link on README badge |
| **P2** | Update `docs/modrinth-cli-guide.md` naming | `docs/modrinth-cli-guide.md` | Eliminates confusion between `mcmod` and `loadmoder` |
| **P2** | Document environment variables | `docs/08-developer-guide-and-api.md` | Developers can configure custom home & contact headers |
| **P3** | Fix `chokidar` & TTL documentation drift | `README.md`, `docs/01`, `docs/02` | Eliminates technical inaccuracies in tech stack docs |
| **P3** | Synchronize class names in doc snippets | `docs/05`, `docs/07` | Matches code declarations exactly |
| **P4** | Create root `AGENTS.md` | `AGENTS.md` | Provides structured guidance for AI coding agents |

---

# 19. Audit Scope, Assumptions & Limitations

### Scope Covered
- **Fully Reviewed:**  
  - All markdown documentation files in `README.md` and `docs/` (12 files).
  - All manifest and configuration files (`package.json`, `package-lock.json`, `tsconfig.json`, `tsup.config.ts`).
  - Source code entry points and core domain logic (`src/index.ts`, `src/constants.ts`, `src/core/`, `src/api/`).
  - All 6 unit and integration test files in `tests/`.
  - All 18 skill manifests in `.agent/skills/*/SKILL.md`.
- **Commands Executed:**  
  - `npm ci` (Dependency installation).
  - `npm test` (Vitest test suite execution: 36 passed).
  - `npx tsc --noEmit` (TypeScript compiler type-check: 0 errors).
  - `git log` and `git status` (Repository snapshot verification).
  - `grep_search` across `docs/`, `src/`, and `tests/` for keyword verification.
- **Commands Not Executed:**  
  - External publishing commands (`npm publish`).
  - Destructive filesystem commands outside sandboxed test runs.

### Limitations & Assumptions
- Audit assumes Node.js 20 LTS as the standard runtime environment.
- Modrinth API interactions were validated using test mocks and network inspection.

---

# 20. Audit History & Delta

- **Previous Audit:** None. This is the baseline initial audit for LoadModer v2.0.0.
- **Direction of Change:** Baseline established at **Level 4 — Solid**.
