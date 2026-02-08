# Feature Specification: Group Chats

**Feature Number**: 011
**Category**: core-features
**Priority**: P2
**Status**: Draft
**Source**: Migrated from ScriptHammer specs/010

---

## Clarifications

### Session 2025-12-02

- Q: When the group owner leaves, what should happen to the group? → A: Prevent owner from leaving until they transfer ownership manually
- Q: What should happen when group key distribution fails for some members during key rotation? → A: Retry 3 times, then mark those members as "pending key" (can't decrypt new messages until resolved)
- Q: What should happen when all members except the owner leave/are removed? → A: Keep as group, owner can continue adding members

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Create Group Chat (Priority: P1)

A user wants to create a group conversation with multiple friends to discuss a topic together instead of sending individual messages.

**Why this priority**: Group creation is the foundational capability - without it, no other group features can exist.

**Independent Test**: Can be fully tested by creating a new group with 3+ members and verifying all members can see the group in their conversation list.

**Acceptance Scenarios**:

1. **Given** a logged-in user with 2+ connections, **When** they click "New Group" and select multiple connections, **Then** a group conversation is created and appears in all members' conversation lists
2. **Given** a user creating a group, **When** they optionally enter a group name, **Then** the group displays that name (or auto-generates from member names if empty)
3. **Given** a new group is created, **When** the owner sends the first message, **Then** all group members receive the encrypted message and can decrypt it

---

### User Story 2 - Send/Receive Group Messages (Priority: P1)

Users in a group want to send and receive encrypted messages that all group members can read.

**Why this priority**: Core messaging functionality - the primary purpose of group chats.

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

**Independent Test**: Can be tested by owner removing a member and verifying removed user loses access to future messages.

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

- What happens when the owner tries to leave the group? Owner must transfer ownership to another member before leaving
- How does system handle adding a member who is already in the group? Show error "User is already a member"
- What happens when a user tries to add someone they're not connected with? Require connection status first
- How does offline message queueing work for group messages? Queue message locally, sync when online using current group key
- What happens if a member's encryption keys are not available when adding? Retry 3 times, then mark as "pending key"
- How does the system handle 200-member group key distribution? Batch in groups of 50 with progress indicator
- What happens when all members except owner leave? Group persists with owner only; owner can continue adding new members

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST allow users to create group conversations with 2-200 members
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
- **FR-008a**: System MUST require owner to transfer ownership before leaving
- **FR-008b**: System MUST allow owner to transfer ownership to any other group member
- **FR-009**: System MUST support upgrading 1-to-1 conversations to groups while preserving history for original participants
- **FR-010**: System MUST display sender name and avatar for each group message
- **FR-011**: System MUST show group name, member count, and member list in group info
- **FR-012**: System MUST support optional custom group names; if not provided, auto-generate from member display names
- **FR-013**: System MUST display stacked avatars for groups in conversation list
- **FR-014**: System MUST show system messages for member join/leave events
- **FR-015**: System MUST support typing indicators for multiple concurrent typers
- **FR-016**: System MUST allow owner to delete entire group

### Key Entities

- **Group Conversation**: A conversation with `is_group = true`, containing a name, owner, current key version, and member count
- **Conversation Member**: Junction entity linking users to conversations with role (owner/member), join date, key version joined, and key status
- **Group Key**: Encrypted symmetric key for a conversation, stored per-member per-version
- **System Message**: Special message type for events like "User joined", "User left", "Group created"

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can create a group and send the first message within 30 seconds
- **SC-002**: Group key distribution for 200 members completes within 10 seconds
- **SC-003**: New members correctly see "[Message before you joined]" placeholder for pre-join messages
- **SC-004**: Key rotation on member change completes without message loss or decryption errors
- **SC-005**: 1-to-1 to group upgrade preserves 100% of original message history for original participants
- **SC-006**: Removed members cannot decrypt any messages sent after their removal
- **SC-007**: All group UI components pass WCAG 2.1 AA accessibility requirements
- **SC-008**: Group conversations display correctly on mobile (44px touch targets, responsive layout)

## Technical Specifications

### Encryption & Key Management

#### Symmetric Key Algorithm

- **Algorithm**: AES-GCM (Galois/Counter Mode)
- **Key Length**: 256 bits (32 bytes)
- **IV Length**: 96 bits (12 bytes) per message
- **Tag Length**: 128 bits (16 bytes) authentication tag

#### Key Generation

- **Entropy Source**: `crypto.getRandomValues()` via Web Crypto API
- **Algorithm**: `crypto.subtle.generateKey()` with `{ name: 'AES-GCM', length: 256 }`

#### ECDH Key Derivation for Group Key Encryption

1. Sender retrieves recipient's public ECDH key from `user_encryption_keys` table
2. Derive shared secret using sender's private key + recipient's public key
3. Derive encryption key from shared secret using HKDF with SHA-256
4. Encrypt group key with derived key
5. Store Base64-encoded (IV || ciphertext || authTag) in `group_keys.encrypted_key`

#### Key Rotation Triggers

Key rotation MUST occur when:

1. A new member is added to the group
2. A member is removed from the group (by owner)
3. A member leaves the group voluntarily

Key rotation MUST NOT occur when:

- Member updates preferences (mute, archive)
- Group is renamed
- Ownership is transferred

### History Restriction

#### Key Version Comparison Logic

```
canDecrypt(message, member) = message.key_version >= member.key_version_joined
```

- If `member.key_version_joined = 0`: Can decrypt ALL messages (original DM participants after upgrade)
- If `member.key_version_joined = N`: Can only decrypt messages with `key_version >= N`
- Pre-join messages display: "[Message before you joined]"

### Member Management

#### 200-Member Limit Enforcement

1. **Service layer**: Check current member count + new members ≤ 200
2. **Database**: CHECK constraint on conversation_members count
3. **UI**: "Add Members" button disabled when at capacity

#### Ownership Transfer Atomicity

Ownership transfer uses a database transaction to prevent dual owners or no owner states.

### UX & UI Specifications

#### Avatar Stack Display

- Show first **3 member avatars** overlapping (16px offset each)
- If >3 members: Show 2 avatars + "+N" badge
- Avatar size: 32px in conversation list, 24px in compact views

#### Auto-Generated Group Name

- **≤3 members**: "Alice, Bob, Carol" (comma-separated display names)
- **>3 members**: "Alice, Bob +5 others"
- **Fallback**: "Group Chat" if names unavailable

#### System Message Display Formats

| Type                    | Format                                       | Example                                     |
| ----------------------- | -------------------------------------------- | ------------------------------------------- |
| `member_joined`         | "{actor} added {target}"                     | "Alice added Bob"                           |
| `member_left`           | "{actor} left"                               | "Carol left"                                |
| `member_removed`        | "{actor} removed {target}"                   | "Alice removed Dave"                        |
| `group_created`         | "{actor} created the group"                  | "Alice created the group"                   |
| `group_renamed`         | "{actor} renamed the group to "{new_value}"" | "Alice renamed the group to "Project Team"" |
| `ownership_transferred` | "{actor} made {target} the group owner"      | "Alice made Bob the group owner"            |

### Accessibility

All new components must pass:

- Color contrast: 4.5:1 for normal text, 3:1 for large text
- Focus indicators: Visible focus ring on all interactive elements
- Text resizing: Functional at 200% zoom
- Motion: Respect `prefers-reduced-motion`
- 44px minimum touch targets for mobile
