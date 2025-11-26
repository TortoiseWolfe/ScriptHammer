# PRP-036: Unified Messaging Sidebar

**Status**: Planning
**Priority**: P1 (UX Improvement)
**Feature Branch**: `036-unified-messaging-sidebar`
**Dependencies**: PRP-023 (User Messaging System)
**Estimated Effort**: 3-5 days

---

## Problem Statement

The current social networking UX is fragmented and clunky:

1. **Multiple disconnected pages**: Users must navigate between `/conversations`, `/messages`, and `/messages/connections` to find people and message them
2. **No "Message" button**: Accepted connections have only a "Remove" button - no way to start a conversation directly
3. **Dead-end flows**: After accepting a friend request, there's no clear path to messaging that person
4. **Implicit conversation creation**: Conversations only get created when the first message is sent, causing confusion
5. **Confusing navigation**: Users report needing "multiple screens to find a connection and still don't see where to message them"

---

## Solution Overview

Create a unified messaging experience with a tabbed sidebar that consolidates all social features into one cohesive interface:

1. **UnifiedSidebar component**: Combines conversations, connections, and user search in one sidebar
2. **Three tabs**: "Chats" | "Connections" | "Find People"
3. **"Message" button**: Directly message accepted connections with one click
4. **getOrCreateConversation()**: Explicit function to create conversations when messaging
5. **Mobile drawer**: Responsive design with collapsible sidebar on mobile

---

## User Stories

### Core UX Improvements

1. **As a user**, I want to see my chats and connections in one place so I don't have to navigate between pages
2. **As a user**, I want to click "Message" on an accepted connection to start chatting immediately
3. **As a user**, I want to switch between chats, connections, and finding new people with simple tabs
4. **As a user**, I want the sidebar to collapse on mobile so I can focus on the chat

### Navigation Simplification

5. **As a user**, I want one main messaging page (`/messages`) that handles everything
6. **As a user**, I want clear visual distinction between the three sections (chats/connections/find)
7. **As a user**, I want to see unread counts and pending requests at a glance

---

## Technical Requirements

### New Component: UnifiedSidebar

**Location**: `src/components/organisms/UnifiedSidebar/`

**5-file pattern**:

```
UnifiedSidebar/
  index.tsx                         # Barrel export
  UnifiedSidebar.tsx                # Main component
  UnifiedSidebar.test.tsx           # Unit tests
  UnifiedSidebar.stories.tsx        # Storybook
  UnifiedSidebar.accessibility.test.tsx  # A11y tests
```

**Props Interface**:

```typescript
interface UnifiedSidebarProps {
  selectedConversationId?: string | null;
  onConversationSelect: (conversationId: string) => void;
  onStartConversation: (userId: string) => Promise<string>;
  className?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}
```

**Tab Structure**:

```typescript
type SidebarTab = 'chats' | 'connections' | 'find';
```

### New Service Function: getOrCreateConversation

**Location**: `src/services/messaging/connection-service.ts`

```typescript
/**
 * Get existing conversation or create a new one between current user and another user.
 * Enforces canonical ordering (smaller UUID = participant_1).
 *
 * @param otherUserId - UUID of the other participant
 * @returns Conversation ID
 * @throws Error if users are not connected (accepted status required)
 */
export async function getOrCreateConversation(
  otherUserId: string
): Promise<string>;
```

**Implementation Notes**:

- Check if conversation exists with canonical ordering
- If exists, return existing conversation ID
- If not, create new conversation
- Verify connection status is "accepted" before creating
- Handle race conditions with upsert pattern

### UI Changes

**Chats Tab**:

- Reuse content from existing `ConversationList`
- Keep All/Unread/Archived sub-filters
- Search and sort functionality

**Connections Tab**:

- Reuse content from existing `ConnectionManager`
- Add "Message" button to accepted connections
- Show Pending Received / Pending Sent / Accepted / Blocked sections

**Find People Tab**:

- Reuse content from existing `UserSearch`
- Search users, send friend requests

---

## Mobile Responsiveness

### Desktop (md+)

- Fixed sidebar on left (w-80 to w-96)
- ChatWindow fills remaining space
- Both always visible

### Mobile (<md)

- DaisyUI drawer pattern
- Full-screen sidebar OR full-screen chat (not both)
- Back button in ChatWindow to return to sidebar
- Swipe gestures (optional enhancement)

```tsx
// Mobile drawer pattern
<div className="drawer md:drawer-open">
  <input type="checkbox" className="drawer-toggle" checked={isMobileOpen} />
  <div className="drawer-side z-40">
    <UnifiedSidebar onMobileClose={() => setMobileOpen(false)} />
  </div>
  <div className="drawer-content">
    <ChatWindow onBackClick={() => setMobileOpen(true)} />
  </div>
</div>
```

---

## Files to Create

```
src/components/organisms/UnifiedSidebar/
  index.tsx
  UnifiedSidebar.tsx
  UnifiedSidebar.test.tsx
  UnifiedSidebar.stories.tsx
  UnifiedSidebar.accessibility.test.tsx
```

## Files to Modify

| File                                                               | Change                                                          |
| ------------------------------------------------------------------ | --------------------------------------------------------------- |
| `src/services/messaging/connection-service.ts`                     | Add `getOrCreateConversation()` function                        |
| `src/app/messages/page.tsx`                                        | Replace ConversationList with UnifiedSidebar, add mobile drawer |
| `src/components/GlobalNav.tsx`                                     | Update nav links (remove separate connections link)             |
| `src/components/organisms/ConnectionManager/ConnectionManager.tsx` | Add "Message" button to accepted connections                    |

## Files to Deprecate/Redirect

| File                                    | Action                                      |
| --------------------------------------- | ------------------------------------------- |
| `src/app/messages/connections/page.tsx` | Redirect to `/messages?tab=connections`     |
| `src/app/conversations/page.tsx`        | Redirect to `/messages` (already redundant) |

---

## Testing Requirements

### Unit Tests

**UnifiedSidebar**:

- Tab switching works correctly
- Renders correct content for each tab
- Calls onConversationSelect when chat selected
- Calls onStartConversation when messaging a connection

**getOrCreateConversation**:

- Returns existing conversation if one exists
- Creates new conversation if none exists
- Enforces canonical ordering
- Rejects if users not connected

### Accessibility Tests

- Tab navigation via keyboard (Arrow keys, Tab)
- Screen reader announces tab changes
- Focus management when switching tabs
- 44px touch targets on all interactive elements

### E2E Tests

**Complete flow**:

1. User opens /messages
2. Clicks "Connections" tab
3. Sees accepted connections with "Message" button
4. Clicks "Message" on a connection
5. Conversation opens in ChatWindow
6. Can send a message

---

## Success Criteria

- [ ] Single `/messages` page handles all messaging functionality
- [ ] Users can message accepted connections with one click
- [ ] Tab switching is smooth and maintains state
- [ ] Mobile drawer pattern works correctly
- [ ] No regression in existing messaging functionality
- [ ] All new components follow 5-file pattern
- [ ] 44px touch targets on all interactive elements
- [ ] WCAG AA accessibility compliance

---

## Out of Scope

- Group conversations (separate PRP)
- Redesigning the ChatWindow component
- Push notifications improvements
- Message search enhancements

---

## Related PRPs

- **PRP-023**: User Messaging System (DEPENDENCY - base messaging infrastructure)
- **PRP-035**: Fix Profile Update (RELATED - recent profile data improvements)
