# Feature: Group Service Implementation

**Feature ID**: 043
**Category**: core-features
**Source**: ScriptHammer README (SPEC-049)
**Status**: Ready for SpecKit
**Depends on**: 009-user-messaging-system

## Description

Complete 8 unimplemented methods in `src/services/messaging/group-service.ts`: addMembers (T043), getMembers (T074), removeMember (T060), leaveGroup (T061), transferOwnership (T062), upgradeToGroup (T054), renameGroup (T093), deleteGroup (T092).

**Note**: This feature was incorrectly categorized under "payments" - it belongs in "core-features" as it extends the messaging system. The folder should be moved to `features/core-features/043-group-service/`.

## User Scenarios

### US-1: Add Members (P1)

Group owners can add new members to conversations.

**Acceptance Criteria**:

1. Given owner, when adding members, then members added successfully
2. Given non-owner, when attempting add, then operation denied
3. Given invalid user, when adding, then error returned
4. Given successful add, when complete, then members notified

### US-2: Remove/Leave Group (P1)

Members can be removed or choose to leave groups.

**Acceptance Criteria**:

1. Given owner, when removing member, then member removed
2. Given member, when leaving, then membership ended
3. Given owner leaving, when only owner, then must transfer first
4. Given removal, when complete, then removed user notified

### US-3: Group Management (P2)

Owners can manage group properties and ownership.

**Acceptance Criteria**:

1. Given owner, when renaming group, then name updated
2. Given owner, when transferring ownership, then new owner set
3. Given ownership transfer, when complete, then both users notified
4. Given owner, when deleting group, then group archived

### US-4: Upgrade to Group (P2)

Direct conversations can be upgraded to group chats.

**Acceptance Criteria**:

1. Given DM conversation, when upgrade requested, then converted to group
2. Given upgrade, when adding third user, then group created
3. Given upgraded group, when viewing, then all history preserved
4. Given upgrade, when complete, then participants notified

## Requirements

### Functional

**addMembers (T043)**

- FR-001: Validate owner permissions
- FR-002: Validate user IDs exist
- FR-003: Add users to conversation_members
- FR-004: Create group keys for new members
- FR-005: Send join notifications

**getMembers (T074)**

- FR-006: Return all conversation members
- FR-007: Include member roles (owner, admin, member)
- FR-008: Include join timestamps
- FR-009: Validate requester is member

**removeMember (T060)**

- FR-010: Validate owner/admin permissions
- FR-011: Prevent owner self-removal
- FR-012: Remove from conversation_members
- FR-013: Revoke group key access
- FR-014: Send removal notification

**leaveGroup (T061)**

- FR-015: Allow any member to leave
- FR-016: Require ownership transfer if owner leaving
- FR-017: Update conversation_members
- FR-018: Clean up member's key access

**transferOwnership (T062)**

- FR-019: Validate current owner
- FR-020: Validate new owner is member
- FR-021: Update owner_id in conversations
- FR-022: Notify both users of transfer

**upgradeToGroup (T054)**

- FR-023: Convert DM to group conversation
- FR-024: Set conversation type to 'group'
- FR-025: Preserve message history
- FR-026: Initialize group metadata

**renameGroup (T093)**

- FR-027: Validate owner permissions
- FR-028: Update conversation name
- FR-029: Validate name length/content
- FR-030: Notify members of rename

**deleteGroup (T092)**

- FR-031: Validate owner permissions
- FR-032: Soft delete conversation
- FR-033: Archive messages
- FR-034: Notify all members
- FR-035: Clean up group keys

### Non-Functional

**Security**

- NFR-001: All operations require authentication
- NFR-002: Permission checks before all mutations
- NFR-003: Group keys properly rotated on member changes

**Performance**

- NFR-004: Member operations < 500ms
- NFR-005: Batch notifications for bulk operations

**Data Integrity**

- NFR-006: Transactions for multi-table operations
- NFR-007: Audit logging for all operations

### Service Interface

```typescript
// src/services/messaging/group-service.ts

interface GroupService {
  addMembers(conversationId: string, userIds: string[]): Promise<void>;
  getMembers(conversationId: string): Promise<Member[]>;
  removeMember(conversationId: string, userId: string): Promise<void>;
  leaveGroup(conversationId: string): Promise<void>;
  transferOwnership(conversationId: string, newOwnerId: string): Promise<void>;
  upgradeToGroup(conversationId: string, name?: string): Promise<void>;
  renameGroup(conversationId: string, name: string): Promise<void>;
  deleteGroup(conversationId: string): Promise<void>;
}

interface Member {
  userId: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
}
```

### Test Files

```
tests/unit/services/messaging/
├── group-service.test.ts
└── group-service.integration.test.ts
```

### Out of Scope

- Group chat UI components (separate feature)
- Admin role management
- Group settings (beyond name)
- Message permissions within groups

## Success Criteria

- SC-001: All 8 methods implemented and functional
- SC-002: Permission checks enforced
- SC-003: Notifications sent for all operations
- SC-004: Group keys managed correctly
- SC-005: 100% test coverage for group-service.ts
- SC-006: No TODO comments remain
