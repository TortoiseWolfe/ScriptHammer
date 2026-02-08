# Requirements Traceability

This folder contains requirement-to-wireframe mapping documents.

## Purpose

Wireframes v3.0 are **lean UI mockups** - they show screens, not documentation.
Requirements traceability (FR/SC/US to screen mapping) lives here instead.

## File Format

One file per feature: `NNN-feature-name.md`

```markdown
# Requirements Traceability: NNN-feature-name

## Wireframe Coverage

| Code   | Description    | Wireframe | Element      |
| ------ | -------------- | --------- | ------------ |
| FR-001 | [from spec.md] | 01:STATE1 | [UI element] |
| FR-002 | [from spec.md] | 01:STATE1 | [UI element] |
| SC-001 | [from spec.md] | 01:STATE3 | [UI element] |

## User Stories

| US   | Priority | Summary | Wireframes |
| ---- | -------- | ------- | ---------- |
| US-1 | P0       | [title] | 01         |
| US-2 | P0       | [title] | 01, 02     |
```

## When to Create

Create a traceability doc when:

- Stakeholders need requirements-to-screen mapping
- Audit trail is required
- Complex features with many FR/SC codes

## Relationship to Wireframes

```
spec.md → wireframe SVG → requirements-trace.md
   │           │                    │
   │           │                    └─ Maps codes to screens
   │           └─ Shows UI with badge-only FR/SC markers
   └─ Contains full FR/SC/US definitions
```

Wireframes show WHERE badges appear (visual).
This folder explains WHY they appear there (documentation).
