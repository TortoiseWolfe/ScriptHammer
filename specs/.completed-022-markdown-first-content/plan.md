# Implementation Plan: Complete Blog System with Markdown Content Pipeline

**Branch**: `022-markdown-first-content` | **Date**: 2025-01-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/022-markdown-first-content/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Build a brand new blog system from scratch with markdown-first content architecture, hot reloading, social features, and offline-first capabilities. Creates a complete content pipeline that processes markdown files at build time and runtime, implements offline editing with IndexedDB, adds social sharing with author profiles, and provides automatic content synchronization with conflict resolution. This is a greenfield implementation with no existing blog infrastructure.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 20+ LTS
**Primary Dependencies**: Next.js 15.5, React 19, Tailwind CSS 4, DaisyUI, Dexie.js (IndexedDB), LZ-String (compression), markdown-to-jsx
**Storage**: IndexedDB for offline blog editing, localStorage for preferences, Service Worker for PWA caching
**Testing**: Vitest, Playwright, Pa11y, React Testing Library, MSW for API mocking
**Target Platform**: Static export, PWA-capable, all modern browsers with Service Worker support
**Project Type**: web (Next.js App Router with static export and offline-first blog system)
**Performance Goals**: Lighthouse 90+, FCP <2s, TTI <3.5s, CLS <0.1, Hot reload <500ms
**Constraints**: Bundle <150KB first load, WCAG AA compliant, offline-capable, 5MB text storage limit, 200MB image storage
**Scale/Scope**: Blog system with markdown processing, social features, author profiles, offline sync, conflict resolution

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### I. Component Structure Compliance

- [x] All components follow 5-file pattern (index, Component, test, stories, a11y)
- [x] Using `pnpm run generate:component` for new components
- [x] No manual component creation

### II. Test-First Development

- [x] Tests written before implementation (RED-GREEN-REFACTOR)
- [x] Minimum 25% unit test coverage
- [x] E2E tests for user workflows
- [x] Accessibility tests with Pa11y

### III. PRP Methodology

- [x] Following PRP workflow (spec → plan → tasks → implement)
- [x] Clear success criteria defined
- [x] Tracking from inception to completion

### IV. Docker-First Development

- [x] Docker Compose setup included
- [x] CI/CD uses containerized environments
- [x] Environment consistency maintained

### V. Progressive Enhancement

- [x] Core functionality works without JS (markdown static content)
- [x] PWA capabilities for offline support
- [x] Accessibility features included
- [x] Mobile-first responsive design

### VI. Privacy & Compliance First

- [x] GDPR compliance with consent system (no tracking without consent)
- [x] Analytics only after consent
- [x] Third-party services need modals (social platforms)
- [x] Privacy controls accessible

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

**Structure Decision**: Option 1 (Single project) - Next.js static export with integrated blog system

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
   - Run `.specify/scripts/bash/update-agent-context.sh claude` for your AI assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/\*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:

- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Build NEW blog system from scratch (no existing blog infrastructure)
- Each API endpoint → contract test task [P]
- Each entity → model creation task [P]
- Each UI page → component generation task
- Each user story → integration test task
- Implementation tasks to make tests pass

**Core Implementation Areas**:

1. **Markdown Processing Pipeline** (NEW)
   - File watcher setup
   - Markdown parser integration
   - Frontmatter extraction
   - HTML generation with caching

2. **IndexedDB Storage** (NEW)
   - Dexie.js setup and schema
   - Offline storage implementation
   - Sync queue management
   - Conflict detection logic

3. **Blog UI Components** (NEW)
   - Post list and cards
   - Post viewer with TOC
   - Editor interface
   - Author profiles
   - Social share buttons

4. **API Routes** (NEW)
   - CRUD operations for posts
   - Sync endpoints
   - Storage management
   - Share tracking

5. **Service Worker** (NEW)
   - Offline caching strategy
   - Background sync setup
   - PWA manifest updates

**Ordering Strategy**:

- TDD order: Tests before implementation
- Dependency order: Core libs → Models → Services → API → UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 40-50 numbered, ordered tasks in tasks.md (building from scratch)

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
- [x] All NEEDS CLARIFICATION resolved (resolved in spec phase)
- [x] Complexity deviations documented (none needed)

---

_Based on Constitution v2.1.1 - See `/memory/constitution.md`_
