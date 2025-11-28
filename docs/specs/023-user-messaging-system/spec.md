# Feature Specification: User Messaging System with E2E Encryption

**Feature Branch**: `023-user-messaging-system`
**Created**: 2025-10-08
**Status**: Draft
**Input**: User description: "User Messaging System with E2E Encryption"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Send Friend Request to Start Conversation (Priority: P1)

A user wants to connect with another user on the platform to enable messaging. They search for the user by username or email and send a friend request.

**Why this priority**: This is the foundation of the messaging system. Without connections, no messaging can occur. This represents the minimal viable product that allows users to form relationships on the platform.

**Independent Test**: Can be fully tested by creating two users, having one search for and send a friend request to the other, and verifying the request appears in the recipient's pending requests list. Delivers value by establishing user-to-user connections.

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

**Why this priority**: This is the core messaging functionality. Without the ability to send/receive encrypted messages, the feature provides no value. Together with P1 connection management, this forms the complete MVP.

**Independent Test**: Can be tested by establishing a connection between two users, having one send an encrypted message, and verifying the recipient receives and can decrypt the message. Delivers immediate value through secure communication.

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

**Why this priority**: Real-time delivery is essential for a modern chat experience. Without it, users must manually refresh to see new messages, breaking the conversational flow. This is part of the MVP for a viable messaging system.

**Independent Test**: Can be tested by opening the same conversation in two browser windows (simulating two users), sending a message from one window, and verifying it appears in the other window within 500ms without refresh. Delivers value through modern chat UX.

**Acceptance Scenarios**:

1. **Given** I have a conversation open, **When** my friend sends me a message, **Then** the message appears in my thread within 500ms without refresh
2. **Given** I am typing a message, **When** I type for >1 second, **Then** my friend sees "[Username] is typing..." indicator
3. **Given** my friend stops typing, **When** 3 seconds pass, **Then** the typing indicator disappears
4. **Given** I sent a message, **When** my friend's app receives it, **Then** the message shows "delivered" status on my end
5. **Given** my friend reads my message, **When** they view the conversation, **Then** my message shows "read" status (double blue checkmark)

---

### User Story 4 - Edit or Delete Message Within 15-Minute Window (Priority: P2)

A user wants to correct a typo, clarify a message, or unsend a message sent by mistake. They can edit or delete the message within 15 minutes. Edits overwrite the original content with an "Edited" indicator. Deletions show "[Message deleted]" placeholder to both users.

**Why this priority**: Message editing and deletion improve user experience by allowing corrections and unsending mistakes. The 15-minute window prevents abuse while allowing quick fixes. This is important but not critical for MVP.

**Independent Test**: Can be tested by sending a message, editing it within 15 minutes, and verifying the recipient sees updated content with "Edited" timestamp. Then send another message, delete it, and verify both users see "[Message deleted]" placeholder. Delivers value through better communication quality. **[Updated 2025-10-08: Added deletion, no edit history storage]**

**Acceptance Scenarios**:

1. **Given** I sent a message <15 minutes ago, **When** I long-press the message, **Then** I see "Edit" and "Delete" options in the menu
2. **Given** I clicked "Edit", **When** I modify the text and save, **Then** the message updates with "Edited 2m ago" indicator
3. **Given** I clicked "Delete", **When** I confirm deletion, **Then** the message shows "[Message deleted]" to both users **[Added 2025-10-08]**
4. **Given** I edited a message, **When** my friend views it, **Then** they see the updated version with "Edited" label
5. ~~**Given** a message was edited, **When** anyone clicks the "Edited" indicator, **Then** they see full edit history with timestamps~~ **[REMOVED - No edit history UI, Clarified 2025-10-08]**
6. **Given** I sent a message 16 minutes ago, **When** I try to edit or delete it, **Then** both options are disabled/hidden **[Updated 2025-10-08]**
7. **Given** I deleted a message, **When** I try to edit it, **Then** edit is not allowed

---

### User Story 5 - Offline Message Queue and Sync (Priority: P2)

A user loses internet connection while composing a message. The app queues the message locally in IndexedDB and automatically sends it when the connection is restored.

**Why this priority**: Offline support ensures message reliability and improves UX in areas with poor connectivity. While important for production quality, it's not critical for the initial MVP.

**Independent Test**: Can be tested by disconnecting from the internet, sending a message (queued in IndexedDB), reconnecting, and verifying the message sends automatically. Delivers value through reliable message delivery.

**Acceptance Scenarios**:

1. **Given** I am offline, **When** I send a message, **Then** it is stored in IndexedDB queue and shows "Sending..." status
2. **Given** I have queued messages, **When** I reconnect to the internet, **Then** all queued messages send automatically
3. **Given** I am offline, **When** I view past conversations, **Then** I see cached messages from IndexedDB
4. **Given** a queued message fails to send 5 times, **When** retry limit is reached, **Then** the message shows "Failed to send" with retry button
5. **Given** I sent a message while offline, **When** it syncs and delivers, **Then** the status updates from "Sending..." to "Delivered"

---

### User Story 6 - Read Conversation History with Virtual Scrolling (Priority: P3)

A user with 1,000+ messages in a conversation wants to scroll through the entire history. The app uses virtual scrolling to render only visible messages for performance.

**Why this priority**: This is important for long-term users with extensive message histories but not critical for initial launch. Virtual scrolling can be added later without breaking existing functionality.

**Independent Test**: Can be tested by creating a conversation with 1,000 messages, scrolling through the history, and measuring scroll performance (should maintain 60fps). Delivers value through scalable performance.

**Acceptance Scenarios**:

1. **Given** I have 1,000+ messages in a conversation, **When** I scroll through history, **Then** the app maintains 60fps scrolling
2. **Given** I scroll to the top, **When** I reach the oldest messages, **Then** the app loads the next 50 older messages (pagination)
3. **Given** I am viewing old messages, **When** a new message arrives, **Then** a "New message" indicator appears with scroll-to-bottom button
4. **Given** I scroll to an arbitrary position, **When** I navigate away and back, **Then** the scroll position is preserved
5. **Given** messages load incrementally, **When** encryption keys are cached, **Then** decryption happens within 50ms per message

---

### User Story 7 - GDPR Data Export and Deletion (Priority: P3)

A user wants to exercise their GDPR rights to export all their message history or delete their account with all associated data.

**Why this priority**: While legally required in EU, this can be implemented after MVP launch. The underlying CASCADE DELETE constraints are in place, so the feature is primarily UI-focused.

**Independent Test**: Can be tested by exporting conversation data to JSON, verifying all messages are decrypted correctly, then deleting the account and confirming all data is removed from the database. Delivers compliance value.

**Acceptance Scenarios**:

1. **Given** I am in settings, **When** I click "Export Data", **Then** I receive a JSON file with all my decrypted conversations
2. **Given** I click "Delete Account", **When** I confirm deletion, **Then** all my messages, connections, and encryption keys are permanently deleted
3. **Given** I deleted my account, **When** other users view old conversations, **Then** my messages show "[User deleted account]" placeholder
4. **Given** I export my data, **When** I open the JSON file, **Then** I see human-readable message content (decrypted), not ciphertext

---

### Edge Cases

- **What happens when** a user tries to message someone who blocked them?
  - Messages remain visible as read-only history. A banner displays "[User] blocked you" at the top of the conversation, and the message input is disabled. The blocked user cannot send new messages but can view the conversation history. **[Clarified 2025-10-08]**

- **How does the system handle** lost encryption keys (user clears browser data)?
  - All past messages become unrecoverable (cannot decrypt). New keys are generated on next message send (lazy re-initialization). User sees warning: "Previous messages cannot be decrypted." **[Clarified 2025-10-08]**

- **What happens when** a user tries to send a message but the recipient has no encryption keys yet?
  - Sender sees informational message: "This user hasn't set up encryption yet. They'll receive your message when they reply." Message is queued locally. Recipient generates keys on their first reply, then queued message is encrypted and sent. **[Clarified 2025-10-08]**

- **What happens when** two users send messages simultaneously while offline?
  - Both messages queue locally, sync when online. Server sequence numbers ensure correct ordering. No message loss.

- **How does the system handle** very long messages (>10,000 characters)?
  - Client validates and shows error: "Message too long (10,000 char max)". Message is not sent.

- **What happens when** a user edits a message after the recipient already replied?
  - Edit is allowed within 15-minute window. Reply references original message ID, so context is preserved even if parent is edited. The edited content overwrites the original (no history preserved). **[Clarified 2025-10-08]**

- **What happens when** a user deletes a message after the recipient already replied?
  - Deletion is allowed within 15-minute window. Deleted message shows "[Message deleted]" placeholder. Reply remains visible and still references the original message_id. Context may be lost but threading is preserved. **[Clarified 2025-10-08]**

- **What happens when** a user tries to delete a message after 15 minutes?
  - Delete option is hidden/disabled in message menu. Message is permanent and cannot be deleted. User can only block the conversation or delete their entire account (GDPR right to erasure). **[Clarified 2025-10-08]**

- **How does the system handle** encryption/decryption failures?
  - Show user-friendly error: "Could not decrypt message. Try refreshing your keys." Log error details for debugging. Message remains encrypted in database.

- **What happens when** a user has 100+ connections?
  - Conversation list uses pagination (50 per page). Search functionality allows finding specific conversations. Performance maintained via IndexedDB caching.

- **How does the system handle** spam/abuse via rapid messaging?
  - Metadata-based rate limiting: max 10 messages/second per user. Block function prevents all future messages from that user. Report function for admin review.

- **What happens when** a conversation has participants from different timezones?
  - All timestamps stored in UTC, displayed in user's local timezone. Relative times ("2m ago") avoid timezone confusion.

## Requirements _(mandatory)_

### Functional Requirements

**Connection Management**:

- **FR-001**: System MUST allow users to search for other users by exact username or email address
- **FR-002**: System MUST allow users to send friend requests to other users who are not already connected
- **FR-003**: System MUST allow users to accept, decline, or block friend requests. When blocking, conversation history MUST remain visible with disabled message input and "[User] blocked you" banner displayed **[Clarified 2025-10-08]**
- **FR-004**: System MUST prevent users from sending duplicate friend requests to the same user
- **FR-005**: System MUST prevent users from sending friend requests to themselves
- **FR-006**: Users MUST be able to view lists of connections, pending requests (sent/received), and blocked users
- **FR-007**: System MUST allow users to remove existing connections (unfriend)

**Encryption & Security**:

- **FR-008**: System MUST generate ECDH key pairs for each user using Web Crypto API (P-256 curve) on first message send attempt (lazy initialization) **[Clarified 2025-10-08]**
- **FR-009**: System MUST store private keys in browser IndexedDB (never transmitted to server)
- **FR-010**: System MUST store public keys in Supabase database for key exchange
- **FR-011**: System MUST derive shared secrets using ECDH between conversation participants
- **FR-012**: System MUST encrypt all message content client-side using AES-GCM (256-bit) before transmission
- **FR-013**: System MUST decrypt all message content client-side after receipt
- **FR-014**: Server MUST never have access to plaintext messages, private keys, or shared secrets (zero-knowledge)
- **FR-015**: System MUST generate unique initialization vectors (IVs) for each encrypted message
- **FR-016**: System MUST validate encryption keys are not expired or revoked before use
- **FR-067**: When user attempts to send first message, system MUST check for existing keys in IndexedDB. If none exist, generate and upload before sending message. **[Clarified 2025-10-08]**
- **FR-068**: System MUST show "Setting up encryption..." loading state during first-time key generation (1-2 seconds) **[Clarified 2025-10-08]**

**Messaging Core**:

- **FR-017**: Users MUST be able to send text messages to their connections (accepted friend requests)
- **FR-018**: Users MUST NOT be able to message users who are not connections
- **FR-019**: System MUST deliver new messages via Supabase Realtime within 500ms
- **FR-020**: System MUST assign sequential sequence numbers to messages within each conversation for ordering
- **FR-021**: System MUST track message delivery status (sent, delivered, read)
- **FR-022**: System MUST enforce maximum message length of 10,000 characters
- **FR-023**: Users MUST be able to view full conversation history with another user
- **FR-024**: System MUST support pagination of message history (50 messages per load)

**Message Editing & Deletion**:

- **FR-025**: Users MUST be able to edit their own messages within 15 minutes of sending
- **FR-026**: System MUST overwrite message content in place when edited (re-encrypt with new content, no edit history storage) **[Clarified 2025-10-08]**
- **FR-027**: System MUST display "Edited" indicator on edited messages with last edit timestamp only (no edit history drill-down) **[Clarified 2025-10-08]**
- **FR-028**: ~~Users MUST be able to view full edit history for any edited message~~ **[REMOVED - Clarified 2025-10-08]**
- **FR-029**: System MUST prevent editing AND deletion of messages older than 15 minutes **[Clarified 2025-10-08]**
- **FR-030**: System MUST prevent editing of already-deleted messages (deleted=true)
- **FR-065**: Users MUST be able to delete their own messages within 15 minutes of sending **[Clarified 2025-10-08]**
- **FR-066**: Deleted messages MUST display "[Message deleted]" placeholder to both users, preserving message_id for threading **[Clarified 2025-10-08]**

**Real-time Features**:

- **FR-031**: System MUST show typing indicators when the other user is actively typing (debounced to 3 seconds). Typing indicators are always enabled with no opt-out setting. **[Clarified 2025-10-08]**
- **FR-032**: System MUST show read receipts (delivered/read status) on sent messages. Read receipts are always enabled with no opt-out setting. **[Clarified 2025-10-08]**
- **FR-033**: System MUST update read status when recipient views the conversation
- **FR-034**: System MUST not mark sender's own messages as read
- **FR-035**: System MUST use Supabase Realtime postgres_changes subscriptions for all real-time updates
- **FR-036**: When a user blocks another user, all real-time features (typing indicators, read receipts) MUST be disabled between those users **[Clarified 2025-10-08]**

**Offline Support**:

- **FR-037**: System MUST queue messages in IndexedDB when user is offline
- **FR-038**: System MUST automatically sync queued messages when connection is restored
- **FR-039**: System MUST cache recent conversations in IndexedDB for offline viewing
- **FR-040**: System MUST retry failed message sends up to 5 times with exponential backoff
- **FR-041**: System MUST show "Sending..." status for queued messages
- **FR-042**: System MUST show "Failed to send" status for messages that exceed retry limit
- **FR-043**: System MUST prevent duplicate message sends via client-side UUIDs and server-side deduplication

**GDPR Compliance**:

- **FR-044**: Users MUST be able to export all their conversation data in JSON format (decrypted)
- **FR-045**: Users MUST be able to delete their account and all associated data (right to erasure)
- **FR-046**: System MUST perform CASCADE DELETE on user deletion (conversations, messages, keys)
- **FR-047**: On account deletion, system MUST soft-delete message content before CASCADE DELETE (set encrypted_content='', deleted=true). Note: This is separate from user-initiated message deletion (FR-065/FR-066). **[Clarified 2025-10-08]**

**UI/UX Requirements**:

- **FR-048**: All interactive elements MUST meet 44×44px minimum touch target size (mobile-first)
- **FR-049**: System MUST use virtual scrolling for conversations with 100+ messages
- **FR-050**: Conversation list MUST sort by last_message_at timestamp (most recent first)
- **FR-051**: System MUST show unread message count badge on conversations
- **FR-052**: System MUST provide "scroll to bottom" button when viewing old messages
- **FR-053**: Mobile layout MUST use full-screen chat, tablet+ MUST use split-pane layout
- **FR-054**: System MUST use skeleton loading states during data fetch

**Accessibility Requirements**:

- **FR-055**: System MUST use ARIA live regions to announce new messages to screen readers
- **FR-056**: System MUST support keyboard navigation (Tab, Arrow keys, Enter, Escape)
- **FR-057**: System MUST trap focus in modals (settings, blocked user warnings)
- **FR-058**: System MUST provide text alternatives for typing indicators and read receipts
- **FR-059**: System MUST meet WCAG AA contrast requirements for all text

**Performance Requirements**:

- **FR-060**: Message encryption MUST complete within 100ms on standard hardware (reference: 2019 MacBook Pro, Intel i5, 8GB RAM)
- **FR-061**: Message decryption MUST complete within 50ms with cached keys on standard hardware (reference: 2019 MacBook Pro, Intel i5, 8GB RAM)
- **FR-062**: Conversation list MUST load within 1 second (with caching)
- **FR-063**: Virtual scroll MUST maintain 60fps during scrolling
- **FR-064**: Real-time updates MUST not block UI thread (use Web Workers if needed)

### Key Entities _(include if feature involves data)_

- **UserConnection**: Represents a relationship between two users (requester/addressee) with status (pending, accepted, blocked, declined). Enforces uniqueness and prevents self-connections.

- **Conversation**: Represents a 1-to-1 chat session between two participants. Uses canonical ordering (participant_1_id < participant_2_id) to prevent duplicate conversations. Tracks last_message_at for sorting.

- **Message**: Represents an encrypted message within a conversation. Contains encrypted_content (ciphertext), initialization_vector (IV), sequence_number (ordering), delivery tracking (delivered_at, read_at), and edit metadata (edited, edited_at). **Edits overwrite content in place - no edit history storage. [Clarified 2025-10-08]**

- **~~MessageEdit~~**: ~~Represents the edit history of a message. Stores previous_content (encrypted previous version), previous_iv, and edit metadata for transparency.~~ **[REMOVED - No edit history stored, Clarified 2025-10-08]**

- **UserEncryptionKey**: Represents a user's public key in JWK format for key exchange. Supports key rotation via expires_at and revocation. Device_id for future multi-device support.

- **ConversationKey**: Represents the shared secret for a conversation, encrypted with the user's public key. Supports key versioning for rotation. Each participant stores their own encrypted copy.

- **TypingIndicator**: Represents real-time typing status within a conversation. Auto-expires via updated_at timestamp (3-second debounce).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can send an encrypted message and have it received/decrypted by the recipient within 500ms (measured via E2E tests across different browsers)

- **SC-002**: Zero-knowledge encryption is verified - database administrators cannot read plaintext messages even with direct database access (verified via manual inspection of encrypted_content in production-like environment)

- **SC-003**: 90% of message edits occur within 5 minutes of sending (measured via edit timestamp analytics), validating 15-minute edit window is sufficient

- **SC-004**: Offline message queue successfully syncs 100% of queued messages when connection is restored (measured via automated retry tests with network throttling)

- **SC-005**: Conversation list with 100+ conversations loads within 1 second using IndexedDB caching (measured via Playwright performance tests)

- **SC-006**: Virtual scrolling maintains 60fps when scrolling through 1,000+ message thread (measured via Chrome DevTools performance profiling)

- **SC-007**: WCAG AA accessibility compliance verified via Pa11y automated tests (zero errors)

- **SC-008**: Cross-browser encryption compatibility - messages encrypted in Chrome can be decrypted in Firefox, Safari, and Edge with 100% success rate (verified via Playwright cross-browser tests)

- **SC-009**: Real-time typing indicators appear within 200ms of user typing activity (measured via E2E tests with timestamp logging)

- **SC-010**: Read receipts update within 500ms of recipient viewing message (measured via Supabase Realtime latency tests)

- **SC-011**: 60%+ test coverage across unit tests (Vitest), integration tests (Supabase), and E2E tests (Playwright)

- **SC-012**: Mobile UI meets 44×44px touch target standard for all interactive elements (verified via visual regression tests and manual testing on iPhone SE)

- **SC-013**: Friend request acceptance flow completes in <30 seconds from search to first message sent (measured via user testing with 10+ participants)

- **SC-014**: Data export generates complete, decrypted conversation history in JSON format within 10 seconds for users with 1,000+ messages (measured via integration tests)

- **SC-015**: Account deletion removes all user data (messages, connections, keys) within 5 seconds via CASCADE DELETE (verified via database inspection after deletion)

## Non-Functional Requirements _(include if applicable)_

### Security

- **NFR-001**: All encryption operations MUST use Web Crypto API (no custom crypto implementations)
- **NFR-002**: Private keys MUST never leave the client device (stored in IndexedDB only)
- **NFR-003**: All database queries MUST enforce Row Level Security (RLS) policies via Supabase auth.uid()
- **NFR-004**: Shared secrets MUST be derived, never transmitted over the network
- **NFR-005**: Message IVs (initialization vectors) MUST be cryptographically random and unique per message
- **NFR-006**: Public keys MUST be validated before use (not expired, not revoked)
- **NFR-007**: Server MUST use HTTPS for all communication (TLS 1.3 minimum)
- **NFR-008**: Session tokens MUST expire and refresh automatically per Supabase Auth defaults

### Privacy

- **NFR-009**: Server MUST NOT log decrypted message content at any layer (application, database, infrastructure)
- **NFR-010**: Blocked users MUST NOT be notified they are blocked (privacy protection)
- **NFR-011**: User search MUST only return exact matches (no fuzzy search to prevent enumeration)
- **NFR-012**: ~~Typing indicators MUST be opt-out (user privacy preference)~~ **[REMOVED - Always enabled, Clarified 2025-10-08]**
- **NFR-013**: ~~Read receipts MUST be opt-out (user privacy preference)~~ **[REMOVED - Always enabled, Clarified 2025-10-08]**

### Performance

- **NFR-014**: Database indexes MUST exist on all foreign keys and frequently queried columns
- **NFR-015**: Conversation list MUST use IndexedDB caching to avoid redundant API calls
- **NFR-016**: Message thread MUST use virtual scrolling for 100+ messages
- **NFR-017**: Real-time subscriptions MUST be scoped to active conversations only (not all conversations)
- **NFR-018**: Encryption/decryption operations MUST use Web Workers to avoid blocking UI thread when batch decrypting >100 messages (e.g., initial conversation load)

### Scalability

- **NFR-019**: System MUST support 1,000+ messages per conversation with <2s load time
- **NFR-020**: System MUST support 100+ connections per user with <1s load time
- **NFR-021**: System MUST support 10+ concurrent active conversations per user
- **NFR-022**: IndexedDB storage MUST be limited to 5MB for message queue (quota management)

### Browser Compatibility

- **NFR-023**: System MUST support Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **NFR-024**: System MUST detect and warn users on unsupported browsers (Web Crypto API check)
- **NFR-025**: System MUST gracefully degrade if IndexedDB is disabled (show warning, disable offline mode)

### Mobile-First Design

- **NFR-026**: All touch targets MUST be minimum 44×44px per Apple HIG and WCAG AAA
- **NFR-027**: Message input MUST avoid mobile keyboard overlap (scroll to bottom on focus)
- **NFR-028**: Virtual keyboard MUST trigger appropriate input types (text, email, search)
- **NFR-029**: Swipe gestures MUST be considered for future actions (reply, delete)
- **NFR-030**: Safe area insets MUST be respected on iOS notched devices

### Accessibility

- **NFR-031**: System MUST provide keyboard shortcuts (Enter to send, Cmd+Enter for newline)
- **NFR-032**: System MUST use semantic HTML (nav, main, article, aside)
- **NFR-033**: System MUST provide skip links for screen readers
- **NFR-034**: Focus indicators MUST be visible and high-contrast
- **NFR-035**: Error messages MUST be announced to screen readers (ARIA live regions)

### Testing

- **NFR-036**: All crypto functions MUST have 100% unit test coverage
- **NFR-037**: All RLS policies MUST have integration tests verifying enforcement
- **NFR-038**: Critical user flows MUST have E2E tests (connection, messaging, editing, offline)
- **NFR-039**: Accessibility MUST be validated via Pa11y on all pages
- **NFR-040**: Performance MUST be benchmarked via Lighthouse (target: 90+ score)

## Out of Scope _(document explicitly what is NOT included)_

The following features are explicitly excluded from this specification and deferred to future versions:

### v0.5.0 Deferred Features

- **Group Chats**: 3+ participants per conversation
  - **Reason**: Complex key management (each participant needs separate encrypted shared secret). Adds significant complexity to encryption architecture.

- **Voice/Video Calls**: WebRTC integration for real-time audio/video
  - **Reason**: Requires WebRTC, STUN/TURN servers, media encryption, significant bandwidth. Different technology stack from text messaging.

- **File Attachments**: Upload and encrypt images, documents, videos
  - **Reason**: Requires Supabase Storage integration, file encryption/decryption, thumbnail generation, MIME type validation. Storage quota concerns.

- **Message Reactions**: Emoji reactions to messages
  - **Reason**: Nice-to-have feature that doesn't impact core messaging flow. Can be added incrementally.

- **Disappearing Messages**: Auto-delete messages after time period (e.g., 24 hours)
  - **Reason**: Requires background jobs, timer management, complex UX. Low priority for MVP.

- **Message Forwarding**: Forward messages to other conversations
  - **Reason**: Privacy concerns (who sent the original?), re-encryption complexity, potential for abuse.

- **Multi-Device Sync**: Sync private keys across user's devices
  - **Reason**: Security challenge - how to securely sync keys? Requires additional key wrapping or cloud escrow. Reduces zero-knowledge guarantee.

- **Perfect Forward Secrecy**: Ratcheting keys per message (Signal Protocol style)
  - **Reason**: Very complex key management. Requires storing key chains, handling out-of-order delivery. ECDH provides good security for MVP.

- **Server-Side Message Search**: Full-text search across all messages
  - **Reason**: Impossible with end-to-end encryption - server cannot read plaintext. Client-side search possible but complex.

### Technical Limitations (By Design)

- **Message Recovery**: Lost private keys = lost messages
  - **Rationale**: Maintaining zero-knowledge architecture means no server-side key recovery. Trade-off for security.

- **Content Moderation**: Cannot scan encrypted message content
  - **Rationale**: Zero-knowledge means server cannot read messages. Rely on user reports and metadata analysis instead.

- **Cross-Device Without Re-Key**: Switching devices requires re-generating keys
  - **Rationale**: Private keys stored in device IndexedDB only. Multi-device support requires future key sync implementation.

## Architecture Overview _(optional but recommended)_

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│  React UI Layer                                                  │
│  ├── ConnectionManager    ├── ConversationList                   │
│  ├── ChatWindow          ├── MessageThread                      │
│  └── UserSearch          └── MessageInput                       │
├─────────────────────────────────────────────────────────────────┤
│  Business Logic Layer                                            │
│  ├── useConversationRealtime (Supabase subscriptions)           │
│  ├── useTypingIndicator (debounced updates)                     │
│  └── Encryption/Decryption (Web Crypto API)                     │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer                                                      │
│  ├── Supabase Client (auth, database, realtime)                 │
│  ├── IndexedDB (Dexie) - offline queue, cached messages         │
│  └── Service Worker - background sync                           │
└─────────────────────────────────────────────────────────────────┘
                               ▼ HTTPS (TLS 1.3)
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase Backend                            │
├─────────────────────────────────────────────────────────────────┤
│  Supabase Auth (JWT sessions, user management)                  │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL Database + RLS Policies                             │
│  ├── user_connections      ├── conversations                    │
│  ├── messages (encrypted)  ├── user_encryption_keys             │
│  ├── conversation_keys     └── typing_indicators                │
│  └── (message_edits removed - no edit history) [2025-10-08]    │
├─────────────────────────────────────────────────────────────────┤
│  Supabase Realtime (postgres_changes subscriptions)             │
│  └── Push updates for: new messages, edits, typing, read status │
└─────────────────────────────────────────────────────────────────┘
```

### Encryption Flow

```
User A (Sender)                              User B (Recipient)
    │                                              │
    ├─ Generate ECDH key pair                     ├─ Generate ECDH key pair
    ├─ Store private key in IndexedDB             ├─ Store private key in IndexedDB
    ├─ Upload public key to Supabase              ├─ Upload public key to Supabase
    │                                              │
    ├─ Fetch User B's public key ◄────────────────┤
    ├─ Derive shared secret (ECDH)                │
    │                                              │
    ├─ Encrypt message (AES-GCM, shared secret)   │
    ├─ Generate IV (random 96-bit)                │
    ├─ Send {ciphertext, IV} to server ─────────► │
    │                                              │
    │                                              ├─ Receive {ciphertext, IV}
    │                                              ├─ Fetch User A's public key
    │                                              ├─ Derive shared secret (ECDH)
    │                                              ├─ Decrypt message (AES-GCM)
    │                                              └─ Display plaintext
```

**Zero-Knowledge Guarantee**:

- Server receives only `encrypted_content` (ciphertext) and `initialization_vector` (IV)
- Server never receives plaintext message, private keys, or shared secret
- Even with database access, content is unreadable

### Real-time Subscriptions

```typescript
// Subscribe to conversation updates
supabase
  .channel(`conversation-${conversationId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    },
    handleNewMessage
  )
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    },
    handleEditedMessage
  )
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'typing_indicators',
      filter: `conversation_id=eq.${conversationId}`,
    },
    handleTypingIndicator
  )
  .subscribe();
```

### Offline Queue Architecture

```
Online:  Message → Encrypt → Send to Supabase → Success
                                  ↓ (fail)
Offline: Message → Encrypt → Queue in IndexedDB → Show "Sending..."
                                  ↓ (reconnect)
         Network event → Sync worker → Retry send → Update status
```

### Component Hierarchy

```
ConversationList (Organism)
├── ConversationListItem (Molecular)
│   ├── AvatarDisplay (Atomic - reused from Feature 022)
│   ├── Username (Text)
│   ├── LastMessage (Text, decrypted)
│   ├── Timestamp (Atomic)
│   └── UnreadBadge (Atomic)

ChatWindow (Organism)
├── ChatHeader (Molecular)
│   ├── AvatarDisplay (Atomic)
│   ├── Username (Text)
│   └── OnlineStatus (Atomic)
├── MessageThread (Molecular)
│   ├── MessageBubble[] (Atomic)
│   │   ├── DecryptedContent (Text)
│   │   ├── Timestamp (Atomic)
│   │   ├── EditIndicator (Atomic)
│   │   └── ReadReceipt (Atomic)
│   ├── TypingIndicator (Atomic)
│   └── DateSeparator (Atomic)
└── MessageInput (Molecular)
    ├── Textarea (Auto-expanding)
    ├── SendButton (Atomic, 44px)
    └── CharacterCount (Text)
```

## Implementation Notes _(optional)_

### Phase 1: Foundation (3 days) - Database & Connections

**Goal**: Users can search for each other and form connections (friend requests)

1. Create Supabase migration with all 6 tables
2. Implement RLS policies for user_connections
3. Build UserSearch component (search by username/email)
4. Build ConnectionManager component (view/manage connections)
5. Implement friend request flow (send, accept, decline, block)
6. Write unit tests for connection logic
7. E2E test: Complete friend request flow

**Deliverable**: Two users can connect via friend requests

### Phase 2: Encryption (3 days) - E2E Crypto Implementation

**Goal**: Establish zero-knowledge encryption infrastructure

1. Implement ECDH key pair generation (Web Crypto API) with lazy initialization on first message send **[Updated 2025-10-08]**
2. Store private keys in IndexedDB (Dexie)
3. Store public keys in Supabase (user_encryption_keys table)
4. Implement shared secret derivation (ECDH + deriveKey)
5. Implement AES-GCM encryption (message → ciphertext + IV)
6. Implement AES-GCM decryption (ciphertext + IV → message)
7. Build "Setting up encryption..." loading state for first message send **[Updated 2025-10-08]**
8. Handle edge case: recipient has no keys yet (queue message, prompt on reply) **[Added 2025-10-08]**
9. Build key management UI (view public key, regenerate keys)
10. Write comprehensive unit tests for all crypto functions
11. Integration test: User A encrypts, User B decrypts successfully

**Deliverable**: End-to-end encryption working between two users

### Phase 3: Messaging (2 days) - Core Chat Functionality

**Goal**: Users can send/receive encrypted messages in real-time

1. Build MessageBubble component (sender/recipient variants)
2. Build MessageThread component (virtual scrolling placeholder)
3. Build MessageInput component (auto-expanding textarea)
4. Build ChatWindow organism (header + thread + input)
5. Implement send message flow (encrypt → send → subscribe)
6. Subscribe to Supabase Realtime for new messages
7. Implement typing indicators (debounced upsert)
8. Implement read receipts (mark as read on view)
9. Implement message editing (within 15-minute window, overwrites in place)
10. Implement message deletion (within 15-minute window, shows "[Message deleted]" placeholder) **[Added 2025-10-08]**
11. ~~Build EditHistoryModal component~~ **[REMOVED - No edit history, Clarified 2025-10-08]**
12. E2E test: Complete messaging flow (send → receive → edit → delete → verify) **[Updated 2025-10-08]**

**Deliverable**: Functional real-time encrypted messaging

### Phase 4: Offline & Polish (2-3 days) - Production Readiness

**Goal**: Offline support, performance optimization, accessibility

1. Implement IndexedDB offline queue (Dexie tables)
2. Implement background sync (Service Worker sync event)
3. Implement retry logic with exponential backoff
4. Build ConversationList component with search/filter
5. Implement virtual scrolling for MessageThread (100+ messages)
6. Implement infinite scroll pagination (load 50 at a time)
7. Add PWA push notifications for new messages (stretch goal - not required for MVP)
8. Mobile responsive polish (44px touch targets, safe areas)
9. Accessibility audit (Pa11y) + fixes
10. Performance optimization (Web Workers for bulk decryption)
11. E2E test: Offline messaging flow (queue → reconnect → sync)

**Deliverable**: Production-ready messaging system

### Technology Stack

**Frontend**:

- React 19.1.0 (already in ScriptHammer)
- TypeScript (strict mode)
- Tailwind CSS 4 + DaisyUI (44px touch targets)
- Dexie.js (IndexedDB wrapper) - **NEW dependency**
- Web Crypto API (built-in)

**Backend**:

- Supabase PostgreSQL (already configured)
- Supabase Realtime (already enabled for payments)
- Supabase Auth (already configured for PRP-016)

**Testing**:

- Vitest (unit tests) - already in ScriptHammer
- Playwright (E2E tests) - already in ScriptHammer
- Pa11y (accessibility) - already in ScriptHammer

**New Dependencies**:

```json
{
  "dependencies": {
    "dexie": "^4.0.10" // IndexedDB wrapper
  }
}
```

### Migration Strategy

**Database Migration**:

```sql
-- Run single migration file
-- /supabase/migrations/20251008_user_messaging_system.sql
-- Includes: 6 tables (removed message_edits), RLS policies, indexes, triggers
-- Tables: user_connections, conversations, messages, user_encryption_keys, conversation_keys, typing_indicators
```

**[Updated 2025-10-08: Removed message_edits table - no edit history storage]**

**IndexedDB Schema**:

```typescript
// Auto-created on first use (Dexie handles versioning)
class MessagingDatabase extends Dexie {
  constructor() {
    super('MessagingDB');
    this.version(1).stores({
      queuedMessages: 'id, conversation_id, synced, created_at',
      cachedMessages: 'id, conversation_id, created_at',
      privateKeys: 'userId', // User's ECDH private key
    });
  }
}
```

### Performance Considerations

**Virtual Scrolling**:

- Use `react-window` or custom implementation
- Render only visible messages (viewport + buffer)
- Fixed item height for performance (80px per message)
- Lazy load older messages (pagination)

**Encryption Performance**:

- Batch decryption for initial load (Web Worker)
- Cache decrypted messages in React state
- Cache shared secrets after first derivation
- Reuse IVs are unique (no caching needed)

**IndexedDB Performance**:

- Index on conversation_id for fast queries
- Limit cached messages to recent 1,000 per conversation
- Periodic cleanup of old cached data (>30 days)

**Real-time Performance**:

- Subscribe only to active conversation (not all)
- Unsubscribe on conversation close
- Debounce typing indicators (3 seconds)
- Batch read receipt updates (mark all as read once)

### Security Best Practices

**Key Management**:

- Generate keys on first use (user sign-up or first message)
- Never export private keys (non-extractable if possible)
- Validate public keys before use (check expiration, revocation)
- Implement key rotation on security events (password change, suspicious activity)

**Encryption Best Practices**:

- Use ECDH for key agreement (not RSA for performance)
- Use AES-GCM for authenticated encryption (no separate MAC needed)
- Generate random IVs (never reuse with same key)
- Use 256-bit keys (not 128-bit)

**Input Validation**:

- Sanitize message content (XSS prevention)
- Validate message length (<10,000 chars)
- Validate encryption keys (JWK format, correct algorithm)
- Rate limit message sending (10/second per user)

**Audit Logging**:

- Log all connection requests/responses (who, when, status)
- Log encryption key generation/rotation
- Log failed decryption attempts (potential attack)
- Log message send/receive (metadata only, not content)

### Monitoring & Debugging

**Metrics to Track**:

- Message send latency (encrypt → deliver → decrypt)
- Encryption/decryption time (p50, p95, p99)
- Real-time subscription latency
- Offline queue sync success rate
- Failed decryption rate (should be near zero)

**Debugging Tools**:

- IndexedDB viewer (Chrome DevTools > Application)
- Supabase Realtime logs (dashboard)
- Web Crypto API console logs (key generation, derivation)
- Network throttling (test offline mode)

**Error Handling**:

- Graceful degradation if Web Crypto API unavailable
- Clear error messages for failed encryption/decryption
- Retry logic for transient network failures
- Fallback UI for unsupported browsers

---

## Clarification Session (2025-10-08)

### Question 1: Blocking Behavior - Message Visibility

**Question**: When a user blocks someone, should existing messages in the conversation remain visible or be hidden?

**Decision**: **Option A** - Messages remain visible as read-only history

**Rationale**: This approach provides transparency and prevents confusion. Users can review the conversation history to understand what led to the block, while clearly preventing future contact. This is consistent with popular messaging platforms like WhatsApp.

**Implementation Impact**:

- Edge case updated (line 140-141)
- UI requirement: Add blocked user banner component
- UI requirement: Disable message input when viewing conversation with blocker
- FR-003 updated to specify blocking behavior (history preserved, input disabled, banner shown)

---

### Question 2: Message Edit History - Storage & Visibility

**Question**: Who should be able to view the full edit history of an edited message, and how long should edit history be retained?

**Decision**: **Custom approach - No edit history UI or storage beyond 15-minute edit window**

**Rationale**:

- Users have 15 minutes to edit messages (correct typos, clarify meaning)
- Neither sender nor recipient needs to view edit history in the UI
- Once the 15-minute edit window expires, the message is "settled" and final
- No value in preserving edit history - adds complexity without user benefit
- Edits overwrite the message in place (re-encrypt with new content)
- "Edited" indicator shows only that the message was edited and when

**Implementation Impact**:

- **REMOVE** MessageEdit table from database schema (no edit history storage)
- **SIMPLIFY** FR-026: Remove requirement to preserve edit history
- **SIMPLIFY** FR-028: Remove requirement to view edit history
- **UPDATE** FR-027: "Edited" indicator shows only last edit timestamp, no drill-down
- **REMOVE** EditHistoryModal component from UI (not needed)
- **UPDATE** Message editing flow: Overwrite encrypted_content in place, set edited=true, update edited_at timestamp
- **UPDATE** FR-047: Remove edit history retention requirement (no history to purge)

---

### Question 3: Read Receipts & Typing Indicators - Privacy Settings

**Question**: How should read receipts and typing indicators be controlled by user privacy settings?

**Decision**: **Option A - Always enabled (no privacy settings)**

**Rationale**:

- Simplest implementation - no settings UI or database fields needed
- Maximizes real-time engagement and conversational flow
- Consistent with platforms like Slack and Discord
- Users who block someone prevent all real-time indicators from that person
- Reduces complexity - no need to check privacy preferences on every update

**Implementation Impact**:

- **REMOVE** NFR-012: "Typing indicators MUST be opt-out (user privacy preference)"
- **REMOVE** NFR-013: "Read receipts MUST be opt-out (user privacy preference)"
- **CLARIFY** FR-031: Typing indicators are always enabled for all users
- **CLARIFY** FR-032: Read receipts are always enabled for all users
- **SIMPLIFY** Settings UI: No toggles for typing/read receipt privacy
- **SIMPLIFY** Database: No user preference fields for these features
- **NOTE**: Blocking a user disables all real-time features (typing, read receipts) between those users

---

### Question 4: Message Deletion - User Control & Behavior

**Question**: Should users be able to delete messages, and if so, what should the deletion behavior be?

**Decision**: **Option C with 15-minute edit window exception - Messages are permanent except during edit window**

**Rationale**:

- Messages are permanent once the 15-minute edit window expires
- Within 15 minutes, users can delete their own messages as a form of editing
- Deletion shows "[Message deleted]" placeholder to both users
- After 15 minutes, messages cannot be deleted (maintains accountability)
- Consistent with the edit window philosophy - 15 minutes to correct mistakes
- Prevents abuse of deletion while allowing quick unsend for mistakes

**Implementation Impact**:

- **ADD** FR-065: Users MUST be able to delete their own messages within 15 minutes of sending
- **ADD** FR-066: Deleted messages MUST show "[Message deleted]" placeholder to both users
- **CLARIFY** FR-030: Prevent editing AND deletion of messages older than 15 minutes
- **CLARIFY** FR-046: Soft-delete only applies to CASCADE DELETE on account deletion (not user-initiated deletion)
- **UPDATE** Message long-press menu: Show "Edit" and "Delete" options for messages <15 minutes old
- **UPDATE** Deletion flow: Set deleted=true, encrypted_content='[Message deleted]', preserve message_id for threading
- **NOTE**: No "delete for yourself only" option - deletion affects both participants

---

### Question 5: Encryption Key Generation - Timing & Initial Setup

**Question**: When should encryption keys be generated, and how is the initial encrypted conversation established?

**Decision**: **Option C - Generate keys when sending first message (lazy, conversation-scoped)**

**Rationale**:

- Minimal overhead - keys only generated for users who actually send messages
- Users who only receive messages or never use messaging don't generate keys
- 1-2 second delay on first message send is acceptable (one-time setup)
- Simplifies onboarding - no key generation during sign-up flow
- Recipient generates their keys when they send their first reply
- Reduces database storage for inactive users

**Implementation Impact**:

- **CLARIFY** FR-008: ECDH key pair generation happens on first message send attempt (lazy initialization)
- **ADD** FR-067: When user attempts to send first message, system MUST check for existing keys in IndexedDB. If none exist, generate and upload before sending message.
- **ADD** FR-068: System MUST show "Setting up encryption..." loading state during first-time key generation (1-2 seconds)
- **UPDATE** Message send flow: Check for sender keys → Generate if needed → Fetch recipient keys → Derive shared secret → Encrypt → Send
- **UPDATE** Key derivation: Shared secret derived on-demand when sending message (check recipient has keys, wait/prompt if they don't)
- **EDGE CASE**: If recipient has no keys yet (never sent a message), sender sees: "This user hasn't set up encryption yet. They'll receive your message when they reply."
- **NOTE**: First message in any conversation has 1-2 second setup delay for key generation + derivation

---

## Next Steps

After specification approval:

1. **Run `/plan`** to generate detailed implementation plan with tasks
2. **Run `/tasks`** to break down into atomic, testable tasks
3. **Run `/implement`** to execute task list (or manual implementation)

**Estimated Timeline**: 8-11 days (based on PRP estimate)
**Target Version**: v0.4.0
**Dependencies**: PRP-016 (User Auth) ✅, PRP-015 (Realtime pattern) ✅
