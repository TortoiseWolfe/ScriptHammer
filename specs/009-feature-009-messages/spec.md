# Feature Specification: Messages Page Code Quality

**Feature Branch**: `009-feature-009-messages`
**Created**: 2025-11-30
**Status**: Draft
**Input**: User description: "Feature 009: Messages Page Code Quality - Fix 18 code review issues across 4 phases"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Critical Bug Fixes (Priority: P1)

As a developer, I need the messaging system to have proper TypeScript safety, no memory leaks, and working connection count badges so the codebase follows project standards and users see accurate information.

**Why this priority**: These issues cause runtime errors, memory leaks, and broken functionality (connection badges always show 0).

**Independent Test**: Can be tested by verifying TypeScript compiles without `any` types, checking React DevTools for memory leaks, and confirming connection badges update when pending requests exist.

**Acceptance Scenarios**:

1. **Given** a user with 3 pending connection requests, **When** they view the Messages sidebar, **Then** the Connections tab badge shows "3"
2. **Given** error handling code at lines 284/304, **When** TypeScript strict mode is enabled, **Then** compilation succeeds without `any` type warnings
3. **Given** the setup toast is shown, **When** user navigates away before 10 seconds, **Then** no React state-after-unmount warnings appear in console
4. **Given** production build, **When** user loads messages page, **Then** no console.warn statements pollute browser console

---

### User Story 2 - High Priority Code Quality (Priority: P2)

As a developer, I need consistent architecture patterns for count callbacks and properly managed useEffect dependencies so the codebase is maintainable and free of stale closure bugs.

**Why this priority**: These issues cause subtle bugs and make the codebase harder to maintain.

**Independent Test**: Can be tested by ESLint passing without exhaustive-deps disable comments and both unread/pending counts following same callback pattern.

**Acceptance Scenarios**:

1. **Given** messages page component, **When** ESLint runs, **Then** no `react-hooks/exhaustive-deps` warnings are suppressed
2. **Given** UnifiedSidebar component, **When** checking its interface, **Then** `onPendingConnectionCountChange` callback exists alongside `onUnreadCountChange`
3. **Given** ConnectionManager detects new pending request, **When** count changes, **Then** parent component receives callback notification

---

### User Story 3 - Medium Priority Improvements (Priority: P3)

As a developer, I need consistent code patterns, proper accessibility, and stable virtual scrolling so the codebase follows best practices.

**Why this priority**: These issues affect code consistency, accessibility compliance, and edge case stability.

**Independent Test**: Can be tested by accessibility audit passing, virtual scroll maintaining stable keys during edits, and className patterns being consistent.

**Acceptance Scenarios**:

1. **Given** ChatWindow component, **When** className prop is passed, **Then** it uses consistent `cn()` utility pattern
2. **Given** conversation search clear button, **When** screen reader reads it, **Then** label says "Clear conversation search" not generic "Clear search"
3. **Given** virtual scroll with 200+ messages, **When** a message is edited, **Then** React doesn't re-render entire list (stable keys)
4. **Given** loadConversationInfo and loadMessages, **When** both complete, **Then** participant name doesn't flicker between values
5. **Given** MessageThread component, **When** reading scroll threshold constants, **Then** each has explanatory comment

---

### User Story 4 - Low Priority Polish (Priority: P4)

As a developer, I need proper error boundaries, cleanup patterns, and consistent fallback text so edge cases are handled gracefully.

**Why this priority**: These issues affect edge case handling and defensive coding practices.

**Independent Test**: Can be tested by verifying error boundaries catch child crashes, Supabase channels properly unsubscribe, and fallback text is consistent.

**Acceptance Scenarios**:

1. **Given** ChatWindow throws an error, **When** error occurs, **Then** error boundary catches it instead of crashing entire page
2. **Given** user navigates away from ConversationList, **When** component unmounts, **Then** Supabase channel is unsubscribed then removed
3. **Given** user profile not found, **When** displaying participant name, **Then** shows "Unknown User" consistently (not "Deleted User")
4. **Given** React Profiler code, **When** production build runs, **Then** no Profiler overhead exists

---

### Edge Cases

- What happens when pending connection count callback is called during unmount?
- How does system handle err:unknown when error has no message property?
- What happens when toast timeout fires after component unmount?
- How does virtual scroll handle message deletion mid-scroll?
- What happens when both loadConversationInfo and loadMessages fail simultaneously?

## Requirements _(mandatory)_

### Functional Requirements

**Phase 1 - Critical**

- **FR-001**: System MUST pass `setPendingConnectionCount` callback to UnifiedSidebar and wire through to ConnectionManager
- **FR-002**: System MUST use `catch (err: unknown)` with proper type checking instead of `catch (err: any)`
- **FR-003**: System MUST store toast setTimeout in ref and cleanup on unmount
- **FR-004**: System MUST remove all console.warn statements or replace with createLogger

**Phase 2 - High**

- **FR-005**: System MUST include loadConversationInfo and loadMessages in useEffect dependencies or properly memoize
- **FR-006**: UnifiedSidebar MUST define `onPendingConnectionCountChange` callback prop
- **FR-007**: ConnectionManager MUST call pending count callback when counts change

**Phase 3 - Medium**

- **FR-008**: All components MUST use consistent className concatenation pattern with cn() utility
- **FR-009**: Clear search button MUST have contextual aria-label "Clear conversation search"
- **FR-010**: Virtual scroll MUST use message.id as key, not virtualItem.key
- **FR-011**: Conversation loading MUST avoid race condition causing participant name flicker
- **FR-012**: Scroll thresholds MUST be documented constants with explanatory comments

**Phase 4 - Low**

- **FR-013**: React Profiler MUST be conditionally loaded or removed for production
- **FR-014**: ChatWindow and sidebar MUST be wrapped in ErrorBoundary
- **FR-015**: Supabase channel cleanup MUST call unsubscribe() before removeChannel()
- **FR-016**: Profile not found MUST show "Unknown User" consistently
- **FR-017**: Error handling MUST follow consistent pattern using createLogger utility
- **FR-018**: Critical callback props SHOULD have development-mode runtime validation

### Key Entities

- **MessagesPage**: Parent component managing conversation state and callbacks
- **UnifiedSidebar**: Sidebar with tabs for Chats/Connections, receives count callbacks
- **ConnectionManager**: Manages connection requests, needs to bubble up pending count
- **ChatWindow**: Chat display with error boundary needed
- **MessageThread**: Virtual scroll with key and threshold improvements needed

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: TypeScript compiles with zero `any` type warnings in messages page files
- **SC-002**: ESLint passes with zero suppressed react-hooks/exhaustive-deps warnings
- **SC-003**: React DevTools shows no memory leak warnings on navigation
- **SC-004**: Production build has zero console.warn statements from messages page
- **SC-005**: Connection badge accurately reflects pending request count
- **SC-006**: Accessibility audit passes for conversation search button
- **SC-007**: Error boundary catches ChatWindow errors without page crash
- **SC-008**: All 18 code review issues resolved and documented
