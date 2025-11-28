# Research: Unified Messaging Sidebar

**Feature Branch**: `037-unified-messaging-sidebar`
**Date**: 2025-11-26

## Executive Summary

This feature consolidates three separate messaging pages (`/messages`, `/messages/connections`, `/conversations`) into a single unified experience with a tabbed sidebar. The primary change is UI/UX - no database schema changes required.

## Existing Infrastructure Analysis

### Current Page Structure

| Route                   | Component                      | Purpose               |
| ----------------------- | ------------------------------ | --------------------- |
| `/messages`             | ConversationList + ChatWindow  | Main messaging UI     |
| `/messages/connections` | UserSearch + ConnectionManager | Connection management |
| `/conversations`        | ConversationList               | Redundant list view   |

### Components to Reuse

#### 1. ConversationList (organism)

- **Location**: `src/components/organisms/ConversationList/`
- **Features**: Search, filter (All/Unread/Archived), sort, keyboard shortcuts
- **Hook**: `useConversationList` - manages conversation state, real-time updates
- **Counts**: Provides `counts.all`, `counts.unread`, `counts.archived`

#### 2. ConnectionManager (organism)

- **Location**: `src/components/organisms/ConnectionManager/`
- **Features**: Tabs for Received/Sent/Accepted/Blocked, accept/decline/block actions
- **Hook**: `useConnections` - manages connection state
- **Gap**: Missing "Message" button on accepted connections

#### 3. UserSearch (molecular)

- **Location**: `src/components/molecular/UserSearch/`
- **Features**: Search users by display_name, send friend requests
- **Service**: Uses `connectionService.searchUsers()`

#### 4. ChatWindow (organism)

- **Location**: `src/components/organisms/ChatWindow/`
- **No changes needed** - will be reused as-is

### Services

#### ConnectionService

- **Location**: `src/services/messaging/connection-service.ts`
- **Methods**: `sendFriendRequest()`, `respondToRequest()`, `searchUsers()`, `getConnections()`, `removeConnection()`
- **Gap**: Missing `getOrCreateConversation()` - needs to be added

#### MessageService

- **Location**: `src/services/messaging/message-service.ts`
- **Methods**: `sendMessage()`, `getMessageHistory()`, `markAsRead()`
- **Note**: Conversation creation currently happens implicitly when first message is sent

### Database Schema (No Changes Required)

Existing tables support all requirements:

- `user_connections` - Friend requests with status
- `conversations` - Chat threads with canonical ordering
- `messages` - Encrypted message content

### Current /messages Page Layout

```tsx
// src/app/messages/page.tsx (simplified)
<div className="fixed inset-0 flex flex-col md:flex-row">
  <aside className="w-full md:w-80 lg:w-96 border-r">
    <ConversationList selectedConversationId={conversationId} />
  </aside>
  <main className="flex-1">
    <ChatWindow ... />
  </main>
</div>
```

## Implementation Approach

### Option A: Modify Existing Page (RECOMMENDED)

- Add tab state to `/messages/page.tsx`
- Conditionally render ConversationList, ConnectionManager, or UserSearch
- Less file churn, faster implementation
- Risk: Growing complexity in single file

### Option B: Create UnifiedSidebar Component

- New component that encapsulates all three tabs
- Cleaner separation of concerns
- Follows 5-file pattern requirement
- More files but better maintainability

**Decision**: Option B - Create UnifiedSidebar component to follow project conventions and maintain clean architecture.

## Key Technical Decisions

### 1. getOrCreateConversation Implementation

Must handle:

- Canonical ordering (smaller UUID = participant_1_id)
- Race condition prevention (upsert or select-then-insert)
- Connection status validation

```typescript
// Pseudocode
async function getOrCreateConversation(otherUserId: string): Promise<string> {
  const user = await getAuthenticatedUser();

  // Enforce canonical ordering
  const [participant_1, participant_2] =
    user.id < otherUserId ? [user.id, otherUserId] : [otherUserId, user.id];

  // Check existing
  const existing = await supabase
    .from('conversations')
    .select('id')
    .eq('participant_1_id', participant_1)
    .eq('participant_2_id', participant_2)
    .single();

  if (existing.data) return existing.data.id;

  // Create new
  const created = await supabase
    .from('conversations')
    .insert({
      participant_1_id: participant_1,
      participant_2_id: participant_2,
    })
    .select('id')
    .single();

  return created.data.id;
}
```

### 2. Tab State Management

Options:

- URL query param (`/messages?tab=connections`) - Enables deep linking, back button works
- React state only - Simpler, but loses state on refresh
- localStorage - Persists across sessions

**Decision**: URL query param for deep linking support (FR-008 redirects require this)

### 3. Mobile Drawer Pattern

Use DaisyUI drawer component:

```tsx
<div className="drawer md:drawer-open">
  <input type="checkbox" className="drawer-toggle" />
  <div className="drawer-side z-40">
    <UnifiedSidebar />
  </div>
  <div className="drawer-content">
    <ChatWindow />
  </div>
</div>
```

## Risk Assessment

| Risk                                            | Probability | Impact | Mitigation                                     |
| ----------------------------------------------- | ----------- | ------ | ---------------------------------------------- |
| Tab state conflicts with conversation selection | Medium      | Medium | Clear state management, URL as source of truth |
| Performance degradation with 3 tab contents     | Low         | Low    | Only render active tab content                 |
| Breaking existing /messages functionality       | Medium      | High   | Comprehensive test coverage before refactor    |
| Race condition in getOrCreateConversation       | Low         | Medium | Database UNIQUE constraint + error handling    |

## Dependencies

- No new npm packages required
- Uses existing DaisyUI components (tabs, drawer)
- Uses existing Supabase infrastructure

## Out of Scope

- Database schema changes
- New API endpoints
- Changes to encryption/messaging logic
- Group conversations
