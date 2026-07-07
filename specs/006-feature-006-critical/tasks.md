# Tasks: Critical Messaging UX Fixes

**Input**: Design documents from `/specs/006-feature-006-critical/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: E2E tests included per plan.md - Playwright for viewport validation, unit tests for key-service.ts

**TDD Deviation Note**: This is a bug fix feature. Per Constitution II (Test-First Development), tests normally precede implementation. For bug fixes, tests are written to validate the fix after implementation since we're correcting existing broken behavior, not building new features. Tests still follow RED-GREEN pattern: write test that fails on current broken code, implement fix, verify test passes.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization - this is a bug fix feature, no new project setup needed

- [ ] T001 Verify branch `006-feature-006-critical` is current and up-to-date with main
- [ ] T002 [P] Verify Docker container is running with `docker compose up`
- [ ] T003 [P] Read all source files to understand current implementation state

**Checkpoint**: Development environment ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type changes that affect multiple user stories

**⚠️ CRITICAL**: US4 (Decryption errors) requires type changes before implementation

- [x] T004 [US4] Add `decryptionError?: boolean` flag to `DecryptedMessage` type in `src/types/messaging.ts`
- [x] T005 [US4] Update `DECRYPTION_ERROR_TEXT` constant in `src/services/messaging/message-service.ts` (line ~564)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Message Input Always Visible (Priority: P1) 🎯 MVP

**Goal**: Fix CSS scroll issue so message input is visible on all viewports (320px-1920px)

**Independent Test**: Navigate to /messages with conversation selected. On mobile (375x667), tablet (768x1024), and desktop (1280x800), message input must be fully visible at bottom without scrolling.

### Implementation for User Story 1

- [x] T006 [US1] Fix CSS Grid layout in `src/app/messages/page.tsx` - ensure `drawer-content` uses proper grid-rows with mobile header accounted
- [x] T007 [US1] Add `min-h-0` to grid children in `src/app/messages/page.tsx:333` to prevent grid blowout
- [x] T008 [US1] Update `src/components/organisms/ChatWindow/ChatWindow.tsx` - ensure grid layout with `grid-rows-[auto_1fr_auto]` for header/messages/input
- [x] T009 [US1] Add `min-h-0 overflow-y-auto` to MessageThread container in `src/components/molecular/MessageThread/MessageThread.tsx`
- [x] T010 [US1] Add `flex-shrink-0` to MessageInput wrapper in ChatWindow to prevent compression
- [x] T011 [US1] Add safe-area padding for mobile keyboards using `pb-[env(safe-area-inset-bottom)]` (requires Safari iOS 11.2+, Android Chrome 69+)
- [x] T012 [US1] Update jump-to-bottom button from `fixed` to `absolute` positioning within ChatWindow container

### E2E Tests for User Story 1

- [ ] T013 [P] [US1] Update viewport tests in `tests/e2e/messaging/messaging-scroll.spec.ts` - add 320px and 1920px edge cases
- [ ] T014 [P] [US1] Add landscape viewport tests (667x375, 1024x768) to `tests/e2e/messaging/messaging-scroll.spec.ts`

**Checkpoint**: Message input visible on all viewports - US1 complete and testable independently

---

## Phase 4: User Story 2 - OAuth Password Setup Flow (Priority: P1)

**Goal**: Fix hasKeys() bug so OAuth users see "Create password" not "Enter password"

**Independent Test**: Sign in with Google OAuth (new user, no keys). Navigate to /messages. Should see "Set Up Encrypted Messaging" with password + confirm fields, not "Enter your password" prompt.

### Implementation for User Story 2

- [x] T015 [US2] Fix `hasKeys()` method in `src/services/messaging/key-service.ts:326` - change `.single()` to `.maybeSingle()` AND add `WHERE revoked=false` filter to only count valid keys (per FR-007)
- [x] T016 [US2] Update error handling in `hasKeys()` - return `false` for no rows, only throw on actual errors
- [x] T017 [US2] Update `checkKeys()` flow in `src/app/messages/page.tsx:113-133` - ensure redirect to `/messages/setup` for users with no keys
- [x] T018 [US2] Update `ReAuthModal` in `src/components/auth/ReAuthModal/ReAuthModal.tsx` - ensure modal is ONLY shown for users with existing keys (unlock mode), never for setup
- [x] T019 [US2] Update modal text to clearly distinguish "Enter your messaging password" (unlock) vs never showing for setup

### Unit Tests for User Story 2

- [ ] T020 [P] [US2] Add unit test for `hasKeys()` with 0 rows scenario in `src/services/messaging/key-service.test.ts`
- [ ] T021 [P] [US2] Add unit test for `hasKeys()` with 1 row scenario (existing keys)
- [ ] T022 [P] [US2] Add unit test for `hasKeys()` with query error scenario

**Checkpoint**: OAuth users without keys see setup flow, users with keys see unlock modal - US2 complete

---

## Phase 5: User Story 3 - Password Manager Integration (Priority: P2)

**Goal**: Enable password managers to detect and save messaging password

**Independent Test**: On `/messages/setup`, enter password. Browser password manager (Chrome/Firefox) should offer to save credentials.

### Implementation for User Story 3

- [x] T023 [US3] Update `/messages/setup` page form in `src/app/messages/setup/page.tsx`:
  - Add hidden email field with user's email and `autocomplete="username"`
  - Add `autocomplete="new-password"` to password field
  - Add `autocomplete="new-password"` to confirm password field
- [x] T024 [US3] Ensure form is proper `<form>` element with submit handler (not just button onClick)
- [x] T025 [US3] Add "Save this password" warning text above password field
- [x] T026 [US3] Add "Save this password" warning text below confirm field
- [x] T027 [US3] Add post-setup toast notification with "Save this password" reminder
- [x] T028 [US3] Update `ReAuthModal` unlock mode with `autocomplete="current-password"` for returning users

**Checkpoint**: Password managers detect setup form and offer to save - US3 complete

---

## Phase 6: User Story 4 - Decryption Failure Explanation (Priority: P2)

**Goal**: Show user-friendly decryption error with lock icon instead of raw error text

**Independent Test**: View conversation with messages encrypted with old/invalid keys. Should see lock icon + "Encrypted with previous keys" text, not "[Message could not be decrypted]".

### Implementation for User Story 4

- [x] T029 [US4] Update `decryptMessage()` in `src/services/messaging/message-service.ts` to set `decryptionError: true` flag on failed decryption
- [x] T030 [US4] Update `MessageBubble` component in `src/components/atomic/MessageBubble/MessageBubble.tsx`:
  - Check for `decryptionError` flag on message
  - Render lock icon (SVG) instead of message content
  - Display "Encrypted with previous keys" text
- [x] T031 [US4] Add tooltip to lock icon (shows on hover AND keyboard focus) explaining "This message was encrypted before your current encryption keys were set up"
- [x] T032 [US4] Add `aria-label` to lock icon for accessibility
- [x] T033 [US4] Style decryption error state with muted colors to distinguish from normal messages
- [x] T034 [US4] Add conversation-level banner when ALL messages are undecryptable: "All messages in this conversation were encrypted with previous keys" (per Edge Case spec)
- [ ] T035 [P] [US4] Update `src/components/atomic/MessageBubble/MessageBubble.accessibility.test.tsx` - add tests for lock icon (aria-label, keyboard focus, tooltip trigger)

**Checkpoint**: Decryption errors show helpful UI with lock icon - US4 complete

---

## Phase 7: User Story 5 - Participant Name Resolution (Priority: P3)

**Goal**: Show actual participant name instead of "Unknown"

**Independent Test**: Open conversation with user "jonpohlner". Header should show "jonpohlner" (or their display_name), not "Unknown".

### Implementation for User Story 5

- [x] T036 [US5] Fix `loadConversationInfo()` in `src/app/messages/page.tsx:150-197`:
  - Add error logging in catch block (remove silent fail)
  - Ensure query returns profile data correctly
- [x] T037 [US5] Update fallback values:
  - "Unknown User" for missing profile (not "User")
  - "Deleted User" for deleted accounts (profile null but user exists with deleted_at)
- [x] T038 [US5] Update `senderName` resolution in message list to use profile lookup
- [x] T039 [US5] Add console.warn for debugging when participant name fails to resolve

**Checkpoint**: Participant names resolve correctly from user_profiles - US5 complete

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T040 [P] Run full E2E test suite: `docker compose exec scripthammer pnpm exec playwright test tests/e2e/messaging/`
- [x] T041 [P] Run unit tests: `docker compose exec scripthammer pnpm test`
- [x] T042 [P] Run type-check: `docker compose exec scripthammer pnpm run type-check`
- [x] T043 [P] Run linting: `docker compose exec scripthammer pnpm run lint`
- [ ] T044 [P] Run Lighthouse performance audit on /messages page (target: 90+ score per Constitution V)
- [ ] T045 Manual browser test with Chrome password manager on /messages/setup
- [ ] T046 Manual browser test with Firefox password manager on /messages/setup
- [ ] T047 Verify all 52 checklist items in `specs/006-feature-006-critical/checklists/ux-release.md`
- [x] T048 Create commit with all changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS US4
- **US1 (Phase 3)**: Can start after Setup (no type dependencies)
- **US2 (Phase 4)**: Can start after Setup (no type dependencies)
- **US3 (Phase 5)**: Can start after US2 (depends on setup/unlock flow distinction)
- **US4 (Phase 6)**: Depends on Foundational (type changes)
- **US5 (Phase 7)**: Can start after Setup (no dependencies)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories - pure CSS fix
- **User Story 2 (P1)**: No dependencies on other stories - key-service fix
- **User Story 3 (P2)**: Depends on US2 (setup vs unlock distinction must be clear)
- **User Story 4 (P2)**: Depends on Foundational type changes (T004, T005)
- **User Story 5 (P3)**: No dependencies on other stories - profile query fix

### Within Each User Story

- CSS changes before E2E tests (US1)
- Service fix before component updates (US2, US4)
- Core implementation before polish (all stories)

### Parallel Opportunities

- **Phase 1**: T002, T003 can run in parallel
- **Phase 3**: T013, T014 (E2E tests) can run in parallel
- **Phase 4**: T020, T021, T022 (unit tests) can run in parallel
- **Phase 6**: T035 (a11y test) can run in parallel with T030-T034
- **Phase 8**: T040-T044 (validation) can run in parallel
- **US1 and US2**: Can be implemented in parallel (different files)
- **US4 and US5**: Can be implemented in parallel (different files)

---

## Parallel Example: US1 + US2 (Both P1)

```bash
# Since US1 and US2 modify different files, they can be developed in parallel:

# Stream 1 - US1 (Scroll Fix):
T006: Fix CSS Grid in messages/page.tsx
T008: Update ChatWindow.tsx grid layout
T009: Update MessageThread.tsx overflow

# Stream 2 - US2 (OAuth Flow):
T015: Fix hasKeys() in key-service.ts
T017: Update checkKeys() in messages/page.tsx (different section than T006)
T018: Update ReAuthModal.tsx
```

---

## Implementation Strategy

### MVP First (US1 + US2 - Both P1)

1. Complete Phase 1: Setup (verify environment)
2. Complete Phase 2: Foundational (type changes for US4)
3. Complete Phase 3: US1 - Scroll fix (critical blocker)
4. Complete Phase 4: US2 - OAuth flow (critical blocker)
5. **STOP and VALIDATE**: Test both P1 stories independently
6. Users can now send messages (US1) and OAuth users can set up encryption (US2)

### Incremental Delivery

1. Setup + Foundational → Types ready
2. US1 (Scroll) → Test on all viewports → Users can see input
3. US2 (OAuth) → Test with OAuth user → New users can set up
4. US3 (Password Manager) → Test with Chrome/Firefox → Credentials saved
5. US4 (Decryption) → Test with old messages → Helpful error display
6. US5 (Participant Name) → Test conversation header → Names resolved

### Single Developer Strategy

1. Phase 1 + 2: Setup and type changes (15 min)
2. US1: CSS scroll fix (30 min) - most critical
3. US2: OAuth flow fix (30 min) - blocking OAuth users
4. US3: Password manager (20 min) - UX improvement
5. US4: Decryption errors (30 min) - UX improvement
6. US5: Participant names (15 min) - cosmetic
7. Phase 8: Validation (30 min)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each phase or logical group
- Stop at any checkpoint to validate story independently
- **P1 stories (US1, US2)** are critical blockers - do first
- **P2 stories (US3, US4)** are important UX - do second
- **P3 story (US5)** is cosmetic - do last
- **Total Tasks**: 48 (T001-T048)
