# Tasks: Fix Messaging Layout

**Input**: Design documents from `/specs/007-fix-messaging-layout/`
**Prerequisites**: plan.md, spec.md, research.md

**Tests**: Manual browser testing only (no automated test tasks - existing tests suffice)

**Organization**: Tasks grouped by user story for independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files)
- **[Story]**: US1 = Scroll, US2 = Input Visible, US3 = Jump Button, US4 = Decryption Errors

---

## Phase 1: Setup

**Purpose**: Database reset to create test data

- [ ] T001 Reset database with 30 test messages: `docker compose exec scripthammer pnpm run db:reset`

**Checkpoint**: 30 test messages exist for scroll testing

---

## Phase 2: User Story 1+2 - Scroll & Input Visible (Priority: P1)

**Goal**: Fix CSS layout so messages scroll and input is visible

**Independent Test**: Login as test@example.com, open conversation with admin, verify scroll works and input visible

### Implementation

- [ ] T002 [US1+2] Fix ChatWindow.tsx - Replace flexbox with CSS Grid `grid-rows-[auto_1fr_auto]` in `src/components/organisms/ChatWindow/ChatWindow.tsx`
  - Change outer div from `flex h-full flex-col` to `grid h-full grid-rows-[auto_1fr_auto]`
  - Header: Keep as-is (grid row 1 = auto)
  - Message area: Change wrapper to `overflow-y-auto min-h-0` (grid row 2 = 1fr)
  - Input area: Keep as-is (grid row 3 = auto)

- [ ] T003 [US1+2] Fix page.tsx - Remove unnecessary wrapper div at line 416 in `src/app/messages/page.tsx`
  - Remove the `<div className="flex h-full flex-col overflow-hidden">` wrapper
  - Pass `className="h-full"` directly to ChatWindow component

- [ ] T004 [US1+2] Fix MessageThread.tsx - Ensure scroll container works in `src/components/molecular/MessageThread/MessageThread.tsx`
  - Verify outer div has `h-full overflow-y-auto`
  - Keep jump button positioning as `absolute` within the scroll container

- [ ] T005 [US1+2] Manual test: Login, open conversation, verify scroll and input
  - Scroll bar appears with 30 messages
  - Can scroll to oldest/newest messages
  - Input box fully visible at bottom
  - Test viewports: 375px, 768px, 1024px, 1440px
  - Edge case: 400px height viewport - input still visible
  - Edge case: Landscape orientation on mobile - scroll works

**Checkpoint**: Scroll works, input visible - core UX fixed

---

## Phase 3: User Story 3 - Jump to Bottom Button (Priority: P2)

**Goal**: Jump button appears when scrolled and works correctly

**Independent Test**: Scroll up 500px, click jump button, verify smooth scroll to bottom

### Implementation

- [ ] T006 [US3] Verify jump button positioning in MessageThread.tsx
  - Button should use `absolute right-4 bottom-4` within scroll container
  - If clipped, adjust to stay within visible scroll area

- [ ] T007 [US3] Manual test: Jump button functionality
  - Scroll up 500px from bottom
  - Button appears
  - Click scrolls smoothly to newest message

**Checkpoint**: Jump button works correctly

---

## Phase 4: User Story 4 - Decryption Error Display (Priority: P3)

**Goal**: Placeholder messages show friendly error text instead of raw errors

**Independent Test**: View test messages (which can't decrypt), verify friendly display

### Implementation

- [ ] T008 [US4] Fix MessageBubble.tsx - Improve decryption error display in `src/components/atomic/MessageBubble/MessageBubble.tsx`
  - When `message.decryptionError === true`:
    - Show lock icon
    - Display "Message encrypted with different keys" or similar friendly text
    - Remove any raw error text like "[Message could not be decrypted]"

- [ ] T009 [US4] Manual test: Decryption error display
  - View test messages from db:reset
  - Verify friendly message with lock icon
  - No raw error text visible

**Checkpoint**: Decryption errors display friendly messages

---

## Phase 5: Polish & Verification

**Purpose**: Cross-browser testing and final verification

- [ ] T010 Cross-browser test: Chrome desktop
- [ ] T011 [P] Cross-browser test: Firefox
- [ ] T012 [P] Cross-browser test: Safari (or Chrome DevTools iOS emulation if Safari unavailable)
- [ ] T013 [P] Mobile viewport test: Chrome DevTools 375px
- [ ] T014 Final verification: All success criteria pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - run db:reset first
- **Phase 2 (US1+2)**: Depends on Phase 1 - needs test messages
- **Phase 3 (US3)**: Depends on Phase 2 - layout must work first
- **Phase 4 (US4)**: Can run parallel to Phase 3 (different file)
- **Phase 5 (Polish)**: Depends on Phases 2-4 completion

### Parallel Opportunities

- T010, T011, T012, T013 can run in parallel (different browsers)
- Phase 3 and Phase 4 can run in parallel (different components)

---

## Parallel Example

```bash
# After Phase 2 completes, run Phase 3 and 4 in parallel:
Task: T006 (MessageThread jump button) - US3
Task: T008 (MessageBubble error display) - US4

# Cross-browser tests in parallel:
Task: T010 (Chrome)
Task: T011 (Firefox)
Task: T012 (Safari)
Task: T013 (Mobile)
```

---

## Implementation Strategy

### MVP (User Stories 1+2 Only)

1. T001: Reset database
2. T002-T004: CSS Grid fixes
3. T005: Manual test scroll + input
4. **STOP and VALIDATE**: Core UX should work

### Full Implementation

1. MVP (above)
2. T006-T007: Jump button verification
3. T008-T009: Decryption error polish
4. T010-T014: Cross-browser verification

---

## Notes

- This is a CSS-only fix - no data model or API changes
- Manual testing is sufficient - existing unit tests will catch regressions
- Focus on T002 (ChatWindow CSS Grid) - this is the core fix
- Test with 30 messages to verify scroll works properly
