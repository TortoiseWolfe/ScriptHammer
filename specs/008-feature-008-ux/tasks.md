# Tasks: UX Polish - Character Count & Markdown Rendering

**Input**: Design documents from `/specs/008-feature-008-ux/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, quickstart.md ✓
**Branch**: `008-feature-008-ux`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 = Character Count, US2 = Markdown Rendering
- All file paths are relative to repository root

---

## Phase 1: Setup

**Purpose**: Verify environment and branch

- [x] T001 Verify on correct branch `008-feature-008-ux` and Docker running

---

## Phase 2: User Story 1 - Character Count Display (Priority: P1) 🎯

**Goal**: Show "0 / 10000 characters" instead of blank when message input is empty

**Independent Test**: Open any conversation, verify character count shows "0 / 10000 characters" on load

### Tests for User Story 1 (TDD)

**NOTE: Write tests FIRST, ensure they FAIL before implementation**

- [x] T002 [P] [US1] Add character count edge case tests in `src/components/atomic/MessageInput/MessageInput.test.tsx`
  - Test: Empty string input → displays "0 / 10000 characters"
  - Test: Undefined charCount → displays "0 / 10000 characters"
  - Test: Typing increments count correctly

### Implementation for User Story 1

- [x] T003 [US1] Fix character count fallback in `src/components/atomic/MessageInput/MessageInput.tsx:192`
  - Change `{charCount} / {charLimit} characters` to `{charCount || 0} / {charLimit} characters`

**Checkpoint**: Character count should now display "0 / 10000 characters" when empty

---

## Phase 3: User Story 2 - Markdown Rendering (Priority: P1)

**Goal**: Parse `**bold**`, `*italic*`, and `` `code` `` in message bubbles

**Independent Test**: View admin welcome message - bold text should render without asterisks

### Tests for User Story 2 (TDD)

**NOTE: Write tests FIRST, ensure they FAIL before implementation**

- [x] T004 [P] [US2] Add parseMarkdown test cases in `src/components/atomic/MessageBubble/MessageBubble.test.tsx`
  - Test: `**bold**` renders as `<strong>`
  - Test: `*italic*` renders as `<em>`
  - Test: `` `code` `` renders as `<code>`
  - Test: Mixed markdown renders all correctly
  - Test: Unmatched `**asterisks` preserved as text
  - Test: Plain text unchanged
  - Test: Line breaks preserved (multi-line message)

### Implementation for User Story 2

- [x] T005 [US2] Add `parseMarkdown` function in `src/components/atomic/MessageBubble/MessageBubble.tsx`
  - Add function before component definition (around line 20)
  - Pattern: `/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g`
  - Handle bold → `<strong>`, italic → `<em>`, code → `<code>`

- [ ] T006 [US2] Update message content rendering in `src/components/atomic/MessageBubble/MessageBubble.tsx:281-282`
  - Change `{message.content}` to `{parseMarkdown(message.content)}`

- [ ] T007 [US2] Verify tests pass after implementation
  - Run: `docker compose exec scripthammer pnpm test MessageBubble`

**Checkpoint**: All markdown types should render correctly in message bubbles

---

## Phase 4: Verification & Polish

**Purpose**: Full validation and cleanup

- [ ] T008 [P] Run full test suite
  - Command: `docker compose exec scripthammer pnpm test`

- [ ] T009 [P] Run type check
  - Command: `docker compose exec scripthammer pnpm run type-check`

- [ ] T010 Manual verification (USER)
  - Open conversation, verify character count shows "0 / 10000 characters"
  - View admin welcome message, verify bold text renders without asterisks
  - Send test message with `**bold**`, `*italic*`, `` `code` ``
  - Verify all markdown renders correctly
  - Verify multi-line messages preserve line breaks

- [ ] T011 Commit changes with descriptive message

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies
- **Phase 2 (US1)**: Depends on Phase 1
- **Phase 3 (US2)**: Depends on Phase 1, can run parallel to Phase 2
- **Phase 4 (Polish)**: Depends on Phases 2 and 3

### Task Dependencies

```
T001 (Setup)
  ├── T002 (US1: Tests) ─► T003 (US1: Fix) ─────────┐
  │                                                  │
  └── T004 (US2: Tests) ─┬─► T005 (parseMarkdown)   │
                         │                          │
                         └─► T006 (Use parser) ─────┤
                                                    │
                         T007 (Verify tests) ◄──────┘
                                │
                                ▼
                    T008, T009, T010, T011 (Polish)
```

### Parallel Opportunities

```bash
# US1 and US2 tests can run in parallel (different files):
Task: "T002 [US1] Add tests in MessageInput.test.tsx"
Task: "T004 [US2] Add tests in MessageBubble.test.tsx"

# Polish tasks can run in parallel:
Task: "T008 Run full test suite"
Task: "T009 Run type check"
```

---

## Execution Summary

| Task | File                   | Story  | Parallel |
| ---- | ---------------------- | ------ | -------- |
| T001 | -                      | Setup  | -        |
| T002 | MessageInput.test.tsx  | US1    | [P]      |
| T003 | MessageInput.tsx:192   | US1    | -        |
| T004 | MessageBubble.test.tsx | US2    | [P]      |
| T005 | MessageBubble.tsx:~20  | US2    | -        |
| T006 | MessageBubble.tsx:281  | US2    | -        |
| T007 | -                      | US2    | -        |
| T008 | -                      | Polish | [P]      |
| T009 | -                      | Polish | [P]      |
| T010 | -                      | Polish | USER     |
| T011 | -                      | Polish | -        |

**Total Tasks**: 11
**Estimated Time**: 35 minutes
