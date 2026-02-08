# Wireframe Plan: 011-group-chats

**Feature**: Group Chats
**Planned By**: Planner Terminal
**Date**: 2026-01-14
**Status**: Ready for Generation

## Screen Analysis

Based on spec review, this feature requires the following key screens:

### User Story Coverage

| User Story                 | Priority | Required Screens               |
| -------------------------- | -------- | ------------------------------ |
| US1: Create Group Chat     | P1       | Create Group Modal             |
| US2: Send/Receive Messages | P1       | Group Conversation View        |
| US3: Add Members           | P2       | Add Members Modal              |
| US4: Upgrade 1-to-1        | P2       | Upgrade Flow (in conversation) |
| US5: Remove/Leave          | P2       | Group Info Panel               |
| US6: View Group Info       | P3       | Group Info Panel               |

### Screen Consolidation

| Consolidated SVG            | Included Views                                      | Rationale                          |
| --------------------------- | --------------------------------------------------- | ---------------------------------- |
| `01-group-conversation.svg` | Message list, sender attribution, typing indicators | Core messaging experience          |
| `02-group-management.svg`   | Create group modal, Add members modal, Upgrade flow | Related modal patterns             |
| `03-group-info-panel.svg`   | Member list, owner actions, leave/transfer          | Side panel with management actions |

---

## Wireframe Assignments

### SVG 1: Group Conversation View

**File**: `01-group-conversation.svg`
**Assigned To**: Generator-1
**Priority**: P1

**Desktop View (1280x720)**:

- Conversation header with stacked avatars + group name
- Message list with sender name/avatar per message
- Distinct styling for own messages vs others
- Typing indicator: "Alice, Bob are typing..."
- System messages (join/leave events) styled distinctly
- Pre-join message placeholder: "[Message before you joined]"
- Message input with encryption indicator

**Mobile View (360x720)**:

- Compact header with group name + member count
- Full-width messages with sender info
- Typing indicator above input
- Pull-to-load-more gesture hint

**Callout Requirements**:

1. Stacked avatar group indicator in header
2. Message with sender attribution (name + avatar)
3. Multi-user typing indicator
4. System message styling (member joined/left)
5. Pre-join message placeholder
6. Encryption status indicator

---

### SVG 2: Group Management Modals

**File**: `02-group-management.svg`
**Assigned To**: Generator-2
**Priority**: P2

**Desktop View (1280x720)**:
Show three modal states overlaid or side-by-side:

**Create Group Modal**:

- Title: "Create Group"
- Group name input (optional, placeholder shows auto-generated)
- Connection list with checkboxes (multi-select)
- Selected count indicator: "3 members selected"
- Create button (primary)

**Add Members Modal**:

- Title: "Add Members"
- Search/filter input
- Connection list with checkboxes
- Already-in-group members shown as disabled
- Add button with count

**Upgrade Flow (contextual)**:

- "Add People" option in 1-to-1 conversation menu
- Same modal as Add Members with upgrade confirmation

**Mobile View (360x720)**:

- Full-screen modal pattern
- Searchable scrolling list
- Floating action button for confirm

**Callout Requirements**:

1. Create group modal with optional name input
2. Multi-select connection list
3. Selected member count badge
4. Add members search field
5. Already-member disabled state
6. Upgrade confirmation message

---

### SVG 3: Group Info Panel

**File**: `03-group-info-panel.svg`
**Assigned To**: Generator-3
**Priority**: P2

**Desktop View (1280x720)**:

- Right-side panel (350px width) sliding over conversation
- Group avatar (stacked) at top
- Editable group name (for owner)
- Member count: "5 members"
- Member list with avatars
- Owner badge indicator next to owner
- Action menu per member (owner only): Remove
- Leave Group button (for non-owners)
- Transfer Ownership option (owner only, in settings)
- Delete Group option (owner only, destructive)

**Mobile View (360x720)**:

- Full-screen info view
- Back arrow to return to conversation
- Scrollable member list
- Bottom action sheet for owner actions

**Callout Requirements**:

1. Editable group name (owner only)
2. Owner badge next to owner's name
3. Member action menu (remove option)
4. Leave Group button (non-owner)
5. Transfer Ownership option
6. Delete Group (destructive styling)
7. Member "pending key" status indicator

---

## Generator Queue Format

```json
{
  "feature": "011-group-chats",
  "assignments": [
    {
      "svg": "01-group-conversation.svg",
      "assignedTo": "generator-1",
      "priority": "P1",
      "status": "pending"
    },
    {
      "svg": "02-group-management.svg",
      "assignedTo": "generator-2",
      "priority": "P2",
      "status": "pending"
    },
    {
      "svg": "03-group-info-panel.svg",
      "assignedTo": "generator-3",
      "priority": "P2",
      "status": "pending"
    }
  ]
}
```

---

## Spec References

- FR-001 to FR-005: Group creation & encryption (create modal)
- FR-009 to FR-014: Member management (info panel)
- FR-015 to FR-021: Conversation features (message view)
- FR-022 to FR-024: History restriction (placeholder messages)
- FR-025 to FR-029: Accessibility requirements
