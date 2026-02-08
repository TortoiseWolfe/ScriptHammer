# DEC-006: Constitution Planning Phase Amendments

**Date**: 2026-01-15
**RFC**: RFC-006
**Status**: active

## Stakeholder Votes

| Stakeholder   | Vote    | Date       |
| ------------- | ------- | ---------- |
| CTO           | approve | 2026-01-15 |
| Architect     | approve | 2026-01-15 |
| Security Lead | approve | 2026-01-15 |
| Toolsmith     | approve | 2026-01-15 |
| DevOps        | approve | 2026-01-15 |
| Product Owner | approve | 2026-01-15 |

**Result**: Unanimous approval (6-0)

## Decision

Amend the constitution (v1.0.0 → v1.1.0) to reflect ScriptHammer's planning-phase status:

1. **Part A**: Change present-tense enforcement language to future-tense
   - Section I: "IS enforced" → "WILL BE enforced once implementation begins"
   - Section IV: "Local installs FORBIDDEN" → "WILL BE forbidden once Docker infrastructure complete"

2. **Part B**: Define infrastructure prerequisites that MUST exist before first component:
   - B1: Root `docker-compose.yml` with dev, test, lint, storybook services
   - B2: Component generator script (`scripts/generate-component.ts`)
   - B3: CI activation triggers (jobs that activate when `src/` folder exists)

3. **Part C**: Establish dependency chain for infrastructure work

## Rationale

The `2026-01-15-constitution-gaps.md` audit identified three HIGH-severity gaps where the constitution describes enforcement mechanisms that do not exist:

| Constitution Claims                                        | Reality                                  |
| ---------------------------------------------------------- | ---------------------------------------- |
| "`pnpm run generate:component`" command exists             | No generator script or root package.json |
| "This structure is enforced via CI/CD pipeline validation" | No component structure validation in CI  |
| "Docker Compose is the primary development environment"    | No root docker-compose.yml               |

Risks of unamended constitution:

- Misleading documentation for new contributors
- Implementation blockers (no generator, no validation)
- "Works on my machine" inconsistencies
- Failed quality gates

## Dissenting Views

None recorded.

## Impact

| Area                 | Impact                                                   | Mitigation                          |
| -------------------- | -------------------------------------------------------- | ----------------------------------- |
| Constitution         | Language change from present to future tense             | Clear versioning (1.1.0)            |
| Timeline             | ~5 sessions of infrastructure work before implementation | Can parallelize with wireframe work |
| CI/CD                | 3 new jobs (conditional activation)                      | Jobs skip if no src/ folder         |
| Development workflow | Docker-first enforced after infrastructure               | Transition period defined           |

**Affected Terminals**:

| Terminal  | Action Required                                            |
| --------- | ---------------------------------------------------------- |
| DevOps    | Create docker-compose.yml, add CI jobs, setup package.json |
| Toolsmith | Create component generator script                          |
| Auditor   | Update constitution.md after approval                      |
| Developer | Use Docker environment, use generator for components       |

## Implementation

- [ ] DevOps: Create root `docker-compose.yml` with required services
- [ ] Toolsmith: Create `scripts/generate-component.ts` with 5-file templates
- [ ] DevOps: Add CI activation jobs to `.github/workflows/ci.yml`
- [ ] DevOps: Create root `package.json` with scripts
- [ ] Auditor: Update `.specify/memory/constitution.md` to v1.1.0
- [ ] Author: Announce via `/broadcast`

**Dependency Chain**:

```
1. docker-compose.yml (DevOps)
       ↓
2. component generator (Toolsmith)
       ↓
3. CI activation jobs (DevOps)
       ↓
4. package.json (DevOps)
       ↓
5. constitution v1.1.0 (Auditor)
       ↓
6. first component implementation (Developer)
```
