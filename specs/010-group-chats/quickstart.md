# Quickstart: Group Chats

**Date**: 2025-12-02 | **Branch**: `010-group-chats`

## Prerequisites

- Docker and Docker Compose installed
- ScriptHammer repository cloned
- `.env` file configured with Supabase credentials
- At least 3 test user accounts for group testing

## Quick Setup

```bash
# 1. Start development environment
docker compose up

# 2. Apply database migrations (group tables)
# The migration is in the monolithic file - execute via Supabase Management API
# or manually apply the GROUP CHAT TABLES section

# 3. Run development server
docker compose exec scripthammer pnpm run dev

# 4. Access the app
open http://localhost:3000
```

## Testing Group Chats Manually

### 1. Create a Group

1. Log in as User A
2. Navigate to Messages (`/messages`)
3. Click "New Group" button in sidebar
4. Enter optional group name
5. Search and select 2+ connections
6. Click "Create"

### 2. Send Group Message

1. Open the newly created group
2. Type a message in the input
3. Send - message should appear encrypted for all members
4. Log in as another group member - they should see the message

### 3. Add Member to Group

1. Open group info panel (click group header)
2. Click "Add Members"
3. Search for a connection not in group
4. Select and add
5. New member should see group but NOT old messages

### 4. Remove Member (Owner Only)

1. As group owner, open group info
2. Click menu on member row
3. Select "Remove from group"
4. Removed member loses access to future messages

### 5. Upgrade 1-to-1 to Group

1. Open an existing DM conversation
2. Click "Add People" in header
3. Select additional members
4. Original participants retain history, new members see only new messages

## Running Tests

```bash
# Unit tests for group services
docker compose exec scripthammer pnpm test src/services/messaging/group

# E2E tests for group workflows
docker compose exec scripthammer pnpm exec playwright test tests/e2e/messaging/group

# Full test suite
docker compose exec scripthammer pnpm run test:suite
```

## Key Files to Modify

| File                                          | Purpose                                             |
| --------------------------------------------- | --------------------------------------------------- |
| `supabase/migrations/20251006_*.sql`          | Add group tables (conversation_members, group_keys) |
| `src/types/messaging.ts`                      | Add GroupConversation, ConversationMember types     |
| `src/services/messaging/group-service.ts`     | NEW: Group CRUD operations                          |
| `src/services/messaging/group-key-service.ts` | NEW: Symmetric key management                       |
| `src/services/messaging/message-service.ts`   | Modify for dual-path encryption                     |
| `src/components/organisms/ChatWindow/`        | Add group header support                            |
| `src/components/atomic/AvatarStack/`          | NEW: Stacked avatars                                |

## Common Issues

### "Cannot decrypt message"

- Check if member's `key_version_joined` > message's `key_version`
- If so, this is expected - member joined after message was sent

### Key distribution stuck in "pending"

- Member may be offline
- Check `conversation_members.key_status` column
- Retry triggers when member comes online (Realtime presence)

### Owner cannot leave

- This is intentional - owner must transfer ownership first
- Open group settings → Transfer Ownership → Select new owner → Then leave

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Layer                                │
│  CreateGroupModal → ChatWindow → MessageBubble → AvatarStack   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                               │
│  GroupService ──► GroupKeyService ──► MessageService            │
│       │                  │                  │                   │
│       │                  │                  ▼                   │
│       │                  │          ┌──────────────┐            │
│       │                  └─────────►│ Encryption   │            │
│       │                             │ (AES-GCM)    │            │
│       │                             └──────────────┘            │
│       ▼                                                         │
│  ┌──────────────┐                                               │
│  │ Connection   │                                               │
│  │ Service      │                                               │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
│  Supabase: conversations │ conversation_members │ group_keys    │
│            messages      │ user_profiles        │ user_connections│
└─────────────────────────────────────────────────────────────────┘
```

## Encryption Flow

```
Creating Group:
1. Owner generates AES-GCM-256 key (symmetric)
2. For each member:
   - Compute ECDH shared secret: ECDH(owner_private, member_public)
   - Encrypt group key with shared secret
   - Store encrypted key in group_keys table
3. Set current_key_version = 1

Sending Message:
1. Fetch group key for current_key_version
2. Decrypt group key using ECDH shared secret
3. Encrypt message with group key + random IV
4. Store message with key_version tag

Adding Member:
1. Generate NEW group key (version N+1)
2. Encrypt new key for ALL members (including new)
3. Update current_key_version
4. New member's key_version_joined = N+1
5. Old messages (version < N+1) undecryptable by new member
```
