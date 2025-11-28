# Tasks: Unified Messaging Sidebar

**Input**: Design documents from `/specs/037-unified-messaging-sidebar/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type definitions and project structure preparation

- [x] T001 [P] Add `SidebarTab` type to `src/types/messaging.ts`
- [x] T002 [P] Create UnifiedSidebar component directory structure using `docker compose exec scripthammer pnpm run generate:component`

**Checkpoint**: Type definitions ready, component scaffolding in place

---

## Phase 2: Foundational (Core Service)

**Purpose**: The `getOrCreateConversation()` service method that enables the Message button

**CRITICAL**: User Story 1 cannot be completed without this phase

- [x] T003 Add unit tests for `getOrCreateConversation()` in `src/services/messaging/__tests__/connection-service.test.ts`
  - Test: returns existing conversation ID when conversation exists
  - Test: creates new conversation when none exists
  - Test: throws AuthenticationError when not signed in
  - Test: throws ConnectionError when users not connected
  - Test: handles race condition gracefully
- [x] T004 Add `getOrCreateConversation()` method to `src/services/messaging/connection-service.ts` (depends on T003)
  - Validate UUID format for otherUserId
  - Get authenticated user
  - Verify connection status is 'accepted'
  - Apply canonical ordering (smaller UUID = participant_1_id)
  - Check for existing conversation
  - Create new conversation if none exists
  - Handle race condition (unique_violation error code 23505)

**Checkpoint**: Foundation ready - getOrCreateConversation() works and is tested

---

## Phase 3: User Story 1 - Message an Accepted Connection (Priority: P1)

**Goal**: Add "Message" button to accepted connections that opens a conversation

**Independent Test**: Accept a connection, click "Message", verify conversation opens in ChatWindow

### Tests for User Story 1

- [x] T005 [P] [US1] Update ConnectionManager tests in `src/components/organisms/ConnectionManager/ConnectionManager.test.tsx`
  - Test: renders Message button for accepted connections when onMessage prop provided
  - Test: does not render Message button when onMessage prop is undefined
  - Test: calls onMessage with correct userId when Message button clicked
  - Test: Message button shows loading spinner when clicked (LR-002)
  - Test: Message button is disabled during loading state

### Implementation for User Story 1

- [x] T006 [US1] Update ConnectionManagerProps interface in `src/components/organisms/ConnectionManager/ConnectionManager.tsx` (depends on T005)
  - Add `onMessage?: (userId: string) => void` prop
- [x] T007 [US1] Add Message button to accepted connections in `src/components/organisms/ConnectionManager/ConnectionManager.tsx` (depends on T005)
  - Add button in `renderConnectionItem` for `type === 'accepted'`
  - Use `btn btn-primary btn-sm min-h-11 min-w-11` classes for 44px touch target
  - Calculate otherUserId from connection.requester_id vs item.requester.id
  - Add loading state: track `messageLoading` userId, show `loading loading-spinner` when active (LR-002)
  - Disable button during loading to prevent double-clicks

**Checkpoint**: User Story 1 complete - "Message" button works on accepted connections

---

## Phase 4: User Story 2 - Unified Sidebar Navigation (Priority: P2)

**Goal**: Create tabbed sidebar with Chats, Connections, Find People tabs

**Independent Test**: Switch between tabs, verify each displays correct content without page reload

### Tests for User Story 2

- [x] T008 [P] [US2] Create unit tests in `src/components/organisms/UnifiedSidebar/UnifiedSidebar.test.tsx`
  - Test: renders all three tabs (Chats, Connections, Find People)
  - Test: highlights active tab correctly
  - Test: calls onTabChange when tab clicked
  - Test: renders ConversationList when chats tab active
  - Test: renders ConnectionManager when connections tab active
  - Test: renders UserSearch when find tab active
  - Test: displays unread count badge on Chats tab when count > 0
  - Test: displays pending connection count badge on Connections tab when count > 0
  - Test: badge shows exact number for 1-99, shows "99+" for >= 100
  - Test: shows skeleton loader when tab content is loading (LR-001)
  - Test: selected conversation has visible focus indicator ring (AR-005)
  - Test: keyboard navigation works (Arrow keys, Enter, Home, End) (AR-002)
- [x] T009 [P] [US2] Create accessibility tests in `src/components/organisms/UnifiedSidebar/UnifiedSidebar.accessibility.test.tsx`
  - Test: all interactive elements have 44px minimum touch targets
  - Test: tabs have proper ARIA roles (role="tablist", role="tab", aria-selected)
  - Test: tab panels have role="tabpanel" with aria-labelledby
  - Test: badge counts are announced via aria-label (AR-004)
  - Test: passes axe accessibility audit

### Implementation for User Story 2

- [x] T010 [US2] Implement UnifiedSidebar component in `src/components/organisms/UnifiedSidebar/UnifiedSidebar.tsx` (depends on T006, T007)
  - Props: selectedConversationId, onConversationSelect, onStartConversation, activeTab, onTabChange
  - Tab navigation with DaisyUI tabs (tabs tabs-bordered)
  - Conditional rendering of ConversationList, ConnectionManager, UserSearch
  - Pass onMessage handler to ConnectionManager
  - Display unread message count badge on Chats tab (exact number 1-99, "99+" for >= 100)
  - Display pending connection count badge on Connections tab (same format)
  - ARIA roles: role="tablist" on container, role="tab" with aria-selected on each tab
  - Tab panels: role="tabpanel" with aria-labelledby pointing to tab id
  - Badge aria-label: "Chats, X unread messages" format (AR-004)
  - Keyboard navigation: Arrow Left/Right, Enter/Space, Home, End (AR-002)
  - Selected conversation focus indicator: `ring-2 ring-primary` class (AR-005)
  - Skeleton loader: Show DaisyUI skeleton within 100ms if content not cached (LR-001)
  - Track lastActiveTimestamp per tab for background refresh logic (DC-002)
- [x] T011 [US2] Create barrel export in `src/components/organisms/UnifiedSidebar/index.tsx`
- [x] T012 [US2] Create Storybook stories in `src/components/organisms/UnifiedSidebar/UnifiedSidebar.stories.tsx`
  - Story: Default (chats tab active)
  - Story: Connections tab active
  - Story: Find People tab active
  - Story: With selected conversation (showing focus ring)
  - Story: Loading state (skeleton visible)
  - Story: With badge counts (showing 5 unread, 2 pending)
  - Story: With high badge count (showing "99+")

**Checkpoint**: User Story 2 complete - UnifiedSidebar component works with tab switching

---

## Phase 5: User Story 3 - Mobile Drawer Pattern (Priority: P3)

**Goal**: Sidebar collapses to drawer on mobile viewports (<768px)

**Independent Test**: On mobile viewport, open drawer, select conversation, verify drawer closes

### Tests for User Story 3

- [x] T012a [P] [US3] Add page-level tests for error handling and offline behavior
  - Test: shows toast with role="alert" when getOrCreateConversation fails (AR-006)
  - Test: shows offline banner when navigator.onLine is false (LR-004)
  - Test: hides offline banner when connection restored
  - Test: error toast shows correct message per error type

### Implementation for User Story 3

- [x] T013 [US3] Update `/messages/page.tsx` with URL-based tab state management
  - Parse `?tab=` query param (default to 'chats')
  - Parse `?conversation=` query param for selected conversation
  - Use `useSearchParams` from next/navigation
  - Preserve scroll position when switching tabs (use useRef to store per-tab scroll positions)
  - Push to browser history on tab changes
- [x] T014 [US3] Replace ConversationList with UnifiedSidebar in `/messages/page.tsx`
  - Pass tab state and handlers
  - Implement onStartConversation using connectionService.getOrCreateConversation()
  - Navigate to conversation after creation
  - Handle errors with toast notifications using role="alert" aria-live="assertive" (AR-006)
  - Show specific error messages per Error Types table in spec.md
- [x] T015 [US3] Implement mobile drawer pattern in `/messages/page.tsx`
  - Use DaisyUI drawer component (`drawer md:drawer-open`)
  - Add drawer toggle checkbox with 44px touch target
  - Set sidebar as drawer-side content
  - Set ChatWindow as drawer-content
  - Close drawer when conversation selected on mobile
  - Manage focus on drawer open/close (AR-003)
- [x] T015a [US3] Implement offline indicator banner (LR-004)
  - Use `navigator.onLine` and `online`/`offline` events to detect network status
  - Show `alert alert-warning` banner: "You're offline. Showing cached data."
  - Auto-dismiss when connection restored
- [x] T015b [US3] Verify real-time subscriptions are active (RT-001, RT-002)
  - Verify existing useConversations hook subscribes to messages table for unread counts
  - Verify existing useConnections hook subscribes to user_connections table for pending counts
  - Badge counts should update without manual refresh

**Checkpoint**: User Story 3 complete - mobile drawer pattern works

---

## Phase 6: User Story 4 - Consolidated Entry Point (Priority: P4)

**Goal**: Redirect legacy routes to /messages with appropriate tab

**Independent Test**: Visit /conversations and /messages/connections, verify redirects work

### Implementation for User Story 4

- [x] T016 [P] [US4] Create redirect in `src/app/conversations/page.tsx`
  - Import `redirect` from next/navigation
  - Redirect to `/messages?tab=chats`
- [x] T017 [P] [US4] Create redirect in `src/app/messages/connections/page.tsx`
  - Import `redirect` from next/navigation
  - Redirect to `/messages?tab=connections`
- [x] T018 [US4] Update GlobalNav navigation links in `src/components/GlobalNav.tsx`
  - Change `/messages/connections` to `/messages?tab=connections`
  - Update any other references to old routes

**Checkpoint**: User Story 4 complete - all legacy routes redirect correctly

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T019 Run full test suite: `docker compose exec scripthammer pnpm test`
- [x] T020 Run type check: `docker compose exec scripthammer pnpm run type-check`
- [x] T021 Run linter: `docker compose exec scripthammer pnpm run lint`
- [x] T022 Verify all quickstart.md checklist items pass
- [ ] T023 Manual testing on mobile and desktop viewports
- [ ] T024 Verify tab switching performance < 200ms (SC-003)
  - Use browser DevTools Performance tab to measure tab switch time
  - Ensure no layout thrashing or unnecessary re-renders
- [ ] T025 Verify scroll position preservation when switching tabs (FR-009)
  - Switch from Chats (scrolled) to Connections and back
  - Confirm scroll position is restored

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on T001 for types
- **Phase 3 (US1)**: Depends on Phase 2 (needs getOrCreateConversation)
- **Phase 4 (US2)**: Depends on Phase 3 (ConnectionManager changes needed)
- **Phase 5 (US3)**: Depends on Phase 4 (UnifiedSidebar must exist)
- **Phase 6 (US4)**: Depends on Phase 5 (page must work before redirects)
- **Phase 7 (Polish)**: Depends on all phases complete

### Within Each Phase

- Tests marked [P] can run in parallel
- Implementation tasks are sequential within a story
- Models/types before services
- Services before components
- Components before page integration

### Parallel Opportunities

```bash
# Phase 1 - Setup (parallel):
Task: "Add SidebarTab type to src/types/messaging.ts"
Task: "Create UnifiedSidebar component directory structure"

# Phase 4 - US2 Tests (parallel):
Task: "Create unit tests in UnifiedSidebar.test.tsx"
Task: "Create accessibility tests in UnifiedSidebar.accessibility.test.tsx"

# Phase 5 - US3 Page Features (parallel after T015):
Task: "Implement offline indicator banner"
Task: "Verify real-time subscriptions are active"

# Phase 6 - US4 Redirects (parallel):
Task: "Create redirect in src/app/conversations/page.tsx"
Task: "Create redirect in src/app/messages/connections/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (getOrCreateConversation)
3. Complete Phase 3: User Story 1 (Message button)
4. **STOP and VALIDATE**: Test Message button on accepted connections
5. Users can now message connections with 2 clicks instead of 4+

### Full Feature Delivery

1. Complete all phases in order
2. Each phase adds incremental value
3. User Story 1 alone delivers significant UX improvement

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently testable
- Commit after each task or logical group
- Use `docker compose exec scripthammer` prefix for all commands
- Follow 5-file component pattern for UnifiedSidebar

## Requirement Coverage Summary

| Requirement                 | Task(s)      | Status   |
| --------------------------- | ------------ | -------- |
| FR-001 to FR-012            | T001-T018    | Covered  |
| AR-001 (ARIA tablist)       | T009, T010   | Covered  |
| AR-002 (keyboard nav)       | T008, T010   | Covered  |
| AR-003 (focus management)   | T015         | Covered  |
| AR-004 (badge announcement) | T009, T010   | Covered  |
| AR-005 (focus indicator)    | T008, T010   | Covered  |
| AR-006 (error messages)     | T012a, T014  | Covered  |
| LR-001 (skeleton loaders)   | T008, T010   | Covered  |
| LR-002 (button loading)     | T005, T007   | Covered  |
| LR-003 (non-blocking)       | T010         | Covered  |
| LR-004 (offline indicator)  | T012a, T015a | Covered  |
| VR-001 to VR-003            | T010, T015   | Covered  |
| RT-001, RT-002 (real-time)  | T015b        | Verified |
| DC-001, DC-002 (caching)    | T010         | Covered  |
