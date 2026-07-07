# Feature Specification: Group Chats

**Feature Branch**: `010-group-chats`
**Created**: 2025-12-02
**Status**: Draft
**Input**: User description: "Feature 010: Group Chats - Add group messaging to E2E encrypted system. Up to 200 members, symmetric key encryption with key versioning, new members cannot see pre-join history, any member can add others but only owner can remove, 1-to-1 conversations can be upgraded to groups with original participants keeping history access."

## Clarifications

### Session 2025-12-02

- Q: When the group owner leaves, what should happen to the group? → A: Prevent owner from leaving until they transfer ownership manually
- Q: What should happen when group key distribution fails for some members during key rotation? → A: Retry 3 times, then mark those members as "pending key" (can't decrypt new messages until resolved)
- Q: What should happen when all members except the owner leave/are removed? → A: Keep as group, owner can continue adding members

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Create Group Chat (Priority: P1)

A user wants to create a group conversation with multiple friends to discuss a topic together instead of sending individual messages.

**Why this priority**: Group creation is the foundational capability - without it, no other group features can exist. This enables the core value proposition of multi-party encrypted conversations.

**Independent Test**: Can be fully tested by creating a new group with 3+ members and verifying all members can see the group in their conversation list.

**Acceptance Scenarios**:

1. **Given** a logged-in user with 2+ connections, **When** they click "New Group" and select multiple connections, **Then** a group conversation is created and appears in all members' conversation lists
2. **Given** a user creating a group, **When** they optionally enter a group name, **Then** the group displays that name (or auto-generates from member names if empty)
3. **Given** a new group is created, **When** the owner sends the first message, **Then** all group members receive the encrypted message and can decrypt it

---

### User Story 2 - Send/Receive Group Messages (Priority: P1)

Users in a group want to send and receive encrypted messages that all group members can read.

**Why this priority**: Core messaging functionality - the primary purpose of group chats. Without this, groups have no utility.

**Independent Test**: Can be tested by having 3 users in a group where each sends a message and all members can read all messages with correct sender attribution.

**Acceptance Scenarios**:

1. **Given** a user in a group chat, **When** they send a message, **Then** all group members receive and can decrypt the message
2. **Given** a group conversation, **When** viewing messages, **Then** each message displays the sender's name and avatar
3. **Given** a group with active members, **When** multiple users type simultaneously, **Then** typing indicators show all currently typing members

---

### User Story 3 - Add Members to Group (Priority: P2)

Any group member wants to invite additional users to join the conversation.

**Why this priority**: Enables organic group growth. Important for usability but not required for basic group function.

**Independent Test**: Can be tested by having an existing member add a new user and verifying the new user appears in member list and can send/receive messages.

**Acceptance Scenarios**:

1. **Given** a group member, **When** they click "Add Members" and select a connection, **Then** the connection is added to the group
2. **Given** a newly added member, **When** they open the group conversation, **Then** they can only see messages sent after their join date (no pre-join history)
3. **Given** a member is added, **When** the group key rotates, **Then** the new member receives the new key and existing members' keys are updated

---

### User Story 4 - Upgrade 1-to-1 to Group (Priority: P2)

Two users in an existing direct message conversation want to add more people to create a group discussion.

**Why this priority**: Natural evolution of conversations. Users shouldn't have to start fresh when they want to include others.

**Independent Test**: Can be tested by taking an existing DM with message history, adding a third person, and verifying original participants retain history access while new member cannot see old messages.

**Acceptance Scenarios**:

1. **Given** an existing 1-to-1 conversation, **When** either participant clicks "Add People", **Then** the conversation converts to a group
2. **Given** a converted group, **When** the original two participants view history, **Then** they can still read their original DM messages
3. **Given** a new member added during upgrade, **When** they view the group, **Then** they cannot see messages from before their join date

---

### User Story 5 - Remove Member / Leave Group (Priority: P2)

The group owner needs to remove problematic members, and any member can choose to leave.

**Why this priority**: Essential for group management and user control, but secondary to creation and messaging.

**Independent Test**: Can be tested by owner removing a member and verifying removed user loses access to future messages, and by a member leaving and confirming they no longer receive group messages.

**Acceptance Scenarios**:

1. **Given** the group owner, **When** they select a member and click "Remove", **Then** the member is removed and cannot access future messages
2. **Given** a group member (non-owner), **When** they click "Leave Group", **Then** they are removed and the group continues for remaining members
3. **Given** a member is removed, **When** the group key rotates, **Then** the removed member cannot decrypt messages sent after removal

---

### User Story 6 - View Group Info and Members (Priority: P3)

Users want to see who is in the group and group metadata.

**Why this priority**: Important for UX but not critical for core functionality.

**Independent Test**: Can be tested by opening group info panel and verifying all members are listed with correct roles.

**Acceptance Scenarios**:

1. **Given** a group conversation, **When** a member clicks the group header or info button, **Then** a panel shows group name, member count, and member list
2. **Given** the group info panel, **When** viewing members, **Then** the owner is clearly indicated and all members show their display names and avatars

---

### Edge Cases

- What happens when the owner tries to leave the group? Owner must transfer ownership to another member before leaving; "Leave Group" button disabled for owner until ownership transferred
- How does system handle adding a member who is already in the group? Should show error message "User is already a member"
- What happens when a user tries to add someone they're not connected with? Require connection status first
- How does offline message queueing work for group messages? Queue message locally, sync when online using current group key
- What happens if a member's encryption keys are not available when adding? Retry key distribution 3 times, then mark member as "pending key" status; member cannot decrypt new messages until key distribution succeeds; system retries when member comes online
- How does the system handle 200-member group key distribution? Batch key encryption in batches of 50 members with progress indicator showing "Distributing keys: X/200"
- What happens when trying to upgrade a group to a group? "Add People" option should only appear for 1-to-1 conversations
- What happens when all members except owner leave? Group persists with owner only; owner can continue adding new members; no automatic deletion

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST allow users to create group conversations with 2-200 members (minimum 2 at creation; can drop to 1 if all other members leave - owner remains as sole member)
- **FR-002**: System MUST encrypt all group messages using AES-GCM-256 symmetric encryption
- **FR-003**: System MUST use a symmetric group key encrypted individually for each member using ECDH
- **FR-004**: System MUST rotate the group key when members are added or removed
- **FR-004a**: System MUST retry failed key distribution up to 3 times before marking member as "pending key"
- **FR-004b**: Members with "pending key" status MUST NOT be able to decrypt new messages until key distribution succeeds
- **FR-004c**: System MUST automatically retry key distribution for "pending key" members when they come online
- **FR-005**: System MUST track key versions so new members cannot decrypt pre-join messages
- **FR-006**: System MUST allow any group member to add new members (who are their connections)
- **FR-007**: System MUST restrict member removal to the group owner only
- **FR-008**: System MUST allow any non-owner member to leave the group voluntarily
- **FR-008a**: System MUST require owner to transfer ownership before leaving; "Leave Group" disabled until ownership transferred
- **FR-008b**: System MUST allow owner to transfer ownership to any other group member
- **FR-009**: System MUST support upgrading 1-to-1 conversations to groups while preserving history for original participants
- **FR-010**: System MUST display sender name and avatar for each group message
- **FR-011**: System MUST show group name, member count, and member list in group info
- **FR-012**: System MUST support optional custom group names; if not provided, auto-generate from first 3 member display names (e.g., "Alice, Bob, Carol" or "Alice, Bob +5 others")
- **FR-016**: System MUST allow owner to delete entire group; all members lose access and conversation is archived
- **FR-013**: System MUST display stacked avatars for groups in conversation list
- **FR-014**: System MUST show system messages for member join/leave events with display formats:
  - `member_joined`: "{actor} added {target} to the group"
  - `member_left`: "{actor} left the group"
  - `member_removed`: "{actor} removed {target} from the group"
  - `group_created`: "{actor} created the group"
  - `group_renamed`: "{actor} renamed the group to {new_value}"
  - `ownership_transferred`: "{actor} made {target} the group owner"
- **FR-015**: System MUST support typing indicators for multiple concurrent typers (show up to 3 names, then "X others are typing")

### Key Entities

- **Group Conversation**: A conversation with `is_group = true`, containing a name, owner, current key version, and member count
- **Conversation Member**: Junction entity linking users to conversations with role (owner/member), join date, key version joined, key status (active/pending), and archive/mute preferences
- **Group Key**: Encrypted symmetric key for a conversation, stored per-member per-version. Each member has their own encrypted copy they can decrypt with their private key
- **System Message**: Special message type for events like "User joined", "User left", "Group created"

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can create a group and send the first message within 30 seconds (measured from "New Group" button click to message confirmation toast; assumes warm browser with cached auth)
- **SC-002**: Group key distribution for 200 members completes within 10 seconds (batch size: 50 members per batch with progress indicator)
- **SC-003**: New members correctly see "[Message before you joined]" placeholder for pre-join messages
- **SC-004**: Key rotation on member change completes without message loss or decryption errors (verified by: all active members can decrypt new messages, no console errors during rotation, message count before/after matches)
- **SC-005**: 1-to-1 to group upgrade preserves 100% of original message history for original participants (verified by: query message count before upgrade, confirm same count visible after upgrade for both original participants)
- **SC-006**: Removed members cannot decrypt any messages sent after their removal (verified by: attempt decryption with removed member's credentials returns error, not plaintext)
- **SC-007**: All group UI components pass WCAG 2.1 AA accessibility requirements (tested with jest-axe, Pa11y)
- **SC-008**: Group conversations display correctly on mobile (44px touch targets, responsive layout)

---

## Technical Specifications

### Encryption & Key Management

#### Symmetric Key Algorithm (CHK001)

- **Algorithm**: AES-GCM (Galois/Counter Mode)
- **Key Length**: 256 bits (32 bytes)
- **IV Length**: 96 bits (12 bytes) per message
- **Tag Length**: 128 bits (16 bytes) authentication tag

#### Key Generation (CHK002)

- **Entropy Source**: `crypto.getRandomValues()` via Web Crypto API
- **Algorithm**: `crypto.subtle.generateKey()` with `{ name: 'AES-GCM', length: 256 }`
- **Output**: CryptoKey object (non-extractable for security, extractable only for encryption to members)

#### ECDH Key Derivation for Group Key Encryption (CHK003)

1. Sender retrieves recipient's public ECDH key from `user_encryption_keys` table
2. Derive shared secret: `crypto.subtle.deriveBits()` using sender's private key + recipient's public key
3. Derive encryption key from shared secret using HKDF: `crypto.subtle.deriveKey()` with SHA-256
4. Encrypt group key: `crypto.subtle.encrypt({ name: 'AES-GCM', iv: <random 12 bytes> }, derivedKey, groupKeyBytes)`
5. Store: Base64-encode(IV || ciphertext || authTag) in `group_keys.encrypted_key`

#### Key Rotation Triggers (CHK004)

Key rotation MUST occur when:

1. A new member is added to the group
2. A member is removed from the group (by owner)
3. A member leaves the group voluntarily
4. Owner explicitly requests rotation (future enhancement)

Key rotation MUST NOT occur when:

- Member updates preferences (mute, archive)
- Group is renamed
- Ownership is transferred

#### Retry Rationale (CHK005)

The 3-retry limit for key distribution failures is chosen because:

- Balances user experience (not waiting indefinitely) with reliability
- Matches common network retry patterns (exponential backoff: 1s, 2s, 4s)
- After 3 failures, member is likely genuinely offline, not experiencing transient issues
- "Pending key" status allows manual resolution or automatic retry on reconnect

#### Key Version Behavior (CHK007)

- Key versions are **monotonically increasing integers** starting at 1
- Each key rotation increments `conversations.current_key_version` by 1
- Key versions are **never reused** within a conversation
- Messages store `key_version` to indicate which key encrypted them
- Members can only decrypt messages where `message.key_version >= member.key_version_joined`

#### Client-Side Key Caching (CHK008)

- Decrypted group keys are cached in-memory per conversation per session
- Cache key: `groupKey:${conversationId}:${keyVersion}`
- Cache is cleared on: logout, tab close, or explicit cache clear
- Keys are NOT persisted to localStorage/IndexedDB (security requirement)
- Cache size limit: 50 keys (LRU eviction)

#### Encrypted Key Format (CHK009)

- Format: Base64-encoded concatenation of `IV (12 bytes) || Ciphertext || AuthTag (16 bytes)`
- Total overhead: 28 bytes + key length (32 bytes) = ~80 characters Base64
- Stored in `group_keys.encrypted_key` as TEXT

#### IV Generation (CHK010)

- Each message encryption generates a **fresh random IV** using `crypto.getRandomValues(new Uint8Array(12))`
- IVs MUST NOT be reused with the same key (cryptographic requirement)
- IV is stored alongside ciphertext in `messages.initialization_vector` as Base64

### History Restriction

#### Key Version Comparison Logic (CHK011)

```
canDecrypt(message, member) = message.key_version >= member.key_version_joined
```

- If `member.key_version_joined = 0`: Can decrypt ALL messages (original DM participants after upgrade)
- If `member.key_version_joined = N`: Can only decrypt messages with `key_version >= N`
- Pre-join messages display: "[Message before you joined]" (not decrypted, not attempted)

#### Placeholder Text (CHK012)

Exact text for pre-join messages: `"[Message before you joined]"`

- Rendered in italic, muted color (gray-500)
- No decryption attempt made
- Click does nothing (not expandable)

#### Consistency: DM Upgrade vs New Member Add (CHK013)

| Scenario     | Original Participants                      | New Members                        |
| ------------ | ------------------------------------------ | ---------------------------------- |
| DM Upgrade   | `key_version_joined = 0` (see all history) | `key_version_joined = current + 1` |
| Add to Group | N/A                                        | `key_version_joined = current + 1` |

Both scenarios: New members cannot see pre-join history. Original DM participants are special-cased with version 0.

#### Original DM Participants (CHK014)

When upgrading 1-to-1 to group:

1. Set `is_group = true` on conversation
2. Create `conversation_members` entries for both original participants with `key_version_joined = 0`
3. Generate first group key (version 1)
4. Messages sent before upgrade have no `key_version` (or version 0) - decryptable via original ECDH
5. New messages use group key (version 1+)

#### Verification Method (CHK015)

To objectively verify "new members cannot see pre-join history":

1. Create group with User A, B (3 messages exchanged)
2. Add User C
3. Assert: User C's message list shows "[Message before you joined]" for first 3 messages
4. Assert: User C cannot retrieve plaintext of those messages via any API call
5. Assert: Network inspector shows no decrypted content for pre-join messages

### Member Management

#### Connection Requirement for Adding (CHK029)

"Any member can add" is qualified: Members can ONLY add users who are **their own connections** (accepted connection status). The adding member must have an active connection with the new member. This is validated in the service layer before adding.

#### 200-Member Limit Enforcement (CHK030)

The 200-member limit is enforced at:

1. **Service layer**: `GroupService.addMembers()` checks current member count + new members ≤ 200
2. **Database**: CHECK constraint on `conversation_members` count (optional, for defense in depth)
3. **UI**: "Add Members" button disabled when at capacity, shows tooltip "Group is at maximum capacity (200 members)"

#### Ownership Transfer Atomicity (CHK031)

Ownership transfer uses a database transaction:

```sql
BEGIN;
UPDATE conversation_members SET role = 'member' WHERE conversation_id = $1 AND role = 'owner';
UPDATE conversation_members SET role = 'owner' WHERE conversation_id = $1 AND user_id = $2;
COMMIT;
```

- If either UPDATE fails, entire transaction rolls back
- No intermediate state with dual owners or no owner possible
- RLS policy ensures only current owner can execute

#### Transfer Decline (CHK032)

Ownership transfer is **immediate and non-negotiable**:

- No confirmation required from new owner
- Transfer takes effect immediately upon owner's action
- New owner can transfer back if desired
- Rationale: Simplicity, matches common messaging app patterns (WhatsApp, Telegram)

#### Leave Group Disabled for Owner (CHK033)

UI specification for owner's Leave Group button:

- Button text: "Leave Group"
- State: `disabled={isOwner && memberCount > 1}`
- Tooltip when disabled: "Transfer ownership to another member before leaving"
- When owner is sole member: Button enabled, clicking deletes group

#### Owner Removal vs Leaving Consistency (CHK034)

| Action | Owner Can Do To Self?                 | Owner Can Do To Others? |
| ------ | ------------------------------------- | ----------------------- |
| Remove | No (use Leave)                        | Yes                     |
| Leave  | Only after transfer OR if sole member | N/A                     |

Consistent rule: Owner cannot be forcibly removed by anyone, including themselves. They must transfer first.

### UX & UI Specifications

#### Avatar Stack Display (CHK035)

- Show first **3 member avatars** overlapping (16px offset each)
- If >3 members: Show 2 avatars + "+N" badge where N = total - 2
- Avatar size: 32px in conversation list, 24px in compact views
- Overlap direction: Right-to-left (newest on top)
- Border: 2px solid background color to separate overlapping avatars

#### Auto-Generated Group Name (CHK036)

When no custom name provided:

- **≤3 members**: "Alice, Bob, Carol" (comma-separated display names)
- **>3 members**: "Alice, Bob +5 others"
- **Fallback**: "Group Chat" if names unavailable
- **Update**: Auto-name updates when members change (unless custom name set)

#### System Message Display Formats (CHK037)

| Type                    | Format                                       | Example                                     |
| ----------------------- | -------------------------------------------- | ------------------------------------------- |
| `member_joined`         | "{actor} added {target}"                     | "Alice added Bob"                           |
| `member_left`           | "{actor} left"                               | "Carol left"                                |
| `member_removed`        | "{actor} removed {target}"                   | "Alice removed Dave"                        |
| `group_created`         | "{actor} created the group"                  | "Alice created the group"                   |
| `group_renamed`         | "{actor} renamed the group to "{new_value}"" | "Alice renamed the group to "Project Team"" |
| `ownership_transferred` | "{actor} made {target} the group owner"      | "Alice made Bob the group owner"            |

Display: Centered, muted text (gray-500), no avatar, smaller font (text-sm)

#### Group Info Panel Content (CHK038)

Panel displays (top to bottom):

1. Group avatar/stack (large, 64px)
2. Group name (editable by owner, with pencil icon)
3. Member count: "X members"
4. Action buttons row: Mute | Archive | Leave (or Delete if owner+sole)
5. "Add Members" button (if not at capacity)
6. Scrollable member list (see CHK042)
7. "Created {date}" footer

#### Progress Indicator for Key Distribution (CHK039)

For 200-member groups:

- Progress bar with text: "Distributing encryption keys: X/200"
- Update frequency: After each batch of 50 members
- Positioned: Modal overlay, non-dismissible during distribution
- On complete: "Keys distributed successfully" toast, auto-dismiss after 3s
- On partial failure: List members with "pending" status, allow retry

#### Add People Button Visibility (CHK040)

"Add People" button appears ONLY when:

- Conversation is 1-to-1 (`is_group = false`)
- Located in: ChatWindow header, next to info button
- Icon: `UserPlus` or `PersonAdd`
- Tooltip: "Add people to start a group"

Does NOT appear for:

- Existing groups (use group info panel → Add Members instead)
- Blocked conversations
- Archived conversations

#### Error Messages (CHK041)

| Scenario                     | Error Message                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------- |
| Add non-connection           | "You can only add people you're connected with"                               |
| Add existing member          | "This person is already in the group"                                         |
| Group at capacity            | "This group has reached the maximum of 200 members"                           |
| Remove non-member            | "This person is not a member of the group"                                    |
| Non-owner remove             | "Only the group owner can remove members"                                     |
| Owner leave without transfer | "Transfer ownership to another member before leaving"                         |
| Key distribution failed      | "Could not send encryption keys to {name}. They'll receive keys when online." |
| Decryption failed            | "This message could not be decrypted"                                         |

#### Owner Indicator in Member List (CHK042)

- Owner row displays: Avatar | Display Name | "Owner" badge (yellow/gold background, dark text)
- Badge position: Right-aligned, after display name
- Owner always listed first in member list
- Non-owners show: Avatar | Display Name | (optional: role badge for future admin roles)

### Edge Cases & Recovery

#### Adding User Who Blocks Adder (CHK043)

If User A tries to add User B who has blocked User A:

- Behavior: Request fails silently from A's perspective
- Error shown to A: "Could not add {name}" (generic, doesn't reveal block)
- User B: No notification, no group join
- Rationale: Don't reveal block status to blocked user

#### Concurrent Add/Remove Operations (CHK044)

Handled via database transactions and optimistic locking:

1. Both operations wrapped in transactions
2. `current_key_version` used as optimistic lock
3. Second operation detects version mismatch, retries with new version
4. If member being added is simultaneously removed: Add wins if committed first
5. All operations use `SELECT ... FOR UPDATE` on conversation row

#### Partial Key Distribution Failure (CHK045)

When key rotation fails for some members:

1. Successful members: Receive new key, can decrypt new messages
2. Failed members: Marked as `key_status = 'pending'`
3. Key version still increments (successful members shouldn't wait)
4. Pending members: System retries when they come online (presence-based)
5. UI shows: "Some members have pending encryption keys" warning in group info

#### Orphaned Group Keys (CHK046)

When member is removed:

1. Their `conversation_members.left_at` is set
2. Their `group_keys` rows are NOT deleted (audit trail, no security risk since they're encrypted for that user)
3. They cannot fetch new group keys (RLS: requires `left_at IS NULL` membership)
4. Their old keys remain but are useless (new messages use new key version)
5. Cleanup: Optional batch job can delete orphaned keys after 30 days

#### Offline Message Queue for Groups (CHK047)

Group messages while offline:

1. Message encrypted with current group key
2. Stored in IndexedDB with `pendingSync: true` flag
3. On reconnect: Messages sent in sequence_number order
4. If key version changed while offline: Re-encrypt with new key before sending
5. Conflict resolution: Server assigns final sequence_number

#### Pending Key Re-sync Across Devices (CHK048)

When user with "pending" status logs in on new device:

1. Presence system detects online status
2. Key distribution retry triggered for all "pending" memberships
3. If successful: Status updated to "active" on all devices via Realtime
4. Keys synced to new device via normal group_keys fetch

#### Upgrading Archived Conversations (CHK049)

When upgrading a conversation with archived messages:

1. Archived messages remain archived
2. Original participants can still view (archive is per-user preference)
3. New members: Cannot see archived messages (pre-join history rule applies)
4. Group inherits archive status: If both originals had archived, group starts archived for them

#### Group Deletion (CHK050)

When owner deletes entire group (FR-016):

1. Confirmation dialog: "Delete this group? All messages will be removed for all members."
2. On confirm: Soft-delete conversation (`deleted_at = now()`)
3. All members: Group removed from conversation list
4. Messages: Retained in DB for compliance but inaccessible
5. Group keys: Retained for audit
6. Undo: Not available (permanent from user perspective)

### Performance & Non-Functional

#### 10-Second Threshold Test Method (CHK051)

To verify SC-002 (200-member key distribution ≤10s):

1. Setup: Create group with 200 mock users (in test environment)
2. Measure: Start timer at `distributeGroupKey()` call
3. Stop timer when all `group_keys` rows written
4. Assert: Duration ≤ 10,000ms
5. Environment: Test in Docker container matching production specs
6. Network: Local Supabase (no network latency in test)

#### 30-Second Threshold Test Method (CHK052)

To verify SC-001 (group creation + first message ≤30s):

1. Measure: Start timer at "New Group" button click
2. User actions: Select 3 members, enter name, click Create, type message, send
3. Stop timer when message appears in chat (confirmed sent)
4. Assert: Duration ≤ 30,000ms
5. Note: Includes user interaction time; aim for <10s system time

#### Batch Size (CHK053)

Key distribution batch size: **50 members per batch**

- Rationale: Balances parallelism with memory usage
- Each batch: Parallel ECDH derivation + encryption
- Progress update: After each batch completes
- Total batches for 200 members: 4 batches

#### Progress Indicator Frequency (CHK054)

- Update after each batch: "25/200", "50/200", "100/200", "150/200", "200/200"
- Minimum update interval: 100ms (prevent UI thrashing)
- Format: Progress bar + "Distributing keys: X/Y"
- Completion: Bar fills, text changes to "Complete", auto-dismiss after 2s

#### Realtime Subscription Scaling (CHK055)

For large groups:

- One Supabase Realtime channel per conversation (not per member)
- Channel name: `group:${conversationId}`
- Presence tracked per channel (typing indicators)
- Message limit: Supabase handles (10,000 messages/second per project)
- Recommendation: For >100 members, consider debouncing typing indicators (every 500ms)

### Accessibility

#### WCAG 2.1 AA Components (CHK056)

All new components must pass:

- Color contrast: 4.5:1 for normal text, 3:1 for large text
- Focus indicators: Visible focus ring on all interactive elements
- Text resizing: Functional at 200% zoom
- Motion: Respect `prefers-reduced-motion`

Tested components: AvatarStack, SystemMessage, GroupChatHeader, GroupInfoPanel, GroupMemberList, AddMemberModal, CreateGroupModal

#### Keyboard Navigation for Member List (CHK057)

- `Tab`: Move focus to member list
- `↑/↓`: Navigate between members
- `Enter`: Open member context menu (if applicable)
- `Escape`: Close context menu, return focus to list
- Focus trap: In modal dialogs (AddMemberModal)

#### Screen Reader Announcements (CHK058)

System messages announced as:

- `role="status"` with `aria-live="polite"`
- Announcement format: Same as display format (e.g., "Alice added Bob to the group")
- Not announced: Pre-join placeholders (already visible, not new)

#### Touch Targets (CHK059)

All new components enforce 44px minimum touch targets:

- Member list rows: `min-h-11` (44px)
- Action buttons: `min-h-11 min-w-11`
- Avatar taps (for profile): 44px tap area around 32px avatar
- Modal close buttons: 44px

#### ARIA Labels (CHK060)

| Component            | ARIA Label                                        |
| -------------------- | ------------------------------------------------- |
| AvatarStack          | `aria-label="Group members: {names}"`             |
| Group header         | `aria-label="{groupName}, {memberCount} members"` |
| Add member button    | `aria-label="Add members to group"`               |
| Leave group button   | `aria-label="Leave this group"`                   |
| Member remove button | `aria-label="Remove {name} from group"`           |
| Owner badge          | `aria-label="Group owner"`                        |

### Acceptance Criteria Verification

#### SC-004 Verification Method (CHK061)

"Without message loss or decryption errors" verified by:

1. Count messages before rotation: `SELECT COUNT(*) FROM messages WHERE conversation_id = $1`
2. Trigger key rotation (add/remove member)
3. Each active member fetches and decrypts all messages
4. Assert: No JavaScript errors, all messages render, count matches
5. Automated: E2E test with 3 users, rotation, message verification

#### SC-005 Verification Method (CHK062)

"100% of original message history preserved" verified by:

1. Count DM messages: `SELECT COUNT(*) FROM messages WHERE conversation_id = $1`
2. Upgrade to group
3. Both original participants fetch message history
4. Assert: Message count matches for both users
5. Assert: All messages decryptable (no "[Message before you joined]" for originals)

#### SC-006 Verification Method (CHK063)

"Cannot decrypt any messages sent after removal" verified by:

1. Remove member from group
2. Send 3 new messages from remaining members
3. Attempt fetch as removed user (should fail RLS)
4. Even if fetched: Attempt decryption with removed user's keys
5. Assert: Decryption fails (removed user has no key for new version)

#### E2E Test Derivation (CHK064)

Acceptance scenarios map to E2E tests:
| User Story | Scenarios | E2E Tests |
|------------|-----------|-----------|
| US1 | 3 | `group-create.spec.ts` (3 tests) |
| US2 | 3 | `group-messaging.spec.ts` (3 tests) |
| US3 | 3 | `group-add-member.spec.ts` (3 tests) |
| US4 | 3 | `group-upgrade.spec.ts` (3 tests) |
| US5 | 3 | `group-remove-leave.spec.ts` (3 tests) |
| US6 | 2 | `group-info.spec.ts` (2 tests) |

Total: 17 E2E tests derived from acceptance scenarios

#### Priority Justification (CHK065)

| Priority | User Stories  | Justification                                                        |
| -------- | ------------- | -------------------------------------------------------------------- |
| P1       | US1, US2      | Core functionality - groups must exist and work before anything else |
| P2       | US3, US4, US5 | Member management - enables group growth and moderation              |
| P3       | US6           | View-only feature - important but not blocking core flows            |

Dependencies: US1 → US2 → US3 → US4 (linear), US5/US6 parallel after US3

---

## Traceability

### Functional Requirements to User Stories (CHK066)

| Requirement       | User Story | Notes                           |
| ----------------- | ---------- | ------------------------------- |
| FR-001            | US1        | Group creation                  |
| FR-002, FR-003    | US2        | Encryption                      |
| FR-004, FR-004a-c | US3, US5   | Key rotation on member change   |
| FR-005            | US3, US4   | History restriction             |
| FR-006            | US3        | Any member can add              |
| FR-007            | US5        | Owner-only removal              |
| FR-008, FR-008a-b | US5        | Leave group, ownership transfer |
| FR-009            | US4        | DM upgrade                      |
| FR-010            | US2        | Sender display                  |
| FR-011            | US6        | Group info                      |
| FR-012            | US1, US6   | Group naming                    |
| FR-013            | US6        | Avatar stack                    |
| FR-014            | US3, US5   | System messages                 |
| FR-015            | US2        | Typing indicators               |
| FR-016            | US5        | Group deletion                  |

### Data Model to Functional Requirements (CHK067)

| Table/Column                            | Requirement                    |
| --------------------------------------- | ------------------------------ |
| conversations.is_group                  | FR-001                         |
| conversations.group_name                | FR-012                         |
| conversations.created_by                | FR-007, FR-008b                |
| conversations.current_key_version       | FR-004, FR-005                 |
| conversation_members                    | FR-001, FR-006, FR-007, FR-008 |
| conversation_members.key_version_joined | FR-005                         |
| conversation_members.key_status         | FR-004a-c                      |
| group_keys                              | FR-002, FR-003, FR-004         |
| messages.key_version                    | FR-005                         |
| messages.is_system_message              | FR-014                         |
| messages.system_message_type            | FR-014                         |

### Clarifications to Requirements (CHK068)

| Clarification                       | Requirements Updated            |
| ----------------------------------- | ------------------------------- |
| Owner cannot leave without transfer | FR-008a added                   |
| Retry 3x then pending               | FR-004a, FR-004b, FR-004c added |
| Single-member group persists        | FR-001 clarified                |

### API Contract to Requirements (CHK069)

| API Operation     | Requirement            |
| ----------------- | ---------------------- |
| createGroup       | FR-001, FR-002, FR-003 |
| getGroupMembers   | FR-011                 |
| addMembers        | FR-006, FR-004         |
| removeMember      | FR-007, FR-004         |
| leaveGroup        | FR-008, FR-004         |
| transferOwnership | FR-008b                |
| renameGroup       | FR-012                 |
| deleteGroup       | FR-016                 |
| getGroupKey       | FR-002, FR-003, FR-005 |
| upgradeToGroup    | FR-009                 |

---

## Glossary (CHK070)

| Term                           | Definition                                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Owner**                      | The user who created the group OR received ownership via transfer. Has exclusive rights to remove members and delete the group. Stored as `role = 'owner'` in conversation_members.   |
| **Member**                     | Any user in a group conversation. Includes the owner. Has rights to view messages, send messages, and add connections. Stored as rows in conversation_members with `left_at IS NULL`. |
| **Pending Key**                | A membership state where key distribution failed. User is in the group but cannot decrypt new messages. Stored as `key_status = 'pending'`. Automatically retried on user online.     |
| **Key Version**                | A monotonically increasing integer tracking group key generations. Incremented on every key rotation. Used to determine message decryption eligibility.                               |
| **Key Rotation**               | The process of generating a new group key and distributing it to all active members. Triggered by member add/remove/leave.                                                            |
| **ECDH**                       | Elliptic Curve Diffie-Hellman. Key agreement protocol used to derive shared secrets between users for encrypting the group key.                                                       |
| **AES-GCM**                    | Advanced Encryption Standard in Galois/Counter Mode. Symmetric encryption algorithm used for encrypting messages and group keys. Provides confidentiality and authenticity.           |
| **IV (Initialization Vector)** | Random value used with AES-GCM to ensure identical plaintexts produce different ciphertexts. Must never be reused with the same key.                                                  |
