# Wireframe Plan: 012-welcome-message-architecture

**Feature**: Welcome Message Architecture
**Planned By**: Planner Terminal
**Date**: 2026-01-14
**Status**: Ready for Generation

## Screen Analysis

Based on spec review, this feature has minimal UI requirements:

### User Story Coverage

| User Story                     | Priority | Required Screens          |
| ------------------------------ | -------- | ------------------------- |
| US1: New User Receives Welcome | P1       | Welcome Conversation View |
| US2: Idempotent Messages       | P2       | N/A (backend logic)       |
| US3: Graceful Error Handling   | P3       | N/A (silent failure)      |

### Screen Consolidation

| Consolidated SVG              | Included Views                                 | Rationale                                         |
| ----------------------------- | ---------------------------------------------- | ------------------------------------------------- |
| `01-welcome-conversation.svg` | Welcome message, Admin sender, E2E explanation | Single screen covering the user-facing experience |

**Skipped**:

- Admin setup flow - Internal system operation, no user-facing UI
- Error states - Designed to fail silently per spec (FR-009)

---

## Wireframe Assignments

### SVG 1: Welcome Message Conversation

**File**: `01-welcome-conversation.svg`
**Assigned To**: Generator-3
**Priority**: P1

**Desktop View (1280x720)**:

- Standard conversation view layout
- Admin sender with "System Admin" or branded name
- Admin avatar (system/bot indicator icon)
- Welcome message content bubble containing:
  - Greeting: "Welcome to [App Name]!"
  - E2E encryption explanation (user-friendly)
  - Key points: messages are encrypted, only you can read them
  - Optional: link to learn more about security
- Timestamp showing message received time
- Read receipt indicator (optional)
- Conversation marked as special (no reply option or greyed input)

**Mobile View (360x720)**:

- Full-screen conversation view
- Large readable message bubble
- Clear admin branding
- No input field (one-way conversation)

**Content Requirements**:
The welcome message should explain:

1. End-to-end encryption is enabled
2. Messages are encrypted on your device
3. Only you and the recipient can read messages
4. Not even the platform can access message content

**Callout Requirements**:

1. Admin sender badge/indicator
2. System avatar (distinct from regular users)
3. Encryption explanation content
4. Read-only conversation indicator (no reply)
5. Security badge/icon in message or header
6. Accessible message content (high contrast)

---

## Generator Queue Format

```json
{
  "feature": "012-welcome-message-architecture",
  "assignments": [
    {
      "svg": "01-welcome-conversation.svg",
      "assignedTo": "generator-3",
      "priority": "P1",
      "status": "pending"
    }
  ]
}
```

---

## Spec References

- FR-001: Automatic welcome after key init (user sees message)
- FR-002: Encrypted message display
- FR-009: Non-blocking delivery (no error UI needed)
- SC-001: Message appears after key initialization

## Design Notes

This is a **passive UX feature** - users don't take action, they receive information. The wireframe should emphasize:

1. **Trust signals**: The admin sender and encryption iconography should convey security
2. **Clarity**: The E2E explanation must be understandable by non-technical users
3. **Subtlety**: It's a welcome message, not a marketing popup - should feel natural in the conversation list
4. **One-way**: Clearly indicate users cannot reply to this system message
