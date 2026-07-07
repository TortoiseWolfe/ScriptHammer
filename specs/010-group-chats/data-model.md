# Data Model: Group Chats

**Date**: 2025-12-02 | **Branch**: `010-group-chats`

## Entity Relationship Diagram

```
┌─────────────────────┐       ┌─────────────────────────┐
│    conversations    │       │   conversation_members  │
├─────────────────────┤       ├─────────────────────────┤
│ id (PK)             │──────<│ conversation_id (FK)    │
│ is_group            │       │ user_id (FK)            │>─────┐
│ group_name          │       │ role                    │      │
│ created_by (FK)     │       │ joined_at               │      │
│ current_key_version │       │ left_at                 │      │
│ last_message_at     │       │ key_version_joined      │      │
│ created_at          │       │ key_status              │      │
│ [participant_1_id]* │       │ archived                │      │
│ [participant_2_id]* │       │ muted                   │      │
└─────────────────────┘       └─────────────────────────┘      │
         │                                                      │
         │                    ┌─────────────────────────┐      │
         │                    │      group_keys         │      │
         │                    ├─────────────────────────┤      │
         └───────────────────<│ conversation_id (FK)    │      │
                              │ user_id (FK)            │>─────┤
                              │ key_version             │      │
                              │ encrypted_key           │      │
                              │ created_at              │      │
                              │ created_by (FK)         │      │
                              └─────────────────────────┘      │
                                                               │
┌─────────────────────┐       ┌─────────────────────────┐      │
│      messages       │       │     user_profiles       │      │
├─────────────────────┤       ├─────────────────────────┤      │
│ id (PK)             │       │ id (PK)                 │<─────┘
│ conversation_id (FK)│       │ display_name            │
│ sender_id (FK)      │       │ avatar_url              │
│ encrypted_content   │       │ ...                     │
│ initialization_vector│       └─────────────────────────┘
│ key_version         │
│ is_system_message   │
│ system_message_type │
│ sequence_number     │
│ created_at          │
└─────────────────────┘

* participant_1_id/participant_2_id retained for backward compatibility with 1-to-1
```

---

## Entity Definitions

### conversations (MODIFIED)

Existing table with new columns for group support.

| Field                   | Type        | Constraints                         | Description                                    |
| ----------------------- | ----------- | ----------------------------------- | ---------------------------------------------- |
| id                      | UUID        | PK, DEFAULT gen_random_uuid()       | Unique conversation identifier                 |
| participant_1_id        | UUID        | FK → user_profiles, NULL for groups | Legacy: smaller UUID participant (1-to-1 only) |
| participant_2_id        | UUID        | FK → user_profiles, NULL for groups | Legacy: larger UUID participant (1-to-1 only)  |
| **is_group**            | BOOLEAN     | NOT NULL DEFAULT FALSE              | **NEW**: Distinguishes group from 1-to-1       |
| **group_name**          | TEXT        | NULL, CHECK length <= 100           | **NEW**: Optional custom group name            |
| **created_by**          | UUID        | FK → user_profiles                  | **NEW**: Owner/creator of group                |
| **current_key_version** | INTEGER     | NOT NULL DEFAULT 1                  | **NEW**: Current symmetric key version         |
| last_message_at         | TIMESTAMPTZ | NULL                                | Timestamp of most recent message               |
| created_at              | TIMESTAMPTZ | NOT NULL DEFAULT now()              | Creation timestamp                             |

**Validation Rules** (CHK023):

- If `is_group = false`: `participant_1_id` and `participant_2_id` required, `participant_1_id < participant_2_id`
- If `is_group = true`: `participant_1_id` and `participant_2_id` should be NULL, `created_by` required

**Database Enforcement**:

```sql
-- CHK023: Enforce is_group validation via CHECK constraint
ALTER TABLE conversations ADD CONSTRAINT check_group_participants CHECK (
  (is_group = false AND participant_1_id IS NOT NULL AND participant_2_id IS NOT NULL)
  OR
  (is_group = true AND participant_1_id IS NULL AND participant_2_id IS NULL AND created_by IS NOT NULL)
);
```

**Cascade Delete Behavior** (CHK024):

- `conversations` deletion → CASCADE to `conversation_members`, `group_keys`, `messages`
- `user_profiles` deletion → CASCADE to `conversation_members`, `group_keys` (user's rows only)

---

### conversation_members (NEW)

Junction table linking users to conversations with membership metadata.

| Field              | Type        | Constraints                                               | Description                                   |
| ------------------ | ----------- | --------------------------------------------------------- | --------------------------------------------- |
| id                 | UUID        | PK, DEFAULT gen_random_uuid()                             | Unique membership identifier                  |
| conversation_id    | UUID        | FK → conversations, NOT NULL                              | Reference to conversation                     |
| user_id            | UUID        | FK → user_profiles, NOT NULL                              | Reference to member                           |
| role               | TEXT        | NOT NULL, CHECK IN ('owner', 'member')                    | Member role in group                          |
| joined_at          | TIMESTAMPTZ | NOT NULL DEFAULT now()                                    | When member joined                            |
| left_at            | TIMESTAMPTZ | NULL                                                      | When member left (NULL = active)              |
| key_version_joined | INTEGER     | NOT NULL DEFAULT 1                                        | Key version when joined (history restriction) |
| key_status         | TEXT        | NOT NULL DEFAULT 'active', CHECK IN ('active', 'pending') | Key distribution status                       |
| archived           | BOOLEAN     | NOT NULL DEFAULT FALSE                                    | Member's archive preference                   |
| muted              | BOOLEAN     | NOT NULL DEFAULT FALSE                                    | Member's mute preference                      |

**Constraints** (CHK025):

- UNIQUE(conversation_id, user_id) - Prevents duplicate memberships
- Note: This allows rejoin after leave (same user_id creates new row - see CHK028)

**Indexes** (CHK026):

- `idx_conversation_members_conversation` ON (conversation_id) WHERE left_at IS NULL
  - Justification: Fast member list lookup for active members only
- `idx_conversation_members_user` ON (user_id) WHERE left_at IS NULL
  - Justification: Fast "my conversations" query for conversation list

**Rejoin Behavior** (CHK028):
When a user who previously left wants to rejoin:

1. **Option chosen**: Create NEW row with fresh `joined_at`, new `key_version_joined`
2. Old row remains with `left_at` set (audit trail)
3. Unique constraint: Actually UNIQUE(conversation_id, user_id) needs adjustment:
   - Change to: UNIQUE(conversation_id, user_id) WHERE left_at IS NULL
   - Or use partial unique index for active memberships only
4. Rejoin = cannot see messages from before new join (new key_version_joined)

**State Transitions**:

```
                  ┌─────────┐
     join         │ active  │◄────────┐
    ────────────► │         │         │ key distributed
                  └────┬────┘         │
                       │              │
           key failed  │         ┌────┴────┐
           (3 retries) │         │ pending │
                       │         │         │
                       ▼         └─────────┘
                  ┌─────────┐
     leave/remove │  left   │
    ─────────────►│         │
                  └─────────┘
```

---

### group_keys (NEW)

Stores encrypted symmetric group keys per member per version.

| Field           | Type        | Constraints                   | Description                                          |
| --------------- | ----------- | ----------------------------- | ---------------------------------------------------- |
| id              | UUID        | PK, DEFAULT gen_random_uuid() | Unique key record identifier                         |
| conversation_id | UUID        | FK → conversations, NOT NULL  | Reference to group                                   |
| user_id         | UUID        | FK → user_profiles, NOT NULL  | Member who owns this encrypted copy                  |
| key_version     | INTEGER     | NOT NULL DEFAULT 1            | Version number of this key                           |
| encrypted_key   | TEXT        | NOT NULL                      | Group key encrypted with member's ECDH shared secret |
| created_at      | TIMESTAMPTZ | NOT NULL DEFAULT now()        | When key was created                                 |
| created_by      | UUID        | FK → user_profiles, NOT NULL  | Who generated/rotated the key                        |

**Constraints**:

- UNIQUE(conversation_id, user_id, key_version)

**Indexes**:

- `idx_group_keys_conversation` ON (conversation_id, key_version DESC)
- `idx_group_keys_user` ON (user_id, conversation_id)

---

### messages (MODIFIED)

Existing table with new columns for group/system message support.

| Field                   | Type        | Constraints            | Description                                     |
| ----------------------- | ----------- | ---------------------- | ----------------------------------------------- |
| id                      | UUID        | PK                     | Message identifier                              |
| conversation_id         | UUID        | FK → conversations     | Parent conversation                             |
| sender_id               | UUID        | FK → user_profiles     | Message author                                  |
| encrypted_content       | TEXT        | NOT NULL               | Encrypted message body                          |
| initialization_vector   | TEXT        | NOT NULL               | AES-GCM IV                                      |
| **key_version**         | INTEGER     | NOT NULL DEFAULT 1     | **NEW**: Which key version encrypted this       |
| **is_system_message**   | BOOLEAN     | NOT NULL DEFAULT FALSE | **NEW**: System event flag                      |
| **system_message_type** | TEXT        | NULL                   | **NEW**: Event type (join, leave, rename, etc.) |
| sequence_number         | BIGINT      | NOT NULL               | Ordering within conversation                    |
| deleted                 | BOOLEAN     | DEFAULT FALSE          | Soft delete flag                                |
| edited                  | BOOLEAN     | DEFAULT FALSE          | Edit flag                                       |
| edited_at               | TIMESTAMPTZ | NULL                   | Last edit timestamp                             |
| delivered_at            | TIMESTAMPTZ | NULL                   | Delivery confirmation                           |
| read_at                 | TIMESTAMPTZ | NULL                   | Read receipt                                    |
| created_at              | TIMESTAMPTZ | NOT NULL               | Creation timestamp                              |

**System Message Types** (CHK027 - Exhaustive and Closed Enum):

- `member_joined` - User added to group
- `member_left` - User voluntarily left
- `member_removed` - User removed by owner
- `group_created` - Initial group creation
- `group_renamed` - Group name changed
- `ownership_transferred` - Owner changed

**Enum Enforcement**:

```sql
-- CHK027: Create enum type for system_message_type
CREATE TYPE system_message_type_enum AS ENUM (
  'member_joined',
  'member_left',
  'member_removed',
  'group_created',
  'group_renamed',
  'ownership_transferred'
);

-- Use in messages table
ALTER TABLE messages
  ALTER COLUMN system_message_type TYPE system_message_type_enum
  USING system_message_type::system_message_type_enum;
```

Note: Enum is **closed** - adding new types requires migration.

---

## TypeScript Interfaces

```typescript
// src/types/messaging.ts additions

export interface GroupConversation {
  id: string;
  is_group: true;
  group_name: string | null;
  created_by: string;
  current_key_version: number;
  last_message_at: string | null;
  created_at: string;
}

export interface DirectConversation {
  id: string;
  is_group: false;
  participant_1_id: string;
  participant_2_id: string;
  last_message_at: string | null;
  created_at: string;
}

export type Conversation = GroupConversation | DirectConversation;

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  left_at: string | null;
  key_version_joined: number;
  key_status: 'active' | 'pending';
  archived: boolean;
  muted: boolean;
  profile?: UserProfile;
}

export interface GroupKey {
  id: string;
  conversation_id: string;
  user_id: string;
  key_version: number;
  encrypted_key: string;
  created_at: string;
  created_by: string;
}

export type SystemMessageType =
  | 'member_joined'
  | 'member_left'
  | 'member_removed'
  | 'group_created'
  | 'group_renamed'
  | 'ownership_transferred';

export interface SystemMessageData {
  type: SystemMessageType;
  actor_id: string;
  target_id?: string;
  old_value?: string;
  new_value?: string;
}

export interface CreateGroupInput {
  name?: string;
  member_ids: string[];
}

export interface AddMembersInput {
  conversation_id: string;
  member_ids: string[];
}
```

---

## RLS Policies

### conversation_members (CHK016)

```sql
-- SELECT: Members can see other members of their conversations
-- CHK022: left_at IS NULL check consistently applied
CREATE POLICY "Members can view conversation members" ON conversation_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
        AND cm.user_id = auth.uid()
        AND cm.left_at IS NULL
    )
  );

-- INSERT: Any member can add (validated via connection check in service)
CREATE POLICY "Members can add to their conversations" ON conversation_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = conversation_id
        AND cm.user_id = auth.uid()
        AND cm.left_at IS NULL
    )
    OR user_id = auth.uid()  -- Self-join on creation
  );

-- UPDATE: Members can update their own preferences, owners can update others
-- CHK020: Owner-only removal enforced via role check
CREATE POLICY "Members can update membership" ON conversation_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'owner'
        AND cm.left_at IS NULL
    )
  );

-- DELETE: No direct deletes allowed - use soft delete via left_at
-- Members are never physically deleted; left_at is set instead
CREATE POLICY "No direct member deletes" ON conversation_members
  FOR DELETE USING (false);
```

### group_keys (CHK017, CHK018, CHK021)

```sql
-- SELECT: Users can only see their own encrypted keys
-- CHK021: Removed members cannot access keys (left_at check in subquery)
CREATE POLICY "Users can view their own keys" ON group_keys
  FOR SELECT USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = group_keys.conversation_id
        AND cm.user_id = auth.uid()
        AND cm.left_at IS NULL
    )
  );

-- INSERT: Active members can distribute keys
CREATE POLICY "Members can distribute keys" ON group_keys
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = conversation_id
        AND cm.user_id = auth.uid()
        AND cm.left_at IS NULL
    )
  );

-- UPDATE: No updates allowed - keys are immutable once created
CREATE POLICY "Keys are immutable" ON group_keys
  FOR UPDATE USING (false);

-- DELETE: CHK018 - No direct deletes, orphaned keys are harmless (encrypted for removed user)
-- Optional cleanup via batch job, not user-triggered
CREATE POLICY "No direct key deletes" ON group_keys
  FOR DELETE USING (false);
```

### messages (CHK019)

```sql
-- SELECT: For group messages, check membership via conversation_members
-- For 1-to-1, existing policy checks participant_1_id/participant_2_id
CREATE POLICY "Members can view group messages" ON messages
  FOR SELECT USING (
    -- 1-to-1 conversations: existing logic
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND c.is_group = false
        AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
    )
    OR
    -- Group conversations: check membership
    EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = messages.conversation_id
        AND cm.user_id = auth.uid()
        AND cm.left_at IS NULL
    )
  );

-- INSERT: For group messages, check active membership
CREATE POLICY "Members can send group messages" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND (
      -- 1-to-1: existing logic
      EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = conversation_id
          AND c.is_group = false
          AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
      )
      OR
      -- Group: check active membership
      EXISTS (
        SELECT 1 FROM conversation_members cm
        WHERE cm.conversation_id = conversation_id
          AND cm.user_id = auth.uid()
          AND cm.left_at IS NULL
      )
    )
  );
```

---

## Migration SQL

```sql
-- Add to supabase/migrations/20251006_complete_monolithic_setup.sql

-- ============================================================================
-- GROUP CHAT TABLES (Feature 010)
-- ============================================================================

-- Modify conversations table for group support
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS group_name TEXT CHECK (length(group_name) <= 100),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS current_key_version INTEGER NOT NULL DEFAULT 1;

-- Modify messages table for key versioning and system messages
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS key_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_system_message BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS system_message_type TEXT;

-- Create conversation_members junction table
CREATE TABLE IF NOT EXISTS conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  key_version_joined INTEGER NOT NULL DEFAULT 1,
  key_status TEXT NOT NULL DEFAULT 'active' CHECK (key_status IN ('active', 'pending')),
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT unique_conversation_member UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation
  ON conversation_members(conversation_id) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversation_members_user
  ON conversation_members(user_id) WHERE left_at IS NULL;

-- Create group_keys table
CREATE TABLE IF NOT EXISTS group_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  key_version INTEGER NOT NULL DEFAULT 1,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  CONSTRAINT unique_group_key_version UNIQUE (conversation_id, user_id, key_version)
);

CREATE INDEX IF NOT EXISTS idx_group_keys_conversation
  ON group_keys(conversation_id, key_version DESC);
CREATE INDEX IF NOT EXISTS idx_group_keys_user
  ON group_keys(user_id, conversation_id);

-- Enable RLS
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies (see above for full definitions)
```
