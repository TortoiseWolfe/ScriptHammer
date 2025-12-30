# Feature Specification: User Messaging System with E2E Encryption

**Feature Number**: 009
**Category**: core-features
**Priority**: P1
**Status**: Draft
**Source**: Migrated from ScriptHammer_v_001 docs/specs/023

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Send Friend Request to Start Conversation (Priority: P1)

A user wants to connect with another user on the platform to enable messaging. They search for the user by username or email and send a friend request.

**Why this priority**: This is the foundation of the messaging system. Without connections, no messaging can occur.

**Independent Test**: Can be fully tested by creating two users, having one search for and send a friend request to the other, and verifying the request appears in the recipient's pending requests list.

**Acceptance Scenarios**:

1. **Given** I am logged in, **When** I search for a user by username, **Then** I see matching users in the search results
2. **Given** I found a user in search, **When** I click "Send Request", **Then** the request is sent and button shows "Request Sent"
3. **Given** I received a friend request, **When** I view my requests, **Then** I see the requester's name and avatar with Accept/Decline buttons
4. **Given** I received a friend request, **When** I click "Accept", **Then** we become connected and can message each other
5. **Given** I received a friend request, **When** I click "Decline", **Then** the request is removed and we remain unconnected
6. **Given** I want to prevent contact, **When** I click "Block" on a user, **Then** they cannot send me requests or messages

---

### User Story 2 - Send Encrypted Message to Connection (Priority: P1)

A user with established connections wants to send a private message to a friend. The message must be end-to-end encrypted so only the sender and recipient can read it.

**Why this priority**: This is the core messaging functionality. Without the ability to send/receive encrypted messages, the feature provides no value.

**Independent Test**: Can be tested by establishing a connection between two users, having one send an encrypted message, and verifying the recipient receives and can decrypt the message.

**Acceptance Scenarios**:

1. **Given** I am connected with a user, **When** I open a conversation, **Then** I see a message input and send button
2. **Given** I am composing a message, **When** I type text and click "Send", **Then** the message is encrypted client-side and sent to the server
3. **Given** my friend sent me a message, **When** I open the conversation, **Then** the encrypted message is decrypted client-side and displayed in plaintext
4. **Given** a message was sent, **When** it appears in the conversation, **Then** I see a timestamp and delivery status (sent/delivered/read)
5. **Given** the server receives an encrypted message, **When** database admins query the message, **Then** they only see encrypted ciphertext (zero-knowledge verified)
6. **Given** I sent a message, **When** my friend reads it, **Then** I see read receipts (double checkmark) on my message

---

### User Story 3 - Real-time Message Delivery (Priority: P1)

A user expects to receive messages instantly without refreshing the page. The system uses Supabase Realtime to push new messages to the recipient within 500ms.

**Why this priority**: Real-time delivery is essential for a modern chat experience.

**Independent Test**: Can be tested by opening the same conversation in two browser windows, sending a message from one window, and verifying it appears in the other window within 500ms without refresh.

**Acceptance Scenarios**:

1. **Given** I have a conversation open, **When** my friend sends me a message, **Then** the message appears in my thread within 500ms without refresh
2. **Given** I am typing a message, **When** I type for >1 second, **Then** my friend sees "[Username] is typing..." indicator
3. **Given** my friend stops typing, **When** 3 seconds pass, **Then** the typing indicator disappears
4. **Given** I sent a message, **When** my friend's app receives it, **Then** the message shows "delivered" status on my end
5. **Given** my friend reads my message, **When** they view the conversation, **Then** my message shows "read" status (double blue checkmark)

---

### User Story 4 - Edit or Delete Message Within 15-Minute Window (Priority: P2)

A user wants to correct a typo, clarify a message, or unsend a message sent by mistake. They can edit or delete the message within 15 minutes.

**Why this priority**: Message editing and deletion improve user experience by allowing corrections and unsending mistakes.

**Acceptance Scenarios**:

1. **Given** I sent a message <15 minutes ago, **When** I long-press the message, **Then** I see "Edit" and "Delete" options in the menu
2. **Given** I clicked "Edit", **When** I modify the text and save, **Then** the message updates with "Edited 2m ago" indicator
3. **Given** I clicked "Delete", **When** I confirm deletion, **Then** the message shows "[Message deleted]" to both users
4. **Given** I edited a message, **When** my friend views it, **Then** they see the updated version with "Edited" label
5. **Given** I sent a message 16 minutes ago, **When** I try to edit or delete it, **Then** both options are disabled/hidden
6. **Given** I deleted a message, **When** I try to edit it, **Then** edit is not allowed

---

### User Story 5 - Offline Message Queue and Sync (Priority: P2)

A user loses internet connection while composing a message. The app queues the message locally in IndexedDB and automatically sends it when the connection is restored.

**Why this priority**: Offline support ensures message reliability and improves UX in areas with poor connectivity.

**Acceptance Scenarios**:

1. **Given** I am offline, **When** I send a message, **Then** it is stored in IndexedDB queue and shows "Sending..." status
2. **Given** I have queued messages, **When** I reconnect to the internet, **Then** all queued messages send automatically
3. **Given** I am offline, **When** I view past conversations, **Then** I see cached messages from IndexedDB
4. **Given** a queued message fails to send 5 times, **When** retry limit is reached, **Then** the message shows "Failed to send" with retry button
5. **Given** I sent a message while offline, **When** it syncs and delivers, **Then** the status updates from "Sending..." to "Delivered"

---

### User Story 6 - Read Conversation History with Virtual Scrolling (Priority: P3)

A user with 1,000+ messages in a conversation wants to scroll through the entire history. The app uses virtual scrolling to render only visible messages for performance.

**Why this priority**: This is important for long-term users with extensive message histories but not critical for initial launch.

**Acceptance Scenarios**:

1. **Given** I have 1,000+ messages in a conversation, **When** I scroll through history, **Then** the app maintains 60fps scrolling
2. **Given** I scroll to the top, **When** I reach the oldest messages, **Then** the app loads the next 50 older messages (pagination)
3. **Given** I am viewing old messages, **When** a new message arrives, **Then** a "New message" indicator appears with scroll-to-bottom button
4. **Given** I scroll to an arbitrary position, **When** I navigate away and back, **Then** the scroll position is preserved
5. **Given** messages load incrementally, **When** encryption keys are cached, **Then** decryption happens within 50ms per message

---

### User Story 7 - GDPR Data Export and Deletion (Priority: P3)

A user wants to exercise their GDPR rights to export all their message history or delete their account with all associated data.

**Why this priority**: While legally required in EU, this can be implemented after MVP launch.

**Acceptance Scenarios**:

1. **Given** I am in settings, **When** I click "Export Data", **Then** I receive a JSON file with all my decrypted conversations
2. **Given** I click "Delete Account", **When** I confirm deletion, **Then** all my messages, connections, and encryption keys are permanently deleted
3. **Given** I deleted my account, **When** other users view old conversations, **Then** my messages show "[User deleted account]" placeholder
4. **Given** I export my data, **When** I open the JSON file, **Then** I see human-readable message content (decrypted), not ciphertext

---

### Edge Cases

- **What happens when** a user tries to message someone who blocked them?
  - Messages remain visible as read-only history. Banner displays "[User] blocked you" at top of conversation, message input is disabled.

- **How does the system handle** lost encryption keys (user clears browser data)?
  - All past messages become unrecoverable. New keys are generated on next message send. User sees warning: "Previous messages cannot be decrypted."

- **What happens when** a user tries to send a message but the recipient has no encryption keys yet?
  - Sender sees: "This user hasn't set up encryption yet. They'll receive your message when they reply." Message is queued locally.

- **What happens when** two users send messages simultaneously while offline?
  - Both messages queue locally, sync when online. Server sequence numbers ensure correct ordering. No message loss.

- **How does the system handle** very long messages (>10,000 characters)?
  - Client validates and shows error: "Message too long (10,000 char max)". Message is not sent.

## Requirements _(mandatory)_

### Functional Requirements

**Connection Management**:

- **FR-001**: System MUST allow users to search for other users by exact username or email address
- **FR-002**: System MUST allow users to send friend requests to other users who are not already connected
- **FR-003**: System MUST allow users to accept, decline, or block friend requests
- **FR-004**: System MUST prevent users from sending duplicate friend requests to the same user
- **FR-005**: System MUST prevent users from sending friend requests to themselves
- **FR-006**: Users MUST be able to view lists of connections, pending requests (sent/received), and blocked users
- **FR-007**: System MUST allow users to remove existing connections (unfriend)

**Encryption & Security**:

- **FR-008**: System MUST generate ECDH key pairs for each user using Web Crypto API (P-256 curve) on first message send attempt
- **FR-009**: System MUST store private keys in browser IndexedDB (never transmitted to server)
- **FR-010**: System MUST store public keys in Supabase database for key exchange
- **FR-011**: System MUST derive shared secrets using ECDH between conversation participants
- **FR-012**: System MUST encrypt all message content client-side using AES-GCM (256-bit) before transmission
- **FR-013**: System MUST decrypt all message content client-side after receipt
- **FR-014**: Server MUST never have access to plaintext messages, private keys, or shared secrets (zero-knowledge)
- **FR-015**: System MUST generate unique initialization vectors (IVs) for each encrypted message

**Messaging Core**:

- **FR-016**: Users MUST be able to send text messages to their connections
- **FR-017**: Users MUST NOT be able to message users who are not connections
- **FR-018**: System MUST deliver new messages via Supabase Realtime within 500ms
- **FR-019**: System MUST assign sequential sequence numbers to messages within each conversation for ordering
- **FR-020**: System MUST track message delivery status (sent, delivered, read)
- **FR-021**: System MUST enforce maximum message length of 10,000 characters
- **FR-022**: Users MUST be able to view full conversation history with another user
- **FR-023**: System MUST support pagination of message history (50 messages per load)

**Message Editing & Deletion**:

- **FR-024**: Users MUST be able to edit their own messages within 15 minutes of sending
- **FR-025**: System MUST overwrite message content in place when edited
- **FR-026**: System MUST display "Edited" indicator on edited messages with last edit timestamp
- **FR-027**: System MUST prevent editing AND deletion of messages older than 15 minutes
- **FR-028**: Users MUST be able to delete their own messages within 15 minutes of sending
- **FR-029**: Deleted messages MUST display "[Message deleted]" placeholder to both users

**Real-time Features**:

- **FR-030**: System MUST show typing indicators when the other user is actively typing
- **FR-031**: System MUST show read receipts (delivered/read status) on sent messages
- **FR-032**: System MUST update read status when recipient views the conversation
- **FR-033**: System MUST use Supabase Realtime postgres_changes subscriptions for all real-time updates

**Offline Support**:

- **FR-034**: System MUST queue messages in IndexedDB when user is offline
- **FR-035**: System MUST automatically sync queued messages when connection is restored
- **FR-036**: System MUST cache recent conversations in IndexedDB for offline viewing
- **FR-037**: System MUST retry failed message sends up to 5 times with exponential backoff
- **FR-038**: System MUST show "Sending..." status for queued messages
- **FR-039**: System MUST show "Failed to send" status for messages that exceed retry limit

**GDPR Compliance**:

- **FR-040**: Users MUST be able to export all their conversation data in JSON format (decrypted)
- **FR-041**: Users MUST be able to delete their account and all associated data (right to erasure)
- **FR-042**: System MUST perform CASCADE DELETE on user deletion (conversations, messages, keys)

**UI/UX Requirements**:

- **FR-043**: All interactive elements MUST meet 44×44px minimum touch target size (mobile-first)
- **FR-044**: System MUST use virtual scrolling for conversations with 100+ messages
- **FR-045**: Conversation list MUST sort by last_message_at timestamp (most recent first)
- **FR-046**: System MUST show unread message count badge on conversations
- **FR-047**: System MUST provide "scroll to bottom" button when viewing old messages

**Accessibility Requirements**:

- **FR-048**: System MUST use ARIA live regions to announce new messages to screen readers
- **FR-049**: System MUST support keyboard navigation (Tab, Arrow keys, Enter, Escape)
- **FR-050**: System MUST trap focus in modals
- **FR-051**: System MUST provide text alternatives for typing indicators and read receipts
- **FR-052**: System MUST meet WCAG AA contrast requirements for all text

### Key Entities

- **UserConnection**: Represents a relationship between two users (requester/addressee) with status (pending, accepted, blocked, declined)

- **Conversation**: Represents a 1-to-1 chat session between two participants. Uses canonical ordering (participant_1_id < participant_2_id) to prevent duplicate conversations

- **Message**: Represents an encrypted message within a conversation. Contains encrypted_content (ciphertext), initialization_vector (IV), sequence_number (ordering), delivery tracking

- **UserEncryptionKey**: Represents a user's public key in JWK format for key exchange

- **ConversationKey**: Represents the shared secret for a conversation, encrypted with the user's public key

- **TypingIndicator**: Represents real-time typing status within a conversation

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can send an encrypted message and have it received/decrypted by the recipient within 500ms
- **SC-002**: Zero-knowledge encryption is verified - database administrators cannot read plaintext messages
- **SC-003**: 90% of message edits occur within 5 minutes of sending, validating 15-minute edit window
- **SC-004**: Offline message queue successfully syncs 100% of queued messages when connection is restored
- **SC-005**: Conversation list with 100+ conversations loads within 1 second using IndexedDB caching
- **SC-006**: Virtual scrolling maintains 60fps when scrolling through 1,000+ message thread
- **SC-007**: WCAG AA accessibility compliance verified via Pa11y automated tests
- **SC-008**: Cross-browser encryption compatibility - messages encrypted in Chrome can be decrypted in Firefox, Safari, and Edge
- **SC-009**: Real-time typing indicators appear within 200ms of user typing activity
- **SC-010**: Read receipts update within 500ms of recipient viewing message
- **SC-011**: 60%+ test coverage across unit, integration, and E2E tests
- **SC-012**: Mobile UI meets 44×44px touch target standard for all interactive elements

## Out of Scope _(explicitly excluded)_

### v0.5.0 Deferred Features

- **Group Chats**: 3+ participants per conversation (see Feature 011)
- **Voice/Video Calls**: WebRTC integration
- **File Attachments**: Upload and encrypt images, documents, videos
- **Message Reactions**: Emoji reactions to messages
- **Disappearing Messages**: Auto-delete messages after time period
- **Message Forwarding**: Forward messages to other conversations
- **Multi-Device Sync**: Sync private keys across user's devices
- **Perfect Forward Secrecy**: Ratcheting keys per message (Signal Protocol style)
- **Server-Side Message Search**: Full-text search across all messages

### Technical Limitations (By Design)

- **Message Recovery**: Lost private keys = lost messages (zero-knowledge architecture)
- **Content Moderation**: Cannot scan encrypted message content
- **Cross-Device Without Re-Key**: Switching devices requires re-generating keys
