# UX Flow Order: 008-on-the-account

**Created**: 2026-01-16
**Author**: UX Designer
**Based on**: Wireframe analysis (01-avatar-upload-flow.svg) + spec.md

## Visual Flow Analysis

The avatar upload wireframe shows a three-panel layout (left-to-right): current avatar display, crop interface, and requirements. The natural user journey progresses through these panels.

### Spec User Stories (3 total)

| US     | Title                   | Priority | Wireframe Coverage           |
| ------ | ----------------------- | -------- | ---------------------------- |
| US-001 | Upload New Avatar       | P1       | ✓ Left panel + center crop   |
| US-002 | Replace Existing Avatar | P2       | ✓ Implied (same flow)        |
| US-003 | Remove Avatar           | P3       | ✓ Left panel (Remove button) |

### Recommended User Story Sequence

| Order | Callout | User Story                 | Screen Location            | Rationale                      |
| ----- | ------- | -------------------------- | -------------------------- | ------------------------------ |
| 1     | ②       | US-001: Upload New Avatar  | Left panel - current state | User sees current avatar first |
| 2     | ①       | US-001: Upload interaction | Left panel - Upload button | User initiates action          |
| 3     | ③       | US-001: Crop & Process     | Center panel               | After file selection           |
| 4     | ④       | A11Y/Requirements          | Right panel                | Constraints during crop        |

### Visual Flow Map

```
Desktop Account Settings (left-to-right):
┌──────────────────┬────────────────────┬──────────────────┐
│ LEFT PANEL       │ CENTER PANEL       │ RIGHT PANEL      │
│ Profile Picture  │ Crop and Position  │ File Requirements│
├──────────────────┼────────────────────┼──────────────────┤
│ ② Current Avatar │ ③ Crop Interface   │ ④ Requirements   │
│    [JD initials] │    [Image preview] │    Formats: JPG  │
│                  │    [Crop circle]   │    PNG, WebP     │
│ ① [Upload Avatar]│    [Progress bar]  │    Max: 5MB      │
│   [Remove Avatar]│    [Cancel] [Save] │    Min: 200x200  │
│                  │                    │                  │
│                  │                    │    Accessibility │
│                  │                    │    - Keyboard    │
│                  │                    │    - Focus       │
└──────────────────┴────────────────────┴──────────────────┘
```

### Current vs Recommended

| Current Wireframe | Recommended      | Change Needed                  |
| ----------------- | ---------------- | ------------------------------ |
| ① Upload button   | ② Current state  | SPEC-ORDER: Show context first |
| ② Current avatar  | ① Upload action  | SPEC-ORDER: Swap               |
| ③ Crop interface  | ③ Crop interface | None                           |
| ④ Requirements    | ④ Requirements   | None                           |

### Issue

Current callout order shows the Upload button (①) before the current avatar state (②). Users naturally observe their current state before taking action.

**Recommendation**: Reorder callouts to match user mental model:

- ① See current avatar (what I have now)
- ② Click Upload button (initiate change)
- ③ Crop/position interface (interactive step)
- ④ Verify requirements (validation feedback)

This follows the See → Decide → Act → Verify pattern.

### Mobile Considerations

Mobile view stacks the panels vertically, maintaining the same flow but with a single-column layout. The crop interface should be modal/full-screen on mobile for better touch interaction.
