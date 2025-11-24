# Contract: Messaging API

**Feature**: Comprehensive E2E Test Suite for User Messaging
**Contract Type**: Supabase Database API (connections, conversations, messages)
**Version**: 1.0.0
**Date**: 2025-11-24

## Overview

This contract defines the messaging API interactions for friend requests, connections, conversations, and encrypted messages between test users.

## Endpoints

### 1. User Search

**Supabase Query**: Search user_profiles by email

**Request**:

```typescript
const { data, error } = await supabase
  .from('user_profiles')
  .select('id, username, display_name, email')
  .ilike('email', `%${searchTerm}%`)
  .limit(10);
```

**Success Response**:

```typescript
{
  data: [
    {
      id: string,          // UUID
      username: string,
      display_name: string,
      email: string
    }
  ],
  error: null
}
```

**Test Cases**:

```typescript
// TC-MSG-001: User A searches for User B by exact email
const { data, error } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('email', process.env.TEST_USER_TERTIARY_EMAIL);

expect(error).toBeNull();
expect(data).toHaveLength(1);
expect(data[0].username).toBe('testuser-b');

// TC-MSG-002: User A searches for User B by partial email
const { data } = await supabase
  .from('user_profiles')
  .select('*')
  .ilike('email', '%test-user-b%');

expect(data.length).toBeGreaterThan(0);
expect(data.some((u) => u.email === process.env.TEST_USER_TERTIARY_EMAIL)).toBe(
  true
);

// TC-MSG-003: Non-existent user returns empty results
const { data } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('email', 'nonexistent@example.com');

expect(data).toHaveLength(0);
```

**Performance**: SC-004 requires search results within 2 seconds

---

### 2. Send Friend Request (Create Connection)

**Supabase Insert**: Create connection record with 'pending' status

**Request**:

```typescript
const { data, error } = await supabase
  .from('connections')
  .insert({
    user_id: currentUserId, // UUID of requester (User A)
    connected_user_id: targetUserId, // UUID of recipient (User B)
    status: 'pending',
  })
  .select()
  .single();
```

**Success Response**:

```typescript
{
  data: {
    id: string,              // UUID
    user_id: string,         // User A UUID
    connected_user_id: string,  // User B UUID
    status: 'pending',
    created_at: string,      // ISO timestamp
    updated_at: string
  },
  error: null
}
```

**Error Response** (409 Conflict - duplicate request):

```typescript
{
  data: null,
  error: {
    message: "duplicate key value violates unique constraint",
    code: "23505"
  }
}
```

**Test Cases**:

```typescript
// TC-MSG-004: User A sends friend request to User B
const { data, error } = await supabase
  .from('connections')
  .insert({
    user_id: USER_A_ID,
    connected_user_id: USER_B_ID,
    status: 'pending',
  })
  .select()
  .single();

expect(error).toBeNull();
expect(data.status).toBe('pending');
expect(data.user_id).toBe(USER_A_ID);
expect(data.connected_user_id).toBe(USER_B_ID);

// TC-MSG-005: Duplicate friend request fails
const { error } = await supabase.from('connections').insert({
  user_id: USER_A_ID,
  connected_user_id: USER_B_ID,
  status: 'pending',
});

expect(error).not.toBeNull();
expect(error.code).toBe('23505'); // Unique constraint violation
```

---

### 3. View Pending Requests

**Supabase Query**: Get connections where current user is recipient

**Request**:

```typescript
const { data, error } = await supabase
  .from('connections')
  .select(
    `
    id,
    user_id,
    status,
    created_at,
    user_profiles:user_id (username, display_name)
  `
  )
  .eq('connected_user_id', currentUserId)
  .eq('status', 'pending')
  .order('created_at', { ascending: false });
```

**Success Response**:

```typescript
{
  data: [
    {
      id: string,
      user_id: string,       // Requester UUID (User A)
      status: 'pending',
      created_at: string,
      user_profiles: {
        username: string,
        display_name: string
      }
    }
  ],
  error: null
}
```

**Test Cases**:

```typescript
// TC-MSG-006: User B views pending request from User A
// First, User A creates request (setup)
await supabase.from('connections').insert({
  user_id: USER_A_ID,
  connected_user_id: USER_B_ID,
  status: 'pending',
});

// User B queries received requests
const { data, error } = await supabase
  .from('connections')
  .select('*')
  .eq('connected_user_id', USER_B_ID)
  .eq('status', 'pending');

expect(error).toBeNull();
expect(data).toHaveLength(1);
expect(data[0].user_id).toBe(USER_A_ID);
```

---

### 4. Accept Friend Request (Update Connection)

**Supabase Update**: Change status to 'accepted'

**Request**:

```typescript
const { data, error } = await supabase
  .from('connections')
  .update({ status: 'accepted', updated_at: new Date().toISOString() })
  .eq('id', connectionId)
  .eq('connected_user_id', currentUserId) // Security: only recipient can accept
  .select()
  .single();
```

**Success Response**:

```typescript
{
  data: {
    id: string,
    user_id: string,
    connected_user_id: string,
    status: 'accepted',
    created_at: string,
    updated_at: string  // Updated timestamp
  },
  error: null
}
```

**Test Cases**:

```typescript
// TC-MSG-007: User B accepts request from User A
// Setup: User A creates request
const { data: request } = await supabase
  .from('connections')
  .insert({
    user_id: USER_A_ID,
    connected_user_id: USER_B_ID,
    status: 'pending',
  })
  .select()
  .single();

// User B accepts
const { data, error } = await supabase
  .from('connections')
  .update({ status: 'accepted' })
  .eq('id', request.id)
  .select()
  .single();

expect(error).toBeNull();
expect(data.status).toBe('accepted');

// TC-MSG-008: Create bidirectional connection
// After User B accepts A's request, create reverse connection
const { data: reverseConnection } = await supabase
  .from('connections')
  .insert({
    user_id: USER_B_ID,
    connected_user_id: USER_A_ID,
    status: 'accepted',
  })
  .select()
  .single();

expect(reverseConnection.status).toBe('accepted');
```

**Performance**: SC-005 requires acceptance within 3 seconds

---

### 5. Create Conversation

**Supabase Insert**: Create conversation between connected users

**Request**:

```typescript
const { data, error } = await supabase
  .from('conversations')
  .insert({
    participant_1_id: user1Id,
    participant_2_id: user2Id,
    last_message_at: new Date().toISOString(),
  })
  .select()
  .single();
```

**Success Response**:

```typescript
{
  data: {
    id: string,              // UUID
    participant_1_id: string,
    participant_2_id: string,
    last_message_at: string,
    created_at: string
  },
  error: null
}
```

**Test Cases**:

```typescript
// TC-MSG-009: Create conversation between User A and User B
const { data, error } = await supabase
  .from('conversations')
  .insert({
    participant_1_id: USER_A_ID,
    participant_2_id: USER_B_ID,
    last_message_at: new Date().toISOString(),
  })
  .select()
  .single();

expect(error).toBeNull();
expect(data.participant_1_id).toBe(USER_A_ID);
expect(data.participant_2_id).toBe(USER_B_ID);

// TC-MSG-010: Duplicate conversation fails (unique constraint)
const { error } = await supabase.from('conversations').insert({
  participant_1_id: USER_A_ID,
  participant_2_id: USER_B_ID,
});

expect(error).not.toBeNull();
expect(error.code).toBe('23505'); // Unique constraint
```

---

### 6. Send Encrypted Message

**Supabase Insert**: Store encrypted message in conversation

**Request**:

```typescript
const { data, error } = await supabase
  .from('messages')
  .insert({
    conversation_id: conversationId,
    sender_id: currentUserId,
    encrypted_content: encryptedCiphertext, // Base64 encoded
    content_iv: initializationVector, // Base64 encoded
    sent_at: new Date().toISOString(),
  })
  .select()
  .single();
```

**Success Response**:

```typescript
{
  data: {
    id: string,
    conversation_id: string,
    sender_id: string,
    encrypted_content: string,  // Base64 ciphertext
    content_iv: string,          // Base64 IV
    sent_at: string,
    delivered_at: null,
    read_at: null
  },
  error: null
}
```

**Test Cases**:

```typescript
// TC-MSG-011: User A sends encrypted message to User B
const plaintextMessage = 'Hello from User A';
const { ciphertext, iv } = await encryptMessage(
  plaintextMessage,
  USER_B_PUBLIC_KEY
);

const { data, error } = await supabase
  .from('messages')
  .insert({
    conversation_id: CONVERSATION_ID,
    sender_id: USER_A_ID,
    encrypted_content: ciphertext,
    content_iv: iv,
  })
  .select()
  .single();

expect(error).toBeNull();
expect(data.encrypted_content).not.toBe(plaintextMessage); // Verify encrypted
expect(data.encrypted_content).toBeTruthy();
expect(data.content_iv).toBeTruthy();

// TC-MSG-012: Verify zero-knowledge encryption (FR-014)
// Query database directly to verify no plaintext
const { data: dbMessage } = await supabase
  .from('messages')
  .select('encrypted_content')
  .eq('id', data.id)
  .single();

expect(dbMessage.encrypted_content).not.toContain(plaintextMessage);
expect(dbMessage.encrypted_content).not.toBe(plaintextMessage);
```

**Encryption Details**:

- Algorithm: AES-GCM (256-bit key)
- Key Exchange: ECDH (P-256 curve)
- IV: 12 bytes random (96 bits)
- Output: Base64-encoded ciphertext + IV

---

### 7. Receive and Decrypt Message

**Supabase Query**: Fetch messages from conversation

**Request**:

```typescript
const { data, error } = await supabase
  .from('messages')
  .select('*')
  .eq('conversation_id', conversationId)
  .order('sent_at', { ascending: true });
```

**Success Response**:

```typescript
{
  data: [
    {
      id: string,
      conversation_id: string,
      sender_id: string,
      encrypted_content: string,
      content_iv: string,
      sent_at: string,
      delivered_at: string | null,
      read_at: string | null
    }
  ],
  error: null
}
```

**Client-Side Decryption**:

```typescript
// Decrypt using recipient's private key
const plaintext = await decryptMessage(
  message.encrypted_content,
  message.content_iv,
  recipientPrivateKey
);
```

**Test Cases**:

```typescript
// TC-MSG-013: User B receives and decrypts message from User A
// Setup: User A sends message (from TC-MSG-011)
const originalMessage = 'Hello from User A';

// User B queries messages
const { data: messages } = await supabase
  .from('messages')
  .select('*')
  .eq('conversation_id', CONVERSATION_ID)
  .eq('sender_id', USER_A_ID);

expect(messages).toHaveLength(1);

// User B decrypts message
const decrypted = await decryptMessage(
  messages[0].encrypted_content,
  messages[0].content_iv,
  USER_B_PRIVATE_KEY
);

expect(decrypted).toBe(originalMessage); // Successful decryption

// TC-MSG-014: User B replies to User A
const replyMessage = 'Reply from User B';
const { ciphertext, iv } = await encryptMessage(
  replyMessage,
  USER_A_PUBLIC_KEY
);

const { data: reply } = await supabase
  .from('messages')
  .insert({
    conversation_id: CONVERSATION_ID,
    sender_id: USER_B_ID,
    encrypted_content: ciphertext,
    content_iv: iv,
  })
  .select()
  .single();

// User A decrypts reply
const { data: replyMsg } = await supabase
  .from('messages')
  .select('*')
  .eq('id', reply.id)
  .single();

const decryptedReply = await decryptMessage(
  replyMsg.encrypted_content,
  replyMsg.content_iv,
  USER_A_PRIVATE_KEY
);

expect(decryptedReply).toBe(replyMessage);
```

---

## Performance Requirements

**Success Criteria Mapping**:

- **SC-001**: Full workflow (sign-in → message → sign-out) in <60 seconds
- **SC-004**: User search returns results within 2 seconds
- **SC-005**: Friend request acceptance within 3 seconds
- **SC-006**: 100% message delivery and decryption success rate
- **SC-007**: Zero plaintext messages in database

**Query Timeouts**:

```typescript
// User search
await expect(page.locator('[data-testid="search-results"]')).toBeVisible({
  timeout: 2000,
}); // SC-004

// Connection acceptance
await page.click('[data-testid="accept-request"]');
await expect(page.locator('[data-testid="connection-status"]')).toHaveText(
  'Connected',
  { timeout: 3000 }
); // SC-005

// Message delivery
await page.fill('[data-testid="message-input"]', message);
await page.click('[data-testid="send-button"]');
await expect(page.locator(`text="${message}"`)).toBeVisible({ timeout: 5000 }); // Message appears
```

---

## Data Cleanup Contract

**Test Idempotency** (SC-008): Tests must clean up data before each run

**Cleanup Order** (respects foreign key constraints):

```typescript
test.beforeEach(async () => {
  // 1. Delete messages (child of conversations)
  await supabase
    .from('messages')
    .delete()
    .in('conversation_id', [CONVERSATION_ID]);

  // 2. Delete conversations
  await supabase
    .from('conversations')
    .delete()
    .or(`participant_1_id.eq.${USER_A_ID},participant_2_id.eq.${USER_B_ID}`);

  // 3. Delete connections
  await supabase
    .from('connections')
    .delete()
    .or(`user_id.eq.${USER_A_ID},user_id.eq.${USER_B_ID}`);

  await supabase
    .from('connections')
    .delete()
    .or(`connected_user_id.eq.${USER_A_ID},connected_user_id.eq.${USER_B_ID}`);
});
```

**Note**: Requires `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS policies for cleanup.

---

## Security Considerations

### Row-Level Security (RLS)

**Connections Table**:

```sql
-- Users can view own connections
CREATE POLICY "users_view_own_connections" ON connections
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = connected_user_id);

-- Users can create connections where they are the requester
CREATE POLICY "users_create_own_connections" ON connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update connections where they are the recipient
CREATE POLICY "users_update_received_connections" ON connections
  FOR UPDATE USING (auth.uid() = connected_user_id);
```

**Messages Table**:

```sql
-- Users can view messages in their conversations
CREATE POLICY "users_view_conversation_messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = messages.conversation_id
        AND (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
    )
  );

-- Users can send messages in their conversations
CREATE POLICY "users_send_messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id
        AND (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
    )
  );
```

### Encryption Security

**Zero-Knowledge Architecture**:

- Private keys NEVER leave client browser (stored in localStorage)
- Public keys exchanged via secure channel (not yet implemented - future enhancement)
- Database stores ONLY ciphertext (never plaintext)
- Server cannot decrypt messages (no server-side private keys)

**Key Generation** (auto-generated on first sign-in):

```typescript
// ECDH key pair generation
const keyPair = await crypto.subtle.generateKey(
  { name: 'ECDH', namedCurve: 'P-256' },
  true, // extractable (public key only)
  ['deriveKey']
);

// AES-GCM encryption key derivation
const sharedSecret = await crypto.subtle.deriveKey(
  { name: 'ECDH', public: theirPublicKey },
  myPrivateKey,
  { name: 'AES-GCM', length: 256 },
  false, // non-extractable
  ['encrypt', 'decrypt']
);
```

---

## Contract Validation

### Pre-conditions

1. ✅ Both test users authenticated
2. ✅ Encryption keys generated for both users
3. ✅ No existing connections between test users (cleanup completed)
4. ✅ No existing conversations between test users (cleanup completed)

### Post-conditions

1. ✅ Connection status = 'accepted' (bidirectional)
2. ✅ Conversation exists with correct participants
3. ✅ Messages stored encrypted in database
4. ✅ Messages decrypt correctly to original plaintext
5. ✅ Database contains ZERO plaintext (SC-007)

### Contract Tests

Run contract tests with:

```bash
docker compose exec scripthammer pnpm exec playwright test e2e/messaging/
```

Expected results:

- All test cases (TC-MSG-001 through TC-MSG-014) pass
- No plaintext in database (SC-007)
- Performance criteria met (SC-004, SC-005)
- 100% delivery and decryption success (SC-006)
