# Contributing to LoadModer

Thank you for your interest in contributing to LoadModer (`lm`). We welcome bug reports, feature requests, and code contributions that adhere to our architectural and code quality standards.

---

## 1. Prerequisites

- **Node.js:** `>= 20.0.0` (ESM native)
- **Package Manager:** `npm` (bundled with Node.js)
- **Git**

---

## 2. Getting Started

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/2Hafast8/LoadModer.git
   cd LoadModer
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run local CLI in development mode:**
   ```bash
   npm run dev -- --help
   ```

---

## 3. Engineering Guidelines

LoadModer follows strict software engineering principles:

1. **Domain Decoupling:**
   - Modules in `src/core/` must **never** import terminal UI libraries (`@clack/prompts`, `@inquirer/prompts`, `figlet`, `boxen`).
   - Domain logic must remain pure and testable without simulating terminal prompts.

2. **Atomic Writes:**
   - Any state mutation writing to disk (`config.json`, `loadmoder.lock.json`, profile snapshots) must use `write-file-atomic` to prevent corruption during abrupt exits.

3. **Integrity Before Writes:**
   - Remote files must be downloaded to temporary `.part` paths and verified against streaming SHA-512 checksums before moving to final destinations.

4. **Strict Type Safety:**
   - Maintain 0 compiler errors under TypeScript strict mode.
   - Avoid `any`, unchecked casts, or empty handlers. Single sources of truth live in `src/types/`.

5. **Anti-Slop Copy & UI:**
   - Follow the Nordic Clean palette in `src/ui/theme.ts`.
   - Write direct, factual terminal copy without marketing fluff.

---

## 4. Verification Protocol (Mandatory Before PR)

Before committing or submitting a pull request, run all verification steps:

```bash
# 1. Type checking (must exit with 0 errors)
npx tsc --noEmit

# 2. Automated test suite (all tests must pass)
npm test

# 3. Production bundle validation
npm run build
```

---

## 5. Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(scope): ...` — New feature or capability
- `fix(scope): ...` — Bug fix
- `refactor(scope): ...` — Code change that neither fixes a bug nor adds a feature
- `perf(scope): ...` — Performance optimization
- `test(scope): ...` — Adding or correcting tests
- `docs(scope): ...` — Documentation updates
- `chore(scope): ...` — Tooling, dependencies, or configuration changes

---

## 6. Submitting a Pull Request

1. Create a feature branch: `git checkout -b feat/your-feature-name`.
2. Commit changes with clear, descriptive commit messages.
3. Ensure all tests and type checks pass.
4. Push your branch and open a Pull Request against `main`.
5. Complete the PR template checklist.
