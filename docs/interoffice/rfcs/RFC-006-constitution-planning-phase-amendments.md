# RFC-006: Constitution Planning Phase Amendments

**Status**: decided
**Author**: Architect
**Created**: 2026-01-15
**Target Decision**: 2026-01-17

## Stakeholders (Consensus Required)

| Stakeholder   | Vote    | Date       |
| ------------- | ------- | ---------- |
| CTO           | approve | 2026-01-15 |
| Architect     | approve | 2026-01-15 |
| Security Lead | approve | 2026-01-15 |
| Toolsmith     | approve | 2026-01-15 |
| DevOps        | approve | 2026-01-15 |
| Product Owner | approve | 2026-01-15 |

**Votes**: approve | reject | abstain
**Required for Decision**: All non-abstaining stakeholders must approve

---

## Summary

The constitution (v1.0.0, ratified 2025-12-29) describes enforcement mechanisms that do not exist in the codebase. ScriptHammer is a **planning template** with 46 feature specs but no application code. This RFC proposes amendments to align constitutional language with the project's planning-phase status and establishes concrete prerequisites for implementation.

---

## Motivation

### Gap Analysis Reference

The `2026-01-15-constitution-gaps.md` audit identified three HIGH-severity gaps:

| Constitution Claims                                        | Reality                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| "`pnpm run generate:component`" command exists             | No generator script or root package.json                 |
| "This structure is enforced via CI/CD pipeline validation" | No component structure validation in CI                  |
| "Docker Compose is the primary development environment"    | No root docker-compose.yml; CI uses ubuntu-latest native |
| "Local pnpm/npm installs are FORBIDDEN"                    | CI runs `pip install pre-commit ruff`                    |

### Risk of Unamended Constitution

1. **Misleading documentation** - New contributors expect infrastructure that doesn't exist
2. **Implementation blockers** - First component creator has no generator, no validation
3. **Inconsistent environment** - Developers will use local tools, creating "works on my machine" issues
4. **Failed quality gates** - Constitution promises enforcement that can't be delivered

---

## Proposal

### Part A: Constitution Language Amendments

Amend constitution sections to reflect planning-phase status with future-tense language.

#### Section I (Component Structure) - Current:

> "This structure is enforced via CI/CD pipeline validation. Use the component generator (`pnpm run generate:component`) to ensure compliance. No exceptions are permitted - manual component creation will cause build failures."

#### Section I - Proposed:

> "This structure **WILL BE** enforced via CI/CD pipeline validation once implementation begins. The component generator (`pnpm run generate:component`) **MUST be created** as the first implementation task per RFC-006. After activation, no exceptions are permitted - manual component creation will cause build failures."

#### Section IV (Docker-First) - Current:

> "Docker Compose is the primary development environment to ensure consistency across all developers. Local pnpm/npm installs are FORBIDDEN."

#### Section IV - Proposed:

> "Docker Compose **WILL BE** the primary development environment to ensure consistency across all developers. Local pnpm/npm installs **WILL BE** forbidden once the root `docker-compose.yml` is created per RFC-006. **Planning phase tools** (Python pre-commit hooks, SVG viewer) may use local installs until Docker infrastructure is complete."

---

### Part B: Infrastructure Prerequisites

Define the infrastructure that MUST exist before the first component is implemented.

#### B1: Root docker-compose.yml Structure

**Location**: `/docker-compose.yml`

**Purpose**: Primary development environment for all terminals

**Required Services**:

```yaml
# Minimum viable docker-compose.yml
version: '3.8'

services:
  # Development server
  dev:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - .:/app
      - node_modules:/app/node_modules
    command: pnpm dev
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=development

  # Test runner (Vitest + Playwright)
  test:
    image: mcr.microsoft.com/playwright:v1.40.0-jammy
    working_dir: /app
    volumes:
      - .:/app
      - node_modules:/app/node_modules
    command: pnpm test
    environment:
      - CI=true

  # Linting and type checking
  lint:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - .:/app
      - node_modules:/app/node_modules
    command: pnpm lint

  # Storybook for component documentation
  storybook:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - .:/app
      - node_modules:/app/node_modules
    command: pnpm storybook
    ports:
      - '6006:6006'

volumes:
  node_modules:
```

**Acceptance Criteria**:

- [ ] `docker compose up dev` starts Next.js dev server on localhost:3000
- [ ] `docker compose run test` executes Vitest unit tests
- [ ] `docker compose run lint` runs ESLint + TypeScript checks
- [ ] `docker compose up storybook` starts Storybook on localhost:6006

---

#### B2: Component Generator Script

**Location**: `scripts/generate-component.ts`

**Purpose**: Scaffold 5-file component structure

**Template Structure**:

```
scripts/
├── generate-component.ts    # Main generator script
└── templates/
    └── component/
        ├── index.tsx.template
        ├── Component.tsx.template
        ├── Component.test.tsx.template
        ├── Component.stories.tsx.template
        └── Component.accessibility.test.tsx.template
```

**Usage**:

```bash
# Inside Docker container
pnpm run generate:component ButtonPrimary --path src/components/buttons

# Creates:
# src/components/buttons/ButtonPrimary/
# ├── index.tsx
# ├── ButtonPrimary.tsx
# ├── ButtonPrimary.test.tsx
# ├── ButtonPrimary.stories.tsx
# └── ButtonPrimary.accessibility.test.tsx
```

**Acceptance Criteria**:

- [ ] Generator creates all 5 files with proper boilerplate
- [ ] Generated files pass TypeScript compilation
- [ ] Generated test file has placeholder test that passes
- [ ] Generated story file renders in Storybook
- [ ] Script validates component name (PascalCase, no reserved words)

---

#### B3: CI Activation Triggers

**Purpose**: Component validation activates when `src/` directory is created

**Implementation in `.github/workflows/ci.yml`**:

```yaml
# New job: component-structure-validation
component-validation:
  name: Component Structure Validation
  runs-on: ubuntu-latest
  # Only run when src/ folder exists
  if: |
    hashFiles('src/**/*.tsx') != '' ||
    hashFiles('src/**/*.ts') != ''
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Validate 5-file pattern
      run: |
        python scripts/validate-component-structure.py --all
      # Phase 1: Soft-fail during initial implementation
      continue-on-error: true

# New job: typescript-build
typescript-build:
  name: TypeScript Build
  runs-on: ubuntu-latest
  if: hashFiles('src/**/*.tsx') != ''
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Node
      uses: actions/setup-node@v4
      with:
        node-version: '20'

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Type check
      run: pnpm tsc --noEmit

    - name: Build
      run: pnpm build

# New job: test-coverage
test-execution:
  name: Test Suite
  runs-on: ubuntu-latest
  if: hashFiles('src/**/*.test.tsx') != ''
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Node
      uses: actions/setup-node@v4
      with:
        node-version: '20'

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Run tests
      run: pnpm test -- --coverage

    - name: Check coverage threshold
      run: |
        # Enforce 25% minimum coverage
        pnpm test -- --coverage --coverageReporters=json-summary
        COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
        if (( $(echo "$COVERAGE < 25" | bc -l) )); then
          echo "Coverage $COVERAGE% below 25% threshold"
          exit 1
        fi
```

**Activation Conditions**:

| Job                  | Activates When             | Enforcement Phase                                 |
| -------------------- | -------------------------- | ------------------------------------------------- |
| component-validation | `src/**/*.tsx` exists      | Soft-fail → Hard-fail (RFC timeline)              |
| typescript-build     | `src/**/*.tsx` exists      | Hard-fail from start                              |
| test-execution       | `src/**/*.test.tsx` exists | Soft-fail on coverage, hard-fail on test failures |

---

### Part C: Implementation Dependency Chain

The following MUST be completed BEFORE the first feature implementation:

```
1. Create root docker-compose.yml (DevOps)
       ↓
2. Create component generator script (Toolsmith)
       ↓
3. Add CI activation jobs (DevOps)
       ↓
4. Create root package.json with scripts (DevOps)
       ↓
5. Amend constitution.md with approved language (Auditor)
       ↓
6. Begin first component implementation (Developer)
```

**Estimated Work**:

| Task                    | Owner     | Complexity                   |
| ----------------------- | --------- | ---------------------------- |
| Root docker-compose.yml | DevOps    | Medium (1 session)           |
| Component generator     | Toolsmith | Medium (2 sessions)          |
| CI activation jobs      | DevOps    | Low (1 session)              |
| Package.json setup      | DevOps    | Low (1 session)              |
| Constitution amendment  | Auditor   | Trivial (after RFC approval) |

---

## Alternatives Considered

### Alternative A: Create Infrastructure in Parallel with Implementation

Start implementation immediately; create infrastructure as we go.

**Rejected because**:

- First component creator has no generator or validation
- Inconsistent approaches between terminals
- Constitution violations from Day 1

### Alternative B: Remove Enforcement Language from Constitution

Treat constitution as aspirational guidelines, not enforceable rules.

**Rejected because**:

- Undermines constitutional authority
- Quality standards become optional
- No accountability for compliance

### Alternative C: Block All Implementation Until Full Infrastructure

Wait for complete CI/CD, Docker, and generator setup before any code.

**Rejected because**:

- Excessive delay for simple first steps
- Can iterate on infrastructure alongside early implementation
- Activation triggers allow phased rollout

---

## Impact Assessment

| Area                 | Impact                                                   | Mitigation                                  |
| -------------------- | -------------------------------------------------------- | ------------------------------------------- |
| Constitution         | Language change from present to future tense             | Clear versioning (1.1.0)                    |
| Timeline             | ~5 sessions of infrastructure work before implementation | Can parallelize with ongoing wireframe work |
| CI/CD                | 3 new jobs (conditional activation)                      | Jobs skip if no src/ folder                 |
| Documentation        | CLAUDE.md may need updates                               | Author terminal handles                     |
| Development workflow | Docker-first enforced after infrastructure               | Transition period defined                   |

**Affected Terminals**:

| Terminal  | Action Required                                            |
| --------- | ---------------------------------------------------------- |
| DevOps    | Create docker-compose.yml, add CI jobs, setup package.json |
| Toolsmith | Create component generator script                          |
| Auditor   | Update constitution.md after approval                      |
| Developer | Use Docker environment, use generator for components       |
| All       | Adopt Docker workflow after infrastructure is ready        |

---

## Discussion Thread

### Architect (2026-01-15) - Initial Proposal

The constitution gaps audit revealed a fundamental disconnect: our constitution describes a mature development environment that doesn't exist. This isn't unusual for spec-first projects - we documented our target state before implementing infrastructure.

The proposal takes a pragmatic approach:

1. **Amend language** to reflect reality (planning phase) while preserving intent (enforcement will come)
2. **Define prerequisites** so implementation can proceed with proper foundation
3. **Establish activation triggers** so CI scales with the codebase

Key architectural decisions embedded in this RFC:

- **Docker-first is non-negotiable** - Constitution Principle IV is correct; we just need the infrastructure
- **Activation triggers preserve CI performance** - Empty jobs on spec-only PRs waste time
- **Generator before components** - Consistent structure from Day 1 prevents technical debt

I recommend council approval to unblock implementation planning while maintaining constitutional integrity.

---

### CTO (2026-01-15)

**Vote: APPROVE**

This RFC addresses a critical governance gap. The constitution should reflect reality while preserving our target state.

Key observations:

1. **Honest documentation prevents confusion** - New contributors deserve accurate expectations
2. **Phased activation is pragmatic** - We don't need full infrastructure for planning work
3. **Prerequisites before implementation is correct** - Foundation must exist before building

The dependency chain (docker-compose → generator → CI → package.json → constitution amendment) is well-ordered.

---

### Security Lead (2026-01-15)

**Vote: APPROVE**

From a security perspective:

1. **Constitution integrity matters** - False enforcement claims create a false sense of security
2. **Planning phase exception is reasonable** - Python pre-commit tools are low-risk for spec work
3. **Docker-first remains the goal** - Once implementation begins, container isolation is mandatory

Note: The "planning phase tools" exception should be narrowly scoped. Only pre-commit hooks and wireframe viewer qualify.

---

### Toolsmith (2026-01-15)

**Vote: APPROVE**

Implementation assessment for my deliverables:

1. **Component generator is achievable** - Will scaffold 5-file pattern with proper templates
2. **2 sessions estimate is realistic** - Template files + validation logic + CLI wrapper
3. **TypeScript generator preferred** - Aligns with project stack

Will begin work immediately upon RFC decision.

---

### DevOps (2026-01-15)

**Vote: APPROVE**

Infrastructure work breakdown:

1. **Root docker-compose.yml** - 1 session, straightforward
2. **CI activation jobs** - 1 session, `hashFiles()` conditionals are well-documented
3. **Package.json setup** - 1 session, standard Next.js configuration

Total: 3 sessions of DevOps work before implementation can begin. Reasonable.

Note: CI jobs use native runners until we have a containerized pipeline. This is acceptable for Phase 2.

---

### Product Owner (2026-01-15)

**Vote: APPROVE**

From a product perspective:

1. **Unblocking implementation is critical** - P0 features are approved (RFC-005), we need infrastructure
2. **Constitution amendments preserve intent** - We're not weakening standards, just acknowledging reality
3. **Clear dependency chain helps planning** - I can communicate timeline to stakeholders

Suggestion: Add "infrastructure sprint" milestone to track these prerequisites.

---

## Dissent Log

| Stakeholder | Objection | Response |
| ----------- | --------- | -------- |
| -           | -         | -        |

---

## Decision Record

**Decided**: 2026-01-15
**Outcome**: approved
**Decision ID**: DEC-006
