# Constitution Gap Analysis

**Date**: 2026-01-15
**Role**: Developer
**Scope**: Component generator, 5-file pattern, Docker dev environment

## Executive Summary

The constitution defines mature development practices that do not yet exist in the codebase. ScriptHammer is a planning template with 46 feature specs but no application code. The constitution reads as if enforcement mechanisms are in place, but implementation gaps exist in all three focus areas.

## Gap Analysis

### 1. Component Generator Script

| Aspect            | Constitution States                                     | Actual State             |
| ----------------- | ------------------------------------------------------- | ------------------------ |
| Generator command | `pnpm run generate:component`                           | Does not exist           |
| Script location   | Implied in root package.json                            | No root package.json     |
| Enforcement       | "No exceptions - manual creation causes build failures" | No enforcement mechanism |

**Files searched**: `**/generate*.{js,ts,sh}` - 0 results

**Impact**: HIGH - Constitution claims manual component creation "will cause build failures" but no validation exists.

**Recommendation**: Create generator script before first component implementation:

```
scripts/
├── generate-component.ts    # Scaffolds 5-file structure
└── templates/
    └── component/
        ├── index.tsx.template
        ├── Component.tsx.template
        ├── Component.test.tsx.template
        ├── Component.stories.tsx.template
        └── Component.accessibility.test.tsx.template
```

### 2. 5-File Component Pattern

| Aspect            | Constitution States                                | Actual State                 |
| ----------------- | -------------------------------------------------- | ---------------------------- |
| Required files    | index.tsx, Component.tsx, test, stories, a11y test | No components exist          |
| Example structure | Not specified                                      | No example to copy           |
| CI validation     | "Enforced via CI/CD pipeline validation"           | No such validation in ci.yml |
| Husky hooks       | "Tests run on pre-push via Husky hooks"            | No .husky directory          |

**Files searched**: `src/**/*.tsx` - 0 results

**Current CI jobs** (from `.github/workflows/ci.yml`):

- `lint` - pre-commit hooks (markdown, yaml, shell, ruff)
- `validate-wireframes` - SVG validation only
- `yaml-lint` - YAML syntax
- `markdown-lint` - Markdown syntax
- `shellcheck` - Shell scripts

**Missing CI jobs**:

- TypeScript compilation
- Component structure validation
- Unit test execution (Vitest)
- E2E test execution (Playwright)
- Accessibility test execution (Pa11y)
- Test coverage enforcement (25% minimum)
- Storybook build verification

**Impact**: MEDIUM - No code exists yet, so no immediate enforcement needed. However, constitution language implies existing enforcement.

**Recommendation**: Add placeholder CI jobs that activate when `src/` directory is created:

```yaml
component-validation:
  if: contains(github.event.commits[*].added, 'src/')
  # ... validation logic
```

### 3. Docker Dev Environment

| Aspect              | Constitution States                                     | Actual State                  |
| ------------------- | ------------------------------------------------------- | ----------------------------- |
| Primary environment | "Docker Compose is the primary development environment" | Partial - wireframes only     |
| Local installs      | "FORBIDDEN"                                             | pre-commit requires local pip |
| Container commands  | "All commands run inside Docker containers"             | CI uses ubuntu-latest native  |
| Git hooks           | "must run from inside containers"                       | No containerized hook setup   |

**Existing Docker configurations**:

| File                                        | Purpose               | Scope              |
| ------------------------------------------- | --------------------- | ------------------ |
| `.speckit/docker-compose.yml`               | Python SpecKit tools  | Minimal (11 lines) |
| `docs/design/wireframes/docker-compose.yml` | SVG viewer + review   | Wireframes only    |
| `docs/design/wireframes/Dockerfile.review`  | Wireframe screenshots | Wireframes only    |

**Missing Docker configurations**:

- No `docker-compose.yml` at project root for main application
- No `Dockerfile` for Next.js development
- No `Dockerfile` for production build
- No containerized CI pipeline (uses native runners)

**Constitution vs Reality**:

```
Constitution says:                    Reality:
─────────────────────────────────────────────────────
pnpm/npm installs FORBIDDEN           CI runs: pip install pre-commit ruff
Git commits inside containers         No container hook setup
Docker Compose primary env            No main app docker-compose
```

**Impact**: HIGH - Constitution principle is unenforceable. Developers will naturally use local tools.

**Recommendation**: Create root docker-compose.yml before implementation begins:

```yaml
services:
  dev:
    image: node:20-alpine
    volumes:
      - .:/app
    working_dir: /app
    command: pnpm dev
    ports:
      - '3000:3000'

  test:
    image: mcr.microsoft.com/playwright:v1.40.0
    volumes:
      - .:/app
    working_dir: /app
    command: pnpm test

  lint:
    image: node:20-alpine
    volumes:
      - .:/app
    working_dir: /app
    command: pnpm lint
```

## Summary Table

| Area                       | Gap Severity | Blocking for Implementation?            |
| -------------------------- | ------------ | --------------------------------------- |
| Component Generator        | HIGH         | YES - must exist before first component |
| 5-File Pattern Enforcement | MEDIUM       | NO - can add incrementally              |
| Docker Environment         | HIGH         | YES - constitution mandates it          |

## Recommended Priority Order

1. **Create root docker-compose.yml** - Foundation for Docker-first development
2. **Create component generator script** - Required before any component work
3. **Add 5-file validation to CI** - Can follow first component creation
4. **Containerize CI pipeline** - Can be phased in

## Constitution Amendment Suggestion

Consider revising Section I language from:

> "This structure is enforced via CI/CD pipeline validation. Use the component generator (`pnpm run generate:component`) to ensure compliance. No exceptions are permitted - manual component creation will cause build failures."

To:

> "This structure WILL BE enforced via CI/CD pipeline validation once implementation begins. The component generator (`pnpm run generate:component`) MUST be created as part of the first implementation task."

This accurately reflects the planning-phase status of the project.

## Related Audits

- `2026-01-15-devops-infrastructure.md` - Infrastructure timeline
- `2026-01-14-organizational-review.md` - Organizational structure

---

_Audit generated by Developer terminal_
