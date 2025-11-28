# Tasks: Unified Blog Content Pipeline

**Input**: Design documents from `/specs/021-unified-blog-content/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)

```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

- **CRUDkit Structure**: `src/app/`, `src/components/`, `src/lib/`, `src/services/`, `src/tests/`
- **Blog Libraries**: `src/lib/blog/`
- **Blog Services**: `src/services/blog/`
- **API Routes**: `src/app/api/blog/`
- **Tests**: `src/tests/contract/`, `src/tests/integration/`, `src/tests/unit/`

## Phase 3.1: Setup & Dependencies

- [x] T001 Verify feature branch `021-unified-blog-content` is checked out
- [x] T002 Install new dependencies: `docker compose exec scripthammer pnpm add chokidar remark remark-html rehype-highlight crypto-js`
- [x] T003 Install dev dependencies: `docker compose exec scripthammer pnpm add -D @types/crypto-js @types/chokidar`
- [x] T004 [P] Create backup of existing blog posts: `cp -r blog blog.backup-$(date +%Y%m%d)`
- [x] T005 [P] Update TypeScript config to include new type definitions

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests

- [ ] T006 [P] Create contract test for sync endpoint: `src/tests/contract/blog-sync.test.ts`
- [ ] T007 [P] Create contract test for posts endpoint: `src/tests/contract/blog-posts-get.test.ts`
- [ ] T008 [P] Create contract test for validate endpoint: `src/tests/contract/blog-validate.test.ts`
- [ ] T009 [P] Create contract test for process endpoint: `src/tests/contract/blog-process.test.ts`
- [ ] T010 [P] Create contract test for conflicts endpoint: `src/tests/contract/blog-conflicts.test.ts`
- [ ] T011 [P] Create contract test for resolve endpoint: `src/tests/contract/blog-resolve.test.ts`

### Integration Tests

- [ ] T012 [P] Create auto-generation test: `src/tests/integration/auto-generation.test.ts`
- [ ] T013 [P] Create offline sync test: `src/tests/integration/offline-sync.test.ts`
- [ ] T014 [P] Create conflict detection test: `src/tests/integration/conflict-detection.test.ts`
- [ ] T015 [P] Create migration test: `src/tests/integration/migration.test.ts`
- [ ] T016 [P] Create enhanced processing test: `src/tests/integration/enhanced-processing.test.ts`

### Unit Tests

- [ ] T017 [P] Create file watcher tests: `src/tests/unit/file-watcher.test.ts`
- [ ] T018 [P] Create markdown processor tests: `src/tests/unit/markdown-processor.test.ts`
- [ ] T019 [P] Create sync service tests: `src/tests/unit/sync-service.test.ts`
- [ ] T020 [P] Create conflict resolver tests: `src/tests/unit/conflict-resolver.test.ts`

### Edge Case Tests

- [ ] T020a [P] Create malformed frontmatter handler test: `src/tests/unit/frontmatter-validator.test.ts`
- [ ] T020b [P] Create large post performance test: `src/tests/unit/large-post-handler.test.ts`
- [ ] T020c [P] Create migration failure recovery test: `src/tests/unit/migration-recovery.test.ts`

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models & Types

- [ ] T021 [P] Update BlogPost type with sync metadata: `src/types/blog.ts`
- [ ] T022 [P] Create PostMetadata Zod schema: `src/schemas/blog-metadata.ts`
- [ ] T023 [P] Create SyncQueueItem type: `src/types/sync.ts`
- [ ] T024 [P] Create ContentVersion type: `src/types/version.ts`
- [ ] T025 [P] Create ConflictResolution type: `src/types/conflict.ts`

### Core Libraries

- [ ] T026 Create enhanced markdown processor: `src/lib/blog/markdown-processor.ts`
- [ ] T027 Create file watcher service: `src/lib/blog/file-watcher.ts`
- [ ] T028 Create content hasher utility: `src/lib/blog/content-hash.ts`
- [ ] T029 Create sync manager: `src/lib/blog/sync-manager.ts`
- [ ] T030 Create conflict detector: `src/lib/blog/conflict-detector.ts`
- [ ] T031 Create version tracker: `src/lib/blog/version-tracker.ts`
- [ ] T032 Create cache manager: `src/lib/blog/cache-manager.ts`
- [ ] T033 Update database schema for new fields: `src/lib/blog/database.ts`
- [ ] T033a Create frontmatter validator with error recovery: `src/lib/blog/frontmatter-validator.ts`
- [ ] T033b Create large post handler with chunking: `src/lib/blog/large-post-handler.ts`
- [ ] T033c Create migration recovery service: `src/lib/blog/migration-recovery.ts`

### Service Layer

- [ ] T034 Enhance post service with sync support: `src/services/blog/post-service.ts`
- [ ] T035 Create bi-directional sync service: `src/services/blog/sync-service.ts`
- [ ] T036 Create conflict resolution service: `src/services/blog/conflict-service.ts`
- [ ] T037 Create storage quota service: `src/services/blog/storage-service.ts`
- [ ] T038 Update offline service for new sync: `src/services/blog/offline-service.ts`

### API Endpoints

- [ ] T039 Implement sync endpoint: `src/app/api/blog/sync/route.ts`
- [ ] T040 Update posts endpoint with caching: `src/app/api/blog/posts/route.ts`
- [ ] T041 Implement validate endpoint: `src/app/api/blog/validate/route.ts`
- [ ] T042 Implement process endpoint: `src/app/api/blog/process/route.ts`
- [ ] T043 Implement conflicts endpoint: `src/app/api/blog/conflicts/route.ts`
- [ ] T044 Implement resolve endpoint: `src/app/api/blog/resolve/route.ts`

## Phase 3.4: Integration

### File Watcher Integration

- [ ] T045 Integrate file watcher with Next.js dev server: `src/app/api/blog/watcher/route.ts`
- [ ] T046 Add debounced update logic: `src/lib/blog/debounce.ts`
- [ ] T047 Connect watcher to markdown processor pipeline
- [ ] T048 Add watcher status to dev UI

### Sync Integration

- [ ] T049 Connect IndexedDB to file system sync
- [ ] T050 Implement queue processor with retry logic
- [ ] T051 Add sync status indicators to UI
- [ ] T052 Create sync progress tracking

### UI Components

- [ ] T053 Create conflict resolution dialog: `src/components/blog/ConflictDialog/ConflictDialog.tsx`
- [ ] T054 Add TOC toggle to blog editor: `src/components/blog/TocToggle/TocToggle.tsx`
- [ ] T055 Create storage quota indicator: `src/components/blog/StorageIndicator/StorageIndicator.tsx`
- [ ] T056 Update blog editor with new features: `src/app/blog/editor/BlogEditorClient.tsx`

## Phase 3.5: Migration & Cleanup

### Migration

- [ ] T057 Create migration script: `scripts/migrate-blog.js`
- [ ] T058 Add hash generation for existing posts
- [ ] T059 Update all frontmatter to include showToc flag
- [ ] T060 Validate migration with test suite
- [ ] T061 Create rollback script: `scripts/rollback-blog.js`

### Cleanup

- [ ] T062 Remove old generate-blog-data.js script
- [ ] T063 Update package.json to remove generate:blog command
- [ ] T064 Clean up blog-data.json dependencies
- [ ] T065 Update CI/CD pipeline to remove build step

## Phase 3.6: Polish & Documentation

### Performance

- [ ] T066 [P] Optimize markdown processing with memoization
- [ ] T067 [P] Implement progressive loading for large posts
- [ ] T068 [P] Add cache warming on startup
- [ ] T069 [P] Profile and optimize sync operations

### Documentation

- [ ] T070 [P] Update README with new blog workflow
- [ ] T071 [P] Document conflict resolution process
- [ ] T072 [P] Create migration guide for existing users
- [ ] T073 [P] Add troubleshooting section to docs

### Validation

- [ ] T074 Run full test suite: `docker compose exec scripthammer pnpm test`
- [ ] T075 Run E2E tests: `docker compose exec scripthammer pnpm test:e2e`
- [ ] T076 Run performance benchmarks: `docker compose exec scripthammer pnpm test:perf`
- [ ] T077 Validate accessibility: `docker compose exec scripthammer pnpm test:a11y`

## Parallel Execution Examples

### Batch 1: Setup & Backup (can run together)

```bash
# Terminal 1
docker compose exec scripthammer pnpm add chokidar remark remark-html rehype-highlight crypto-js

# Terminal 2
cp -r blog blog.backup-$(date +%Y%m%d)
```

### Batch 2: All Contract Tests (T006-T011)

```bash
# These can all run in parallel as they're different files
Task: "Create all contract tests"
Files: src/tests/contract/blog-*.test.ts
```

### Batch 3: All Type Definitions (T021-T025)

```bash
# These can all run in parallel as they're different files
Task: "Create all type definitions"
Files: src/types/*.ts, src/schemas/*.ts
```

### Batch 4: Documentation (T070-T073)

```bash
# All documentation can be written in parallel
Task: "Update all documentation"
Files: README.md, docs/*.md
```

## Dependencies Graph

```
Setup (T001-T005)
    ↓
Contract Tests (T006-T011) [P]
Integration Tests (T012-T016) [P]
Unit Tests (T017-T020) [P]
    ↓
Data Models (T021-T025) [P]
    ↓
Core Libraries (T026-T033)
    ↓
Service Layer (T034-T038)
    ↓
API Endpoints (T039-T044)
    ↓
Integration (T045-T056)
    ↓
Migration (T057-T061)
    ↓
Cleanup (T062-T065)
    ↓
Polish (T066-T073) [P]
    ↓
Validation (T074-T077)
```

## Success Criteria

- [ ] All tests passing (contract, integration, unit)
- [ ] File changes auto-reload in <1 second
- [ ] Offline edits sync successfully
- [ ] Conflicts detectable and resolvable
- [ ] All 50+ posts migrated without data loss
- [ ] Performance targets met
- [ ] No manual build steps required

## Estimated Time: 37-42 hours

- Setup: 1 hour
- Tests: 8 hours
- Core Implementation: 12 hours
- Integration: 8 hours
- Migration: 3 hours
- Polish: 3-8 hours

---

_Generated from design documents in /specs/021-unified-blog-content/_
