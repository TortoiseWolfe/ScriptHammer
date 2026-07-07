# UX Flow Order: 011-group-chats

**Created**: 2026-01-16
**Author**: UX Designer
**Based on**: Wireframe analysis (01-group-creation-messaging.svg) + spec.md

## Visual Flow Analysis

The group chats wireframe shows a messaging interface with sidebar (conversation list) and main panel (active chat). The user flow moves from discovery to creation to active messaging.

### Spec User Stories (6 total)

| US     | Title                       | Priority | Wireframe Coverage                   |
| ------ | --------------------------- | -------- | ------------------------------------ |
| US-001 | Create Group Chat           | P1       | ✓ New Group button                   |
| US-002 | Send/Receive Group Messages | P1       | ✓ Message area                       |
| US-003 | Add Members to Group        | P2       | ✓ Stacked avatars concept            |
| US-004 | Upgrade 1-to-1 to Group     | P2       | Not shown                            |
| US-005 | Remove Member / Leave Group | P2       | Not shown (02-member-management.svg) |
| US-006 | View Group Info             | P3       | ✓ Info button                        |

### Recommended User Story Sequence

| Order | Callout | User Story                    | Screen Location                  | Rationale                 |
| ----- | ------- | ----------------------------- | -------------------------------- | ------------------------- |
| 1     | ①       | US-001: Create Group          | + Group button (sidebar top)     | Entry point to feature    |
| 2     | ④       | US-003: Add Members           | Stacked avatars (sidebar list)   | Visual indicator of group |
| 3     | ②       | US-002: Send/Receive Messages | Message area (main panel)        | Core functionality        |
| 4     | ③       | US-002: Typing Indicators     | Typing area (bottom of messages) | Real-time feedback        |

### Visual Flow Map

```
Desktop Messages View (sidebar + main):
┌────────────────────┬──────────────────────────────────────────┐
│ SIDEBAR            │ MAIN PANEL                               │
│ Messages           │ Project Team (header)                    │
│ [① + Group]        │                                          │
├────────────────────┼──────────────────────────────────────────┤
│ ④ Project Team     │ ② MESSAGE AREA                           │
│   [stacked avatars]│    Alex: Ready for meeting?              │
│                    │    Sarah: Joining in 5 min               │
│ Sarah Wilson       │    You: Mockups are ready                │
│   [single avatar]  │                                          │
│                    ├──────────────────────────────────────────┤
│ Design Review      │ ③ TYPING INDICATORS                      │
│   [stacked avatars]│    Alex and Mike are typing...           │
│                    ├──────────────────────────────────────────┤
│                    │ [Message input] [Send]                   │
└────────────────────┴──────────────────────────────────────────┘
```

### Current vs Recommended

| Current Wireframe | Recommended       | Change Needed                                   |
| ----------------- | ----------------- | ----------------------------------------------- |
| ① Create Group    | ① Create Group    | None                                            |
| ② Message Area    | ④ Stacked Avatars | SPEC-ORDER: Show group identity before messages |
| ③ Typing          | ② Message Area    | SPEC-ORDER: Core function before feedback       |
| ④ Stacked Avatars | ③ Typing          | SPEC-ORDER: Feedback is secondary               |

### Issue

Current callout sequence interweaves group identity (④ stacked avatars) with messaging (②③). The recommended flow groups related concepts:

1. Group creation and identity (①④)
2. Core messaging (②)
3. Real-time feedback (③)

**Recommendation**: Reorder to follow feature discovery pattern:

- ① Create Group (action)
- ② See Group Identity (stacked avatars - confirmation of group)
- ③ Send/Receive Messages (core use)
- ④ Typing Indicators (enhancement)

Alternatively, keep messaging flow together:

- ① Create Group
- ② Message Area
- ③ Sender Attribution (who said what)
- ④ Typing Indicators (who is composing)

The current wireframe mixes concepts from different user journeys.

### Mobile Considerations

Mobile shows single-panel view (conversation list OR active chat). The flow remains consistent:

1. Tap + to create group
2. Select members
3. View group in list
4. Tap to open and message
