# Quickstart: Unified Messaging Sidebar

**Feature Branch**: `037-unified-messaging-sidebar`
**Date**: 2025-11-26

## Prerequisites

- Docker running with ScriptHammer container
- On feature branch `037-unified-messaging-sidebar`
- Test user account available (`test@example.com`)

## Implementation Order

### Phase 1: Core Service (P1 blocker)

1. **Add `getOrCreateConversation` to connection-service.ts**

```bash
# File: src/services/messaging/connection-service.ts
# Add after removeConnection method (~line 500)
```

```typescript
/**
 * Get existing conversation or create a new one between current user and another user.
 * Enforces canonical ordering (smaller UUID = participant_1).
 */
async getOrCreateConversation(otherUserId: string): Promise<string> {
  const supabase = createClient();

  // Validate UUID format
  validateUUID(otherUserId, 'otherUserId');

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new AuthenticationError('You must be signed in to start a conversation');
  }

  // Verify connection is accepted
  const { data: connection } = await (supabase as any)
    .from('user_connections')
    .select('status')
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user.id})`)
    .eq('status', 'accepted')
    .single();

  if (!connection) {
    throw new ConnectionError('You must be connected with this user to start a conversation');
  }

  // Apply canonical ordering
  const [participant_1, participant_2] =
    user.id < otherUserId ? [user.id, otherUserId] : [otherUserId, user.id];

  // Check for existing conversation
  const { data: existing } = await (supabase as any)
    .from('conversations')
    .select('id')
    .eq('participant_1_id', participant_1)
    .eq('participant_2_id', participant_2)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create new conversation
  const { data: created, error: createError } = await (supabase as any)
    .from('conversations')
    .insert({
      participant_1_id: participant_1,
      participant_2_id: participant_2,
    })
    .select('id')
    .single();

  if (createError) {
    // Handle race condition - conversation may have been created by other user
    if (createError.code === '23505') { // unique_violation
      const { data: retry } = await (supabase as any)
        .from('conversations')
        .select('id')
        .eq('participant_1_id', participant_1)
        .eq('participant_2_id', participant_2)
        .single();
      if (retry) return retry.id;
    }
    throw new ConnectionError('Failed to create conversation: ' + createError.message);
  }

  return created.id;
}
```

### Phase 2: Add Message Button to ConnectionManager

2. **Modify ConnectionManager props**

```bash
# File: src/components/organisms/ConnectionManager/ConnectionManager.tsx
```

Add `onMessage` prop:

```typescript
export interface ConnectionManagerProps {
  onRefreshAvailable?: (refresh: () => Promise<void>) => void;
  className?: string;
  onMessage?: (userId: string) => void; // NEW
}
```

Add Message button in `renderConnectionItem` for `type === 'accepted'`:

```typescript
{type === 'accepted' && (
  <>
    {onMessage && (
      <button
        onClick={() => {
          const otherUserId = item.connection.requester_id === item.requester.id
            ? item.addressee.id
            : item.requester.id;
          onMessage(otherUserId);
        }}
        className="btn btn-primary btn-sm min-h-11 min-w-11"
      >
        Message
      </button>
    )}
    <button
      onClick={() => handleRemove(item.connection.id)}
      disabled={actionLoading === item.connection.id}
      className="btn btn-ghost btn-sm min-h-11 min-w-11"
    >
      Remove
    </button>
  </>
)}
```

### Phase 3: Create UnifiedSidebar Component

3. **Generate component skeleton**

```bash
docker compose exec scripthammer pnpm run generate:component
# Name: UnifiedSidebar
# Category: organisms
```

4. **Implement UnifiedSidebar.tsx**

```typescript
'use client';

import React from 'react';
import ConversationList from '@/components/organisms/ConversationList';
import ConnectionManager from '@/components/organisms/ConnectionManager';
import UserSearch from '@/components/molecular/UserSearch';
import type { SidebarTab } from '@/types/messaging';

export interface UnifiedSidebarProps {
  selectedConversationId?: string | null;
  onConversationSelect: (conversationId: string) => void;
  onStartConversation: (userId: string) => Promise<string>;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  className?: string;
}

export default function UnifiedSidebar({
  selectedConversationId,
  onConversationSelect,
  onStartConversation,
  activeTab,
  onTabChange,
  className = '',
}: UnifiedSidebarProps) {
  const handleMessage = async (userId: string) => {
    const conversationId = await onStartConversation(userId);
    onConversationSelect(conversationId);
  };

  return (
    <div className={`unified-sidebar h-full flex flex-col ${className}`}>
      {/* Tab Navigation */}
      <div role="tablist" className="tabs tabs-bordered px-4 pt-4">
        <button
          role="tab"
          className={`tab min-h-11 ${activeTab === 'chats' ? 'tab-active' : ''}`}
          onClick={() => onTabChange('chats')}
        >
          Chats
        </button>
        <button
          role="tab"
          className={`tab min-h-11 ${activeTab === 'connections' ? 'tab-active' : ''}`}
          onClick={() => onTabChange('connections')}
        >
          Connections
        </button>
        <button
          role="tab"
          className={`tab min-h-11 ${activeTab === 'find' ? 'tab-active' : ''}`}
          onClick={() => onTabChange('find')}
        >
          Find People
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'chats' && (
          <ConversationList selectedConversationId={selectedConversationId} />
        )}
        {activeTab === 'connections' && (
          <div className="p-4">
            <ConnectionManager onMessage={handleMessage} />
          </div>
        )}
        {activeTab === 'find' && (
          <div className="p-4">
            <UserSearch />
          </div>
        )}
      </div>
    </div>
  );
}
```

### Phase 4: Update Messages Page

5. **Refactor /messages/page.tsx**

Replace ConversationList with UnifiedSidebar, add tab state from URL.

### Phase 5: Redirects

6. **Add redirect files**

```typescript
// src/app/conversations/page.tsx
import { redirect } from 'next/navigation';
export default function ConversationsPage() {
  redirect('/messages?tab=chats');
}

// src/app/messages/connections/page.tsx
import { redirect } from 'next/navigation';
export default function ConnectionsRedirectPage() {
  redirect('/messages?tab=connections');
}
```

### Phase 6: Update GlobalNav

7. **Update navigation links in GlobalNav.tsx**

Change `/messages/connections` link to `/messages?tab=connections`.

## Test Commands

```bash
# Run all tests
docker compose exec scripthammer pnpm test

# Run specific component tests
docker compose exec scripthammer pnpm test ConnectionManager
docker compose exec scripthammer pnpm test UnifiedSidebar

# Type check
docker compose exec scripthammer pnpm run type-check

# Lint
docker compose exec scripthammer pnpm run lint
```

## Verification Checklist

- [ ] `getOrCreateConversation` returns existing conversation when one exists
- [ ] `getOrCreateConversation` creates new conversation when none exists
- [ ] `getOrCreateConversation` rejects if users not connected
- [ ] "Message" button appears on accepted connections
- [ ] Clicking "Message" opens conversation in ChatWindow
- [ ] Tab switching works without page reload
- [ ] Default tab is "Chats" on direct navigation
- [ ] /conversations redirects to /messages?tab=chats
- [ ] /messages/connections redirects to /messages?tab=connections
- [ ] Mobile drawer pattern works on <768px viewport
- [ ] All interactive elements have 44px minimum touch targets
- [ ] UnifiedSidebar passes Pa11y accessibility audit
