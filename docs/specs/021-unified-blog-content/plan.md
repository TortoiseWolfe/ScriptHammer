# Implementation Plan: Unified Blog Content Pipeline

**Branch**: `021-unified-blog-content` | **Date**: 2025-09-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/021-unified-blog-content/spec.md`

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

Refactor the current dual-system blog architecture (separate markdown files and IndexedDB) into a unified, type-safe content pipeline that maintains offline-first capabilities while eliminating manual build steps. The solution will provide automatic file watching, hot reload in development, and bi-directional synchronization between static content and IndexedDB for offline editing.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 20+ LTS
**Primary Dependencies**: Next.js 15.5, React 19, Tailwind CSS 4, DaisyUI
**Content Processing**: Content Collections or enhanced markdown pipeline (TBD in research)
**Markdown Libraries**: gray-matter 4.0.3, markdown-to-jsx 7.7.13 (current), potential remark/rehype
**Storage**: IndexedDB via Dexie.js for offline, file system for static content
**Schema Validation**: Zod for frontmatter and content validation
**Testing**: Vitest, Playwright, Pa11y, React Testing Library
**Target Platform**: Static export, PWA-capable, all modern browsers
**Project Type**: web (Next.js App Router with static export)
**Performance Goals**: Lighthouse 90+, FCP <2s, TTI <3.5s, CLS <0.1
**Constraints**: Bundle <150KB first load, WCAG AA compliant, offline-capable, 50+ existing posts
**Scale/Scope**: Blog system with 50+ existing markdown posts, offline editing capability
**Clarifications Resolved** (via /clarify):

- TOC generation: Optional per post via frontmatter flag (FR-007)
- Conflict resolution: Manual three-way merge with UI (FR-010)
- Storage quota: Hybrid - compress first, then warn before deletion (FR-015)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### I. Component Structure Compliance

- [x] All components follow 5-file pattern (index, Component, test, stories, a11y)
- [x] Using `pnpm run generate:component` for new components
- [x] No manual component creation
- _Note: Blog system primarily backend/service focused, UI components already exist_

### II. Test-First Development

- [x] Tests written before implementation (RED-GREEN-REFACTOR)
- [x] Minimum 25% unit test coverage planned
- [x] E2E tests for user workflows (sync, conflict resolution)
- [x] Accessibility tests with Pa11y for blog UI

### III. PRP Methodology

- [x] Following PRP workflow (spec → plan → tasks → implement)
- [x] Clear success criteria defined in spec
- [x] Tracking from inception to completion

### IV. Docker-First Development

- [x] Docker Compose setup already in place
- [x] CI/CD uses containerized environments
- [x] Environment consistency maintained

### V. Progressive Enhancement

- [x] Core functionality works without JS (SSG markdown rendering)
- [x] PWA capabilities for offline support (primary feature)
- [x] Accessibility features included
- [x] Mobile-first responsive design

### VI. Privacy & Compliance First

- [x] GDPR compliance maintained (no new data collection)
- [x] No analytics changes
- [x] No new third-party services
- [x] Privacy controls unchanged

## Project Structure

### Documentation (this feature)

```
specs/021-unified-blog-content/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
# Current structure (Option 1: Single project)
src/
├── lib/
│   └── blog/           # Core blog libraries
│       ├── database.ts # IndexedDB via Dexie
│       ├── markdown-loader.ts # Current markdown processing
│       ├── sync.ts    # Sync logic
│       └── [new files for unified pipeline]
├── services/
│   └── blog/           # Blog business logic
│       ├── post-service.ts
│       ├── offline-service.ts
│       └── [enhanced services]
├── app/
│   └── blog/           # Next.js blog pages
└── scripts/            # Build-time scripts
    └── generate-blog-data.js # Current generation script

tests/
├── contract/           # API contract tests
├── integration/        # Blog sync integration tests
└── unit/              # Library unit tests
```

**Structure Decision**: Option 1 (Single project) - Matches existing architecture

## Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - Research Content Collections vs enhanced markdown pipeline approach
   - Best practices for bi-directional file system ↔ IndexedDB sync
   - Conflict resolution strategies for distributed editing
   - Incremental build strategies for markdown content
   - File watching and hot reload integration with Next.js
   - Storage quota management strategies

2. **Generate and dispatch research agents**:

   ```
   Task: "Research Content Collections for Next.js 15 with TypeScript"
   Task: "Find best practices for bi-directional sync between file system and IndexedDB"
   Task: "Research conflict resolution patterns for offline-first applications"
   Task: "Investigate incremental build strategies for markdown in Next.js"
   Task: "Research file watching and hot reload for static content in Next.js"
   Task: "Find storage quota management patterns for IndexedDB"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

1. **Extract entities from feature spec** → `data-model.md`:
   - BlogPost: Enhanced with sync metadata
   - PostMetadata: Validation schema with Zod
   - SyncQueue: Bi-directional sync tracking
   - ContentVersion: Version tracking for conflicts
   - ProcessingCache: Cache invalidation strategy
   - ContentSource: Unified source abstraction

2. **Generate API contracts** from functional requirements:
   - POST /api/blog/sync - Sync offline changes
   - GET /api/blog/posts - Retrieve posts with cache headers
   - POST /api/blog/validate - Validate frontmatter
   - POST /api/blog/process - Process markdown to HTML
   - GET /api/blog/conflicts - Retrieve conflict list
   - POST /api/blog/resolve - Resolve conflicts
   - Output OpenAPI schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Schema validation tests
   - Error case tests
   - Tests must fail initially

4. **Extract test scenarios** from user stories:
   - Auto-reload on markdown file change
   - Offline edit and sync scenario
   - Conflict detection and resolution
   - Migration of 50+ posts
   - Large post handling

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
   - Add Content Collections or enhanced pipeline decision
   - Add sync architecture notes
   - Update recent changes
   - Output to repository root

**Output**: data-model.md, /contracts/\*, failing tests, quickstart.md, CLAUDE.md updates

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:

- Research implementation tasks (setup chosen solution)
- Migration tasks for existing 50+ posts
- Sync service implementation tasks
- File watcher integration tasks
- Contract test implementation [P]
- Integration test implementation
- UI updates for conflict resolution
- Performance optimization tasks

**Ordering Strategy**:

- TDD order: Tests before implementation
- Dependencies: Core libraries → Services → UI → Migration
- Mark [P] for parallel execution where possible

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking

_No constitution violations identified - unified pipeline aligns with all principles_

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
- [x] All NEEDS CLARIFICATION resolved (in research phase)
- [x] Complexity deviations documented (none needed)

---

_Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`_
