# Data Model: User Messaging System

**Generated**: 2025-10-08 | **For**: PRP-023 User Messaging System

## Overview

This data model implements a complete user-to-user messaging system with:

- Zero-knowledge end-to-end encryption (ECDH + AES-GCM)
- Friend request management (pending, accepted, blocked, declined)
- Real-time message delivery (Supabase Realtime)
- Offline message queueing (IndexedDB)
- Message editing/deletion (15-minute window)
- Typing indicators and read receipts

**Database**: PostgreSQL (Supabase) + IndexedDB (Dexie.js)
**Tables**: 6 PostgreSQL tables + 3 IndexedDB stores

## Database Schema (PostgreSQL)

### 1. user_connections

**Purpose**: Manages friend requests and connections between users.

```sql
CREATE TABLE user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT no_self_connection CHECK (requester_id != addressee_id),
  CONSTRAINT unique_connection UNIQUE (requester_id, addressee_id)
);

-- Indexes
CREATE INDEX idx_user_connections_requester ON user_connections(requester_id, status);
CREATE INDEX idx_user_connections_addressee ON user_connections(addressee_id, status);
CREATE INDEX idx_user_connections_status ON user_connections(status);

-- RLS Policies
ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connections" ON user_connections
  FOR SELECT USING (
    auth.uid() = requester_id OR auth.uid() = addressee_id
  );

CREATE POLICY "Users can create friend requests" ON user_connections
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Addressee can update connection status" ON user_connections
  FOR UPDATE USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

CREATE POLICY "Users can delete own sent requests" ON user_connections
  FOR DELETE USING (
    auth.uid() = requester_id AND status = 'pending'
  );
```

**Fields**:

- `id`: UUID primary key
- `requester_id`: User who sent the friend request
- `addressee_id`: User who received the friend request
- `status`: 'pending' | 'accepted' | 'blocked' | 'declined'
- `created_at`: When request was sent
- `updated_at`: When status last changed

**Business Rules**:

- No self-connections (CHECK constraint)
- Unique pair (requester, addressee) via UNIQUE constraint
- Only addressee can update status (accept/decline/block)
- Requester can delete pending requests
- Both users can view the connection
- CASCADE DELETE when user deleted (GDPR compliance)

---

### 2. conversations

**Purpose**: Represents 1-to-1 chat sessions between two connected users.

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT no_self_conversation CHECK (participant_1_id != participant_2_id),
  CONSTRAINT canonical_ordering CHECK (participant_1_id < participant_2_id),
  CONSTRAINT unique_conversation UNIQUE (participant_1_id, participant_2_id)
);

-- Indexes
CREATE INDEX idx_conversations_participant_1 ON conversations(participant_1_id);
CREATE INDEX idx_conversations_participant_2 ON conversations(participant_2_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);

-- RLS Policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (
    auth.uid() = participant_1_id OR auth.uid() = participant_2_id
  );

CREATE POLICY "Users can create conversations with connections" ON conversations
  FOR INSERT WITH CHECK (
    (auth.uid() = participant_1_id OR auth.uid() = participant_2_id) AND
    EXISTS (
      SELECT 1 FROM user_connections
      WHERE status = 'accepted' AND (
        (requester_id = participant_1_id AND addressee_id = participant_2_id) OR
        (requester_id = participant_2_id AND addressee_id = participant_1_id)
      )
    )
  );

CREATE POLICY "System can update last_message_at" ON conversations
  FOR UPDATE TO service_role
  USING (true);
```

**Fields**:

- `id`: UUID primary key
- `participant_1_id`: First participant (lower UUID)
- `participant_2_id`: Second participant (higher UUID)
- `last_message_at`: Timestamp of most recent message (for sorting)
- `created_at`: When conversation started

**Business Rules**:

- Canonical ordering: `participant_1_id < participant_2_id` prevents duplicates
- Both participants must be connected (INSERT policy checks user_connections)
- Both participants can view conversation
- Only service role can update `last_message_at` (triggered by message INSERT)
- CASCADE DELETE when user deleted

---

### 3. messages

**Purpose**: Stores encrypted messages within conversations.

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL,  -- Base64-encoded ciphertext
  initialization_vector TEXT NOT NULL,  -- Base64-encoded IV (96-bit for AES-GCM)
  sequence_number BIGINT NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT false,
  edited BOOLEAN NOT NULL DEFAULT false,
  edited_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT sender_is_participant CHECK (
    sender_id IN (
      SELECT participant_1_id FROM conversations WHERE id = conversation_id
      UNION
      SELECT participant_2_id FROM conversations WHERE id = conversation_id
    )
  ),
  CONSTRAINT unique_sequence UNIQUE (conversation_id, sequence_number)
);

-- Indexes
CREATE INDEX idx_messages_conversation ON messages(conversation_id, sequence_number DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_unread ON messages(read_at) WHERE read_at IS NULL;

-- RLS Policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own conversations" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can send messages to own conversations" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can edit own messages" ON messages
  FOR UPDATE USING (sender_id = auth.uid())
  WITH CHECK (
    sender_id = auth.uid() AND
    created_at > now() - INTERVAL '15 minutes'  -- 15-minute edit window
  );

CREATE POLICY "Users cannot delete messages" ON messages
  FOR DELETE USING (false);  -- Deletion via soft-delete (UPDATE deleted=true)
```

**Fields**:

- `id`: UUID primary key
- `conversation_id`: Foreign key to conversations
- `sender_id`: User who sent the message
- `encrypted_content`: Base64-encoded AES-GCM ciphertext
- `initialization_vector`: Base64-encoded 96-bit IV (unique per message)
- `sequence_number`: Monotonic sequence for ordering (assigned by database)
- `deleted`: Soft-delete flag (shows "[Message deleted]" placeholder)
- `edited`: True if message was edited
- `edited_at`: Timestamp of last edit
- `delivered_at`: When message reached recipient's device
- `read_at`: When recipient viewed the message
- `created_at`: Original send timestamp

**Business Rules**:

- Only conversation participants can view messages (RLS policy)
- Only sender can send messages (sender_id = auth.uid())
- Edits allowed within 15 minutes (RLS policy checks timestamp)
- No hard deletes (FOR DELETE USING false)
- Soft deletes set `deleted=true` and `encrypted_content='[Message deleted]'`
- Sequence numbers guarantee ordering even with offline sync
- CASCADE DELETE when user or conversation deleted

---

### 4. user_encryption_keys

**Purpose**: Stores users' ECDH public keys for key exchange (private keys stay in IndexedDB).

```sql
CREATE TABLE user_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key JSONB NOT NULL,  -- JWK format (JSON Web Key)
  device_id TEXT,  -- For future multi-device support
  expires_at TIMESTAMPTZ,  -- For key rotation
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT unique_user_device UNIQUE (user_id, device_id)
);

-- Indexes
CREATE INDEX idx_user_encryption_keys_user ON user_encryption_keys(user_id);
CREATE INDEX idx_user_encryption_keys_active ON user_encryption_keys(user_id, revoked, expires_at)
  WHERE revoked = false;

-- RLS Policies
ALTER TABLE user_encryption_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public keys" ON user_encryption_keys
  FOR SELECT USING (true);  -- Public keys are public

CREATE POLICY "Users can create own keys" ON user_encryption_keys
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can revoke own keys" ON user_encryption_keys
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users cannot delete keys" ON user_encryption_keys
  FOR DELETE USING (false);  -- Revoke instead of delete for audit trail
```

**Fields**:

- `id`: UUID primary key
- `user_id`: Owner of the key pair
- `public_key`: ECDH public key in JWK format (e.g., `{"kty":"EC","crv":"P-256","x":"...","y":"..."}`)
- `device_id`: Optional device identifier (for future multi-device support)
- `expires_at`: Optional expiration for key rotation
- `revoked`: True if key is no longer valid
- `created_at`: When key was generated

**Business Rules**:

- Public keys are publicly readable (needed for key exchange)
- Only key owner can create/revoke keys
- No hard deletes (revoke instead for audit trail)
- JWK format for standard crypto interoperability
- Private keys NEVER stored in database (only in client IndexedDB)

---

###5. conversation_keys

**Purpose**: Stores encrypted shared secrets for conversations (encrypted with user's public key).

```sql
CREATE TABLE conversation_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_shared_secret TEXT NOT NULL,  -- Encrypted with user's public key
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT unique_conversation_user_version UNIQUE (conversation_id, user_id, key_version)
);

-- Indexes
CREATE INDEX idx_conversation_keys_conversation ON conversation_keys(conversation_id);
CREATE INDEX idx_conversation_keys_user ON conversation_keys(user_id);

-- RLS Policies
ALTER TABLE conversation_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversation keys" ON conversation_keys
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create conversation keys" ON conversation_keys
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users cannot update keys" ON conversation_keys
  FOR UPDATE USING (false);  -- Immutable for security

CREATE POLICY "Users cannot delete keys" ON conversation_keys
  FOR DELETE USING (false);  -- Immutable for security
```

**Fields**:

- `id`: UUID primary key
- `conversation_id`: Foreign key to conversations
- `user_id`: User this encrypted key belongs to
- `encrypted_shared_secret`: Shared secret encrypted with user's public key (for recovery)
- `key_version`: Version number for key rotation
- `created_at`: When key was derived

**Business Rules**:

- Each participant has their own encrypted copy of the shared secret
- Immutable (no UPDATE or DELETE) for security
- Only conversation participants can create keys
- Only key owner can view their encrypted key
- Supports key rotation via `key_version`

---

### 6. typing_indicators

**Purpose**: Real-time typing status for conversations.

```sql
CREATE TABLE typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_typing BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT unique_conversation_user UNIQUE (conversation_id, user_id)
);

-- Indexes
CREATE INDEX idx_typing_indicators_conversation ON typing_indicators(conversation_id, updated_at DESC);

-- RLS Policies
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view typing in own conversations" ON typing_indicators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = typing_indicators.conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update own typing status" ON typing_indicators
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own typing status" ON typing_indicators
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can clean up old indicators" ON typing_indicators
  FOR DELETE TO service_role
  USING (updated_at < now() - INTERVAL '5 seconds');
```

**Fields**:

- `id`: UUID primary key
- `conversation_id`: Foreign key to conversations
- `user_id`: User whose typing status this represents
- `is_typing`: True if currently typing
- `updated_at`: Last activity timestamp (3-second debounce client-side)

**Business Rules**:

- Auto-expires after 5 seconds (service role cleanup)
- Only conversation participants can view typing status
- Only user can update their own typing status
- Debounced client-side (3 seconds) to reduce database writes

---

## IndexedDB Schema (Dexie.js)

### 1. queuedMessages

**Purpose**: Offline message queue for sending when connection restored.

```typescript
interface QueuedMessage {
  id: string; // UUID (client-generated)
  conversation_id: string;
  encrypted_content: string; // Pre-encrypted ciphertext
  initialization_vector: string; // Pre-generated IV
  synced: boolean; // false until sent to server
  retries: number; // Retry count (max 5)
  created_at: number; // Unix timestamp
}

// Dexie schema
queuedMessages: 'id, conversation_id, synced, created_at';
```

**Indexes**:

- Primary key: `id`
- Compound index: `conversation_id, synced, created_at`

**Business Rules**:

- Max 5 retry attempts
- Exponential backoff: 1s, 2s, 4s, 8s, 16s
- Deleted after successful sync or after 5 failures
- Shows "Sending..." in UI while `synced=false`

---

### 2. cachedMessages

**Purpose**: Cache of recent messages for offline viewing.

```typescript
interface CachedMessage {
  id: string; // UUID from server
  conversation_id: string;
  sender_id: string;
  encrypted_content: string;
  initialization_vector: string;
  sequence_number: number;
  deleted: boolean;
  edited: boolean;
  edited_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string; // ISO 8601
}

// Dexie schema
cachedMessages: 'id, conversation_id, created_at';
```

**Indexes**:

- Primary key: `id`
- Compound index: `conversation_id, created_at`

**Business Rules**:

- Cache last 1,000 messages per conversation
- Auto-purge messages older than 30 days
- Updated when new messages received via Realtime
- Used for offline viewing and virtual scrolling

---

### 3. privateKeys

**Purpose**: Store user's ECDH private key (NEVER transmitted to server).

```typescript
interface PrivateKey {
  userId: string; // User ID (primary key)
  privateKey: JsonWebKey; // JWK format
  created_at: number; // Unix timestamp
}

// Dexie schema
privateKeys: 'userId';
```

**Indexes**:

- Primary key: `userId`

**Business Rules**:

- Generated on first message send (lazy initialization)
- Cleared on sign-out (security)
- Never exported or transmitted
- Lost on browser data clear = messages unrecoverable (by design)

---

## Database Triggers

### Update last_message_at on message insert

```sql
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_inserted
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();
```

### Auto-increment sequence_number

```sql
CREATE OR REPLACE FUNCTION assign_sequence_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  next_seq BIGINT;
BEGIN
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO next_seq
  FROM messages
  WHERE conversation_id = NEW.conversation_id;

  NEW.sequence_number := next_seq;
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_message_insert
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION assign_sequence_number();
```

---

## Data Flow Examples

### Send Message Flow

1. **Client encrypts message**:
   - Fetch recipient's public key from `user_encryption_keys`
   - Derive shared secret (ECDH)
   - Encrypt message content (AES-GCM)
   - Generate random IV

2. **If online**:
   - INSERT into `messages` table
   - Trigger updates `conversations.last_message_at`
   - Supabase Realtime pushes to recipient

3. **If offline**:
   - INSERT into IndexedDB `queuedMessages`
   - Show "Sending..." status
   - Background sync retries on reconnect

4. **Recipient receives**:
   - Supabase Realtime subscription fires
   - Fetch message from database
   - Decrypt using shared secret from IndexedDB
   - Display plaintext

---

### Friend Request Flow

1. **Send Request**:
   - Search for user by username/email
   - INSERT into `user_connections` (status='pending')
   - RLS ensures requester_id = auth.uid()

2. **Receive Request**:
   - SELECT from `user_connections` WHERE addressee_id = auth.uid() AND status='pending'
   - Show in pending requests list

3. **Accept Request**:
   - UPDATE `user_connections` SET status='accepted'
   - RLS ensures addressee_id = auth.uid()

4. **First Message**:
   - INSERT into `conversations` (both participants connected via user_connections)
   - Generate encryption keys (lazy initialization)
   - INSERT shared secret into `conversation_keys` for both users

---

## Relationships Diagram

```
auth.users (Supabase Auth)
    ├── user_connections (requester_id, addressee_id)
    ├── conversations (participant_1_id, participant_2_id)
    ├── messages (sender_id)
    ├── user_encryption_keys (user_id)
    ├── conversation_keys (user_id)
    └── typing_indicators (user_id)

conversations
    ├── messages (conversation_id)
    ├── conversation_keys (conversation_id)
    └── typing_indicators (conversation_id)
```

---

## Migration File Structure

**Location**: `/home/turtle_wolfe/repos/ScriptHammer/supabase/migrations/20251008_user_messaging_system.sql`

```sql
-- User Messaging System Migration
BEGIN;

-- 1. Create all 6 tables
-- 2. Create indexes
-- 3. Enable RLS on all tables
-- 4. Create RLS policies
-- 5. Grant permissions
-- 6. Create triggers

COMMIT;
```

---

## Next Steps

✅ **Phase 1 (Data Model) Complete**

**→ Proceed to**: contracts/ directory (TypeScript interfaces) + quickstart.md (developer setup)
