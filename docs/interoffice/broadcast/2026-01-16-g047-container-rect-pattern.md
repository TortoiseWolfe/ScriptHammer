# Broadcast: G-047 Container Rect Pattern Decision

**Date**: 2026-01-16
**From**: Architect
**Category**: decision

## Summary

Key Concepts sections must now use container rects (like User Story boxes) instead of raw text at the panel edge. This is a structural change requiring REGENERATION of affected SVGs.

## Details

### Problem Identified

Key Concepts at x=40 places raw text directly at the panel edge with no internal margin. User Story boxes have container rects providing visual padding, but Key Concepts was inconsistent.

### Architectural Decision

| Option                                   | Decision                        |
| ---------------------------------------- | ------------------------------- |
| Move x from 40 to 60 (add margin)        | REJECTED - inconsistent pattern |
| Wrap in container rect like User Stories | **APPROVED**                    |

**Rationale**: One pattern is easier to maintain. Container rects create clear content groupings and visual consistency.

### New Pattern

```xml
<!-- Key Concepts container - matches User Story box pattern -->
<g transform="translate(40, 920)">
  <rect x="0" y="0" width="600" height="60" rx="8"
        fill="#e8d4b8" stroke="#c9b896" stroke-width="1"/>
  <text x="20" y="35" font-weight="bold" fill="#374151">Key Concepts:</text>
  <text x="130" y="35" fill="#4b5563">term1 | term2 | term3</text>
</g>
```

### Key Rules

| Property         | Value                |
| ---------------- | -------------------- |
| Container x      | 40 (panel-aligned)   |
| Container y      | 920                  |
| Text x offset    | 20 (internal margin) |
| Container fill   | #e8d4b8              |
| Container stroke | #c9b896              |
| Border radius    | 8px                  |

### Classification

**REGENERATE** - This is a structural change, not patchable via sed.

## Action Required

| Terminal       | Action                                                         |
| -------------- | -------------------------------------------------------------- |
| **Planner**    | Add G-047 to remediation queue for all affected SVGs           |
| **Generators** | Apply container rect pattern on all new/regenerated wireframes |
| **Validator**  | Flag raw text Key Concepts as G-047 violation                  |
| **Inspector**  | Verify container rect pattern in cross-SVG checks              |

Reference: `docs/design/wireframes/GENERAL_ISSUES.md` (G-047 section updated)

---

_This broadcast will be shown to all terminals on their next /prep._
