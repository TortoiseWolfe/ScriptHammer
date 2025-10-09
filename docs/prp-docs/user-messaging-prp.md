# PRP-023: User Messaging System with E2E Encryption

**Status**: Planning
**Priority**: P0 (Core Feature)
**Feature Branch**: `023-user-messaging`
**Dependencies**: PRP-016 (User Authentication), PRP-015 (Payment Integration - realtime pattern)
**Estimated Effort**: 8-11 days

---

## Problem Statement

ScriptHammer currently has no way for authenticated users to communicate with each other within the platform. Users need:

1. **Privacy-first messaging**: End-to-end encrypted conversations where the server never sees plaintext
2. **Real-time communication**: Instant message delivery with typing indicators and read receipts
3. **Offline reliability**: Queue messages when offline, sync when reconnected
4. **Transparency**: Message editing with visible edit history
5. **Connection management**: Ability to send friend requests, accept/decline, and block users
6. **Mobile-first UX**: Touch-optimized chat interface following ScriptHammer's 44px touch target standards

Without this feature, users must rely on external communication channels, reducing platform engagement and limiting user-to-user collaboration.

---

## Solution Overview

Implement a comprehensive 1-to-1 messaging system using **Supabase Realtime** with **Web Crypto API** for end-to-end encryption:

- User connections/friends system (request, accept, block)
- End-to-end encrypted messaging (zero-knowledge architecture)
- Message editing with transparent edit history
- Real-time delivery with typing indicators and read receipts
- Offline message queue with background sync
- Mobile-first responsive UI
- WCAG AA accessibility compliance
- GDPR-compliant data retention

---

## User Stories

### Connection Management

1. **As a user**, I want to search for other users by username/email so I can find people to message
2. **As a user**, I want to send friend requests so I can connect with others
3. **As a user**, I want to accept/decline friend requests to control who can message me
4. **As a user**, I want to block users to prevent unwanted contact
5. **As a user**, I want to see my list of connections (friends)

### Messaging

6. **As a user**, I want to send encrypted messages to my connections
7. **As a user**, I want to receive messages instantly via real-time updates
8. **As a user**, I want to edit my messages within 15 minutes of sending
9. **As a user**, I want to see when my messages were edited (transparency)
10. **As a user**, I want to see when messages are delivered and read
11. **As a user**, I want to see when the other person is typing

### Privacy & Security

12. **As a user**, I want my messages to be end-to-end encrypted so the server can't read them
13. **As a user**, I want to verify the other person's identity (device verification)
14. **As a user**, I want to delete all my messages (right to be forgotten)
15. **As a user**, I want to export my conversation history

### Offline Support

16. **As a user**, I want to send messages while offline and have them delivered when I reconnect
17. **As a user**, I want to read my message history while offline

---

## Technical Requirements

### Database Schema

#### User Connections (Friend System)

```sql
CREATE TABLE user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate connections
  UNIQUE(requester_id, addressee_id),

  -- Prevent self-connections
  CHECK (requester_id != addressee_id)
);

CREATE INDEX idx_user_connections_requester ON user_connections(requester_id, status);
CREATE INDEX idx_user_connections_addressee ON user_connections(addressee_id, status);
CREATE INDEX idx_user_connections_status ON user_connections(status);
```

#### Conversations

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,

  -- Only 1-to-1 conversations (for now)
  UNIQUE(participant_1_id, participant_2_id),
  CHECK (participant_1_id < participant_2_id) -- Canonical ordering
);

CREATE INDEX idx_conversations_participant_1 ON conversations(participant_1_id, last_message_at DESC);
CREATE INDEX idx_conversations_participant_2 ON conversations(participant_2_id, last_message_at DESC);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
```

#### Messages (Encrypted)

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Encrypted content (client-side encrypted)
  encrypted_content TEXT NOT NULL, -- Base64-encoded encrypted message
  initialization_vector TEXT NOT NULL, -- IV for AES-GCM

  -- Message metadata
  sequence_number INTEGER NOT NULL, -- For ordering
  edited BOOLEAN NOT NULL DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,

  -- Delivery tracking
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure sequential ordering per conversation
  UNIQUE(conversation_id, sequence_number)
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, sequence_number DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_unread ON messages(conversation_id, read_at) WHERE read_at IS NULL;
```

#### Message Edit History

```sql
CREATE TABLE message_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  previous_content TEXT NOT NULL, -- Encrypted previous version
  previous_iv TEXT NOT NULL,
  edited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_message_edits_message ON message_edits(message_id, created_at DESC);
```

#### Encryption Keys (Public Keys)

```sql
CREATE TABLE user_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL, -- JWK format public key
  key_type TEXT NOT NULL CHECK (key_type IN ('ECDH', 'RSA')),
  device_id TEXT, -- For multi-device support (future)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Key rotation
  revoked BOOLEAN NOT NULL DEFAULT FALSE,

  UNIQUE(user_id, device_id)
);

CREATE INDEX idx_encryption_keys_user ON user_encryption_keys(user_id, revoked, expires_at);
```

#### Conversation Keys (Shared Secrets)

```sql
CREATE TABLE conversation_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_shared_key TEXT NOT NULL, -- Shared secret encrypted with user's public key
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(conversation_id, user_id, key_version)
);

CREATE INDEX idx_conversation_keys_conversation ON conversation_keys(conversation_id, key_version DESC);
CREATE INDEX idx_conversation_keys_user ON conversation_keys(user_id);
```

#### Typing Indicators

```sql
CREATE TABLE typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_typing BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_typing_indicators_conversation ON typing_indicators(conversation_id, updated_at DESC);
```

---

### End-to-End Encryption Architecture

#### Encryption Flow (Web Crypto API)

**Key Generation (Per User)**:

```typescript
// Generate ECDH key pair for user
const keyPair = await crypto.subtle.generateKey(
  { name: 'ECDH', namedCurve: 'P-256' },
  true,
  ['deriveKey', 'deriveBits']
);

// Export public key to JWK format
const publicKeyJWK = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

// Store public key in database
await supabase.from('user_encryption_keys').insert({
  user_id: currentUser.id,
  public_key: JSON.stringify(publicKeyJWK),
  key_type: 'ECDH',
});

// Store private key in IndexedDB (never sent to server)
await storePrivateKey(keyPair.privateKey);
```

**Shared Secret Derivation (Per Conversation)**:

```typescript
// Alice derives shared secret with Bob's public key
const sharedSecret = await crypto.subtle.deriveKey(
  { name: 'ECDH', public: bobPublicKey },
  alicePrivateKey,
  { name: 'AES-GCM', length: 256 },
  true,
  ['encrypt', 'decrypt']
);

// Store encrypted shared secret (for key rotation)
const encryptedSecret = await encryptWithPublicKey(
  sharedSecret,
  alicePublicKey
);
await supabase.from('conversation_keys').insert({
  conversation_id: conversationId,
  user_id: alice.id,
  encrypted_shared_key: encryptedSecret,
});
```

**Message Encryption**:

```typescript
// Encrypt message with shared secret
const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
const encodedMessage = new TextEncoder().encode(messageText);

const encryptedData = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  sharedSecret,
  encodedMessage
);

// Send encrypted message to server
await supabase.from('messages').insert({
  conversation_id: conversationId,
  sender_id: currentUser.id,
  encrypted_content: arrayBufferToBase64(encryptedData),
  initialization_vector: arrayBufferToBase64(iv),
});
```

**Message Decryption**:

```typescript
// Decrypt received message
const encryptedData = base64ToArrayBuffer(message.encrypted_content);
const iv = base64ToArrayBuffer(message.initialization_vector);

const decryptedData = await crypto.subtle.decrypt(
  { name: 'AES-GCM', iv },
  sharedSecret,
  encryptedData
);

const messageText = new TextDecoder().decode(decryptedData);
```

#### Zero-Knowledge Architecture

**Guarantees**:

- Server never receives plaintext messages
- Server never receives private keys
- Server never receives shared secrets
- All encryption/decryption happens client-side
- Even database admins cannot read messages

**Key Management**:

- Private keys stored in browser IndexedDB (never synced)
- Public keys stored in Supabase (for key exchange)
- Shared secrets derived via ECDH (never transmitted)
- Key rotation on security events
- Forward secrecy via ephemeral keys (future)

---

### Message Editing

#### Edit Window & Permissions

```typescript
// 15-minute edit window
const EDIT_WINDOW_MS = 15 * 60 * 1000;

export function canEditMessage(message: Message, userId: string): boolean {
  // Must be sender
  if (message.sender_id !== userId) return false;

  // Must not be deleted
  if (message.deleted) return false;

  // Must be within edit window
  const messageAge = Date.now() - new Date(message.created_at).getTime();
  if (messageAge > EDIT_WINDOW_MS) return false;

  return true;
}
```

#### Edit Flow

```typescript
// Edit message (preserves history)
export async function editMessage(
  messageId: string,
  newContent: string,
  sharedSecret: CryptoKey
): Promise<void> {
  // Get original message
  const { data: message } = await supabase
    .from('messages')
    .select('*')
    .eq('id', messageId)
    .single();

  if (!message) throw new Error('Message not found');
  if (!canEditMessage(message, currentUser.id)) {
    throw new Error('Cannot edit this message');
  }

  // Save original to edit history
  await supabase.from('message_edits').insert({
    message_id: messageId,
    previous_content: message.encrypted_content,
    previous_iv: message.initialization_vector,
    edited_by: currentUser.id,
  });

  // Encrypt new content
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedSecret,
    new TextEncoder().encode(newContent)
  );

  // Update message
  await supabase
    .from('messages')
    .update({
      encrypted_content: arrayBufferToBase64(encryptedData),
      initialization_vector: arrayBufferToBase64(iv),
      edited: true,
      edited_at: new Date().toISOString(),
    })
    .eq('id', messageId);
}
```

#### Edit History UI

```typescript
// Show edit history (decrypt all versions)
export async function getEditHistory(
  messageId: string
): Promise<MessageVersion[]> {
  const { data: edits } = await supabase
    .from('message_edits')
    .select('*')
    .eq('message_id', messageId)
    .order('created_at', { ascending: false });

  // Decrypt each version
  const versions = await Promise.all(
    edits.map(async (edit) => ({
      content: await decryptMessage(edit.previous_content, edit.previous_iv),
      edited_at: edit.created_at,
      edited_by: edit.edited_by,
    }))
  );

  return versions;
}
```

---

### Real-time Updates (Supabase Realtime)

#### Subscribe to New Messages

```typescript
// Pattern from payment system (usePaymentRealtime)
export function useConversationRealtime(conversationId: string) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    // Subscribe to new messages
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === updatedMessage.id ? updatedMessage : msg
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return { messages };
}
```

#### Typing Indicators

```typescript
// Debounced typing indicator
export function useTypingIndicator(conversationId: string) {
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const startTyping = useCallback(() => {
    setIsTyping(true);

    // Update database
    supabase.from('typing_indicators').upsert({
      conversation_id: conversationId,
      user_id: currentUser.id,
      is_typing: true,
      updated_at: new Date().toISOString(),
    });

    // Auto-clear after 3 seconds
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [conversationId]);

  const stopTyping = useCallback(() => {
    setIsTyping(false);
    supabase
      .from('typing_indicators')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', currentUser.id);
  }, [conversationId]);

  return { startTyping, stopTyping, isTyping };
}
```

#### Read Receipts

```typescript
// Mark messages as read when viewed
export async function markMessagesAsRead(
  conversationId: string
): Promise<void> {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .is('read_at', null)
    .neq('sender_id', currentUser.id); // Don't mark own messages
}
```

---

### Offline Support (IndexedDB Queue)

#### Offline Queue Schema (Dexie)

```typescript
// lib/messaging/database.ts
import Dexie, { Table } from 'dexie';

interface QueuedMessage {
  id: string; // Local UUID
  conversation_id: string;
  recipient_id: string;
  encrypted_content: string;
  initialization_vector: string;
  created_at: string;
  retry_count: number;
  synced: boolean;
}

class MessagingDatabase extends Dexie {
  queuedMessages!: Table<QueuedMessage, string>;
  cachedMessages!: Table<Message, string>;
  cachedConversations!: Table<Conversation, string>;

  constructor() {
    super('MessagingDB');
    this.version(1).stores({
      queuedMessages: 'id, conversation_id, synced, created_at',
      cachedMessages: 'id, conversation_id, created_at',
      cachedConversations: 'id, last_message_at',
    });
  }
}

export const messagingDb = new MessagingDatabase();
```

#### Queue Message When Offline

```typescript
// services/messaging/offline-queue.ts
export async function sendMessage(
  conversationId: string,
  recipientId: string,
  content: string
): Promise<void> {
  const sharedSecret = await getConversationKey(conversationId);

  // Encrypt message
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedSecret,
    new TextEncoder().encode(content)
  );

  const message = {
    id: crypto.randomUUID(),
    conversation_id: conversationId,
    recipient_id: recipientId,
    encrypted_content: arrayBufferToBase64(encryptedData),
    initialization_vector: arrayBufferToBase64(iv),
    created_at: new Date().toISOString(),
    retry_count: 0,
    synced: false,
  };

  if (navigator.onLine) {
    // Try to send immediately
    try {
      await supabase.from('messages').insert({
        conversation_id: message.conversation_id,
        sender_id: currentUser.id,
        encrypted_content: message.encrypted_content,
        initialization_vector: message.initialization_vector,
      });

      // Success - don't queue
      return;
    } catch (error) {
      console.error('Send failed, queuing:', error);
    }
  }

  // Queue for later
  await messagingDb.queuedMessages.add(message);
}
```

#### Background Sync

```typescript
// utils/messaging-sync.ts
export async function syncQueuedMessages(): Promise<void> {
  const queued = await messagingDb.queuedMessages
    .where('synced')
    .equals(false)
    .toArray();

  for (const message of queued) {
    try {
      await supabase.from('messages').insert({
        conversation_id: message.conversation_id,
        sender_id: currentUser.id,
        encrypted_content: message.encrypted_content,
        initialization_vector: message.initialization_vector,
        created_at: message.created_at,
      });

      // Mark as synced
      await messagingDb.queuedMessages.update(message.id, { synced: true });
    } catch (error) {
      // Increment retry count
      await messagingDb.queuedMessages.update(message.id, {
        retry_count: message.retry_count + 1,
      });

      // Give up after 5 retries
      if (message.retry_count >= 5) {
        console.error('Message failed after 5 retries:', message.id);
      }
    }
  }
}

// Service Worker sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncQueuedMessages());
  }
});
```

---

## UI Components (5-File Pattern)

### Atomic Components

#### `MessageBubble/`

```typescript
interface MessageBubbleProps {
  message: Message;
  isSender: boolean;
  showAvatar?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}
```

- Display encrypted message (after decryption)
- Sender vs. recipient styling
- Edit indicator ("Edited 2m ago")
- Read receipt checkmark
- Long-press menu (edit, delete, copy)
- 44px touch target

#### `TypingIndicator/`

```typescript
interface TypingIndicatorProps {
  username: string;
  isVisible: boolean;
}
```

- Animated "..." dots
- "[Username] is typing..."
- Fade in/out transitions

#### `ReadReceipt/`

```typescript
interface ReadReceiptProps {
  status: 'sent' | 'delivered' | 'read';
  timestamp?: string;
}
```

- Single checkmark: delivered
- Double checkmark: read
- Color: gray (delivered), blue (read)

### Molecular Components

#### `MessageInput/`

```typescript
interface MessageInputProps {
  conversationId: string;
  onSend: (content: string) => void;
  onTyping: () => void;
  disabled?: boolean;
}
```

- Auto-expanding textarea
- Send button (44px touch target)
- Typing indicator trigger
- Emoji picker (optional)
- Attachment button (future)
- Character count
- Keyboard shortcuts (Cmd+Enter to send)

#### `MessageThread/`

```typescript
interface MessageThreadProps {
  conversationId: string;
  messages: Message[];
  onLoadMore: () => void;
}
```

- Virtual scrolling (performance)
- Infinite scroll (load older messages)
- Date separators
- Grouped messages (same sender)
- Scroll to bottom button
- Unread message indicator

#### `ConversationListItem/`

```typescript
interface ConversationListItemProps {
  conversation: Conversation;
  unreadCount: number;
  lastMessage: Message;
  isOnline: boolean;
  onClick: () => void;
}
```

- User avatar
- Username
- Last message preview (decrypted)
- Timestamp
- Unread badge
- Online/offline indicator
- 44px touch target

#### `EditHistoryModal/`

```typescript
interface EditHistoryModalProps {
  messageId: string;
  isOpen: boolean;
  onClose: () => void;
}
```

- List all edits with timestamps
- Decrypt and display each version
- "Original" vs. "Edited" labels
- Close button (44px)

### Organisms

#### `ConversationList/`

```typescript
interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
}
```

- Search conversations
- Filter by unread
- Sort by last message
- New message button
- Empty state (no conversations)
- Loading skeleton

#### `ChatWindow/`

```typescript
interface ChatWindowProps {
  conversationId: string;
  recipientId: string;
}
```

- Header (recipient name, avatar, online status)
- MessageThread (scrollable messages)
- MessageInput (compose)
- Typing indicator
- Connection status (online/offline)
- Mobile: Full screen
- Desktop: Split pane

#### `UserSearch/`

```typescript
interface UserSearchProps {
  onSelect: (userId: string) => void;
  excludeUserIds?: string[];
}
```

- Search input (debounced)
- User results list
- Avatar + username + bio
- "Send request" / "Message" button
- Empty state ("No users found")
- Loading state

#### `ConnectionManager/`

```typescript
interface ConnectionManagerProps {
  connections: UserConnection[];
  pendingRequests: UserConnection[];
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onBlock: (id: string) => void;
}
```

- Tabs: Friends, Requests, Blocked
- Friend list with avatars
- Pending requests (accept/decline)
- Blocked users (unblock option)
- Search friends

---

## Row Level Security (RLS) Policies

### User Connections

```sql
-- Users can view connections they're part of
CREATE POLICY "Users view own connections" ON user_connections
  FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Users can create connection requests
CREATE POLICY "Users can send requests" ON user_connections
  FOR INSERT
  WITH CHECK (auth.uid() = requester_id AND status = 'pending');

-- Users can update requests sent to them
CREATE POLICY "Users can respond to requests" ON user_connections
  FOR UPDATE
  USING (auth.uid() = addressee_id AND status = 'pending')
  WITH CHECK (status IN ('accepted', 'declined', 'blocked'));

-- Users can delete connections they're part of
CREATE POLICY "Users can delete own connections" ON user_connections
  FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
```

### Conversations

```sql
-- Users can only view conversations they're in
CREATE POLICY "Users view own conversations" ON conversations
  FOR SELECT
  USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

-- Users can create conversations with connections
CREATE POLICY "Users can create conversations" ON conversations
  FOR INSERT
  WITH CHECK (
    (auth.uid() = participant_1_id OR auth.uid() = participant_2_id) AND
    EXISTS (
      SELECT 1 FROM user_connections
      WHERE status = 'accepted' AND (
        (requester_id = participant_1_id AND addressee_id = participant_2_id) OR
        (requester_id = participant_2_id AND addressee_id = participant_1_id)
      )
    )
  );
```

### Messages

```sql
-- Users can view messages in their conversations
CREATE POLICY "Users view own messages" ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id AND
      (auth.uid() = participant_1_id OR auth.uid() = participant_2_id)
    )
  );

-- Users can send messages to their conversations
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id AND
      (auth.uid() = participant_1_id OR auth.uid() = participant_2_id)
    )
  );

-- Users can edit their own messages (within edit window)
CREATE POLICY "Users can edit own messages" ON messages
  FOR UPDATE
  USING (
    auth.uid() = sender_id AND
    deleted = FALSE AND
    (NOW() - created_at) < INTERVAL '15 minutes'
  );

-- Users can soft-delete their own messages
CREATE POLICY "Users can delete own messages" ON messages
  FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (deleted = TRUE);
```

### Encryption Keys

```sql
-- Users can view all public keys (needed for encryption)
CREATE POLICY "Anyone can view public keys" ON user_encryption_keys
  FOR SELECT
  USING (revoked = FALSE AND (expires_at IS NULL OR expires_at > NOW()));

-- Users can create their own keys
CREATE POLICY "Users can create own keys" ON user_encryption_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can revoke their own keys
CREATE POLICY "Users can revoke own keys" ON user_encryption_keys
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (revoked = TRUE);
```

---

## Security Considerations

### End-to-End Encryption

**Guarantees**:

- Server never sees plaintext messages
- Database admins cannot read messages
- Supabase employees cannot read messages
- Man-in-the-middle attacks prevented (HTTPS + encryption)

**Limitations**:

- Lost private key = lost messages (cannot recover)
- No message search (server-side) - must decrypt locally
- Multi-device requires key synchronization (future)

### Content Moderation

**Challenge**: Cannot moderate encrypted content

**Solutions**:

1. **User reports**: Allow reporting conversations
2. **Metadata analysis**: Detect spam via message frequency
3. **Client-side filtering**: Optional profanity filter (user-controlled)
4. **Connection vetting**: Require mutual friend requests

### GDPR Compliance

**Right to Erasure**:

```sql
-- Delete all user's messages (CASCADE handles most)
DELETE FROM auth.users WHERE id = <user_id>;

-- Explicitly clear message content (before CASCADE)
UPDATE messages SET
  encrypted_content = '',
  deleted = TRUE,
  deleted_at = NOW()
WHERE sender_id = <user_id>;
```

**Data Export**:

```typescript
// Export all conversations
export async function exportUserData(userId: string): Promise<Blob> {
  const conversations = await getConversations(userId);
  const messages = await Promise.all(
    conversations.map((c) => getMessages(c.id))
  );

  // Decrypt messages
  const decryptedData = await decryptAllMessages(messages);

  // Format as JSON
  return new Blob([JSON.stringify(decryptedData, null, 2)], {
    type: 'application/json',
  });
}
```

**Data Retention**:

- Messages: Keep indefinitely (user-controlled deletion)
- Deleted messages: Soft delete (content cleared)
- Edit history: Keep for 90 days, then purge

---

## Mobile-First Design

### Touch Targets (44px Minimum)

```tsx
// All interactive elements
<button className="btn btn-primary min-h-11 min-w-11">Send</button>
<div className="message-bubble min-h-11 cursor-pointer">...</div>
<Link className="user-avatar min-h-11 min-w-11">...</Link>
```

### Responsive Layout

**Mobile (< 768px)**:

```tsx
// Full-screen chat window
<div className="fixed inset-0 z-50">
  <ChatHeader />
  <MessageThread className="flex-1" />
  <MessageInput className="sticky bottom-0" />
</div>
```

**Tablet+ (>= 768px)**:

```tsx
// Split pane: conversation list + chat
<div className="flex h-screen">
  <ConversationList className="w-80 border-r" />
  <ChatWindow className="flex-1" />
</div>
```

### Keyboard Handling

```tsx
// Avoid keyboard overlap on mobile
<MessageInput
  onFocus={() => scrollToBottom()}
  className="pb-safe-bottom" // iOS safe area
/>;

// Detect keyboard visibility
const isKeyboardVisible = useKeyboardVisible();
<MessageThread className={isKeyboardVisible ? 'h-[50vh]' : 'h-full'} />;
```

### Performance Optimizations

**Virtual Scrolling**:

```tsx
// Only render visible messages
import { VirtualScroller } from '@/components/utils/VirtualScroller';

<VirtualScroller
  items={messages}
  itemHeight={80}
  renderItem={(msg) => <MessageBubble message={msg} />}
/>;
```

**Lazy Loading**:

```tsx
// Load 50 messages at a time
const [page, setPage] = useState(1);
const { messages, hasMore } = useMessages(conversationId, page);

<InfiniteScroll onLoadMore={() => setPage((p) => p + 1)} hasMore={hasMore}>
  {messages.map((msg) => (
    <MessageBubble key={msg.id} message={msg} />
  ))}
</InfiniteScroll>;
```

**Image Optimization**:

```tsx
// Compress before upload (future feature)
const compressed = await compressImage(file, {
  maxWidth: 1024,
  maxHeight: 1024,
  quality: 0.8,
});
```

---

## Testing Requirements

### Unit Tests (Vitest)

**Encryption Functions**:

- `generateKeyPair()` - creates valid ECDH keys
- `deriveSharedSecret()` - derives matching secrets
- `encryptMessage()` - produces ciphertext
- `decryptMessage()` - recovers plaintext
- Round-trip encryption (encrypt → decrypt = original)

**Message Validation**:

- `canEditMessage()` - enforces 15-minute window
- `canDeleteMessage()` - checks ownership
- `validateMessageContent()` - length limits, sanitization

**Offline Queue**:

- `queueMessage()` - stores in IndexedDB
- `syncMessages()` - retries on reconnect
- `deduplicateMessages()` - handles duplicates

### Integration Tests

**Real-time Subscriptions**:

- Receive new message via Supabase realtime
- Typing indicator updates
- Read receipt updates
- Connection status changes

**RLS Policy Enforcement**:

- Cannot read others' messages
- Cannot send to non-connections
- Cannot edit others' messages
- Can view public encryption keys

**Offline Sync**:

- Queue message when offline
- Sync when reconnected
- Handle conflicts (duplicate sends)

### E2E Tests (Playwright)

**Complete Messaging Flow**:

1. User A searches for User B
2. User A sends friend request
3. User B accepts request
4. User A sends encrypted message
5. User B receives message in real-time
6. User B reads message (read receipt)
7. User A sees read status

**Message Editing Flow**:

1. Send message
2. Edit within 15 minutes
3. See "Edited" indicator
4. View edit history
5. Cannot edit after 15 minutes

**Offline Messaging**:

1. Go offline (network throttle)
2. Send message (queued)
3. Message shows "Sending..."
4. Go online
5. Message syncs and delivers

**Cross-Browser Encryption**:

- Chrome → Firefox encryption works
- Safari → Chrome encryption works
- Edge → Safari encryption works

### Accessibility Tests (Pa11y)

**Keyboard Navigation**:

- Tab through conversations
- Arrow keys to navigate messages
- Enter to open conversation
- Escape to close modals

**Screen Reader Support**:

- Announce new messages (ARIA live region)
- Announce typing indicators
- Announce read receipts
- Message timestamps

**Focus Management**:

- Focus message input after opening chat
- Focus first conversation after search
- Trap focus in modals

---

## Performance Requirements

### Latency

- Message send → receive: **< 500ms** (real-time)
- Message encryption: **< 100ms** (client-side)
- Message decryption: **< 50ms** (cached keys)
- Typing indicator: **< 200ms** (debounced)
- Conversation list load: **< 1s** (cached)

### Scalability

- Support **1,000+ messages** per conversation (virtual scroll)
- Support **100+ connections** per user (pagination)
- Support **10+ concurrent conversations** (IndexedDB cache)
- Message queue: **100+ offline messages** (5MB storage limit)

### UI Responsiveness

- Scroll FPS: **60 fps** (virtual scrolling)
- Animation FPS: **60 fps** (CSS transitions)
- Input lag: **< 50ms** (debounced typing)
- Initial load: **< 2s** (skeleton UI)

---

## Implementation Phases

### Phase 1: Foundation (3 days)

**Goals**: Basic database, connections, UI components

- [ ] Create database schema (all tables)
- [ ] Write RLS policies
- [ ] Create Supabase migrations
- [ ] Build `ConnectionManager` component
- [ ] Build `UserSearch` component
- [ ] Implement friend request flow
- [ ] Write unit tests for connection logic
- [ ] E2E test: send/accept friend request

### Phase 2: Encryption (3 days)

**Goals**: E2E encryption working end-to-end

- [ ] Implement key generation (ECDH)
- [ ] Store private keys in IndexedDB
- [ ] Store public keys in Supabase
- [ ] Implement shared secret derivation
- [ ] Implement message encryption (AES-GCM)
- [ ] Implement message decryption
- [ ] Build encryption key management UI
- [ ] Write unit tests for crypto functions
- [ ] Integration test: cross-user encryption

### Phase 3: Messaging (2 days)

**Goals**: Send/receive encrypted messages in real-time

- [ ] Build `MessageBubble` component
- [ ] Build `MessageThread` component
- [ ] Build `MessageInput` component
- [ ] Build `ChatWindow` component
- [ ] Implement send message flow
- [ ] Subscribe to Supabase realtime
- [ ] Implement typing indicators
- [ ] Implement read receipts
- [ ] Message editing with history
- [ ] E2E test: complete message flow

### Phase 4: Offline & Polish (2-3 days)

**Goals**: Offline support, search, notifications, final polish

- [ ] Implement IndexedDB offline queue
- [ ] Background sync on reconnection
- [ ] Implement message search (local)
- [ ] Build `ConversationList` component
- [ ] Implement virtual scrolling
- [ ] Implement infinite scroll (pagination)
- [ ] Add push notifications (PWA)
- [ ] Mobile responsive polish
- [ ] Accessibility audit (Pa11y)
- [ ] Performance optimization
- [ ] E2E test: offline messaging

---

## Success Criteria

- [ ] Users can send/receive encrypted messages with < 500ms latency
- [ ] Server cannot decrypt messages (zero-knowledge verified)
- [ ] Messages edit within 15 minutes, edit history preserved
- [ ] Offline messages queue and sync on reconnection
- [ ] Real-time typing indicators work
- [ ] Read receipts accurate
- [ ] Mobile UI follows 44px touch target standard
- [ ] Conversation list supports 100+ conversations
- [ ] Message threads support 1,000+ messages (virtual scroll)
- [ ] WCAG AA accessibility compliance (Pa11y passes)
- [ ] 60%+ test coverage (unit + integration + E2E)
- [ ] Cross-browser encryption works (Chrome, Firefox, Safari, Edge)
- [ ] GDPR compliance (data export, right to erasure)

---

## Out of Scope (v0.5.0)

The following features are deferred to future versions:

❌ **Group Chats**: 3+ participants per conversation (complex key management)
❌ **Voice/Video Calls**: WebRTC integration (significant complexity)
❌ **File Attachments**: Images, documents, videos (storage + encryption)
❌ **Message Reactions**: Emoji reactions (low priority)
❌ **Disappearing Messages**: Auto-delete after time (complexity)
❌ **Message Forwarding**: Forward to other conversations (privacy concerns)
❌ **Multi-Device Sync**: Sync private keys across devices (security challenge)
❌ **Perfect Forward Secrecy**: Ratcheting keys per message (complexity)
❌ **Message Search**: Server-side full-text search (can't search encrypted)

---

## Risks & Mitigations

### Risk 1: Encryption Complexity

**Impact**: High complexity, potential bugs in crypto implementation

**Mitigation**:

- Use browser's Web Crypto API (battle-tested)
- Extensive unit tests for crypto functions
- Security audit before production
- Reference implementation: Signal Protocol

### Risk 2: Performance with Large Message Histories

**Impact**: UI lag with 1,000+ messages

**Mitigation**:

- Virtual scrolling (only render visible messages)
- Pagination (load 50 at a time)
- IndexedDB caching (reduce API calls)
- Lazy load images (future)

### Risk 3: Offline Sync Conflicts

**Impact**: Duplicate messages or lost messages

**Mitigation**:

- Client-side UUID prevents duplicates
- Retry logic with exponential backoff
- Server-side idempotency checks
- Conflict resolution UI (show both versions)

### Risk 4: Lost Private Keys

**Impact**: User loses all messages if private key deleted

**Mitigation**:

- Warn user about IndexedDB clearing consequences
- Export key backup (encrypted with password)
- Future: Multi-device key sync
- Future: Key escrow (opt-in, reduces zero-knowledge)

### Risk 5: Content Moderation

**Impact**: Cannot moderate encrypted content

**Mitigation**:

- User reporting system
- Block/unblock functionality
- Metadata-based spam detection (frequency)
- Connection vetting (mutual requests)

---

## Dependencies

**Technical**:

- ✅ Supabase project configured
- ✅ Supabase Realtime enabled
- ✅ User authentication (PRP-016)
- ✅ Web Crypto API support (all modern browsers)

**External Services**:

- None (fully self-hosted on Supabase)

**Browser Requirements**:

- Web Crypto API (Chrome 37+, Firefox 34+, Safari 11+, Edge 79+)
- IndexedDB (all modern browsers)
- Service Worker (all modern browsers)

---

## Environment Variables

```bash
# No additional env vars needed (uses existing Supabase config)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: Feature flags
NEXT_PUBLIC_ENABLE_MESSAGING=true
NEXT_PUBLIC_MESSAGE_EDIT_WINDOW_MINUTES=15
NEXT_PUBLIC_MAX_MESSAGE_LENGTH=10000
NEXT_PUBLIC_OFFLINE_QUEUE_SIZE=100
```

---

## Documentation Deliverables

1. **User Guide**: How to send messages, manage connections, understand encryption
2. **Developer Guide**: Encryption architecture, offline queue, real-time subscriptions
3. **Security Guide**: Threat model, key management, zero-knowledge architecture
4. **API Reference**: All components, hooks, utility functions
5. **Privacy Policy Update**: Explain E2E encryption, data retention, GDPR rights

---

## Notes

- This feature showcases ScriptHammer's real-time and offline capabilities
- Zero-knowledge encryption demonstrates privacy-first architecture
- Reuses patterns from payment system (realtime, offline queue, RLS)
- Mobile-first design maintains 44px touch target standards
- Comprehensive testing ensures production readiness
- Phased implementation allows incremental delivery

---

## Related PRPs

- **PRP-016**: User Authentication (DEPENDENCY - provides user system)
- **PRP-015**: Payment Integration (INSPIRATION - realtime pattern)
- **PRP-011**: PWA Background Sync (INSPIRATION - offline queue)
- **Future PRP-024**: Group Chat (EXPANSION of this PRP)
- **Future PRP-025**: Voice/Video Calls (EXPANSION of this PRP)
