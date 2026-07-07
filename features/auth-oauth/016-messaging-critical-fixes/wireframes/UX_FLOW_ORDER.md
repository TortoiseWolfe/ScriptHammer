# UX Flow Order: 016-messaging-critical-fixes

**Created**: 2026-01-16
**Author**: UX Designer
**Based on**: Wireframe analysis (01-message-input-visibility.svg) + spec.md

## Visual Flow Analysis

The messaging UX wireframe shows a conversation view addressing input visibility issues. The user flow involves viewing conversation context, scrolling through messages, and composing new messages.

### Spec User Stories (5 total)

| US     | Title                          | Priority | Wireframe Coverage          |
| ------ | ------------------------------ | -------- | --------------------------- |
| US-001 | Message Input Always Visible   | P1       | ✓ Fixed input               |
| US-002 | OAuth Full-Page Setup Flow     | P1       | See 02-oauth-setup-flow.svg |
| US-003 | Password Manager Integration   | P2       | Not shown                   |
| US-004 | Decryption Failure Explanation | P2       | ✓ Lock icon on message      |
| US-005 | Participant Name Resolution    | P3       | ✓ Conversation header       |

### Recommended User Story Sequence

| Order | Callout | User Story                | Screen Location           | Rationale            |
| ----- | ------- | ------------------------- | ------------------------- | -------------------- |
| 1     | ②       | US-005: Participant Name  | Conversation header (top) | Context first        |
| 2     | ③       | -                         | Scrollable message area   | Core content         |
| 3     | ④       | US-004: Decryption Status | Lock icon on message      | Edge case visibility |
| 4     | ①       | US-001: Fixed Input       | Input field (bottom)      | Always accessible    |

### Visual Flow Map

```
Desktop Conversation View:
┌────────────────────────────────────────────────────────────────┐
│ Header                                                         │
├────────────────────────────────────────────────────────────────┤
│ ② Conversation with Jane Smith [Online ●]                      │ ← US-005
├────────────────────────────────────────────────────────────────┤
│ ③ SCROLLABLE MESSAGE AREA                                      │
│                                                                │
│    [Received message bubble]                                   │
│    "Hey, are you free to chat today?"                         │
│                                                                │
│                          [Sent message bubble - purple]        │
│                          "Sure! What did you want to discuss?" │
│                                                                │
│    [Received message bubble]                                   │
│    "The project timeline for next quarter..."                 │
│                                                                │
│    ④ [🔒 Encrypted with previous keys] ← US-004               │
│                                                                │
│                          [Sent message bubble - purple]        │
│                          "Got it. Let me pull up documents."  │
├────────────────────────────────────────────────────────────────┤
│ ① FIXED MESSAGE INPUT (sticky bottom)                          │ ← US-001
│    [Type a message...                              ] [Send]    │
└────────────────────────────────────────────────────────────────┘
```

### Current vs Recommended

| Current Wireframe      | Recommended    | Change Needed                      |
| ---------------------- | -------------- | ---------------------------------- |
| ① Fixed Input (bottom) | ② Header (top) | SPEC-ORDER: Header seen first      |
| ② Header               | ③ Message Area | SPEC-ORDER: Reading flow           |
| ③ Message Area         | ④ Decryption   | SPEC-ORDER: Error state in context |
| ④ Decryption           | ① Fixed Input  | SPEC-ORDER: Input is persistent    |

### Issue

Current callout sequence prioritizes the "fix" (① input visibility) over the natural user experience. Users observe the interface top-to-bottom, encountering:

1. Who they're talking to (header)
2. Conversation history (messages)
3. Any problem messages (decryption errors)
4. Composition area (always visible input)

**Recommendation**: Reorder callouts to match visual hierarchy:

- ① Participant Name (who is this?)
- ② Message Area (what did we discuss?)
- ③ Decryption Status (why can't I read this?)
- ④ Fixed Input (I can always respond)

This tells the story from user perspective rather than engineering fix perspective.

### Mobile Considerations

Mobile maintains the same vertical flow in a narrower viewport:

- Header condensed (shows only name)
- Messages fill available space
- Input fixed at bottom (critical for mobile keyboards)
- Decryption indicators must remain legible at smaller sizes

The "always visible input" fix (US-001) is particularly important on mobile where soft keyboards can push content off-screen.
