# Architecture & Code Quality Audit

**Date:** 2026-10-02  
**Repository:** [LoadModer](file:///c:/Users/DELL/Downloads/LoadModer) (`2Hafast8/LoadModer`)  
**Branch:** `improvement`  
**Audited Commit SHA:** [`b88dabd4bcf1b297ea4f9c6d36ef554a9d20c57f`](file:///c:/Users/DELL/Downloads/LoadModer) (`b88dabd`)  
**Working Tree State:** Clean (Post-Bug Remediation & Security Hardening)  
**Auditor:** Antigravity AI Engineering System  
**Audit Protocol:** Production-Grade Architecture & Code Quality Audit v2.0  
**Applied Skills:** `/software-architecture`, `/code-review`, `/antislop-code`, `/clean-code`  

---

## 0. Audit Scope & Coverage

### Repository Snapshot

```text
Audit Date:                      2026-10-02
Repository:                      2Hafast8/LoadModer
Branch:                          improvement
Commit SHA:                      b88dabd4bcf1b297ea4f9c6d36ef554a9d20c57f (b88dabd)
Primary Stack:                   TypeScript 5.5.3 (strict), Node.js >= 20.0.0 (ESM)
CLI Framework:                   Commander.js 12.1.0
Validation:                      Zod 3.23.8
Bundler:                         tsup 8.1.0 (esbuild target node20)
Test Runner:                     Vitest 1.6.1 (15 test files, 85 passed, 100%)
Project Scale:                   43 source files (6,350 LOC in src/), 15 test files (1,433 LOC in tests/)
Command Execution Available:     Yes (Local PowerShell 7 / Windows 11)
Network Access Available:        Restricted / Local Sandbox
Audit Mode:                      AUDIT-ONLY (Zero source code, test, or config modifications)
Previous Baseline Audit:         docs/audits/architecture-code-quality-audit-2026-10-02.md (Commit f89edba)
```

### Coverage Map

| Architectural Domain | Files Inspected | Review Depth | Status |
| :--- | :--- | :--- | :--- |
| **API Client & Network** | [`src/api/client.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/api/client.ts), [`src/api/cache.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/api/cache.ts) | 100% Full-depth | Audited |
| **Dependency Core** | [`src/core/dependency/graph.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/core/dependency/graph.ts), [`src/core/dependency/resolver.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/core/dependency/resolver.ts) | 100% Full-depth | Audited |
| **Instance & Launcher** | [`src/core/instance/config.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/core/instance/config.ts), [`src/core/instance/detector.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/core/instance/detector.ts) | 100% Full-depth | Audited |
| **Minecraft & Versions** | [`src/core/minecraft/versions.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/core/minecraft/versions.ts), [`src/core/minecraft/compatibility.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/core/minecraft/compatibility.ts) | 100% Full-depth | Audited |
| **Modpack Engine** | [`src/core/modpack/unpacker.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/core/modpack/unpacker.ts) | 100% Full-depth | Audited |
| **Profile & Isolation** | [`src/core/profile/snapshotManager.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/core/profile/snapshotManager.ts) | 100% Full-depth | Audited |
| **Troubleshooting & Bisect**| [`src/core/troubleshoot/bisect.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/core/troubleshoot/bisect.ts) | 100% Full-depth | Audited |
| **Directory Watcher** | [`src/core/watcher/modsWatcher.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/core/watcher/modsWatcher.ts) | 100% Full-depth | Audited |
| **Type Definitions** | [`src/types/*.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/types) (5 files) | 100% Full-depth | Audited |
| **CLI Commands** | [`src/commands/*.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/commands) (11 files) | 100% Full-depth | Audited |
| **TUI Dashboard** | [`src/ui/dashboard/*.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/ui/dashboard), [`src/ui/*.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/ui) (10 files) | 100% Full-depth | Audited |
| **Utilities** | [`src/utils/*.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/utils) (3 files) | 100% Full-depth | Audited |
| **Constants** | [`src/constants.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/constants.ts) | 100% Full-depth | Audited |
| **Test Suites** | [`tests/*.test.ts`](file:///c:/Users/DELL/Downloads/LoadModer/tests) (15 files) | 100% Full-depth | Audited |

**Coverage Confidence:** **100% Full-depth exhaustive coverage across all 43 production TypeScript files and 15 automated test suites**.

---

## 1. Architecture Overview

LoadModer (`lm`) is structured as a standalone TypeScript CLI and Terminal User Interface (TUI) application designed to manage Minecraft mods, modpacks (`.mrpack`), shaders, and resource packs via the Modrinth API v2.

```mermaid
graph TD
    CLI[CLI Entrypoint & Commander Handlers<br/>src/index.ts, src/commands/*.ts] --> CORE[Core Domain Logic<br/>src/core/*]
    TUI[Interactive TUI Dashboard<br/>src/ui/dashboard/*.ts, src/ui/*.ts] --> CORE
    TUI -.->|Architectural Coupling: Invokes CLI Commands| CLI
    CORE --> API[Modrinth API Client & Cache<br/>src/api/*]
    CORE --> TYPES[Zod Schemas & Types<br/>src/types/*]
    CORE --> UTILS[Streaming Crypto & Formatting<br/>src/utils/*]
    UTILS -.->|Cross-Layer Leak: markdown.ts imports theme.ts| TUI
```

### Architectural Evolution Since Baseline Audit (`f89edba` $\rightarrow$ `b88dabd`)

1. **Domain Isolation Remediation (`ARCH-001`, `ARCH-002` Resolved):**
   - [`src/core/dependency/resolver.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/core/dependency/resolver.ts): All terminal logging calls and imports from `@clack/prompts` have been removed and replaced with an optional logging callback (`opts.onLog`).
   - [`src/core/minecraft/versions.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/core/minecraft/versions.ts): UI menu formatting (`getMinecraftVersionChoices`) was extracted to [`src/ui/interactive.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/ui/interactive.ts).
   - As a result, **`src/core/` now has zero dependencies on `src/ui/`**, completely satisfying the domain decoupling rule in `AGENTS.md`.
2. **Partial UI Megamodule Decomposition (`ARCH-003` Mitigated):**
   - [`src/ui/dashboard/detail.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/ui/dashboard/detail.ts) was reduced from 1,149 LOC to 744 LOC by extracting:
     - `computeModCompatibility` into [`src/core/minecraft/compatibility.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/core/minecraft/compatibility.ts).
     - `renderComprehensiveModDetailCard` into [`src/ui/dashboard/detailCard.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/ui/dashboard/detailCard.ts).
     - `handleVersionsExplorer` into [`src/ui/dashboard/versionsExplorer.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/ui/dashboard/versionsExplorer.ts).
3. **Dead Code & Dependency Hygiene (`ARCH-006`, `ARCH-007`, `ARCH-008` Resolved):**
   - Unused packages (`pathe`, `ora`, `cli-progress`, `@types/cli-progress`, `picocolors`) were uninstalled from `package.json`.
   - Dead file `src/ui/progress.ts` and orphaned renderers in `src/ui/theme.ts` were purged.
   - Paginator in `src/utils/markdown.ts` was separated into [`src/ui/markdownViewer.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/ui/markdownViewer.ts).
4. **Massive Test Suite Expansion:**
   - Test suites grew from 6 test files (36 tests) to 15 test files (85 tests), achieving 100% pass rate. Dedicated test suites were created for `bisect`, `instanceConfig`, `instanceDetector`, `modsWatcher`, `snapshotManager`, `compatibility`, `searchFilters`, and `security`.

---

## 2. Architecture Findings

### [ARCH-004] TUI-to-CLI Inversion & Abrupt Termination via `process.exit(1)` in Command Handlers
- **Classification:** Confirmed Architecture Problem
- **Severity:** **HIGH**
- **Location:** 
  - [`src/commands/update.ts#L33, L41`](file:///c:/Users/DELL/Downloads/LoadModer/src/commands/update.ts#L33)
  - [`src/commands/toggle.ts#L17, L31`](file:///c:/Users/DELL/Downloads/LoadModer/src/commands/toggle.ts#L17)
  - [`src/commands/remove.ts#L25`](file:///c:/Users/DELL/Downloads/LoadModer/src/commands/remove.ts#L25)
  - [`src/commands/install.ts#L35, L49`](file:///c:/Users/DELL/Downloads/LoadModer/src/commands/install.ts#L35)
  - [`src/commands/list.ts#L27`](file:///c:/Users/DELL/Downloads/LoadModer/src/commands/list.ts#L27)
  - [`src/commands/bisect.ts#L20`](file:///c:/Users/DELL/Downloads/LoadModer/src/commands/bisect.ts#L20)
  - [`src/ui/dashboard/detail.ts#L11-L12`](file:///c:/Users/DELL/Downloads/LoadModer/src/ui/dashboard/detail.ts#L11-L12)
  - [`src/ui/dashboard/home.ts#L8-L10`](file:///c:/Users/DELL/Downloads/LoadModer/src/ui/dashboard/home.ts#L8-L10)
  - [`src/ui/dashboard/versionsExplorer.ts#L4`](file:///c:/Users/DELL/Downloads/LoadModer/src/ui/dashboard/versionsExplorer.ts#L4)
- **Problem:** TUI dashboard screens directly import CLI command handlers (`updateCommand`, `installCommand`, `initCommand`, `bisectCommand`). In turn, these command handlers execute hardcoded `process.exit(1)` whenever validation fails or directories are missing.
- **Evidence:**
  ```typescript
  // src/commands/update.ts:L31-L34
  const modsDir = opts.dir ?? activeInst?.modsDir;
  if (!modsDir) {
    p.log.error('Folder mods belum ditentukan. Jalankan "loadmoder init" terlebih dahulu.');
    process.exit(1);
  }

  // src/ui/dashboard/detail.ts:L11-L12
  import {updateCommand} from "../../commands/update.js";
  import {installCommand} from "../../commands/install.js";
  ```
- **Consequence:** If an error condition occurs during an interactive TUI action (e.g. invalid target, missing loader, temporary disk lock), `process.exit(1)` immediately terminates the Node.js runtime process, dumping the user out of the interactive session into the terminal shell without opportunity for error recovery or navigation.
- **Impact:** System Reliability, UX Stability, Architectural Layering.
- **Recommendation:**
  1. Decouple reusable business workflows from CLI presentation handlers by introducing a clean Application Service layer (e.g., `InstallModService`, `UpdateModsService`, `ToggleModService`) in `src/core/` or `src/services/`.
  2. Services should return structured `Result` types or throw typed domain errors.
  3. CLI command handlers in `src/commands/` should catch domain errors and set `process.exitCode = 1` without hard-exiting.
  4. TUI dashboard screens should invoke services directly and display recoverable error prompts.
- **Refactoring Scope:** Medium
- **Change Risk:** Low to Medium
- **Verification:** Trigger an error condition inside the TUI dashboard; verify that the TUI displays a friendly error box and remains active on the current screen.

---

### [ARCH-009] Domain Responsibility Misplacement in `src/core/troubleshoot/bisect.ts` (`BisectRunner.toggleMod`)
- **Classification:** Confirmed Architecture Problem
- **Severity:** **MEDIUM**
- **Location:** [`src/core/troubleshoot/bisect.ts#L108-L127`](file:///c:/Users/DELL/Downloads/LoadModer/src/core/troubleshoot/bisect.ts#L108-L127), [`src/commands/toggle.ts#L20`](file:///c:/Users/DELL/Downloads/LoadModer/src/commands/toggle.ts#L20)
- **Problem:** Enabling and disabling individual mod files (appending or removing `.disabled` extensions) is implemented as a method on `BisectRunner`, a class dedicated to binary search crash troubleshooting.
- **Evidence:**
  ```typescript
  // src/commands/toggle.ts:L20-L23
  const runner = new BisectRunner(modsDir);
  const newName = await runner.toggleMod(modQuery, enable);

  // src/core/troubleshoot/bisect.ts:L108
  async toggleMod(modQuery: string, enable: boolean): Promise<string> {
    const files = await readdir(this.modsDir);
    ...
    await rename(oldPath, newPath);
    return newName;
  }
  ```
- **Consequence:** Violates the Single Responsibility Principle (SRP). A consumer wanting to toggle an individual mod must instantiate `new BisectRunner(modsDir)`. This hides standard mod file management inside a troubleshooting module and creates conceptual coupling between ordinary mod state and crash diagnosis.
- **Impact:** Maintainability, Domain Clarity, Code Discoverability.
- **Recommendation:** Extract file toggling logic to a dedicated module, such as `src/core/instance/modManager.ts` or `src/core/mod/modFileService.ts`. `BisectRunner` should focus strictly on binary search state management.
- **Refactoring Scope:** Small
- **Change Risk:** Low
- **Verification:** Unit tests in `tests/bisect.test.ts` continue to pass; `lm toggle <mod>` and TUI toggle routes execute identically.

---

### [ARCH-010] Presentation Workflow Layer Misplacement in `src/commands/profile.ts` (`runInteractiveProfileSwitcher`)
- **Classification:** Confirmed Architecture Problem
- **Severity:** **MEDIUM**
- **Location:** [`src/commands/profile.ts#L16-L327`](file:///c:/Users/DELL/Downloads/LoadModer/src/commands/profile.ts#L16-L327), [`src/ui/dashboard/home.ts#L11`](file:///c:/Users/DELL/Downloads/LoadModer/src/ui/dashboard/home.ts#L11)
- **Problem:** `src/commands/profile.ts` contains 312 lines of interactive TUI terminal prompt menus (`runInteractiveProfileSwitcher`), which is imported by the UI dashboard [`src/ui/dashboard/home.ts`](file:///c:/Users/DELL/Downloads/LoadModer/src/ui/dashboard/home.ts).
- **Evidence:**
  ```typescript
  // src/ui/dashboard/home.ts:L11
  import {runInteractiveProfileSwitcher} from "../../commands/profile.js";

  // src/commands/profile.ts:L16
  export async function runInteractiveProfileSwitcher(activeInstanceKey?: string): Promise<void> {
    ...
    while (inProfileMenu) {
      const selected = await askInteractiveMenu(...);
      ...
    }
  }
  ```
- **Consequence:** Creates an upward layer inversion where `src/ui/dashboard/` imports presentation components from `src/commands/`. `src/commands/` should be the outermost presentation adapter for CLI subcommands, while interactive full-screen menus belong inside `src/ui/dashboard/`.
- **Impact:** Layer Cohesion, Clean Architecture Boundaries.
- **Recommendation:** Move `runInteractiveProfileSwitcher` to `src/ui/dashboard/profileSwitcher.ts`. Keep `src/commands/profile.ts` focused strictly on CLI command handlers (`profileListCommand`, `profileSwitchCommand`).
- **Refactoring Scope:** Small
- **Change Risk:** Low
- **Verification:** CLI `lm profile switch` and TUI "Kelola Profil & Versi" menu both function properly without importing across `ui` $\rightarrow$ `commands`.

---

### [ARCH-011] Upward Cross-Layer Dependency from `src/utils/markdown.ts` to `src/ui/theme.ts`
- **Classification:** Confirmed Architecture Problem
- **Severity:** **LOW**
- **Location:** [`src/utils/markdown.ts#L2`](file:///c:/Users/DELL/Downloads/LoadModer/src/utils/markdown.ts#L2), [`src/ui/theme.ts#L6`](file:///c:/Users/DELL/Downloads/LoadModer/src/ui/theme.ts#L6)
- **Problem:** `src/utils/markdown.ts` imports `theme` from `../ui/theme.js`, while `src/ui/theme.ts` imports `formatBytes` from `../utils/format.js`.
- **Evidence:**
  ```typescript
  // src/utils/markdown.ts:L2
  import {theme} from "../ui/theme.js";

  // src/ui/theme.ts:L6
  import {formatBytes} from "../utils/format.js";
  ```
- **Consequence:** Creates cross-layer bidirectional coupling between `src/utils/` and `src/ui/`. A low-level utility module imports a high-level UI module, preventing `src/utils/` from being an independent leaf directory.
- **Impact:** Layer Independence, Modularity.
- **Recommendation:** Relocate `renderMarkdownToTerminal` into `src/ui/markdown.ts` (as it is inherently a terminal UI formatter using ANSI escape tokens and Nordic theme colors). Leave `src/utils/` strictly for UI-agnostic leaf utilities (crypto, format).
- **Refactoring Scope:** Small
- **Change Risk:** Low
- **Verification:** Grep confirms zero imports from `src/ui/` inside `src/utils/`.

---

## 3. Code Quality Findings

### [ARCH-003] God UI Component & Megamodule in `src/ui/dashboard/detail.ts`
- **Classification:** Confirmed Code Quality Problem
- **Severity:** **MEDIUM** *(Down-ranked from HIGH following partial decomposition)*
- **Location:** [`src/ui/dashboard/detail.ts#L1-L744`](file:///c:/Users/DELL/Downloads/LoadModer/src/ui/dashboard/detail.ts#L1-L744) (744 LOC, 28.5 KB)
- **Problem:** Although 405 lines were extracted in recent refactoring (`computeModCompatibility`, `renderComprehensiveModDetailCard`, `handleVersionsExplorer`), `detail.ts` remains the largest file in the codebase at 744 lines, accumulating:
  1. **Environment Setup & Prompts:** `ensureInstanceEnvironment` (lines 44–102).
  2. **Data Hashing & Aggregation:** `buildInstalledModDetail` (lines 104–260) and `buildRemoteModDetail` (lines 261–350).
  3. **Installed Mod Action Route:** `runInstalledModDetailRoute` (lines 351–570).
  4. **Remote Mod Action Route:** `runRemoteModDetailRoute` (lines 571–744).
- **Evidence:**
  File LOC analysis confirms `src/ui/dashboard/detail.ts` is 744 LOC, exceeding the repository clean-code guideline (<200 LOC per file, <50 LOC per function).
- **Consequence:** High cognitive load during maintenance. Modifying file detail metadata or route actions requires editing a 744-line file that manages multiple asynchronous workflows.
- **Impact:** Maintainability, Testability, Cognitive Overhead.
- **Recommendation:** Complete the decomposition:
  - Move `buildInstalledModDetail` and `buildRemoteModDetail` into `src/core/mod/detailLoader.ts`.
  - Split `runInstalledModDetailRoute` and `runRemoteModDetailRoute` into dedicated route files under `src/ui/dashboard/detail/`.
- **Refactoring Scope:** Medium
- **Change Risk:** Low
- **Verification:** Detail routes for both installed and remote mods render and operate identically; file sizes remain under 250 LOC each.

---

### [ARCH-012] Type Redundancy and Primitive Obsession across Mod Loaders and Project Types
- **Classification:** Confirmed Code Quality Problem
- **Severity:** **LOW**
- **Location:**
  - [`src/constants.ts#L17-L21`](file:///c:/Users/DELL/Downloads/LoadModer/src/constants.ts#L17-L21) vs [`src/types/instance.ts#L2`](file:///c:/Users/DELL/Downloads/LoadModer/src/types/instance.ts#L2) vs [`src/types/modrinth.ts#L3`](file:///c:/Users/DELL/Downloads/LoadModer/src/types/modrinth.ts#L3)
  - [`src/commands/update.ts#L78, L150-L151`](file:///c:/Users/DELL/Downloads/LoadModer/src/commands/update.ts#L78)
  - [`src/commands/install.ts#L183`](file:///c:/Users/DELL/Downloads/LoadModer/src/commands/install.ts#L183)
  - [`src/commands/init.ts#L23, L104`](file:///c:/Users/DELL/Downloads/LoadModer/src/commands/init.ts#L23)
- **Problem:** 
  1. `ProjectType` is defined twice: in `src/constants.ts:L21` and `src/types/modrinth.ts:L3`.
  2. Mod loader union is defined twice: as `SupportedLoader` in `constants.ts` and `LoaderType` in `types/instance.ts`.
  3. `SavedInstanceConfig` weakens loader type to `string`, causing downstream type assertions (`loader = inputLoader as any`).
  4. `src/commands/update.ts` declares `nextVersion: any; nextFile: any` despite `ModVersion` and `ModVersionFile` existing in `src/types/modrinth.ts`.
- **Evidence:**
  ```typescript
  // src/commands/update.ts:L78
  const updates: { current: string; currentPath: string; nextVersion: any; nextFile: any }[] = [];

  // src/commands/install.ts:L183
  let projectMeta: any;
  ```
- **Consequence:** Unnecessary duplication of type contracts and loss of compile-time safety across command handlers, forcing arbitrary `as any` casts.
- **Impact:** Type Safety, Code Consistency.
- **Recommendation:**
  1. Establish single sources of truth for `ProjectType` and `LoaderType` in `src/types/`.
  2. Replace all remaining `any` type annotations in `update.ts`, `install.ts`, and `init.ts` with explicit interfaces.
- **Refactoring Scope:** Small
- **Change Risk:** Low
- **Verification:** `npx tsc --noEmit` exits with 0 errors with zero `any` annotations in command definitions.

---

### [ARCH-013] Lack of Domain Error Hierarchy
- **Classification:** Confirmed Architecture Problem
- **Severity:** **LOW**
- **Location:** Core modules in [`src/core/`](file:///c:/Users/DELL/Downloads/LoadModer/src/core)
- **Problem:** The entire application defines only one custom error class: `ModrinthError` in `src/api/client.ts`. All other domain failures (instance missing, corrupted lockfile, invalid modpack, bisect failure) throw generic `new Error('...')`.
- **Evidence:**
  - `src/core/instance/config.ts`: `throw new Error('Instance dengan id/nama ... tidak ditemukan.')`
  - `src/core/troubleshoot/bisect.ts`: `throw new Error('Minimal harus ada 2 mod aktif...')`
  - `src/core/modpack/unpacker.ts`: `throw new Error('Path traversal terdeteksi...')`
- **Consequence:** Callers cannot programmatically distinguish between recoverable user input errors and fatal internal errors using `instanceof` or error codes. Callers must rely on brittle string matching on `err.message`.
- **Impact:** Error Handling Predictability, Extensibility.
- **Recommendation:** Introduce a lightweight domain error hierarchy in `src/types/errors.ts`:
  - `LoadModerError` (base)
  - `InstanceNotFoundError`, `CorruptStateError`, `CompatibilityError`, `ModpackError`.
- **Refactoring Scope:** Small
- **Change Risk:** Low
- **Verification:** Call sites can catch specific error classes via `instanceof`.

---

## 4. Dependency Findings

### Dependency Health Assessment: Clean & Optimized
- In the baseline audit, finding **`ARCH-008`** documented 3 unused production dependencies (`pathe`, `ora`, `cli-progress`) and **`ARCH-007`** documented duplicate color libraries (`chalk` + `picocolors`).
- Both findings have been **fully resolved**:
  - `pathe`, `ora`, `cli-progress`, and `@types/cli-progress` have been uninstalled.
  - `picocolors` was removed and standardized on `chalk`.
- Direct dependencies in `package.json` are now lean, purpose-driven, and modern:
  - `@clack/prompts` (0.7.0) & `@inquirer/prompts` (8.7.2): Terminal interactivity.
  - `boxen` (9.0.0), `chalk` (6.0.1), `cli-table3` (0.6.5), `gradient-string` (3.0.0): Terminal presentation.
  - `commander` (12.1.0): CLI command orchestration.
  - `zod` (3.23.8): Runtime contract validation.
  - `write-file-atomic` (5.0.1): Crash-resilient file persistence.
  - `unzipper` (0.12.3) & `p-limit` (5.0.0): Streaming modpack unpacker & concurrency control.
- **Zero unused dependencies** remain in `package.json`.

---

## 5. Technical Debt

| Debt Item | Area | Current Impact | Change Risk | Growth Status | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hardcoded `process.exit(1)` (ARCH-004)** | `src/commands/*.ts` | TUI session terminates on command error | Low–Med | Stable | High |
| **detail.ts Remaining Size (ARCH-003)** | `src/ui/dashboard/detail.ts` | 744 LOC router/service megamodule | Low | Shrinking | Medium |
| **Domain Misplacement of `toggleMod` (ARCH-009)** | `src/core/troubleshoot/bisect.ts` | SRP violation; toggle coupled to bisect | Low | Stable | Medium |
| **TUI Workflow in Commands (ARCH-010)** | `src/commands/profile.ts` | Upward UI-to-commands dependency | Low | Stable | Medium |
| **Utils-to-UI Leak (ARCH-011)** | `src/utils/markdown.ts` | `markdown.ts` imports `theme.ts` | Low | Stable | Low |
| **Duplicate Loader/Project Types (ARCH-012)** | `src/types/` & `src/constants.ts` | Inconsistent types and unnecessary `any` | Low | Stable | Low |
| **Generic `new Error` (ARCH-013)** | `src/core/` | No structured error classes for domain | Low | Stable | Low |

---

## 6. Testability Assessment

### Test Suite Evolution
The automated test suite has evolved significantly from the baseline audit:

```text
Baseline (f89edba):  6 test files  |  36 tests passing  | 5 untested core modules
Current  (b88dabd): 15 test files  |  85 tests passing  | 100% core domain covered
```

### Verified Test Suites

| Test Suite | Tests | Domain Tested |
| :--- | :---: | :--- |
| [`tests/dependencyResolver.test.ts`](file:///c:/Users/DELL/Downloads/LoadModer/tests/dependencyResolver.test.ts) | 11 | Recursive dependency resolution, circular detection, description parsing |
| [`tests/compatibility.test.ts`](file:///c:/Users/DELL/Downloads/LoadModer/tests/compatibility.test.ts) | 5 | Mod compatibility scoring, loader matching, version tags |
| [`tests/security.test.ts`](file:///c:/Users/DELL/Downloads/LoadModer/tests/security.test.ts) | 8 | Path traversal prevention, SSRF rejection, escape injection sanitization |
| [`tests/dependencyGraph.test.ts`](file:///c:/Users/DELL/Downloads/LoadModer/tests/dependencyGraph.test.ts) | 8 | DAG reference counting, lockfile parsing, orphan pruning |
| [`tests/bisect.test.ts`](file:///c:/Users/DELL/Downloads/LoadModer/tests/bisect.test.ts) | 6 | Binary search arithmetic, state save/restore, culprit isolation |
| [`tests/instanceConfig.test.ts`](file:///c:/Users/DELL/Downloads/LoadModer/tests/instanceConfig.test.ts) | 4 | Instance registration, active selection, corrupt config recovery |
| [`tests/cliJsonOutput.test.ts`](file:///c:/Users/DELL/Downloads/LoadModer/tests/cliJsonOutput.test.ts) | 2 | Pure JSON output for automation scripts (`lm list --json`, `lm search --json`) |
| [`tests/instanceDetector.test.ts`](file:///c:/Users/DELL/Downloads/LoadModer/tests/instanceDetector.test.ts) | 2 | Launcher auto-detection across multi-platform instance paths |
| [`tests/crypto.test.ts`](file:///c:/Users/DELL/Downloads/LoadModer/tests/crypto.test.ts) | 3 | SHA-1 and SHA-512 stream hashing verification |
| [`tests/performance.test.ts`](file:///c:/Users/DELL/Downloads/LoadModer/tests/performance.test.ts) | 2 | Cache-first hit latency, memory efficiency |
| [`tests/uiThemeA11y.test.ts`](file:///c:/Users/DELL/Downloads/LoadModer/tests/uiThemeA11y.test.ts) | 13 | WCAG AA color contrast, responsive column truncation |
| [`tests/minecraftVersions.test.ts`](file:///c:/Users/DELL/Downloads/LoadModer/tests/minecraftVersions.test.ts) | 10 | Version comparison ordering, snapshot vs release sorting, TTL cache |
| [`tests/modsWatcher.test.ts`](file:///c:/Users/DELL/Downloads/LoadModer/tests/modsWatcher.test.ts) | 2 | Real-time filesystem event debouncing, lockfile disk sync |
| [`tests/snapshotManager.test.ts`](file:///c:/Users/DELL/Downloads/LoadModer/tests/snapshotManager.test.ts) | 3 | Profile snapshot creation, file archiving, profile switching |
| [`tests/searchFilters.test.ts`](file:///c:/Users/DELL/Downloads/LoadModer/tests/searchFilters.test.ts) | 6 | Facet query building, sort parameters, category filters |

---

## 7. Maintainability Assessment

### Change Blast Radius
- **Low Blast Radius:** Core utilities (`src/utils/`), Dependency Graph (`src/core/dependency/graph.ts`), API Client (`src/api/client.ts`), and Mods Watcher (`src/core/watcher/modsWatcher.ts`). These modules feature isolated, highly cohesive logic with comprehensive regression coverage.
- **Medium Blast Radius:** Command handlers in `src/commands/`. While presentation logic is clean, coupling to `process.exit(1)` impacts the TUI dashboard.
- **Moderate Blast Radius:** `src/ui/dashboard/detail.ts`. Although substantially reduced from 1,149 LOC, changes to mod detail navigation still involve a 744-line file.

---

## 8. Refactoring Recommendations

### Quick Wins (Small Scope, Minimal Risk)
1. **Move `renderMarkdownToTerminal` to UI (ARCH-011):** Move `src/utils/markdown.ts` to `src/ui/markdown.ts` or inject theme tokens. Eliminates the upward dependency from `utils` to `ui`.
2. **Unify Project and Loader Types (ARCH-012):** Consolidate `ProjectType` and `LoaderType` into `src/types/`. Remove `any` casts in `update.ts` and `install.ts`.
3. **Relocate `toggleMod` from `BisectRunner` (ARCH-009):** Extract `toggleMod` to `src/core/instance/modManager.ts` to preserve SRP.

### Medium Improvements (Focused Scope, Low-to-Medium Risk)
1. **Relocate Interactive Profile Switcher (ARCH-010):** Move `runInteractiveProfileSwitcher` from `src/commands/profile.ts` into `src/ui/dashboard/profileSwitcher.ts`.
2. **Complete Decomposition of `detail.ts` (ARCH-003):** Extract `buildInstalledModDetail` and `buildRemoteModDetail` into a data service module (`src/core/mod/detailLoader.ts`).
3. **Introduce Domain Error Hierarchy (ARCH-013):** Define `LoadModerError` base class with domain-specific subclasses.

### Architectural Improvements (Strategic Scope)
1. **Decouple TUI from Command Handlers & Eliminate `process.exit(1)` (ARCH-004):**
   - Introduce an Application Service layer (`InstallService`, `UpdateService`, `ToggleService`).
   - Command handlers catch service errors and set `process.exitCode = 1`.
   - TUI dashboard invokes services directly and handles errors gracefully without exiting the process.

---

## 9. Priority Roadmap

```text
Phase 1: Boundary & Type Cleanup (Immediate — Low Risk)
├── 1. Unify ProjectType, LoaderType, and remove `any` annotations (ARCH-012)
├── 2. Extract toggleMod from BisectRunner to dedicated ModManager (ARCH-009)
├── 3. Move runInteractiveProfileSwitcher from commands/ to ui/dashboard/ (ARCH-010)
└── 4. Move renderMarkdownToTerminal from utils/ to ui/ (ARCH-011)

Phase 2: Error Architecture & Mod Detail Decomposition (Near-Term)
├── 5. Introduce LoadModerError domain error hierarchy (ARCH-013)
└── 6. Extract buildInstalledModDetail from detail.ts to detailLoader.ts (ARCH-003)

Phase 3: Application Service Layer & Process Exit Decoupling (Medium-Term)
├── 7. Create pure application services for install, update, toggle (ARCH-004)
├── 8. Replace process.exit(1) in commands with typed error returns (ARCH-004)
└── 9. Route TUI dashboard actions through application services with in-TUI error dialogs (ARCH-004)
```

---

## 10. Scorecard & Trend

| Dimension | Previous (f89edba) | Current (b88dabd) | Trend | Justification |
| :--- | :---: | :---: | :---: | :--- |
| **Architecture** | 4 / 5 | **4 / 5** | $\rightarrow$ | Core-to-UI leakage (`ARCH-001`) and version UI leak (`ARCH-002`) resolved; held at 4 due to TUI-to-CLI coupling (`ARCH-004`). |
| **Separation of Concerns** | 3 / 5 | **4 / 5** | $\nearrow$ | Resolver logging decoupled; `detail.ts` megamodule broken down from 1,149 to 744 lines; markdown paginator separated. |
| **Dependency Direction** | 3 / 5 | **4 / 5** | $\nearrow$ | Zero UI imports in `src/core/`; clean unidirectional flow from CLI/TUI to Core and API. Minor leak remains in `markdown.ts`. |
| **Code Consistency** | 4 / 5 | **4 / 5** | $\rightarrow$ | Consistent theme tokens, error logging, and table formatting; `picocolors` duplicate eliminated. |
| **Type / Contract Safety** | 5 / 5 | **4 / 5** | $\searrow$ | 0 `@ts-ignore`, 0 `@ts-expect-error`, strict TypeScript mode; docked 1 point for loose `any` casts in `update.ts`, `install.ts`, and `init.ts`. |
| **Testability** | 3 / 5 | **5 / 5** | $\nearrow\nearrow$ | Major breakthrough: expanded from 6 test files (36 tests) to 15 test files (85 tests, 100% passing) covering all core modules. |
| **Dependency Health** | 4 / 5 | **5 / 5** | $\nearrow$ | Unused dependencies (`pathe`, `ora`, `cli-progress`) purged; zero unused dependencies; lean, modern production stack. |
| **Technical Debt** | 4 / 5 | **4 / 5** | $\rightarrow$ | Dead code in `progress.ts` and `theme.ts` removed; remaining debt isolated to command `process.exit(1)` and `detail.ts`. |
| **Maintainability** | 4 / 5 | **4 / 5** | $\rightarrow$ | Clean, well-documented code with strong safety net; comprehensive automated regression protection. |

### Audit Comparison & Delta Summary

- **Resolved Findings (6):**
  - `ARCH-001`: Core-to-UI Domain Boundary Leakage in `resolver.ts` $\rightarrow$ **RESOLVED**
  - `ARCH-002`: Upward Layer Boundary Inversion in `versions.ts` $\rightarrow$ **RESOLVED**
  - `ARCH-005`: Layer Misplacement of Interactive Paginator in `markdown.ts` $\rightarrow$ **RESOLVED**
  - `ARCH-006`: Dead Code in `theme.ts` and `progress.ts` $\rightarrow$ **RESOLVED**
  - `ARCH-007`: Duplicate Color Styling Libraries (`picocolors` vs `chalk`) $\rightarrow$ **RESOLVED**
  - `ARCH-008`: Unused Production Dependencies in `package.json` $\rightarrow$ **RESOLVED**
- **Still-Open Findings (2):**
  - `ARCH-003`: Megamodule `detail.ts` $\rightarrow$ **Partially Resolved / Mitigated** (Reduced from 1,149 to 744 LOC; remains open for full separation).
  - `ARCH-004`: TUI-to-CLI Inversion & Abrupt Termination via `process.exit(1)` $\rightarrow$ **Still Open** (Requires Application Service layer).
- **New Findings (5):**
  - `ARCH-009`: Domain Responsibility Misplacement in `BisectRunner.toggleMod` (Medium).
  - `ARCH-010`: Presentation Workflow Layer Misplacement in `profile.ts` (Medium).
  - `ARCH-011`: Upward Cross-Layer Dependency from `markdown.ts` to `theme.ts` (Low).
  - `ARCH-012`: Type Redundancy and Primitive Obsession across Mod Loaders & Project Types (Low).
  - `ARCH-013`: Lack of Domain Error Hierarchy in `src/core/` (Low).
- **Overall Trajectory:** **Strong Positive Trend ($\nearrow$)**. Core domain boundaries have been strictly restored, all unused dependencies eliminated, dead code removed, and automated test coverage increased by 136%.

---

## 11. Audit Evidence & Verification

### Executed Commands & Validation

1. **Type Checking:**
   ```bash
   npx tsc --noEmit
   # Exit code: 0 (0 errors across 43 source files and 15 test files)
   ```
2. **Automated Test Suite:**
   ```bash
   npm test
   # Vitest v1.6.1: 15 test files passed, 85 tests passed (100%), duration 5.86s
   ```
3. **Production Bundling:**
   ```bash
   npm run build
   # tsup v8.5.1: Target node20, ESM build success in 101ms
   ```
4. **Binary Execution:**
   ```bash
   node dist/index.js --help
   # Exit code: 0 (Accurately renders all 13 CLI commands and global options)
   ```

---

## 12. Potential Improvements

### [ARCH-P01] Dual Prompt Engine Consolidation (`@clack/prompts` vs `@inquirer/prompts`)
- **Concern:** The project uses `@clack/prompts` for spinners, steps, and banners, but `@inquirer/prompts` for interactive selects, search menus, and raw text input.
- **Evaluation:** While both coexist without runtime conflict, consolidating to a single terminal interactive toolkit would reduce bundle size and provide a completely unified input experience.

### [ARCH-P02] Direct Singleton Exports vs Dependency Injection
- **Concern:** Singletons (`modrinthClient`, `instanceConfig`, `profileSnapshotManager`) are exported directly from modules.
- **Evaluation:** For a standalone CLI tool, module-level singletons are pragmatic and avoid unnecessary DI boilerplate. However, supporting constructor-injected configurations will improve test isolation for parallel test runs.

### [ARCH-P03] MultiMC Component Parser Loose Typing
- **Concern:** `InstanceDetector.scanPrismAndMultiMC()` inspects components with `(c: any) => c.uid`.
- **Evaluation:** Defining an explicit TypeScript interface or Zod schema for `mmc-pack.json` components would eliminate the need for `any` when inspecting MultiMC instance manifests.

---

## 13. Audit Scope, Assumptions & Limitations

1. **Scope:** Full-depth review was conducted across all 43 `.ts` files in `src/` and all 15 test files in `tests/`.
2. **Audit Mode Strictness:** In accordance with the AUDIT-ONLY protocol, zero modifications were made to application source code, tests, dependencies, or configuration. Only this audit report was written.
3. **Execution Context:** Verification was conducted on Node.js 24+ / Windows 11 using local offline fixtures and mocked API responses.
