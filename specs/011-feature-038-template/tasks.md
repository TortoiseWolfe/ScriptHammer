# Tasks: Template Fork Experience

**Input**: Design documents from `/specs/011-feature-038-template/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US5)
- Exact file paths included in descriptions

## Path Conventions

- Single project: `src/`, `tests/`, `scripts/` at repository root
- Docker config: `docker/`, root `docker-compose.yml`
- GitHub Actions: `.github/workflows/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Validate existing infrastructure and prepare for implementation

- [x] T001 Verify existing project structure matches plan.md layout
- [x] T002 [P] Read and understand `scripts/detect-project.js` auto-detection logic
- [x] T003 [P] Read and understand `src/config/project.config.ts` configuration system
- [x] T004 [P] Read and understand `tests/setup.ts` current mock structure

**Checkpoint**: Infrastructure understood - ready for implementation

---

## Phase 2: User Story 1 - Automated Rebranding (Priority: P1) 🎯 MVP

**Goal**: Create rebrand.sh script that automates 200+ file updates in under 5 minutes

**Independent Test**: Run `./scripts/rebrand.sh TestApp testuser "Test description"` and verify build succeeds

### Tests for User Story 1 (TDD - Write First, Ensure FAIL) ⚠️

**NOTE**: Per Constitution §II, tests MUST be written before implementation. Shell script testing uses manual verification scripts.

- [x] T005a [P] [US1] Create `tests/rebrand/test-rebrand.sh` test harness with test case structure
- [x] T005b [P] [US1] Write test case: verify argument validation (missing args should fail with exit 1)
- [x] T005c [P] [US1] Write test case: verify name sanitization ("My App!" → "my-app")
- [x] T005d [US1] Write test case: verify dry-run produces no file changes
- [x] T005e [US1] Write test case: verify re-rebrand detection prompts user

### Implementation for User Story 1

- [x] T005 [US1] Create `scripts/rebrand.sh` skeleton with argument parsing and --help output
- [x] T006 [US1] Implement argument validation (3 required args, optional --force, --dry-run flags)
- [x] T007 [US1] Implement name sanitization function (spaces→hyphens, remove special chars)
- [x] T008 [US1] Implement previous-rebrand detection (grep for "ScriptHammer" count)
- [x] T008a [US1] Implement uncommitted changes warning (git status check, warn but proceed)
- [x] T009 [US1] Implement user confirmation prompt for re-rebrand scenario
- [x] T010 [US1] Implement content replacement using sed across all file types (_.ts, _.tsx, _.js, _.json, _.md, _.yml, \*.sh)
- [x] T011 [US1] Implement directory exclusion (node_modules/, .next/, out/, .git/)
- [x] T012 [US1] Implement file renaming for files containing "ScriptHammer" in name
- [x] T013 [US1] Implement docker-compose.yml service name update
- [x] T014 [US1] Implement public/CNAME deletion
- [x] T015 [US1] Implement package.json field updates (name, description, repository)
- [x] T016 [US1] Implement git remote origin URL update
- [x] T017 [US1] Implement verbose output (print each file as modified)
- [x] T018 [US1] Implement --dry-run flag (show changes without modifying)
- [x] T019 [US1] Implement --force flag (skip confirmation prompts)
- [x] T020 [US1] Implement exit codes (0=success, 1=invalid args, 2=declined, 3=git error)
- [x] T021 [US1] Implement summary output (files modified count, files renamed count, elapsed time)
- [x] T022 [US1] Add cross-platform sed compatibility (BSD vs GNU detection)
- [x] T023 [US1] Test rebrand script end-to-end with actual fork simulation

**Checkpoint**: User Story 1 complete - rebrand script works independently

---

## Phase 3: User Story 2 - Tests Pass Without Supabase Config (Priority: P2)

**Goal**: Tests pass without Supabase environment variables using comprehensive mocks

**Independent Test**: Remove .env, run `pnpm test`, verify 0 failures

### Implementation for User Story 2

- [x] T024 [P] [US2] Create mockSupabaseClient object with auth methods in `tests/setup.ts`
- [x] T025 [P] [US2] Add database methods (from, select, insert, update, delete) to mock
- [x] T026 [P] [US2] Add realtime methods (channel, on, subscribe, unsubscribe) to mock
- [x] T027 [P] [US2] Add storage methods (upload, getPublicUrl, remove) to mock
- [x] T028 [US2] Add vi.mock for `@/lib/supabase/client` using mockSupabaseClient
- [x] T029 [US2] Update `src/config/__tests__/project.config.test.ts` to use generic assertions
- [ ] T030 [US2] Verify all tests pass with no .env file present

**Checkpoint**: User Story 2 complete - tests pass without Supabase config

---

## Phase 4: User Story 3 - GitHub Pages Deploys Correctly (Priority: P3)

**Goal**: Forks deploy to GitHub Pages without NEXT_PUBLIC_BASE_PATH secret

**Independent Test**: Fork repo, enable GitHub Pages, verify site loads correctly

### Implementation for User Story 3

- [x] T031 [P] [US3] Remove NEXT_PUBLIC_BASE_PATH line from `.github/workflows/deploy.yml`
- [x] T032 [P] [US3] Update `next.config.ts` to treat empty string basePath as undefined
- [x] T033 [US3] Verify `scripts/detect-project.js` correctly auto-detects basePath in CI

**Checkpoint**: User Story 3 complete - GitHub Pages deploys without basePath secret

---

## Phase 5: User Story 4 - Docker Git Workflow Works (Priority: P4)

**Goal**: Git commits work from Docker container without errors

**Independent Test**: Run `docker compose exec scripthammer git commit -m "test"` after change

### Implementation for User Story 4

- [x] T034 [P] [US4] Verify `docker/Dockerfile` has `git config --global --add safe.directory /app`
- [x] T035 [P] [US4] Add GIT_AUTHOR_NAME and GIT_AUTHOR_EMAIL to `docker-compose.yml` environment
- [x] T036 [P] [US4] Document GIT_AUTHOR variables in `.env.example` with instructions
- [ ] T037 [US4] Update `CLAUDE.md` with container-based git commit instructions

**Checkpoint**: User Story 4 complete - Docker git workflow works

---

## Phase 6: User Story 5 - Graceful Degradation (Priority: P5)

**Goal**: App shows setup banner when Supabase not configured instead of crashing

**Independent Test**: Deploy without Supabase secrets, verify banner appears

### Implementation for User Story 5

- [x] T038 [US5] Create `src/components/SetupBanner/index.tsx` barrel export
- [x] T039 [US5] Create `src/components/SetupBanner/SetupBanner.tsx` with dismissible DaisyUI alert
- [x] T040 [US5] Implement session storage for banner dismissal state
- [x] T041 [US5] Create `src/components/SetupBanner/SetupBanner.test.tsx` unit tests
- [x] T042 [US5] Create `src/components/SetupBanner/SetupBanner.stories.tsx` Storybook stories
- [x] T043 [US5] Create `src/components/SetupBanner/SetupBanner.accessibility.test.tsx` a11y tests
- [x] T044 [US5] Modify `src/lib/supabase/client.ts` to not throw on missing env vars
- [ ] T045 [US5] Add SetupBanner to `src/app/layout.tsx` when Supabase unavailable

**Checkpoint**: User Story 5 complete - graceful degradation works

---

## Phase 7: Dynamic Configuration & Documentation

**Purpose**: Service worker, manifest, and documentation updates

### Dynamic Configuration

- [ ] T046 [P] Update `public/sw.js` to use dynamic cache name from project config
- [ ] T047 [P] Add `public/manifest.json` to `.gitignore` (it's generated)
- [ ] T048 [P] Verify `scripts/generate-manifest.js` creates correct dynamic manifest
- [ ] T049 Update admin email references to use ADMIN_EMAIL env var with fallback

### Documentation

- [ ] T050 [P] Add "Forking This Template" section to `README.md`
- [ ] T051 [P] Document Supabase GitHub secrets requirement in `CLAUDE.md`
- [ ] T052 [P] Add template attribution link to `src/components/Footer.tsx`
- [ ] T053 Create `docs/FORKING.md` with comprehensive fork workflow guide

**Checkpoint**: All documentation updated

---

## Phase 8: Polish & Verification

**Purpose**: Final verification and cleanup

- [ ] T054 Run full test suite (`pnpm test`) - verify all 793+ tests pass
- [ ] T055 Run build (`pnpm run build`) - verify zero errors
- [ ] T056 Run lint (`pnpm run lint`) - verify zero warnings
- [ ] T057 Run type-check (`pnpm run type-check`) - verify zero errors
- [ ] T058 Test rebrand script with edge cases (special chars, re-rebrand)
- [ ] T058a Test rebrand script idempotency (run twice with same args, verify no errors)
- [ ] T058b Test rebrand script case-sensitivity (verify "MyApp" preserved for display, "myapp" for technical)
- [ ] T059 Verify quickstart.md workflow end-to-end
- [ ] T060 Update plan.md Progress Tracking to show all phases complete

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ──────────────────────────────────────┐
                                                      │
Phase 2 (US1: Rebrand Script) ◄───────────────────────┤ Sequential
                                                      │ (MVP First)
Phase 3 (US2: Test Infrastructure) ◄──────────────────┤
                                                      │
Phase 4 (US3: GitHub Pages) ◄─────────────────────────┤
                                                      │
Phase 5 (US4: Docker Git) ◄───────────────────────────┤
                                                      │
Phase 6 (US5: Graceful Degradation) ◄─────────────────┤
                                                      │
Phase 7 (Dynamic Config & Docs) ◄─────────────────────┤
                                                      │
Phase 8 (Polish) ◄────────────────────────────────────┘
```

### Within User Stories

- US1 (Rebrand): T005→T006→T007→T008...T023 (sequential - all in same file)
- US2 (Tests): T024-T027 parallel, then T028→T029→T030 sequential
- US3 (Deploy): T031, T032 parallel, then T033
- US4 (Docker): T034, T035, T036 parallel, then T037
- US5 (Banner): T038→T039→T040→T041-T043 (parallel tests)→T044→T045

### Parallel Opportunities

```bash
# Phase 1 - Setup (all parallel):
Task: "Read scripts/detect-project.js"
Task: "Read src/config/project.config.ts"
Task: "Read tests/setup.ts"

# Phase 4-5 - US3 & US4 (parallel across stories):
Task: "Remove NEXT_PUBLIC_BASE_PATH from deploy.yml"
Task: "Add GIT_AUTHOR vars to docker-compose.yml"
Task: "Update .env.example with git config vars"

# Phase 7 - Documentation (all parallel):
Task: "Add Forking section to README.md"
Task: "Document secrets in CLAUDE.md"
Task: "Add attribution to Footer.tsx"
Task: "Create docs/FORKING.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (understand existing code)
2. Complete Phase 2: User Story 1 - Rebrand Script
3. **STOP and VALIDATE**: Test script end-to-end
4. Demo/deliver MVP

### Incremental Delivery

| Milestone | Stories Complete | Value Delivered                 |
| --------- | ---------------- | ------------------------------- |
| MVP       | US1              | Fork setup time: 2hrs → 5min    |
| +Tests    | US1, US2         | Tests pass without config       |
| +Deploy   | US1-US3          | GitHub Pages works out of box   |
| +Docker   | US1-US4          | Git workflow friction removed   |
| +Polish   | US1-US5          | Graceful degradation, full docs |

---

## Task Count Summary

| Phase        | Tasks  | Parallel      |
| ------------ | ------ | ------------- |
| Setup        | 4      | 3             |
| US1: Rebrand | 19     | 0 (same file) |
| US2: Tests   | 7      | 4             |
| US3: Deploy  | 3      | 2             |
| US4: Docker  | 4      | 3             |
| US5: Banner  | 8      | 3             |
| Config/Docs  | 8      | 6             |
| Polish       | 7      | 0             |
| **Total**    | **60** | **21**        |

---

## Notes

- All rebrand script tasks (T005-T023) are sequential - single file `scripts/rebrand.sh`
- SetupBanner component follows 5-file pattern per constitution
- Test infrastructure tasks can run in parallel (separate mock objects)
- Documentation tasks are fully parallelizable
- Verify tests fail before implementing (TDD where applicable)
- Commit after each phase checkpoint
