# Feature Specification: Group Chats

**Feature Branch**: `011-group-chats`
**Created**: 2025-12-30
**Status**: Draft
**Input**: User description: "A group chat feature enabling users to create and manage multi-member conversations with end-to-end encryption, member management, key rotation for security, and seamless upgrade from 1-to-1 conversations."

## Clarifications

### Session 2025-12-02

- Q: When the group owner leaves, what should happen to the group? → A: Prevent owner from leaving until they transfer ownership manually
- Q: What should happen when group key distribution fails for some members during key rotation? → A: Retry 3 times, then mark those members as "pending key" (can't decrypt new messages until resolved)
- Q: What should happen when all members except the owner leave/are removed? → A: Keep as group, owner can continue adding members

---

## User Scenarios & Testing _(mandatory)_

<!-- User stories reordered per UX_FLOW_ORDER.md (2026-01-16):
     Follows UX discovery pattern: Create → See Identity → Message → Manage -->

### User Story 1 - Create Group Chat (Priority: P1) [UX: Entry Point]

As a user, I need to create a group conversation with multiple friends so that we can discuss topics together instead of sending individual messages.

**Why this priority**: Group creation is the foundational capability - without it, no other group features can exist.

**Independent Test**: Can be tested by creating a new group with 3+ members and verifying all members can see the group in their conversation list.

**Acceptance Scenarios**:

1. **Given** a logged-in user with 2+ connections, **When** they click "New Group" and select multiple connections, **Then** a group conversation is created and appears in all members' conversation lists
2. **Given** a user creating a group, **When** they optionally enter a group name, **Then** the group displays that name (or auto-generates from member names if empty)
3. **Given** a new group is created, **When** the owner sends the first message, **Then** all group members receive the encrypted message and can decrypt it

---

### User Story 2 - Add Members to Group (Priority: P2) [UX: Group Identity]

As a group member, I need to invite additional users to join the conversation so that the group can grow organically.

**Why this priority**: Enables organic group growth. Important for usability but not required for basic group function.

**Independent Test**: Can be tested by having an existing member add a new user and verifying the new user appears in member list and can send/receive messages.

**Acceptance Scenarios**:

1. **Given** a group member, **When** they click "Add Members" and select a connection, **Then** the connection is added to the group
2. **Given** a newly added member, **When** they open the group conversation, **Then** they can only see messages sent after their join date (no pre-join history)
3. **Given** a member is added, **When** the group key rotates, **Then** the new member receives the new key and existing members' keys are updated

---

### User Story 3 - Send/Receive Group Messages (Priority: P1) [UX: Core Function]

As a user in a group, I need to send and receive encrypted messages that all group members can read.

**Why this priority**: Core messaging functionality - the primary purpose of group chats.

**Independent Test**: Can be tested by having 3 users in a group where each sends a message and all members can read all messages with correct sender attribution.

**Acceptance Scenarios**:

1. **Given** a user in a group chat, **When** they send a message, **Then** all group members receive and can decrypt the message
2. **Given** a group conversation, **When** viewing messages, **Then** each message displays the sender's name and avatar
3. **Given** a group with active members, **When** multiple users type simultaneously, **Then** typing indicators show all currently typing members

---

### User Story 4 - Upgrade 1-to-1 to Group (Priority: P2)

As a user in a direct message conversation, I need to add more people to create a group discussion without losing our message history.

**Why this priority**: Natural evolution of conversations. Users shouldn't have to start fresh when they want to include others.

**Independent Test**: Can be tested by taking an existing DM with message history, adding a third person, and verifying original participants retain history access while new member cannot see old messages.

**Acceptance Scenarios**:

1. **Given** an existing 1-to-1 conversation, **When** either participant clicks "Add People", **Then** the conversation converts to a group
2. **Given** a converted group, **When** the original two participants view history, **Then** they can still read their original DM messages
3. **Given** a new member added during upgrade, **When** they view the group, **Then** they cannot see messages from before their join date

---

### User Story 5 - Remove Member / Leave Group (Priority: P2)

As a group owner, I need to remove problematic members, and as any member, I need the ability to leave groups.

**Why this priority**: Essential for group management and user control, but secondary to creation and messaging.

**Independent Test**: Can be tested by owner removing a member and verifying removed user loses access to future messages.

**Acceptance Scenarios**:

1. **Given** the group owner, **When** they select a member and click "Remove", **Then** the member is removed and cannot access future messages
2. **Given** a group member (non-owner), **When** they click "Leave Group", **Then** they are removed and the group continues for remaining members
3. **Given** a member is removed, **When** the group key rotates, **Then** the removed member cannot decrypt messages sent after removal

---

### User Story 6 - View Group Info and Members (Priority: P3)

As a group member, I need to see who is in the group and view group metadata.

**Why this priority**: Important for UX but not critical for core functionality.

**Independent Test**: Can be tested by opening group info panel and verifying all members are listed with correct roles.

**Acceptance Scenarios**:

1. **Given** a group conversation, **When** a member clicks the group header or info button, **Then** a panel shows group name, member count, and member list
2. **Given** the group info panel, **When** viewing members, **Then** the owner is clearly indicated and all members show their display names and avatars

---

### Edge Cases

- What happens when the owner tries to leave the group?
  - Owner must transfer ownership to another member before leaving

- How does system handle adding a member who is already in the group?
  - Show error "User is already a member"

- What happens when a user tries to add someone they're not connected with?
  - Require connection status first

- How does offline message queueing work for group messages?
  - Queue message locally, sync when online using current group key

- What happens if a member's encryption keys are not available when adding?
  - Retry distribution, then mark as "pending key" status

- How does the system handle large group key distribution?
  - Batch distribution with progress indicator

- What happens when all members except owner leave?
  - Group persists with owner only; owner can continue adding new members

---

## Requirements _(mandatory)_

### Functional Requirements

**Group Creation & Structure**

- **FR-001**: System MUST allow users to create group conversations with 2-200 members
- **FR-002**: System MUST encrypt all group messages using symmetric encryption
- **FR-003**: System MUST use a symmetric group key encrypted individually for each member
- **FR-004**: System MUST rotate the group key when members are added or removed
- **FR-005**: System MUST track key versions so new members cannot decrypt pre-join messages

**Key Distribution & Recovery**

- **FR-006**: System MUST retry failed key distribution before marking member as "pending key"
- **FR-007**: Members with "pending key" status MUST NOT be able to decrypt new messages until resolved
- **FR-008**: System MUST automatically retry key distribution for "pending key" members when they come online

**Member Management**

- **FR-009**: System MUST allow any group member to add new members (who are their connections)
- **FR-010**: System MUST restrict member removal to the group owner only
- **FR-011**: System MUST allow any non-owner member to leave the group voluntarily
- **FR-012**: System MUST require owner to transfer ownership before leaving
- **FR-013**: System MUST allow owner to transfer ownership to any other group member
- **FR-014**: System MUST allow owner to delete entire group

**Conversation Features**

- **FR-015**: System MUST support upgrading 1-to-1 conversations to groups while preserving history for original participants
- **FR-016**: System MUST display sender name and avatar for each group message
- **FR-017**: System MUST show group name, member count, and member list in group info
- **FR-018**: System MUST support optional custom group names; auto-generate from member names if not provided
- **FR-019**: System MUST display stacked avatars for groups in conversation list
- **FR-020**: System MUST show system messages for member join/leave events
- **FR-021**: System MUST support typing indicators for multiple concurrent typers

**History Restriction**

- **FR-022**: New members MUST only see messages sent after their join date
- **FR-023**: Pre-join messages MUST display placeholder text like "[Message before you joined]"
- **FR-024**: Original DM participants MUST retain access to full history after group upgrade

**Accessibility**

- **FR-025**: All group UI components MUST meet contrast requirements
- **FR-026**: All interactive elements MUST have visible focus indicators
- **FR-027**: UI MUST remain functional at 200% zoom
- **FR-028**: UI MUST respect reduced motion preferences
- **FR-029**: All touch targets MUST meet minimum size requirements for mobile

### Key Entities

- **Group Conversation**: A conversation with group flag, containing name, owner, current key version, and member count

- **Conversation Member**: Junction entity linking users to conversations with role (owner/member), join date, key version at join, and key status

- **Group Key**: Encrypted symmetric key for a conversation, stored per-member per-version

- **System Message**: Special message type for events like "User joined", "User left", "Group created", "Ownership transferred"

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can create a group and send the first message within 30 seconds
- **SC-002**: Key distribution for large groups completes within reasonable time
- **SC-003**: New members correctly see placeholder text for pre-join messages
- **SC-004**: Key rotation on member change completes without message loss or decryption errors
- **SC-005**: 1-to-1 to group upgrade preserves 100% of original message history for original participants
- **SC-006**: Removed members cannot decrypt any messages sent after their removal
- **SC-007**: All group UI components pass accessibility requirements
- **SC-008**: Group conversations display correctly on mobile with appropriate touch targets

---

## Constraints _(optional)_

- Maximum 200 members per group
- No voice/video calls in groups
- No message reactions in groups
- No pinned messages
- No group admin roles (only owner and member)
- No message threading/replies

---

## Dependencies _(optional)_

- Requires user messaging system (009) for core messaging infrastructure
- Requires user authentication (003) for user identity
- Requires RLS policies (000) for secure data access

---

## Assumptions _(optional)_

- Users have existing connections before creating groups
- All group members have compatible encryption capabilities
- Group owner remains responsible for group management
- Single-device encryption (keys don't sync across devices)
