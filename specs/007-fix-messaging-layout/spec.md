# Feature Specification: Fix Messaging Layout

**Feature Branch**: `007-fix-messaging-layout`
**Created**: 2025-11-29
**Status**: Draft
**Input**: User description: "Fix Messaging Layout - Critical scroll and viewport issues: (1) Cannot scroll message list - messages overflow but no scroll appears, (2) Reply input box clipped at bottom of viewport - not visible, (3) Decryption errors for placeholder messages need graceful handling. Root cause investigation needed for CSS layout chain from page.tsx through ChatWindow. Must test with 30+ messages to verify scroll works."

## Clarifications

### Session 2025-11-29

- Q: Should we handle nested scroll containers with iOS-specific CSS? → A: No nested scrolling. Single scroll container for messages only - header and input are fixed.

## Root Cause Analysis

### Current Layout Chain (Broken)

```
page.tsx:370  fixed top-16 right-0 bottom-4 left-0     <- Fixed container
  └── page.tsx:372  drawer h-full                       <- h-full = 100% parent
      └── page.tsx:382  drawer-content flex h-full flex-col  <- Flex column
          └── page.tsx:414  main min-h-0 flex-1 overflow-hidden
              └── page.tsx:416  div flex h-full flex-col overflow-hidden  <- PROBLEM
                  └── ChatWindow min-h-0 flex-1
                      └── ChatWindow:124  div flex h-full flex-col overflow-hidden
                          ├── header shrink-0  (fixed height)
                          ├── div min-h-0 flex-1  (message thread wrapper)
                          │   └── MessageThread h-full overflow-y-auto  <- SCROLL HERE
                          └── div shrink-0  (input area)
```

### Issues Identified

1. **Too many nested `h-full` declarations** - Height doesn't propagate reliably through 6+ layers of flexbox with `h-full`
2. **`page.tsx:416` wrapper div** - Adds unnecessary flex container with `h-full`
3. **No explicit grid layout** - Flexbox with nested `h-full` is unreliable for this pattern
4. **Jump button uses `absolute bottom-4`** - Gets clipped when container height fails

### Solution: Single Scroll Container

**No nested scrolling.** One scroll container for messages only:

- Header: Fixed at top of chat area
- Message list: ONLY scrollable element
- Input: Fixed at bottom of chat area

CSS Grid `grid-rows-[auto_1fr_auto]` creates this structure:

- **auto**: Header (fixed height, no scroll)
- **1fr**: Message list (ONLY scroll here)
- **auto**: Input (fixed height, no scroll)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Scroll Message History (Priority: P1)

User opens a conversation with 30+ messages and can scroll up/down through the entire message history.

**Why this priority**: Without scroll, the messaging feature is completely broken - users cannot see their messages.

**Independent Test**: Load conversation with 30 test messages, verify scroll bar appears and all messages are accessible.

**Acceptance Scenarios**:

1. **Given** a conversation with 30 messages, **When** user opens the conversation, **Then** scroll bar appears on message list
2. **Given** a conversation with 30 messages, **When** user scrolls to top, **Then** they can see the oldest message
3. **Given** a conversation with 30 messages, **When** user scrolls to bottom, **Then** they can see the newest message and input box

---

### User Story 2 - Message Input Visible (Priority: P1)

User can always see the message input box at the bottom of the viewport without it being clipped.

**Why this priority**: Without visible input, users cannot send messages - core feature is broken.

**Independent Test**: Open any conversation, verify input box is fully visible at bottom of screen.

**Acceptance Scenarios**:

1. **Given** any conversation, **When** user views the chat, **Then** message input is fully visible at bottom
2. **Given** mobile viewport (375px width), **When** user views chat, **Then** input box is not clipped
3. **Given** desktop viewport, **When** user views chat, **Then** input box has proper padding from screen edge

---

### User Story 3 - Jump to Bottom Button (Priority: P2)

User can click "Jump to Bottom" button to scroll to newest messages.

**Why this priority**: Important for UX but not blocking core functionality.

**Independent Test**: Scroll up 500+ pixels, verify button appears and works.

**Acceptance Scenarios**:

1. **Given** user has scrolled 500px from bottom, **When** viewing chat, **Then** jump button appears
2. **Given** jump button is visible, **When** user clicks it, **Then** view scrolls to newest message

---

### User Story 4 - Graceful Decryption Error Handling (Priority: P3)

Placeholder/unreadable messages show a clear, non-alarming message instead of error text.

**Why this priority**: UX polish - test messages in db:reset are expected to be unreadable.

**Independent Test**: View test messages created by db:reset script, verify friendly message displays.

**Acceptance Scenarios**:

1. **Given** a message that cannot be decrypted, **When** displayed, **Then** shows "Message cannot be decrypted" with lock icon
2. **Given** all messages in conversation are unreadable, **When** viewing, **Then** banner explains messages were encrypted with old keys

---

### Edge Cases

- What happens when viewport is extremely short (e.g., 400px height)? Layout must still show input.
- How does system handle landscape orientation on mobile? Must maintain scroll.
- What happens during keyboard open on mobile? Input should remain visible.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Message list MUST be the ONLY scrollable element (no nested scrolling)
- **FR-002**: Header and input MUST be fixed (non-scrolling) within the chat area
- **FR-003**: Layout MUST use CSS Grid (`grid-rows-[auto_1fr_auto]`) for single scroll container
- **FR-004**: Jump to bottom button MUST be positioned within the scroll container
- **FR-005**: Decryption errors MUST display user-friendly message, not raw error text

### Technical Implementation

**Files to modify:**

| File                                                       | Change                                           |
| ---------------------------------------------------------- | ------------------------------------------------ |
| `src/app/messages/page.tsx`                                | Remove wrapper div at line 416, simplify nesting |
| `src/components/organisms/ChatWindow/ChatWindow.tsx`       | Use CSS Grid layout instead of flexbox           |
| `src/components/molecular/MessageThread/MessageThread.tsx` | Ensure scroll container has explicit height      |
| `src/components/atomic/MessageBubble/MessageBubble.tsx`    | Improve decryption error display                 |

**CSS Grid Pattern for ChatWindow:**

```tsx
<div className="grid h-full grid-rows-[auto_1fr_auto]">
  <header>...</header> {/* auto = natural height */}
  <div className="min-h-0 overflow-y-auto">
    {' '}
    {/* 1fr = remaining space */}
    <MessageThread />
  </div>
  <div>...</div> {/* auto = natural height */}
</div>
```

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: With 30 messages, user can scroll to see all messages within 1 second of page load
- **SC-002**: Message input is 100% visible on all tested viewports (375px, 768px, 1024px, 1440px)
- **SC-003**: Jump to bottom button appears when scrolled 500px+ from bottom and works correctly
- **SC-004**: Decryption error messages display friendly text, not "[Message could not be decrypted]" or raw errors
- **SC-005**: Layout works on Chrome, Firefox, and Safari if available (Chrome DevTools mobile emulation acceptable for Safari mobile testing)

### Testing Commands

```bash
# Reset database with test messages
docker compose exec scripthammer pnpm run db:reset

# Login as test user
# Email: test@example.com
# Password: (from .env TEST_USER_PRIMARY_PASSWORD)

# Navigate to /messages and verify:
# 1. 30 test messages are visible
# 2. Scroll works
# 3. Input box is visible at bottom
```
