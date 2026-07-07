# Data Model: Unified Messaging Sidebar

**Feature Branch**: `037-unified-messaging-sidebar`
**Date**: 2025-11-26

## Component Hierarchy

```
src/app/messages/page.tsx
└── MessagesContent
    ├── UnifiedSidebar (NEW)
    │   ├── SidebarTabs (tab navigation)
    │   ├── ConversationList (existing - "Chats" tab)
    │   ├── ConnectionsTab (NEW - wraps ConnectionManager + Message button)
    │   │   └── ConnectionManager (existing - modified for onMessage prop)
    │   └── UserSearch (existing - "Find People" tab)
    │
    └── ChatWindow (existing)
```

## New Types

### SidebarTab Enum

```typescript
// src/types/messaging.ts
export type SidebarTab = 'chats' | 'connections' | 'find';
```

### UnifiedSidebarProps

```typescript
// src/components/organisms/UnifiedSidebar/UnifiedSidebar.tsx
export interface UnifiedSidebarProps {
  /** Currently selected conversation ID */
  selectedConversationId?: string | null;
  /** Callback when a conversation is selected */
  onConversationSelect: (conversationId: string) => void;
  /** Callback to start conversation with a user (returns conversation ID) */
  onStartConversation: (userId: string) => Promise<string>;
  /** Currently active tab */
  activeTab: SidebarTab;
  /** Callback when tab changes */
  onTabChange: (tab: SidebarTab) => void;
  /** Additional CSS classes */
  className?: string;
}
```

### ConnectionManagerProps Update

```typescript
// src/components/organisms/ConnectionManager/ConnectionManager.tsx
export interface ConnectionManagerProps {
  onRefreshAvailable?: (refresh: () => Promise<void>) => void;
  className?: string;
  /** NEW: Callback when "Message" button clicked on accepted connection */
  onMessage?: (userId: string) => void;
}
```

## State Management

### URL Query Parameters

```
/messages                       → tab=chats (default)
/messages?tab=chats             → Chats tab active
/messages?tab=connections       → Connections tab active
/messages?tab=find              → Find People tab active
/messages?conversation=<uuid>   → Chats tab with conversation selected
```

### Page State

```typescript
// src/app/messages/page.tsx
interface MessagesPageState {
  activeTab: SidebarTab; // Derived from URL ?tab= param
  conversationId: string | null; // Derived from URL ?conversation= param
  isMobileDrawerOpen: boolean; // Mobile drawer state
}
```

### UnifiedSidebar Internal State

```typescript
// Managed internally by child components
ConversationList: {
  conversations: Conversation[];
  counts: { all: number; unread: number; archived: number };
  searchQuery: string;
  filterType: 'all' | 'unread' | 'archived';
  sortType: 'recent' | 'alphabetical' | 'unread';
}

ConnectionManager: {
  connections: ConnectionList; // pending_sent, pending_received, accepted, blocked
  activeSubTab: 'received' | 'sent' | 'accepted' | 'blocked';
}

UserSearch: {
  query: string;
  results: UserProfile[];
  alreadyConnected: string[];
}
```

## Service Method Addition

### getOrCreateConversation

```typescript
// src/services/messaging/connection-service.ts

/**
 * Get existing conversation or create a new one between current user and another user.
 *
 * @param otherUserId - UUID of the other participant
 * @returns Promise<string> - Conversation ID
 * @throws AuthenticationError if user is not signed in
 * @throws ValidationError if otherUserId is invalid UUID
 * @throws ConnectionError if users are not connected (accepted status required)
 */
async getOrCreateConversation(otherUserId: string): Promise<string> {
  // 1. Get authenticated user
  // 2. Validate otherUserId is valid UUID
  // 3. Verify connection exists with status='accepted'
  // 4. Apply canonical ordering (smaller UUID = participant_1_id)
  // 5. Check if conversation exists
  // 6. If not, create new conversation
  // 7. Return conversation ID
}
```

## Component Files (5-file pattern)

### UnifiedSidebar

```
src/components/organisms/UnifiedSidebar/
├── index.tsx                         # export { default } from './UnifiedSidebar';
├── UnifiedSidebar.tsx                # Main component
├── UnifiedSidebar.test.tsx           # Unit tests
├── UnifiedSidebar.stories.tsx        # Storybook stories
└── UnifiedSidebar.accessibility.test.tsx  # Pa11y/axe tests
```

## Database Entities (No Changes)

### conversations (existing)

| Column           | Type        | Notes                          |
| ---------------- | ----------- | ------------------------------ |
| id               | UUID        | Primary key                    |
| participant_1_id | UUID        | FK to auth.users, smaller UUID |
| participant_2_id | UUID        | FK to auth.users, larger UUID  |
| created_at       | TIMESTAMPTZ | Auto-generated                 |
| last_message_at  | TIMESTAMPTZ | Updated on new message         |

**Constraint**: `UNIQUE(participant_1_id, participant_2_id)`
**Constraint**: `CHECK(participant_1_id < participant_2_id)` - Canonical ordering

### user_connections (existing)

| Column       | Type        | Notes                                        |
| ------------ | ----------- | -------------------------------------------- |
| id           | UUID        | Primary key                                  |
| requester_id | UUID        | FK to auth.users                             |
| addressee_id | UUID        | FK to auth.users                             |
| status       | TEXT        | 'pending', 'accepted', 'declined', 'blocked' |
| created_at   | TIMESTAMPTZ | Auto-generated                               |
| updated_at   | TIMESTAMPTZ | Auto-updated                                 |

## Navigation Flow Diagrams

### Tab Navigation

```
┌─────────────────────────────────────────┐
│            UnifiedSidebar               │
├─────────────────────────────────────────┤
│ [Chats (5)] [Connections (2)] [Find]    │  ← Tab bar with badges
├─────────────────────────────────────────┤
│                                         │
│  Tab Content Area                       │
│  (conditionally rendered)               │
│                                         │
└─────────────────────────────────────────┘
```

### Message Button Flow

```
User clicks "Message" on accepted connection
    │
    ▼
onMessage(userId) called
    │
    ▼
getOrCreateConversation(userId)
    │
    ├─► Existing conversation found → Return ID
    │
    └─► No conversation → Create new → Return ID
    │
    ▼
Navigate to /messages?conversation={id}&tab=chats
    │
    ▼
ChatWindow loads with conversation
```

### Redirect Flow

```
/conversations
    │
    └─► Redirect to /messages?tab=chats

/messages/connections
    │
    └─► Redirect to /messages?tab=connections
```
