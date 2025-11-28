# Feature Specification: Fix Conversations Page Infinite Loading Spinner

**Feature Branch**: `029-fix-conversations-page`
**Created**: 2025-11-25
**Status**: Draft
**Input**: User description: "Fix conversations page infinite loading spinner - user is signed in but page stays stuck on spinner, never shows conversations or empty state"

## Clarifications

### Session 2025-11-25

- Q: Before implementing timeout logic, should we first add diagnostic logging to identify the exact root cause of the spinner? → A: Debug first - Add console.logs to identify where loading gets stuck before writing fix

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Conversations Page Loads Successfully (Priority: P1)

As a signed-in user, I want to visit the conversations page and see my conversations list (or empty state), not an infinite loading spinner.

**Why this priority**: This is the core bug - users cannot access conversations at all. Without this fix, the messaging feature is completely unusable.

**Independent Test**: Navigate to /conversations while signed in as test user. Page should display content (conversations list or "No Conversations Yet" message) within 5 seconds.

**Acceptance Scenarios**:

1. **Given** a signed-in user with existing conversations, **When** they navigate to /conversations, **Then** they see their conversations list within 5 seconds
2. **Given** a signed-in user with no conversations, **When** they navigate to /conversations, **Then** they see the empty state message "No Conversations Yet" within 5 seconds
3. **Given** a signed-in user, **When** the Supabase query takes longer than 10 seconds, **Then** they see a timeout error message with retry option (not infinite spinner)

---

### User Story 2 - Error Handling for Failed Queries (Priority: P2)

As a user experiencing database issues, I want to see a clear error message so I know what's wrong and can take action.

**Why this priority**: If the query fails (RLS, network, etc.), users need feedback rather than being stuck on a spinner.

**Independent Test**: Simulate a database query failure and verify error message appears with retry button.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** the conversations query fails, **Then** they see an error message describing the problem
2. **Given** a user seeing an error, **When** they click "Retry", **Then** the page attempts to reload conversations

---

### Edge Cases

- What happens when auth completes but user object is null? Show "Please sign in" message
- What happens when conversations query hangs indefinitely? Timeout after 10 seconds, show error
- What happens when RLS blocks the query? Show error from Supabase
- What happens when user_profiles query fails after conversations succeed? Show conversations with "Unknown" participant names

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Developer MUST first add diagnostic console.logs to identify exact root cause of infinite spinner before implementing fixes
- **FR-002**: System MUST display conversations list or empty state within 5 seconds of page load for authenticated users
- **FR-003**: System MUST implement a 10-second timeout on the conversations Supabase query (after root cause identified)
- **FR-004**: System MUST show an error message (not spinner) when the query fails or times out
- **FR-005**: System MUST provide a "Retry" button when an error occurs
- **FR-006**: System MUST NOT show infinite spinner under any circumstance - always resolve to content, empty state, or error
- **FR-007**: System MUST retain console logging for ongoing diagnostics

### Key Entities

- **Conversation**: Database record linking two users, with last_message_at timestamp
- **Loading State**: Boolean tracking whether data is being fetched
- **Error State**: String or null tracking any error messages to display

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Conversations page shows content (list, empty state, or error) within 5 seconds for all authenticated users
- **SC-002**: No infinite spinner states - all code paths lead to a terminal UI state
- **SC-003**: E2E test passes: sign in as test user, navigate to /conversations, verify non-spinner state within 5 seconds
- **SC-004**: Console shows diagnostic logs for loading state transitions
