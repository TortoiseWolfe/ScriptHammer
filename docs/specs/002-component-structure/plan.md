# Implementation Plan: Component Structure Standardization

**Branch**: `002-component-structure` | **Date**: 2025-09-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-component-structure/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Standardize all React components to follow a constitutional 4-file pattern (index.tsx, Component.tsx, Component.test.tsx, Component.stories.tsx). Create tooling for auditing, migrating, and enforcing this structure through scripts and CI validation.

## Technical Context

**Language/Version**: TypeScript 5.x / React 19.1.0
**Primary Dependencies**: Next.js 15.5.2, Vitest, Storybook, Plop
**Storage**: N/A (file system only)
**Testing**: Vitest + React Testing Library
**Target Platform**: Web (Node.js build environment)
**Project Type**: web - frontend tooling
**Performance Goals**: Instant audit (<1s for 100 components)
**Constraints**: Zero runtime impact, build-time only
**Scale/Scope**: ~50-100 components in typical project

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Simplicity**:

- Projects: 1 (scripts directory with audit/migration tools)
- Using framework directly? YES (Node.js fs, no abstractions)
- Single data model? YES (component structure definition)
- Avoiding patterns? YES (direct file operations, no complex patterns)

**Architecture**:

- EVERY feature as library? YES (audit, migrate, validate as separate modules)
- Libraries listed:
  - audit-components: Analyze component structure compliance
  - migrate-components: Auto-fix non-compliant components
  - validate-structure: CI enforcement tool
- CLI per library: Each script supports --help, --json output
- Library docs: Will be included in scripts

**Testing (NON-NEGOTIABLE)**:

- RED-GREEN-Refactor cycle enforced? YES
- Git commits show tests before implementation? YES
- Order: Contract→Integration→E2E→Unit strictly followed? YES
- Real dependencies used? YES (actual file system)
- Integration tests for: new libraries, contract changes, shared schemas? YES
- FORBIDDEN: Implementation before test, skipping RED phase ✓

**Observability**:

- Structured logging included? YES (JSON reports)
- Frontend logs → backend? N/A (build tool only)
- Error context sufficient? YES (detailed error messages)

**Versioning**:

- Version number assigned? 1.0.0
- BUILD increments on every change? YES
- Breaking changes handled? N/A (first version)

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Option 2 (Web application) - frontend tooling scripts

## Phase 0: Outline & Research

✅ **COMPLETE** - See [research.md](./research.md)

Key decisions made:

- 4-file pattern confirmed (index, component, test, story)
- Node.js scripts with Plop scaffolding
- Automated migration with test stubs
- CI enforcement via pre-commit
- Directory-based component detection

All technical clarifications resolved, no unknowns remaining.

## Phase 1: Design & Contracts

✅ **COMPLETE** - All artifacts generated

Generated artifacts:

- [data-model.md](./data-model.md) - Component structure entities and validation rules
- [contracts/cli-api.yaml](./contracts/cli-api.yaml) - OpenAPI spec for CLI commands
- [quickstart.md](./quickstart.md) - Step-by-step implementation guide

Key design decisions:

- CLI-based tooling (audit, migrate, validate, scaffold)
- JSON/Markdown/Console output formats
- Automated migration with backup support
- CI-ready validation with exit codes

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:
The /tasks command will generate approximately 20-25 tasks following TDD principles:

1. **Test Tasks (RED phase)** - Create failing tests first:
   - Unit tests for audit-components module
   - Unit tests for migrate-components module
   - Unit tests for validate-structure module
   - Integration tests for full workflow

2. **Implementation Tasks (GREEN phase)** - Make tests pass:
   - Implement audit-components.js script
   - Implement migrate-components.js script
   - Implement validate-structure.js script
   - Create Plop templates and configuration

3. **Integration Tasks** - Wire everything together:
   - Update package.json scripts
   - Configure CI pipeline
   - Create VSCode snippets
   - Documentation updates

**Ordering Strategy**:

- Strict TDD: Every implementation task preceded by test task
- Dependencies first: Core scripts before Plop integration
- Parallel markers [P] for independent script development

**Estimated Output**: ~20-25 tasks with clear TDD progression

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

No violations - all constitutional principles followed ✅

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command) ✅
- [x] Phase 1: Design complete (/plan command) ✅
- [x] Phase 2: Task planning complete (/plan command - describe approach only) ✅
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS ✅
- [x] Post-Design Constitution Check: PASS ✅
- [x] All NEEDS CLARIFICATION resolved ✅
- [x] Complexity deviations documented (none needed) ✅

---

_Based on Constitution v2.1.1 - See `/memory/constitution.md`_
