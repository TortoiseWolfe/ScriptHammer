# Tasks: Group Chats

**Input**: Design documents from `/specs/010-group-chats/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml

**Tests**: Included per Constitution Principle II (Test-First Development)

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1-US6, or Setup/Foundation/Polish)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and type definitions

- [ ] T001 [P] [Setup] Add group-related TypeScript types to `src/types/messaging.ts` (GroupConversation, DirectConversation, ConversationMember, GroupKey, SystemMessageType, SystemMessageData, CreateGroupInput, AddMembersInput)
- [ ] T002 [P] [Setup] Create `src/services/messaging/group-service.ts` with empty service class skeleton
- [ ] T003 [P] [Setup] Create `src/services/messaging/group-key-service.ts` with empty service class skeleton
- [ ] T004 [P] [Setup] Create test file `tests/unit/services/messaging/group-service.test.ts` with describe block
- [ ] T005 [P] [Setup] Create test file `tests/unit/services/messaging/group-key-service.test.ts` with describe block

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and core encryption infrastructure - MUST complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Schema

- [ ] T006 [Foundation] Add group columns to conversations table in `supabase/migrations/20251006_complete_monolithic_setup.sql`: is_group, group_name, created_by, current_key_version
- [ ] T007 [Foundation] Add key_version column to messages table in same migration file (depends on T006)
- [ ] T008 [Foundation] Add system message columns to messages table: is_system_message, system_message_type (depends on T007)
- [ ] T009 [Foundation] Create conversation_members table with all fields per data-model.md (depends on T006)
- [ ] T010 [Foundation] Create group_keys table with all fields per data-model.md (depends on T006)
- [ ] T011 [Foundation] Add indexes for conversation_members and group_keys tables (depends on T009, T010)
- [ ] T012 [Foundation] Enable RLS on conversation_members and group_keys tables (depends on T009, T010)
- [ ] T013 [Foundation] Create RLS policies for conversation_members per data-model.md L258-L294: SELECT (members can view other members), INSERT (members can add OR self-join), UPDATE (own preferences OR owner can update others) (depends on T012)
- [ ] T014 [Foundation] Create RLS policies for group_keys per data-model.md L298-L313: SELECT (users can only view their own keys), INSERT (members can distribute keys) (depends on T012)
- [ ] T014a [Foundation] Update messages table RLS policy to check group membership via conversation_members junction table for is_group=true conversations (depends on T012)

### Core Encryption Infrastructure

- [ ] T015 [P] [Foundation] Write unit tests for group key generation in `tests/unit/services/messaging/group-key-service.test.ts`: generateGroupKey(), encryptGroupKeyForMember()
- [ ] T016 [Foundation] Implement generateGroupKey() in `src/services/messaging/group-key-service.ts`: generate AES-GCM-256 symmetric key using Web Crypto API (depends on T015)
- [ ] T017 [Foundation] Implement encryptGroupKeyForMember() in same file: ECDH shared secret derivation + AES-GCM encryption of group key (depends on T016)
- [ ] T018 [Foundation] Implement decryptGroupKey() in same file: decrypt member's encrypted group key copy (depends on T017)
- [ ] T019 [Foundation] Implement getGroupKeyForConversation() in same file: fetch and cache decrypted group key (depends on T018)
- [ ] T020 [Foundation] Add group key caching mechanism to prevent repeated decryption (depends on T019)

**Checkpoint**: Foundation ready - database schema deployed, encryption infrastructure tested

---

## Phase 3: User Story 1 - Create Group Chat (Priority: P1) 🎯 MVP

**Goal**: Users can create encrypted group conversations with 2-200 members

**Independent Test**: Create group with 3 members, verify all see group in conversation list, owner can send first encrypted message

### Tests for User Story 1

- [ ] T021 [P] [US1] Write integration test for createGroup() in `tests/integration/messaging/group-creation.test.ts`: valid creation, member limit, connection requirement
- [ ] T022 [P] [US1] Write unit tests for GroupService.createGroup() in `tests/unit/services/messaging/group-service.test.ts`

### Implementation for User Story 1

- [ ] T023 [US1] Implement createGroup() in `src/services/messaging/group-service.ts`: validate members, create conversation with is_group=true, add conversation_members entries (depends on T022)
- [ ] T024 [US1] Implement distributeGroupKey() in `src/services/messaging/group-key-service.ts`: generate key, encrypt for each member, store in group_keys (depends on T023)
- [ ] T025 [US1] Integrate key distribution into createGroup() flow (depends on T024)
- [ ] T026 [P] [US1] Create CreateGroupModal component using generator: `docker compose exec scripthammer pnpm run generate:component` - organisms/CreateGroupModal
- [ ] T027 [P] [US1] Create useGroupMembers hook in `src/hooks/useGroupMembers.ts` for member search/selection
- [ ] T028 [US1] Implement CreateGroupModal UI: member search, selection chips, name input, create button; include auto-name generation from first 3 member display names per FR-012 (depends on T026, T027)
- [ ] T029 [US1] Add "New Group" button to UnifiedSidebar in `src/components/organisms/UnifiedSidebar/UnifiedSidebar.tsx`
- [ ] T030 [US1] Wire CreateGroupModal to messages page in `src/app/messages/page.tsx` (depends on T028, T029)
- [ ] T031 [US1] Update useConversationList hook in `src/components/organisms/ConversationList/useConversationList.ts` to fetch groups (is_group=true) and populate members

**Checkpoint**: User Story 1 complete - users can create groups, verify with 3-member group test

---

## Phase 4: User Story 2 - Send/Receive Group Messages (Priority: P1)

**Goal**: Users can send and receive E2E encrypted messages in groups

**Independent Test**: 3 users in group, each sends message, all can read all messages with correct sender attribution

### Tests for User Story 2

- [ ] T032 [P] [US2] Write unit tests for group message encryption in `tests/unit/services/messaging/message-service.test.ts`: encryptWithGroupKey(), decryptWithGroupKey()
- [ ] T033 [P] [US2] Write integration test for group messaging in `tests/integration/messaging/group-messaging.test.ts`

### Implementation for User Story 2

- [ ] T034 [US2] Modify sendMessage() in `src/services/messaging/message-service.ts` to detect is_group and use group key path (depends on T032)
- [ ] T035 [US2] Implement group message encryption: fetch group key, encrypt with AES-GCM, store with key_version (depends on T034)
- [ ] T036 [US2] Modify getMessageHistory() in same file to decrypt group messages using appropriate key version (depends on T035)
- [ ] T037 [US2] Implement key_version_joined check: show "[Message before you joined]" placeholder text per SC-003 for pre-join messages (depends on T036)
- [ ] T038 [US2] Update useConversationRealtime hook in `src/hooks/useConversationRealtime.ts` to handle group message decryption
- [ ] T039 [US2] Modify MessageBubble in `src/components/atomic/MessageBubble/MessageBubble.tsx` to show sender avatar for group messages
- [ ] T040 [US2] Modify ChatWindow in `src/components/organisms/ChatWindow/ChatWindow.tsx` to detect group and show multiple typing indicators (up to 3 names, then "X others are typing" per FR-015); update useConversationRealtime to track multiple typers

**Checkpoint**: User Story 2 complete - encrypted group messaging works, history restriction verified

---

## Phase 5: User Story 3 - Add Members to Group (Priority: P2)

**Goal**: Any member can add their connections to the group with key rotation

**Independent Test**: Existing member adds new user, new user appears in list and can send/receive (but not see old messages)

### Tests for User Story 3

- [ ] T041 [P] [US3] Write unit tests for addMembers() in `tests/unit/services/messaging/group-service.test.ts`: validation, key rotation trigger
- [ ] T042 [P] [US3] Write integration test for adding members in `tests/integration/messaging/group-members.test.ts`

### Implementation for User Story 3

- [ ] T043 [US3] Implement addMembers() in `src/services/messaging/group-service.ts`: validate connections, add to conversation_members (depends on T041)
- [ ] T044 [US3] Implement rotateGroupKey() in `src/services/messaging/group-key-service.ts`: generate new key version, distribute to all current members (depends on T043)
- [ ] T045 [US3] Integrate key rotation into addMembers() flow, set key_version_joined for new members (depends on T044)
- [ ] T046 [US3] Implement retry logic for failed key distribution: 3 retries, then mark as "pending" status (depends on T045)
- [ ] T047 [P] [US3] Create AddMemberModal component using generator: molecular/AddMemberModal
- [ ] T048 [US3] Implement AddMemberModal UI: search connections, multi-select, add button (depends on T047)
- [ ] T049 [US3] Create system message for member_joined event in `src/services/messaging/message-service.ts`
- [ ] T050 [P] [US3] Create SystemMessage component using generator: atomic/SystemMessage
- [ ] T051 [US3] Render system messages in MessageThread (depends on T049, T050)

**Checkpoint**: User Story 3 complete - adding members works with key rotation, history restriction verified

---

## Phase 6: User Story 4 - Upgrade 1-to-1 to Group (Priority: P2)

**Goal**: Convert existing DM to group while preserving history for original participants

**Independent Test**: Take DM with message history, add third person, originals retain history, new member cannot see old messages

### Tests for User Story 4

- [ ] T052 [P] [US4] Write unit tests for upgradeToGroup() in `tests/unit/services/messaging/group-service.test.ts`
- [ ] T053 [P] [US4] Write integration test for DM upgrade in `tests/integration/messaging/group-upgrade.test.ts`

### Implementation for User Story 4

- [ ] T054 [US4] Implement upgradeToGroup() in `src/services/messaging/group-service.ts`: set is_group=true, create conversation_members with key_version_joined=0 for originals (depends on T052)
- [ ] T055 [US4] Generate first group key (version 1), distribute to all including new members with key_version_joined=1 (depends on T054)
- [ ] T056 [US4] Add "Add People" button to ChatWindow header for 1-to-1 conversations only (depends on T055)
- [ ] T057 [US4] Wire upgrade flow to AddMemberModal with pre-selected original participants (depends on T048, T056)

**Checkpoint**: User Story 4 complete - DM upgrade preserves history, new members restricted

---

## Phase 7: User Story 5 - Remove Member / Leave Group (Priority: P2)

**Goal**: Owner can remove members, any member can leave (except owner without transfer)

**Independent Test**: Owner removes member → removed user loses future access; Non-owner leaves → group continues

### Tests for User Story 5

- [ ] T058 [P] [US5] Write unit tests for removeMember(), leaveGroup(), transferOwnership() in `tests/unit/services/messaging/group-service.test.ts`
- [ ] T059 [P] [US5] Write integration test for member removal in `tests/integration/messaging/group-removal.test.ts`

### Implementation for User Story 5

- [ ] T060 [US5] Implement removeMember() in `src/services/messaging/group-service.ts`: owner-only check, set left_at, trigger key rotation (depends on T058)
- [ ] T061 [US5] Implement leaveGroup() in same file: non-owner check, set left_at, trigger key rotation (depends on T060)
- [ ] T062 [US5] Implement transferOwnership() in same file: owner-only, update roles atomically (depends on T061)
- [ ] T063 [US5] Key rotation on removal: generate new key, distribute to remaining members only (depends on T060, T061)
- [ ] T064 [US5] Create system messages for member_left, member_removed, ownership_transferred (depends on T063)
- [ ] T065 [US5] Add "Leave Group" button to GroupInfoPanel (disabled for owner until transfer) (depends on T062)
- [ ] T066 [US5] Add "Remove" option to member list context menu (owner only) (depends on T060)
- [ ] T067 [US5] Add "Transfer Ownership" option to member list for owner (depends on T062)

**Checkpoint**: User Story 5 complete - removal/leaving works with key rotation, owner transfer required

---

## Phase 8: User Story 6 - View Group Info and Members (Priority: P3)

**Goal**: Users can view group metadata and member list with roles

**Independent Test**: Open group info panel, verify all members listed with owner indicated

### Tests for User Story 6

- [ ] T068 [P] [US6] Write component tests for GroupInfoPanel in `src/components/molecular/GroupInfoPanel/GroupInfoPanel.test.tsx`
- [ ] T069 [P] [US6] Write component tests for GroupMemberList in `src/components/molecular/GroupMemberList/GroupMemberList.test.tsx`

### Implementation for User Story 6

- [ ] T070 [P] [US6] Create GroupInfoPanel component using generator: molecular/GroupInfoPanel
- [ ] T071 [P] [US6] Create GroupMemberList component using generator: molecular/GroupMemberList
- [ ] T072 [P] [US6] Create GroupChatHeader component using generator: molecular/GroupChatHeader
- [ ] T073 [P] [US6] Create AvatarStack component using generator: atomic/AvatarStack
- [ ] T074 [US6] Implement GroupInfoPanel UI: group name, member count, member list, action buttons (depends on T070, T071)
- [ ] T075 [US6] Implement GroupMemberList: scrollable list with role badges, action menus (depends on T071)
- [ ] T076 [US6] Implement GroupChatHeader: avatar stack, group name, member count, info button (depends on T072, T073)
- [ ] T077 [US6] Implement AvatarStack: 2-3 overlapping avatars with "+N" indicator (depends on T073)
- [ ] T078 [US6] Modify ConversationListItem in `src/components/molecular/ConversationListItem/ConversationListItem.tsx` to show AvatarStack for groups (depends on T077)
- [ ] T079 [US6] Integrate GroupChatHeader into ChatWindow for group conversations (depends on T076)
- [ ] T080 [US6] Wire GroupInfoPanel as slide-in panel from ChatWindow header (depends on T074, T079)

**Checkpoint**: User Story 6 complete - group info panel works with all metadata displayed

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple user stories

- [ ] T081 [P] [Polish] Add accessibility tests for all new components using jest-axe: AvatarStack, SystemMessage, GroupChatHeader, GroupInfoPanel, GroupMemberList, AddMemberModal, CreateGroupModal (7 components for SC-007 WCAG 2.1 AA compliance)
- [ ] T082 [P] [Polish] Add Storybook stories for AvatarStack, SystemMessage, GroupChatHeader, GroupInfoPanel, GroupMemberList
- [ ] T083 [P] [Polish] Add E2E test for complete group workflow in `tests/e2e/messaging/group-chat.spec.ts`
- [ ] T084 [Polish] Update existing conversation queries to handle both is_group=true and is_group=false
- [ ] T085 [Polish] Add progress indicator for 200-member key distribution showing "Distributing keys: X/200" with 50-member batches per SC-002
- [ ] T086 [Polish] Implement auto-retry for "pending key" members when they come online; include offline message queueing for groups using IndexedDB
- [ ] T087 [Polish] Add mobile responsive testing for all new group components (44px touch targets per SC-008)
- [ ] T088 [Polish] Run quickstart.md validation scenarios
- [ ] T089 [Polish] Update CLAUDE.md with group chat architecture notes
- [ ] T090 [P] [Polish] Add performance test for SC-001: measure group creation + first message time (target: <30s)
- [ ] T091 [P] [Polish] Add performance test for SC-002: measure 200-member key distribution time (target: <10s)
- [ ] T092 [Polish] Implement group deletion (FR-016): owner can delete entire group, archive conversation for all members
- [ ] T093 [Polish] Implement group rename functionality with renameGroup() service method and UI in GroupInfoPanel

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - MVP delivery point
- **User Story 2 (Phase 4)**: Depends on Foundational, shares components with US1
- **User Story 3-6 (Phases 5-8)**: Depend on Foundational, can proceed in priority order
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Create Group)**: Foundation only - can start immediately after Phase 2
- **US2 (Send/Receive)**: Foundation only - can start in parallel with US1
- **US3 (Add Members)**: Uses UI from US1 (CreateGroupModal pattern) - recommended after US1
- **US4 (Upgrade DM)**: Uses addMembers logic from US3 - recommended after US3
- **US5 (Remove/Leave)**: Uses GroupInfoPanel from US6 - can start in parallel
- **US6 (View Info)**: Foundation only - can start in parallel with US1/US2

### Within Each User Story

1. Tests MUST be written and FAIL before implementation
2. Service layer before UI components
3. Core logic before integration
4. Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**: All T001-T005 can run in parallel

**Phase 2 (Foundation)**:

- T015 can start in parallel with database tasks
- T006-T014 are mostly sequential (migration file order)

**Phase 3-8 (User Stories)**:

- Test tasks marked [P] within each story can run in parallel
- Component generation tasks marked [P] can run in parallel
- Different user stories CAN be worked on in parallel by different developers

---

## Parallel Example: Phase 3 (User Story 1)

```bash
# Launch all tests for User Story 1 together:
Task: "Write integration test for createGroup() in tests/integration/messaging/group-creation.test.ts"
Task: "Write unit tests for GroupService.createGroup() in tests/unit/services/messaging/group-service.test.ts"

# After tests pass, launch component generation in parallel:
Task: "Create CreateGroupModal component using generator"
Task: "Create useGroupMembers hook in src/hooks/useGroupMembers.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Create Group)
4. Complete Phase 4: User Story 2 (Send/Receive)
5. **STOP and VALIDATE**: Test group creation + messaging independently
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Create Group) → Test → Deploy (Groups exist!)
3. Add US2 (Send/Receive) → Test → Deploy (Groups work!)
4. Add US3 (Add Members) → Test → Deploy (Groups grow!)
5. Add US4-6 → Polish → Full feature complete

### Parallel Team Strategy

With 2+ developers after Foundational:

- Developer A: User Story 1 → User Story 3 → User Story 5
- Developer B: User Story 2 → User Story 4 → User Story 6
- Integrate at checkpoints

---

## Summary

| Phase             | Tasks                  | Story                 |
| ----------------- | ---------------------- | --------------------- |
| Setup             | T001-T005 (5)          | Infrastructure        |
| Foundational      | T006-T020 + T014a (16) | Database + Encryption |
| US1: Create Group | T021-T031 (11)         | P1 MVP                |
| US2: Send/Receive | T032-T040 (9)          | P1                    |
| US3: Add Members  | T041-T051 (11)         | P2                    |
| US4: Upgrade DM   | T052-T057 (6)          | P2                    |
| US5: Remove/Leave | T058-T067 (10)         | P2                    |
| US6: View Info    | T068-T080 (13)         | P3                    |
| Polish            | T081-T093 (13)         | Cross-cutting         |

**Total Tasks**: 94
**MVP Scope**: Phases 1-4 (US1 + US2) = 40 tasks
**Parallel Opportunities**: 35+ tasks marked [P]
