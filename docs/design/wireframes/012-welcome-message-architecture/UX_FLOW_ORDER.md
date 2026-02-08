# UX Flow Order: 012-welcome-message-architecture

**Created**: 2026-01-16
**Author**: UX Designer
**Based on**: Wireframe analysis (01-user-onboarding-flow.svg) + spec.md

## Visual Flow Analysis

The welcome message wireframe shows the post-onboarding messaging experience where a new user sees their first conversation from the system admin. The flow is automated (user doesn't initiate) so the callout order should reflect what the user observes.

### Spec User Stories (3 total)

| US     | Title                       | Priority | Wireframe Coverage     |
| ------ | --------------------------- | -------- | ---------------------- |
| US-001 | New User Receives Welcome   | P1       | ✓ Welcome conversation |
| US-002 | Idempotent Welcome Messages | P2       | ✓ Status indicator     |
| US-003 | Graceful Error Handling     | P3       | ✓ Success state shown  |

### Recommended User Story Sequence

| Order | Callout | User Story               | Screen Location              | Rationale                |
| ----- | ------- | ------------------------ | ---------------------------- | ------------------------ |
| 1     | ①       | US-001: Receive Welcome  | Conversation list (left)     | First thing user notices |
| 2     | ②       | US-001: Read Content     | Message content (center)     | User reads message       |
| 3     | ③       | US-001: Understand E2E   | Encryption badge (below msg) | Security explanation     |
| 4     | ④       | US-002: Status Confirmed | Status indicator             | System confirmation      |

### Visual Flow Map

```
Desktop Messages View (split panel):
┌────────────────────┬──────────────────────────────────────────┐
│ CONVERSATION LIST  │ MESSAGE DETAIL                           │
├────────────────────┼──────────────────────────────────────────┤
│ ① Admin (System)   │ Admin (System)                           │
│    Welcome to...   │ System Administrator                     │
│    [E2E badge]     │                                          │
│                    │ ② MESSAGE CONTENT                        │
│ No other convos    │    "Welcome to ScriptHammer!"            │
│                    │    Your messages are protected with E2E  │
│                    │    - Messages encrypted before sending   │
│                    │    - Only you hold decryption keys       │
│                    │                                          │
│                    │ ③ [End-to-End Encrypted] [✓]             │
│                    │                                          │
│                    │ ④ Welcome Status: [Sent]                 │
│                    │                                          │
│                    │ "This message was sent automatically"    │
└────────────────────┴──────────────────────────────────────────┘
```

### Current vs Recommended

| Current Wireframe   | Recommended         | Change Needed |
| ------------------- | ------------------- | ------------- |
| ① Welcome Convo     | ① Welcome Convo     | None          |
| ② Message Content   | ② Message Content   | None          |
| ③ Encryption Status | ③ Encryption Status | None          |
| ④ Welcome Status    | ④ Welcome Status    | None          |

### Issue

**No SPEC-ORDER issue in this wireframe.** The callout sequence already matches the natural reading flow:

1. See conversation in list (left panel)
2. Read message content (main panel)
3. Notice encryption badge (trust indicator)
4. Confirm status (system state)

The mobile view also maintains this flow, just in a single-panel presentation.

### Additional Observations

The "Additional Requirements" row (y=110 in annotation panel) may be positioned too high visually - this is a PATCH item, not a SPEC-ORDER issue.

**Recommendation**: This wireframe serves as a good reference for proper callout ordering. The sequence follows the user's eye movement (left→right, top→bottom) and information hierarchy (what→how→confirmation).
