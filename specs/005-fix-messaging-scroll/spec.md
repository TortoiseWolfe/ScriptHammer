# Feature Specification: Fix Messaging Scroll

**Feature Branch**: `005-fix-messaging-scroll`
**Created**: 2025-11-29
**Status**: Draft
**Input**: User description: "Fix Messaging Scroll - Critical UX bug affecting all viewports where users cannot see the message input or scroll to bottom of messages. Root cause: Nested flexbox with h-full doesn't reliably calculate heights. Solution: Use CSS Grid for ChatWindow layout (grid-rows-[auto_1fr_auto]), change jump button from fixed to absolute positioning, ensure h-full propagates through container chain."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - View Message Input on All Viewports (Priority: P1)

As a user viewing any conversation, I need to see the message input field at the bottom of the screen so I can type and send messages.

**Why this priority**: This is the core bug - users literally cannot interact with the messaging feature if they can't see or access the input field. This is a complete blocker.

**Independent Test**: Navigate to /messages with a conversation selected. The message input field and send button must be visible at the bottom of the screen without scrolling, on mobile (375px), tablet (768px), and desktop (1280px) viewports.

**Acceptance Scenarios**:

1. **Given** a user is on the messages page with a conversation selected, **When** the page loads, **Then** the message input field is visible at the bottom of the chat area
2. **Given** a user is viewing messages on a mobile device (< 768px), **When** viewing any conversation, **Then** the message input and send button are fully visible and tappable
3. **Given** a user is viewing messages on desktop (≥ 768px), **When** viewing any conversation with the sidebar open, **Then** the message input is visible at the bottom of the chat area

---

### User Story 2 - Scroll Through Long Message History (Priority: P1)

As a user with many messages in a conversation, I need to scroll through the message history while keeping the input visible at the bottom.

**Why this priority**: Users need to read previous messages while still being able to respond. The scroll area must be constrained to the message list, not the entire page.

**Independent Test**: Load a conversation with 20+ messages. Scroll up through the messages. The message input should remain fixed at the bottom while only the message list scrolls.

**Acceptance Scenarios**:

1. **Given** a conversation with 20+ messages, **When** the user scrolls up, **Then** older messages become visible while the message input remains at the bottom
2. **Given** the user is scrolled up in the message history, **When** a new message arrives, **Then** they can scroll down to see it OR click the jump-to-bottom button
3. **Given** the message list is longer than the viewport, **When** the user reaches the top, **Then** pagination loads older messages (if available)

---

### User Story 3 - Jump to Bottom Button Works (Priority: P2)

As a user who has scrolled up in the message history, I need to quickly jump back to the most recent messages using the jump-to-bottom button.

**Why this priority**: The jump button is a convenience feature. It should work correctly but is secondary to the core scroll functionality.

**Independent Test**: Scroll up in a long conversation. The jump-to-bottom button should appear and be clickable. Clicking it should smoothly scroll to the newest messages.

**Acceptance Scenarios**:

1. **Given** the user has scrolled more than 500px from the bottom, **When** viewing the message thread, **Then** a jump-to-bottom button appears
2. **Given** the jump-to-bottom button is visible, **When** clicked, **Then** the view smoothly scrolls to the most recent messages
3. **Given** the jump-to-bottom button is visible, **When** displayed, **Then** it does not overlap or block the message input field

---

### Edge Cases

- What happens when the conversation has 0 messages? Empty state should display with input still visible at bottom
- What happens with very long messages that exceed viewport height? Message should wrap and be scrollable within the thread
- How does the system handle the mobile drawer being open? Sidebar overlays, chat remains scrollable when sidebar closes
- What happens on orientation change (portrait to landscape)? Layout should recalculate and input remain visible

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display the message input field at the bottom of the chat area on all viewports (mobile, tablet, desktop)
- **FR-002**: System MUST constrain scrolling to the message thread area only, keeping header and input fixed in position
- **FR-003**: System MUST use CSS Grid layout (grid-rows-[auto_1fr_auto]) for the ChatWindow to ensure reliable height calculation
- **FR-004**: System MUST position the jump-to-bottom button relative to its scroll container (absolute), not the viewport (fixed)
- **FR-005**: System MUST propagate explicit height (h-full) through the container chain from the fixed container to the chat window

### Key Entities

- **ChatWindow**: Container component using CSS Grid with 3 rows: header (auto), message thread (1fr), input (auto)
- **MessageThread**: Scrollable container for messages, constrained to available space between header and input
- **MessageInput**: Fixed-height input area at the bottom of the chat window

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Message input is visible without scrolling on 100% of page loads across all tested viewports
- **SC-002**: Users can scroll through 100+ messages while input remains visible at bottom
- **SC-003**: Jump-to-bottom button appears when scrolled 500px+ from bottom and does not overlap input
- **SC-004**: Layout renders correctly on mobile (375x667), tablet (768x1024), and desktop (1280x800) viewports
