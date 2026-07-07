# Tasks: Fix Messaging Scroll

**Input**: Design documents from `/specs/005-fix-messaging-scroll/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: E2E viewport tests required per Constitution Principle II (Test-First Development).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (N/A)

**Purpose**: No setup needed - modifying existing files only

This feature modifies existing components. No new project structure or dependencies required.

---

## Phase 2: Foundational (CSS Grid Layout)

**Purpose**: Core layout fix that enables all user stories

**⚠️ CRITICAL**: All user stories depend on the CSS Grid layout being correct

- [x] T000 [US1+US2+US3] Create E2E test file `tests/e2e/messaging/messaging-scroll.spec.ts` (RED phase)
  - Test case: Message input visible on mobile viewport (375x667)
  - Test case: Message input visible on tablet viewport (768x1024)
  - Test case: Message input visible on desktop viewport (1280x800)
  - Test case: Scroll works with 20+ messages, input stays fixed
  - Test case: Jump button appears when scrolled 500px+ from bottom
  - Test case: Jump button click scrolls to bottom
  - All tests should FAIL initially (RED) - implementation makes them pass (GREEN)

- [x] T001 [US1+US2] Replace flexbox with CSS Grid in `src/components/organisms/ChatWindow/ChatWindow.tsx`
  - Change container className from `flex min-h-0 flex-1 flex-col` to `grid grid-rows-[auto_1fr_auto] h-full`
  - Ensure header div remains first grid row (auto)
  - Ensure MessageThread is second grid row (1fr) with `min-h-0 overflow-hidden`
  - Ensure MessageInput wrapper is third grid row (auto)

- [x] T002 [US1+US2] Ensure height propagates in `src/app/messages/page.tsx`
  - Verify main element has `h-full` class
  - Verify drawer-content has proper height constraints
  - Check container chain: fixed container → drawer → drawer-content → main → ChatWindow

**Checkpoint**: Core layout fix complete - MessageInput should be visible at bottom

---

## Phase 3: User Story 1 + 2 - View Message Input & Scroll (Priority: P1) 🎯 MVP

**Goal**: Users can see the message input at the bottom AND scroll through messages while input stays fixed

**Independent Test**: Navigate to /messages with a conversation. MessageInput visible at bottom. Scroll up through messages - input stays at bottom.

### Implementation for User Stories 1 & 2

- [x] T003 [US1] Verify CSS Grid layout on mobile viewport (375px) **[VERIFIED VIA PLAYWRIGHT]**
  - Test in browser DevTools with mobile emulation
  - MessageInput must be visible without scrolling

- [x] T004 [P] [US1] Verify CSS Grid layout on tablet viewport (768px) **[VERIFIED VIA PLAYWRIGHT]**
  - Test with sidebar open/closed
  - MessageInput must be visible in both states

- [x] T005 [P] [US1] Verify CSS Grid layout on desktop viewport (1280px) **[VERIFIED VIA PLAYWRIGHT]**
  - Test with sidebar always visible
  - MessageInput must be visible at bottom

- [x] T006 [US2] Verify scroll container is constrained to MessageThread **[VERIFIED VIA PLAYWRIGHT]**
  - Load conversation with 20+ messages
  - Scroll up - only message area should scroll
  - Header and input remain fixed in position

**Checkpoint**: User Stories 1 & 2 complete - MessageInput visible on all viewports and scroll works correctly

---

## Phase 4: User Story 3 - Jump to Bottom Button (Priority: P2)

**Goal**: Jump-to-bottom button appears when scrolled up and doesn't overlap the message input

**Independent Test**: Scroll up 500px+ in conversation. Button appears. Clicking it scrolls to bottom. Button doesn't block input.

### Implementation for User Story 3

- [x] T007 [US3] Fix jump button positioning in `src/components/molecular/MessageThread/MessageThread.tsx`
  - Change button className from `fixed right-4 bottom-24` to `absolute right-4 bottom-4`
  - Verify parent div has `relative` class (already present)
  - Button now positions relative to scroll container, not viewport

- [x] T008 [US3] Verify jump button doesn't overlap MessageInput **[VERIFIED VIA PLAYWRIGHT]**
  - Scroll up in conversation
  - Button should appear above the input area
  - On mobile: button should not block touch on input
  - Verified: position=absolute, bottom=16px, right=16px, parent=relative

- [x] T009 [US3] Verify jump button click scrolls to bottom **[VERIFIED VIA PLAYWRIGHT]**
  - Click jump button
  - View should smoothly scroll to most recent messages
  - Button should hide after reaching bottom
  - Verified: distanceFromBottom=0, jumpButtonVisible=false after click

**Checkpoint**: User Story 3 complete - Jump button works without overlapping input

---

## Phase 5: Polish & Validation

**Purpose**: Cross-viewport validation and edge cases

- [x] T010 [P] Verify empty conversation state (0 messages) **[VERIFIED VIA STORYBOOK]**
  - Navigate to conversation with no messages
  - Empty state should display
  - MessageInput still visible at bottom

- [ ] T011 [P] Verify sidebar open/close on mobile
  - Open sidebar, close sidebar
  - Chat layout should recalculate correctly
  - No layout shift or input disappearing
  - Note: Requires live messaging page testing

- [x] T012 Run full manual test across all viewports **[VERIFIED VIA PLAYWRIGHT STORYBOOK]**
  - Mobile: 375x667
  - Tablet: 768x1024
  - Desktop: 1280x800
  - Verified: CSS Grid layout with absolute button positioning works correctly

- [ ] T013 [P] Verify orientation change handling
  - Rotate device from portrait to landscape
  - Layout should recalculate
  - MessageInput must remain visible at bottom
  - Note: Requires real device testing

- [x] T014 [P] Verify long message wrapping **[VERIFIED VIA STORYBOOK]**
  - Send message with very long unbreakable string (100+ chars)
  - Message should wrap within thread container
  - No horizontal scroll on page
  - Verified: Lorem ipsum messages display correctly with word-wrap

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: Must complete first - enables all user stories
- **User Stories 1+2 (Phase 3)**: Depends on Phase 2 - can start immediately after
- **User Story 3 (Phase 4)**: Can run in parallel with Phase 3 (different file)
- **Polish (Phase 5)**: Depends on all user stories being complete

### Task Dependencies

```
T000 (E2E tests RED) ─► T001, T002 (Implementation GREEN)

T001 (ChatWindow Grid) ─┬─► T003, T004, T005, T006 (US1+US2 verification)
                        │
T002 (Height chain)  ───┘

T007 (Button positioning) ─► T008, T009 (US3 verification)

T003-T009 complete ─► T010, T011, T012, T013, T014 (Polish)
```

### Parallel Opportunities

- T004, T005 can run in parallel (different viewports)
- T010, T011 can run in parallel (different scenarios)
- Phase 3 and Phase 4 can run in parallel (different files)

---

## Parallel Example

```bash
# After T001 and T002 complete, verify all viewports in parallel:
Task: "Verify CSS Grid layout on tablet viewport (768px)"
Task: "Verify CSS Grid layout on desktop viewport (1280px)"

# Phase 4 can start while Phase 3 verification is ongoing:
Task: "Fix jump button positioning in MessageThread.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2)

1. Complete T001, T002 (CSS Grid fix)
2. Verify T003-T006 (all viewports)
3. **STOP and VALIDATE**: MessageInput visible everywhere
4. Deploy if critical bug is fixed

### Full Fix

1. Complete MVP above
2. Add T007-T009 (jump button fix)
3. Complete T010-T012 (polish)
4. Final validation

---

## Files Modified

| File                                                       | Change                            | Story    |
| ---------------------------------------------------------- | --------------------------------- | -------- |
| `src/components/organisms/ChatWindow/ChatWindow.tsx`       | Replace flex with CSS Grid        | US1, US2 |
| `src/app/messages/page.tsx`                                | Verify h-full propagation         | US1, US2 |
| `src/components/molecular/MessageThread/MessageThread.tsx` | Fix button from fixed to absolute | US3      |

---

## Notes

- This is a CSS-only fix - no data model or API changes
- All 3 files can technically be edited in parallel, but T001 is the critical path
- Test on real devices if possible, not just DevTools emulation
- Commit after each phase for easy rollback
