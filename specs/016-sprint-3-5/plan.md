# Implementation Plan: Sprint 3.5 - Technical Debt Reduction

**Branch**: `016-sprint-3-5` | **Date**: 2025-09-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/016-sprint-3-5/spec.md`

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

Sprint 3.5 focuses on eliminating accumulated technical debt before advancing to Sprint 4 features. The sprint targets 11 specific debt items across Critical, High, and Medium priorities, including Next.js workarounds, test failures, Storybook issues, and configuration complexity. All fixes must be implemented without breaking existing functionality while maintaining test coverage at 58%+.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 15.5.2, React 19.1.0
**Primary Dependencies**: Next.js, React, Vitest, Storybook 8, Playwright, Pa11y, Leaflet
**Storage**: N/A (technical debt fixes only)
**Testing**: Vitest for unit/integration, Playwright for E2E, Pa11y for accessibility
**Target Platform**: Static export for GitHub Pages and various hosting providers
**Project Type**: web (Next.js App Router with static export)
**Performance Goals**: Lighthouse score >90, First Load JS <90KB (from current 102KB)
**Constraints**: Must maintain backward compatibility, no breaking changes to public APIs
**Scale/Scope**: 11 technical debt items across build, test, and configuration systems

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Simplicity**: ✅

- Projects: 1 (CRUDkit monorepo with technical debt fixes)
- Using framework directly? Yes (Next.js, React, Vitest used directly)
- Single data model? N/A (no new data models, debt fixes only)
- Avoiding patterns? Yes (removing workarounds and complexity)

**Architecture**: ✅ (for debt reduction sprint)

- EVERY feature as library? N/A (fixing existing code, not adding features)
- Libraries listed: N/A (technical debt fixes in existing libraries)
- CLI per library: Using existing pnpm scripts for all operations
- Library docs: Will update existing documentation for fixes

**Testing (NON-NEGOTIABLE)**: ✅

- RED-GREEN-Refactor cycle enforced? Yes (fixing failing tests first)
- Git commits show tests before implementation? Yes (fix tests, then code)
- Order: Contract→Integration→E2E→Unit strictly followed? Yes where applicable
- Real dependencies used? Yes (actual browser for E2E, real contexts for Storybook)
- Integration tests for: N/A (fixing existing test failures)
- FORBIDDEN: No implementation before fixing tests

**Observability**: ✅

- Structured logging included? Maintaining existing logging
- Frontend logs → backend? N/A (static site, no backend)
- Error context sufficient? Yes (improving error messages in fixes)

**Versioning**: ✅

- Version number assigned? 0.3.5 for this sprint
- BUILD increments on every change? Yes (following semver)
- Breaking changes handled? None (backward compatibility maintained)

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

**Structure Decision**: Option 2 (Web application - Next.js with App Router)

## Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `/scripts/bash/update-agent-context.sh claude` for your AI assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/\*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:

- Load `/templates/tasks-template.md` as base
- Generate tasks from technical debt priorities in CONSTITUTION.md
- Critical items → immediate tasks (Week 1)
- High priority items → following tasks (Week 1-2)
- Medium priority items → final tasks (Week 2-3)

**Task Categories**:

1. **Build System Fixes**: Next.js workarounds, manifest generation
2. **Test Fixes**: Offline queue, Storybook stories
3. **Documentation**: Security headers, deployment guides
4. **Optimization**: Bundle size, lazy loading
5. **CI/CD**: E2E test integration, automated validation

**Ordering Strategy**:

- Priority order: Critical → High → Medium
- Dependency order: Build fixes before test fixes
- Documentation can be parallel [P]
- Mark [P] for parallel execution (independent tasks)

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none needed)

---

_Based on Constitution v2.1.1 - See `/memory/constitution.md`_
