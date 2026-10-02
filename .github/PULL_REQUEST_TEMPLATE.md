## Description

Please include a summary of the change, relevant motivation, and context.

Fixes #(issue)

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update
- [ ] Refactoring / Performance improvement

## Architectural & Engineering Checklist

- [ ] My code adheres to the project's domain decoupling rules (`src/core/` does not import UI libraries).
- [ ] State-mutating disk writes use `write-file-atomic`.
- [ ] Remote downloads use temporary `.part` paths with streaming SHA-512 verification.
- [ ] My changes generate zero compiler warnings or errors (`npx tsc --noEmit`).
- [ ] I have added automated tests that prove my fix is effective or that my feature works.
- [ ] All tests pass locally (`npm test`).
- [ ] Production build succeeds (`npm run build`).
