# Tasks: User Messaging System with E2E Encryption

**Input**: Design documents from `/specs/023-user-messaging-system/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths assume Next.js App Router structure (from plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Install Dexie.js dependency: `docker compose exec scripthammer pnpm add dexie@^4.0.10`
- [ ] T002 [P] Create TypeScript types in `src/types/messaging.ts` (copy from `contracts/types.ts`)
- [ ] T003 [P] Create IndexedDB database schema in `src/lib/messaging/database.ts` (3 Dexie stores: queuedMessages, cachedMessages, privateKeys)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create Supabase migration `supabase/migrations/20251008_user_messaging_system.sql` with 6 tables (user_connections, conversations, messages, user_encryption_keys, conversation_keys, typing_indicators)
- [ ] T005 [P] Add database indexes for foreign keys and frequently queried columns (conversation_id, sender_id, user_id, status, last_message_at)
- [ ] T006 [P] Enable Row Level Security (RLS) on all 6 tables
- [ ] T007 Create RLS policies for user isolation using auth.uid() (SELECT/INSERT/UPDATE/DELETE policies per table)
- [ ] T008 [P] Create database trigger `update_conversation_timestamp()` to update `conversations.last_message_at` on message insert
- [ ] T009 [P] Create database trigger `assign_sequence_number()` to auto-increment message sequence numbers
- [ ] T010 Run migration locally: `docker compose exec scripthammer pnpm supabase db reset`
- [ ] T011 Regenerate Supabase TypeScript types: `docker compose exec scripthammer pnpm supabase gen types typescript --local > src/lib/supabase/database.types.ts`
- [ ] T012 Verify migration success: Check all 6 tables exist, RLS enabled, triggers created

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Send Friend Request to Start Conversation (Priority: P1) 🎯 MVP

**Goal**: Users can search for other users and send friend requests to establish connections

**Independent Test**: Create two users, have one search for and send a friend request to the other, verify request appears in recipient's pending list, accept request, verify connection established

### Tests for User Story 1 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T013 [P] [US1] Contract test for connection service in `tests/integration/messaging/connections.test.ts` (test sendFriendRequest, respondToRequest, getConnections with real Supabase client)
- [ ] T014 [P] [US1] E2E test for friend request flow in `e2e/messaging/friend-requests.spec.ts` (User A sends request → User B accepts → verify connection status)

### Implementation for User Story 1

- [ ] T015 [P] [US1] Create ConnectionService in `src/services/messaging/connection-service.ts` implementing IConnectionService interface
- [ ] T016 [P] [US1] Create ValidationService in `src/lib/messaging/validation.ts` (validateEmail, sanitizeInput methods)
- [ ] T017 [US1] Implement sendFriendRequest method in ConnectionService (INSERT user_connections with status='pending', handle duplicates)
- [ ] T018 [US1] Implement respondToRequest method in ConnectionService (UPDATE status to accepted/declined/blocked)
- [ ] T019 [US1] Implement searchUsers method in ConnectionService (SELECT from auth.users WHERE email/username EXACT MATCH)
- [ ] T020 [US1] Implement getConnections method in ConnectionService (SELECT user_connections with filtering by status)
- [ ] T021 [US1] Implement removeConnection method in ConnectionService (DELETE from user_connections WHERE status='accepted')
- [ ] T022 [P] [US1] Generate UserSearch component: `docker compose exec scripthammer pnpm run generate:component -- --name UserSearch --category molecular --hasProps true --withHooks false`
- [ ] T023 [US1] Implement UserSearch component in `src/components/molecular/UserSearch/UserSearch.tsx` (input field, search button 44px, results list)
- [ ] T024 [US1] Add search input validation in UserSearch (email format check, min length 3 chars)
- [ ] T025 [US1] Display search results with "Send Request" button (44px touch target, disabled if already connected)
- [ ] T026 [P] [US1] Generate ConnectionManager component: `docker compose exec scripthammer pnpm run generate:component -- --name ConnectionManager --category organisms --hasProps true --withHooks true`
- [ ] T027 [US1] Implement ConnectionManager component in `src/components/organisms/ConnectionManager/ConnectionManager.tsx` (tabs for Pending Sent/Pending Received/Accepted/Blocked)
- [ ] T028 [US1] Add Accept/Decline/Block buttons in ConnectionManager (44px touch targets, confirm modals for block action)
- [ ] T029 [US1] Implement useConnections hook in `src/hooks/useConnections.ts` (fetch connections, sendRequest, acceptRequest, declineRequest, blockUser methods)
- [ ] T030 [US1] Add error handling for connection operations (duplicate request, user not found, already connected errors)
- [ ] T031 [US1] Add loading states for async operations (skeleton loaders while fetching connections)
- [ ] T032 [P] [US1] Write unit tests for ConnectionService in `src/services/messaging/__tests__/connection-service.test.ts` (mock Supabase client, test all methods)
- [ ] T033 [P] [US1] Write unit tests for UserSearch component in `src/components/molecular/UserSearch/UserSearch.test.tsx`
- [ ] T034 [P] [US1] Write unit tests for ConnectionManager component in `src/components/organisms/ConnectionManager/ConnectionManager.test.tsx`
- [ ] T035 [P] [US1] Write Storybook stories for UserSearch in `src/components/molecular/UserSearch/UserSearch.stories.tsx`
- [ ] T036 [P] [US1] Write Storybook stories for ConnectionManager in `src/components/organisms/ConnectionManager/ConnectionManager.stories.tsx`
- [ ] T037 [P] [US1] Write accessibility tests for UserSearch in `src/components/molecular/UserSearch/UserSearch.accessibility.test.tsx` (keyboard navigation, ARIA labels)
- [ ] T038 [P] [US1] Write accessibility tests for ConnectionManager in `src/components/organisms/ConnectionManager/ConnectionManager.accessibility.test.tsx` (tab focus, screen reader announcements)
- [ ] T039 [US1] Create connections page in `src/app/messages/connections/page.tsx` using ConnectionManager and UserSearch components
- [ ] T040 [US1] Add route to GlobalNav for connections page (`/messages/connections`)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Two users can search, connect, and manage friend requests.

---

## Phase 4: User Story 2 - Send Encrypted Message to Connection (Priority: P1) 🎯 MVP

**Goal**: Users can send end-to-end encrypted messages to their connections with zero-knowledge architecture

**Independent Test**: Establish connection between two users, send encrypted message from User A, verify User B receives and decrypts message correctly. Verify database only stores ciphertext (zero-knowledge).

### Tests for User Story 2 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T041 [P] [US2] Unit tests for EncryptionService in `src/lib/messaging/__tests__/encryption.test.ts` (100% coverage: generateKeyPair, exportPublicKey, storePrivateKey, getPrivateKey, deriveSharedSecret, encryptMessage, decryptMessage, error cases)
- [ ] T042 [P] [US2] Integration test for end-to-end encryption flow in `tests/integration/messaging/encryption.test.ts` (User A encrypts → User B decrypts roundtrip)
- [ ] T043 [P] [US2] Cross-browser encryption test in `e2e/messaging/encrypted-messaging.spec.ts` (encrypt in Chrome, decrypt in Firefox/Safari/Edge)
- [ ] T044 [P] [US2] E2E test for messaging flow in `e2e/messaging/encrypted-messaging.spec.ts` (send message → receive → verify zero-knowledge)

### Implementation for User Story 2

- [ ] T045 [P] [US2] Create EncryptionService in `src/lib/messaging/encryption.ts` implementing IEncryptionService interface
- [ ] T046 [US2] Implement generateKeyPair method in EncryptionService (Web Crypto API: crypto.subtle.generateKey with ECDH P-256)
- [ ] T047 [US2] Implement exportPublicKey method in EncryptionService (crypto.subtle.exportKey to JWK format)
- [ ] T048 [US2] Implement storePrivateKey method in EncryptionService (save to IndexedDB privateKeys table)
- [ ] T049 [US2] Implement getPrivateKey method in EncryptionService (retrieve from IndexedDB by userId)
- [ ] T050 [US2] Implement deriveSharedSecret method in EncryptionService (ECDH: crypto.subtle.deriveKey from private + public keys)
- [ ] T051 [US2] Implement encryptMessage method in EncryptionService (AES-GCM: crypto.subtle.encrypt with random 96-bit IV)
- [ ] T052 [US2] Implement decryptMessage method in EncryptionService (AES-GCM: crypto.subtle.decrypt with IV)
- [ ] T053 [US2] Implement getUserPublicKey method in EncryptionService (SELECT from user_encryption_keys WHERE user_id=?)
- [ ] T054 [US2] Add error handling for encryption failures (invalid keys, corrupted ciphertext, browser compatibility)
- [ ] T055 [P] [US2] Create KeyManagementService in `src/services/messaging/key-service.ts` implementing IKeyManagementService interface
- [ ] T056 [US2] Implement initializeKeys method in KeyManagementService (lazy generation: check IndexedDB → generate if missing → upload public key)
- [ ] T057 [US2] Implement hasValidKeys method in KeyManagementService (check privateKeys table in IndexedDB)
- [ ] T058 [US2] Implement rotateKeys method in KeyManagementService (generate new pair, mark old keys as revoked)
- [ ] T059 [US2] Implement revokeKeys method in KeyManagementService (UPDATE user_encryption_keys SET revoked=true)
- [ ] T060 [P] [US2] Create MessageService in `src/services/messaging/message-service.ts` implementing IMessageService interface
- [ ] T061 [US2] Implement sendMessage method in MessageService (initialize keys if needed → encrypt content → INSERT messages → return SendMessageResult)
- [ ] T062 [US2] Implement getMessageHistory method in MessageService (SELECT messages with pagination, decrypt all messages)
- [ ] T063 [US2] Implement markAsRead method in MessageService (UPDATE messages SET read_at=now() WHERE id IN (?))
- [ ] T064 [US2] Add "Setting up encryption..." loading state UI during first message send (1-2 second delay for key generation)
- [ ] T065 [US2] Handle edge case: recipient has no keys yet (show "User hasn't set up encryption yet. They'll receive your message when they reply.")
- [ ] T066 [P] [US2] Generate MessageBubble component: `docker compose exec scripthammer pnpm run generate:component -- --name MessageBubble --category atomic --hasProps true --withHooks false`
- [ ] T067 [US2] Implement MessageBubble component in `src/components/atomic/MessageBubble/MessageBubble.tsx` (sender/recipient variants, timestamp, decrypted content display)
- [ ] T068 [US2] Add delivery status indicators to MessageBubble (sent: single checkmark, delivered: double checkmark, read: double blue checkmark)
- [ ] T069 [P] [US2] Generate MessageInput component: `docker compose exec scripthammer pnpm run generate:component -- --name MessageInput --category atomic --hasProps true --withHooks false`
- [ ] T070 [US2] Implement MessageInput component in `src/components/atomic/MessageInput/MessageInput.tsx` (auto-expanding textarea, send button 44px, character count)
- [ ] T071 [US2] Add message validation in MessageInput (max 10,000 chars, non-empty after trim)
- [ ] T072 [US2] Add Enter key to send message (Cmd+Enter for newline on Mac, Ctrl+Enter on Windows/Linux)
- [ ] T073 [P] [US2] Generate MessageThread component: `docker compose exec scripthammer pnpm run generate:component -- --name MessageThread --category molecular --hasProps true --withHooks true`
- [ ] T074 [US2] Implement MessageThread component in `src/components/molecular/MessageThread/MessageThread.tsx` (render MessageBubble array, scroll to bottom on new message)
- [ ] T075 [US2] Add pagination support in MessageThread (load 50 messages at a time, infinite scroll upwards)
- [ ] T076 [US2] Add "Scroll to bottom" button when viewing old messages (44px floating button)
- [ ] T077 [P] [US2] Generate ChatWindow component: `docker compose exec scripthammer pnpm run generate:component -- --name ChatWindow --category organisms --hasProps true --withHooks true`
- [ ] T078 [US2] Implement ChatWindow component in `src/components/organisms/ChatWindow/ChatWindow.tsx` (compose ChatHeader + MessageThread + MessageInput)
- [ ] T079 [US2] Add blocked user banner to ChatWindow (display "[User] blocked you" at top, disable MessageInput)
- [ ] T080 [US2] Create conversation page in `src/app/messages/[id]/page.tsx` using ChatWindow component
- [ ] T081 [US2] Implement useConversationRealtime hook (to be used in Phase 5, placeholder for now)
- [ ] T082 [P] [US2] Write unit tests for EncryptionService (verify roundtrip encrypt/decrypt, error handling, key validation)
- [ ] T083 [P] [US2] Write unit tests for KeyManagementService in `src/services/messaging/__tests__/key-service.test.ts`
- [ ] T084 [P] [US2] Write unit tests for MessageService in `src/services/messaging/__tests__/message-service.test.ts`
- [ ] T085 [P] [US2] Write unit tests for MessageBubble in `src/components/atomic/MessageBubble/MessageBubble.test.tsx`
- [ ] T086 [P] [US2] Write unit tests for MessageInput in `src/components/atomic/MessageInput/MessageInput.test.tsx`
- [ ] T087 [P] [US2] Write unit tests for MessageThread in `src/components/molecular/MessageThread/MessageThread.test.tsx`
- [ ] T088 [P] [US2] Write unit tests for ChatWindow in `src/components/organisms/ChatWindow/ChatWindow.test.tsx`
- [ ] T089 [P] [US2] Write Storybook stories for MessageBubble in `src/components/atomic/MessageBubble/MessageBubble.stories.tsx`
- [ ] T090 [P] [US2] Write Storybook stories for MessageInput in `src/components/atomic/MessageInput/MessageInput.stories.tsx`
- [ ] T091 [P] [US2] Write Storybook stories for MessageThread in `src/components/molecular/MessageThread/MessageThread.stories.tsx`
- [ ] T092 [P] [US2] Write Storybook stories for ChatWindow in `src/components/organisms/ChatWindow/ChatWindow.stories.tsx`
- [ ] T093 [P] [US2] Write accessibility tests for MessageBubble in `src/components/atomic/MessageBubble/MessageBubble.accessibility.test.tsx` (ARIA labels for delivery status)
- [ ] T094 [P] [US2] Write accessibility tests for MessageInput in `src/components/atomic/MessageInput/MessageInput.accessibility.test.tsx` (keyboard navigation, character counter)
- [ ] T095 [P] [US2] Write accessibility tests for MessageThread in `src/components/molecular/MessageThread/MessageThread.accessibility.test.tsx` (ARIA live region for new messages)
- [ ] T096 [P] [US2] Write accessibility tests for ChatWindow in `src/components/organisms/ChatWindow/ChatWindow.accessibility.test.tsx` (focus management)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. Users can connect and exchange encrypted messages (zero-knowledge verified).

---

## Phase 5: User Story 3 - Real-time Message Delivery (Priority: P1) 🎯 MVP

**Goal**: Messages delivered in real-time via Supabase Realtime (<500ms), typing indicators, and read receipts

**Independent Test**: Open two browser windows with same conversation, send message from one, verify it appears in other within 500ms without refresh. Test typing indicators appear/disappear correctly.

### Tests for User Story 3 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T097 [P] [US3] Unit tests for RealtimeService in `src/lib/messaging/__tests__/realtime.test.ts` (subscribeToMessages, subscribeToMessageUpdates, subscribeToTypingIndicators, setTypingStatus)
- [ ] T098 [P] [US3] E2E test for real-time delivery in `e2e/messaging/real-time-delivery.spec.ts` (two windows, send message, verify <500ms delivery)
- [ ] T099 [P] [US3] E2E test for typing indicators in `e2e/messaging/real-time-delivery.spec.ts` (type → indicator appears → stop typing → indicator disappears after 3s)

### Implementation for User Story 3

- [ ] T100 [P] [US3] Create RealtimeService in `src/lib/messaging/realtime.ts` implementing IRealtimeService interface
- [ ] T101 [US3] Implement subscribeToMessages method in RealtimeService (Supabase channel with postgres_changes: INSERT on messages table)
- [ ] T102 [US3] Implement subscribeToMessageUpdates method in RealtimeService (Supabase channel with postgres_changes: UPDATE on messages table)
- [ ] T103 [US3] Implement subscribeToTypingIndicators method in RealtimeService (Supabase channel with postgres_changes: \* on typing_indicators table)
- [ ] T104 [US3] Implement setTypingStatus method in RealtimeService (UPSERT typing_indicators with 3-second debounce)
- [ ] T105 [US3] Implement unsubscribeFromConversation method in RealtimeService (cleanup Supabase subscriptions)
- [ ] T106 [US3] Add debounce logic for typing indicators (only send update after 1 second of typing activity)
- [ ] T107 [US3] Add auto-expire logic for typing indicators (remove indicator if no update for 5 seconds)
- [ ] T108 [P] [US3] Generate TypingIndicator component: `docker compose exec scripthammer pnpm run generate:component -- --name TypingIndicator --category atomic --hasProps true --withHooks false`
- [ ] T109 [US3] Implement TypingIndicator component in `src/components/atomic/TypingIndicator/TypingIndicator.tsx` (animated dots, "[User] is typing..." text, ARIA live region)
- [ ] T110 [P] [US3] Generate ReadReceipt component: `docker compose exec scripthammer pnpm run generate:component -- --name ReadReceipt --category atomic --hasProps true --withHooks false`
- [ ] T111 [US3] Implement ReadReceipt component in `src/components/atomic/ReadReceipt/ReadReceipt.tsx` (sent/delivered/read states, checkmark icons, ARIA labels)
- [ ] T112 [US3] Implement useConversationRealtime hook in `src/hooks/useConversationRealtime.ts` (subscribe to messages on mount, decrypt in real-time, handle pagination)
- [ ] T113 [US3] Implement useTypingIndicator hook in `src/hooks/useTypingIndicator.ts` (track other user's typing status, debounce own status updates)
- [ ] T114 [US3] Integrate RealtimeService into ChatWindow (subscribe on mount, unsubscribe on unmount)
- [ ] T115 [US3] Add TypingIndicator to MessageThread (show when other user is typing)
- [ ] T116 [US3] Add ReadReceipt to MessageBubble (display delivery/read status icons)
- [ ] T117 [US3] Update MessageInput to trigger typing status (call setTypingStatus on input change)
- [ ] T118 [US3] Implement automatic read receipt updates (mark messages as read when conversation is viewed)
- [ ] T119 [US3] Add network status indicator (online/offline badge in ChatWindow header)
- [ ] T120 [P] [US3] Write unit tests for RealtimeService in `src/lib/messaging/__tests__/realtime.test.ts` (mock Supabase channel, test subscriptions)
- [ ] T121 [P] [US3] Write unit tests for useConversationRealtime hook in `src/hooks/__tests__/useConversationRealtime.test.ts`
- [ ] T122 [P] [US3] Write unit tests for useTypingIndicator hook in `src/hooks/__tests__/useTypingIndicator.test.ts`
- [ ] T123 [P] [US3] Write unit tests for TypingIndicator in `src/components/atomic/TypingIndicator/TypingIndicator.test.tsx`
- [ ] T124 [P] [US3] Write unit tests for ReadReceipt in `src/components/atomic/ReadReceipt/ReadReceipt.test.tsx`
- [ ] T125 [P] [US3] Write Storybook stories for TypingIndicator in `src/components/atomic/TypingIndicator/TypingIndicator.stories.tsx`
- [ ] T126 [P] [US3] Write Storybook stories for ReadReceipt in `src/components/atomic/ReadReceipt/ReadReceipt.stories.tsx`
- [ ] T127 [P] [US3] Write accessibility tests for TypingIndicator in `src/components/atomic/TypingIndicator/TypingIndicator.accessibility.test.tsx` (screen reader announcement)
- [ ] T128 [P] [US3] Write accessibility tests for ReadReceipt in `src/components/atomic/ReadReceipt/ReadReceipt.accessibility.test.tsx` (alt text, ARIA labels)

**Checkpoint**: User Stories 1, 2, AND 3 should all work independently. Real-time messaging experience complete (<500ms delivery, typing indicators, read receipts).

---

## Phase 6: User Story 4 - Edit or Delete Message Within 15-Minute Window (Priority: P2)

**Goal**: Users can edit or delete messages within 15 minutes of sending. Edits overwrite in place with "Edited" indicator. Deletions show "[Message deleted]" placeholder.

**Independent Test**: Send message, edit within 15 minutes, verify recipient sees updated content with "Edited" timestamp. Send another message, delete within 15 minutes, verify both users see "[Message deleted]".

### Tests for User Story 4 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T129 [P] [US4] Unit tests for ValidationService in `src/lib/messaging/__tests__/validation.test.ts` (isWithinEditWindow, isWithinDeleteWindow methods)
- [ ] T130 [P] [US4] E2E test for message editing in `e2e/messaging/message-editing.spec.ts` (send → edit within 15min → verify "Edited" indicator → attempt edit after 15min → verify disabled)
- [ ] T131 [P] [US4] E2E test for message deletion in `e2e/messaging/message-editing.spec.ts` (send → delete within 15min → verify "[Message deleted]" → attempt delete after 15min → verify disabled)

### Implementation for User Story 4

- [ ] T132 [US4] Implement editMessage method in MessageService (check 15-minute window, re-encrypt new content, UPDATE messages SET encrypted_content, edited=true, edited_at=now())
- [ ] T133 [US4] Implement deleteMessage method in MessageService (check 15-minute window, UPDATE messages SET deleted=true, encrypted_content='[Message deleted]')
- [ ] T134 [US4] Implement isWithinEditWindow method in ValidationService (check created_at > now() - INTERVAL '15 minutes')
- [ ] T135 [US4] Implement isWithinDeleteWindow method in ValidationService (check created_at > now() - INTERVAL '15 minutes')
- [ ] T136 [US4] Add long-press menu to MessageBubble (show "Edit" and "Delete" options for own messages <15min old)
- [ ] T137 [US4] Add "Edited" indicator to MessageBubble (display "Edited Xm ago" next to timestamp when edited=true)
- [ ] T138 [US4] Create edit mode UI in MessageBubble (inline textarea, Save/Cancel buttons when editing)
- [ ] T139 [US4] Add delete confirmation modal (confirm before deletion, explain "[Message deleted]" placeholder behavior)
- [ ] T140 [US4] Disable edit/delete options after 15-minute window (grey out in menu, show tooltip "Can only edit/delete within 15 minutes")
- [ ] T141 [US4] Prevent editing of already-deleted messages (check deleted=true before allowing edit)
- [ ] T142 [US4] Update MessageService.getMessageHistory to handle deleted messages (display "[Message deleted]" for deleted=true)
- [ ] T143 [US4] Add Realtime subscription for message updates (listen for UPDATE events, refresh MessageBubble with "Edited" indicator)
- [ ] T144 [P] [US4] Write unit tests for editMessage in `src/services/messaging/__tests__/message-service.test.ts` (test within window, after window, re-encryption)
- [ ] T145 [P] [US4] Write unit tests for deleteMessage in `src/services/messaging/__tests__/message-service.test.ts` (test within window, after window, soft-delete)
- [ ] T146 [P] [US4] Write unit tests for ValidationService in `src/lib/messaging/__tests__/validation.test.ts` (test time window validation)

**Checkpoint**: User Story 4 complete. Users can edit/delete messages within 15-minute window. "Edited" indicator and "[Message deleted]" placeholders working.

---

## Phase 7: User Story 5 - Offline Message Queue and Sync (Priority: P2)

**Goal**: Messages sent while offline are queued in IndexedDB and automatically synced when connection restored

**Independent Test**: Disconnect internet, send message (queued), reconnect, verify message syncs automatically and shows "Delivered" status

### Tests for User Story 5 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T147 [P] [US5] Unit tests for OfflineQueueService in `src/services/messaging/__tests__/offline-queue.test.ts` (queueMessage, getQueue, syncQueue, removeFromQueue, getRetryDelay)
- [ ] T148 [P] [US5] Integration test for offline queue in `tests/integration/messaging/offline-queue.test.ts` (add to queue, retrieve, sync with network simulation)
- [ ] T149 [P] [US5] E2E test for offline sync in `e2e/messaging/offline-sync.spec.ts` (go offline → send message → reconnect → verify sync)

### Implementation for User Story 5

- [ ] T150 [P] [US5] Create OfflineQueueService in `src/services/messaging/offline-queue.ts` implementing IOfflineQueueService interface
- [ ] T151 [US5] Implement queueMessage method in OfflineQueueService (INSERT into IndexedDB queuedMessages table with synced=false)
- [ ] T152 [US5] Implement getQueue method in OfflineQueueService (SELECT \* FROM queuedMessages WHERE synced=false)
- [ ] T153 [US5] Implement syncQueue method in OfflineQueueService (fetch unsynced messages, send each, mark synced or increment retries)
- [ ] T154 [US5] Implement removeFromQueue method in OfflineQueueService (DELETE FROM queuedMessages WHERE id=?)
- [ ] T155 [US5] Implement getRetryDelay method in OfflineQueueService (exponential backoff: 1s, 2s, 4s, 8s, 16s based on retry count)
- [ ] T156 [US5] Add retry limit check (max 5 retries, show "Failed to send" if exceeded)
- [ ] T157 [US5] Update MessageService.sendMessage to use offline queue (check navigator.onLine, queue if offline)
- [ ] T158 [US5] Implement useOfflineQueue hook in `src/hooks/useOfflineQueue.ts` (monitor queue count, trigger sync on reconnect, show "Sending..." UI)
- [ ] T159 [US5] Add network event listeners (online/offline events, trigger sync on 'online' event)
- [ ] T160 [US5] Add "Sending..." status to MessageBubble for queued messages (distinct from delivered/read states)
- [ ] T161 [US5] Add "Failed to send" status with retry button (show after 5 failed attempts, allow manual retry)
- [ ] T162 [P] [US5] Create CacheService in `src/services/messaging/cache-service.ts` implementing ICacheService interface
- [ ] T163 [US5] Implement cacheMessages method in CacheService (INSERT messages into IndexedDB cachedMessages table)
- [ ] T164 [US5] Implement getCachedMessages method in CacheService (SELECT from cachedMessages WHERE conversation_id=? ORDER BY created_at DESC LIMIT ?)
- [ ] T165 [US5] Implement clearOldCache method in CacheService (DELETE FROM cachedMessages WHERE created_at < now() - INTERVAL '30 days')
- [ ] T166 [US5] Implement getCacheSize method in CacheService (COUNT(\*) FROM cachedMessages)
- [ ] T167 [US5] Integrate caching into MessageService.getMessageHistory (fallback to cached messages if offline)
- [ ] T168 [US5] Add cache quota management (limit to 5MB for message queue, warn user if approaching limit)
- [ ] T169 [P] [US5] Write unit tests for OfflineQueueService (test queueing, sync, retry logic, exponential backoff)
- [ ] T170 [P] [US5] Write unit tests for CacheService in `src/services/messaging/__tests__/cache-service.test.ts`
- [ ] T171 [P] [US5] Write unit tests for useOfflineQueue hook in `src/hooks/__tests__/useOfflineQueue.test.ts`

**Checkpoint**: User Story 5 complete. Offline messaging fully functional (queue, sync, cache, retry with exponential backoff).

---

## Phase 8: User Story 6 - Read Conversation History with Virtual Scrolling (Priority: P3)

**Goal**: Conversations with 1,000+ messages scroll smoothly at 60fps using virtual scrolling

**Independent Test**: Create conversation with 1,000 messages, scroll through history, measure performance (should maintain 60fps). Test pagination loads next 50 messages.

### Tests for User Story 6 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T172 [P] [US6] Performance test for virtual scrolling in `e2e/messaging/performance.spec.ts` (seed 1,000 messages, measure scrolling FPS with Chrome DevTools)
- [ ] T172b [P] [US6] E2E test for 100-message threshold in `e2e/messaging/performance.spec.ts` (verify virtual scrolling activates at exactly 100 messages, not 99 or before)
- [ ] T173 [P] [US6] E2E test for pagination in `e2e/messaging/performance.spec.ts` (scroll to top → verify next 50 messages load)

### Implementation for User Story 6

- [ ] T174 [US6] Research virtual scrolling library (react-window vs custom implementation)
- [ ] T175 [US6] Install react-window: `docker compose exec scripthammer pnpm add react-window`
- [ ] T176 [US6] Refactor MessageThread to use react-window VariableSizeList (render only visible messages)
- [ ] T177 [US6] Configure fixed item height for MessageBubble (80px per message for performance)
- [ ] T178 [US6] Implement infinite scroll pagination (detect scroll to top, load previous 50 messages)
- [ ] T179 [US6] Add loading skeleton during pagination fetch
- [ ] T180 [US6] Preserve scroll position after pagination (maintain view on currently visible message)
- [ ] T181 [US6] Optimize decryption for large message batches (use Web Worker to decrypt off main thread)
- [ ] T182 [US6] Add shared secret caching (store derived secrets in memory Map to avoid re-derivation)
- [ ] T183 [US6] Profile performance with Chrome DevTools (verify 60fps during scrolling)
- [ ] T184 [US6] Add "New message" indicator when viewing old messages (floating badge with scroll-to-bottom button)
- [ ] T185 [P] [US6] Write performance benchmarks in `tests/performance/virtual-scrolling.test.ts` (measure render time, scroll FPS)

**Checkpoint**: User Story 6 complete. Virtual scrolling maintains 60fps for 1,000+ message conversations. Pagination working smoothly.

---

## Phase 9: User Story 7 - GDPR Data Export and Deletion (Priority: P3)

**Goal**: Users can export all conversation data (decrypted JSON) and delete their account with CASCADE DELETE

**Independent Test**: Export conversation data, verify JSON contains decrypted messages. Delete account, verify all data removed from database (messages, connections, keys).

### Tests for User Story 7 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T186 [P] [US7] Integration test for data export in `tests/integration/messaging/gdpr.test.ts` (export data, verify JSON format, decrypted content)
- [ ] T187 [P] [US7] Integration test for account deletion in `tests/integration/messaging/gdpr.test.ts` (delete account, verify CASCADE DELETE, check all tables)

### Implementation for User Story 7

- [ ] T188 [US7] Implement exportUserData method in KeyManagementService (fetch all conversations, decrypt all messages, generate JSON blob)
- [ ] T189 [US7] Add "Export Data" button in account settings page (`src/app/account/page.tsx`)
- [ ] T190 [US7] Implement data export flow (fetch decrypted conversations, convert to JSON, trigger browser download)
- [ ] T191 [US7] Add loading state during export (show progress bar, "Decrypting messages..." status)
- [ ] T192 [US7] Add "Delete Account" button in account settings with confirmation modal
- [ ] T193 [US7] Implement account deletion flow (call Supabase auth.admin.deleteUser, CASCADE DELETE removes all data)
- [ ] T194 [US7] Add final confirmation step before deletion ("This action is permanent. All your messages, connections, and encryption keys will be deleted.")
- [ ] T195 [US7] Show "[User deleted account]" placeholder for messages from deleted users
- [ ] T196 [US7] Verify CASCADE DELETE works correctly (test in integration tests, check all 6 tables cleared)
- [ ] T197 [P] [US7] Write unit tests for exportUserData in `src/services/messaging/__tests__/key-service.test.ts`

**Checkpoint**: User Story 7 complete. GDPR compliance implemented (data export, right to erasure via account deletion).

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T198 [P] Generate ConversationList component: `docker compose exec scripthammer pnpm run generate:component -- --name ConversationList --category organisms --hasProps true --withHooks true`
- [ ] T199 Implement ConversationList component in `src/components/organisms/ConversationList/ConversationList.tsx` (sort by last_message_at, show unread badges, pagination)
- [ ] T200 [P] Generate ConversationListItem component: `docker compose exec scripthammer pnpm run generate:component -- --name ConversationListItem --category molecular --hasProps true --withHooks false`
- [ ] T201 Implement ConversationListItem component in `src/components/molecular/ConversationListItem/ConversationListItem.tsx` (avatar, name, last message preview, timestamp, unread count badge, 44px touch target)
- [ ] T202 Create conversations list page in `src/app/messages/page.tsx` using ConversationList component
- [ ] T203 Add search/filter functionality to ConversationList (search by user name, filter by unread)
- [ ] T204 Implement unread message count badge (COUNT messages WHERE read_at IS NULL grouped by conversation)
- [ ] T205 Add mobile-first responsive layouts (full-screen chat on mobile, split-pane on tablet+)
- [ ] T206 Add safe area insets for iOS notched devices (padding-top: env(safe-area-inset-top))
- [ ] T207 Verify all touch targets meet 44×44px minimum (audit all buttons, links, inputs)
- [ ] T208 Run Pa11y accessibility audit: `docker compose exec scripthammer pnpm run test:a11y:dev`
- [ ] T209 Fix any Pa11y errors to achieve WCAG AA compliance (zero errors required)
- [ ] T210 Add keyboard shortcuts (Enter to send, Cmd+Enter for newline, Tab navigation)
- [ ] T211 Add focus trap in modals (settings, confirmation dialogs, blocked user warnings)
- [ ] T212 Add skip links for screen readers (skip to conversation list, skip to message input)
- [ ] T213 Verify ARIA live regions announce new messages to screen readers
- [ ] T214 Run Lighthouse performance audit (target: 90+ score)
- [ ] T215 Optimize bundle size (code splitting, lazy loading for messaging routes)
- [ ] T216 Add error boundaries around messaging components (graceful degradation if encryption fails)
- [ ] T217 [P] Write unit tests for ConversationList in `src/components/organisms/ConversationList/ConversationList.test.tsx`
- [ ] T218 [P] Write unit tests for ConversationListItem in `src/components/molecular/ConversationListItem/ConversationListItem.test.tsx`
- [ ] T219 [P] Write Storybook stories for ConversationList in `src/components/organisms/ConversationList/ConversationList.stories.tsx`
- [ ] T220 [P] Write Storybook stories for ConversationListItem in `src/components/molecular/ConversationListItem/ConversationListItem.stories.tsx`
- [ ] T221 [P] Write accessibility tests for ConversationList in `src/components/organisms/ConversationList/ConversationList.accessibility.test.tsx`
- [ ] T222 [P] Write accessibility tests for ConversationListItem in `src/components/molecular/ConversationListItem/ConversationListItem.accessibility.test.tsx`
- [ ] T223 Update CLAUDE.md with messaging system documentation (encryption patterns, troubleshooting, key management)
- [ ] T224 Update project-status.json (mark PRP-023 as complete, add messaging system to feature list)
- [ ] T225 Run quickstart.md validation (follow developer setup guide, verify all steps work)
- [ ] T226 Run full test suite: `docker compose exec scripthammer pnpm run test:suite`
- [ ] T227 Verify 60%+ test coverage: `docker compose exec scripthammer pnpm run test:coverage`
- [ ] T228 Run production build: `docker compose exec scripthammer pnpm run build`
- [ ] T229 Verify bundle size (<150KB for messaging modules)
- [ ] T230 Final success criteria verification (all 15 SC-001 to SC-015 met per spec.md)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-9)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Foundational - No dependencies on other stories
  - User Story 2 (P1): Can start after Foundational - Independent (though typically follows US1 for testing)
  - User Story 3 (P1): Depends on US2 completion (needs MessageService for real-time subscriptions)
  - User Story 4 (P2): Depends on US2 and US3 completion (needs messaging and real-time for edits)
  - User Story 5 (P2): Depends on US2 completion (needs MessageService for offline queue)
  - User Story 6 (P3): Depends on US2 and US3 completion (virtual scrolling needs messaging + real-time)
  - User Story 7 (P3): Depends on US2 completion (GDPR export needs decryption)
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent - Can start immediately after Foundational
- **User Story 2 (P1)**: Independent - Can start immediately after Foundational (typically after US1 for testing)
- **User Story 3 (P1)**: Depends on US2 (MessageService, ChatWindow components)
- **User Story 4 (P2)**: Depends on US2 and US3 (needs messaging + real-time for edit notifications)
- **User Story 5 (P2)**: Depends on US2 (needs MessageService for queue integration)
- **User Story 6 (P3)**: Depends on US2 and US3 (needs MessageThread with real-time updates)
- **User Story 7 (P3)**: Depends on US2 (needs decryption for data export)

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Services before components (EncryptionService → MessageService → ChatWindow)
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- All tests for a user story marked [P] can run in parallel
- Component generation marked [P] can run in parallel
- Unit tests, Storybook stories, and accessibility tests for same component can run in parallel
- User Story 1 and User Story 2 can be worked on in parallel by different team members (after Foundational)
- Different user stories can be worked on in parallel by different team members (respecting dependencies)

---

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together:
Task: "Unit tests for EncryptionService in src/lib/messaging/__tests__/encryption.test.ts"
Task: "Integration test for end-to-end encryption flow in tests/integration/messaging/encryption.test.ts"
Task: "Cross-browser encryption test in e2e/messaging/encrypted-messaging.spec.ts"

# Launch all component generations for User Story 2 together:
Task: "Generate MessageBubble component (atomic)"
Task: "Generate MessageInput component (atomic)"
Task: "Generate MessageThread component (molecular)"
Task: "Generate ChatWindow component (organisms)"

# Launch all Storybook stories for User Story 2 together:
Task: "Write Storybook stories for MessageBubble"
Task: "Write Storybook stories for MessageInput"
Task: "Write Storybook stories for MessageThread"
Task: "Write Storybook stories for ChatWindow"
```

---

## Implementation Strategy

### MVP First (User Stories 1, 2, 3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Friend Requests)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Complete Phase 4: User Story 2 (Encrypted Messaging)
6. **STOP and VALIDATE**: Test User Story 2 independently
7. Complete Phase 5: User Story 3 (Real-time Delivery)
8. **STOP and VALIDATE**: Test all three stories together
9. Deploy/demo MVP

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo
3. Add User Story 2 → Test independently → Deploy/Demo (MVP!)
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add User Story 5 → Test independently → Deploy/Demo
7. Add User Story 6 → Test independently → Deploy/Demo
8. Add User Story 7 → Test independently → Deploy/Demo (Full feature complete)
9. Complete Phase 10 (Polish) → Final production release

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2 (in parallel with A)
3. After US2 complete:
   - Developer A: User Story 3 (depends on US2)
   - Developer B: User Story 5 (depends on US2, parallel with US3)
   - Developer C: User Story 7 (depends on US2, parallel with US3/US5)
4. After US2 and US3 complete:
   - Developer A: User Story 4 (depends on US2 + US3)
   - Developer B: User Story 6 (depends on US2 + US3, parallel with US4)
5. Stories complete and integrate independently

---

## Task Summary

**Total Tasks**: 230 tasks across 10 phases
**Estimated Time**: 8-11 days

**Phase Breakdown**:

- Phase 1 (Setup): 3 tasks, 0.5 days
- Phase 2 (Foundational): 9 tasks, 1 day
- Phase 3 (User Story 1 - Friend Requests): 28 tasks, 2 days
- Phase 4 (User Story 2 - Encrypted Messaging): 56 tasks, 3 days
- Phase 5 (User Story 3 - Real-time Delivery): 32 tasks, 1.5 days
- Phase 6 (User Story 4 - Edit/Delete): 18 tasks, 1 day
- Phase 7 (User Story 5 - Offline Queue): 25 tasks, 1.5 days
- Phase 8 (User Story 6 - Virtual Scrolling): 14 tasks, 1 day
- Phase 9 (User Story 7 - GDPR): 12 tasks, 0.5 days
- Phase 10 (Polish): 33 tasks, 1 day

**Critical Path**:

1. Setup → Foundational → User Story 1 → User Story 2 → User Story 3 → User Story 4 → User Story 5 → User Story 6 → User Story 7 → Polish

**Parallelizable Work**:

- Component generation can happen alongside service implementation (within same user story)
- Tests can be written while components are being built (TDD approach)
- Storybook stories and accessibility tests can run in parallel with unit tests
- User Story 1 and User Story 2 can proceed in parallel after Foundational
- User Story 5 and User Story 7 can proceed in parallel after User Story 2

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- 100% test coverage required for all crypto functions (EncryptionService)
- WCAG AA compliance required (zero Pa11y errors)
- 60%+ overall test coverage target
- All interactive elements must meet 44×44px touch target minimum

---

**Next Command**: `/implement` to execute task list (or manual implementation following this breakdown)
