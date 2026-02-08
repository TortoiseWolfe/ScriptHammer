# Validator Escalation to Toolsmith

**Date**: 2026-01-16
**From**: Validator
**To**: Toolsmith
**Priority**: Medium
**Subject**: Missing validation rule for Key Concepts x-position

---

## Issue

During QC review, discovered that Key Concepts row is positioned at x=40 (panel edge) across all 43 SVGs. This should be x=60 (with 20px padding matching annotation panel content).

**validate-wireframe.py does not check this**, which is why it wasn't caught during automated validation.

## Request

Add validation rule to `validate-wireframe.py`:

### Rule Specification

| Property | Value                                                        |
| -------- | ------------------------------------------------------------ |
| Code     | `KEY-001`                                                    |
| Severity | ERROR                                                        |
| Check    | Key Concepts `<text>` element x-position                     |
| Expected | x >= 60                                                      |
| Message  | `Key Concepts at x={x}, expected x>=60 (20px panel padding)` |

### Detection Logic

```python
# Find Key Concepts text elements
# Pattern: <text ...>Key Concepts:</text>
# Check: x attribute >= 60
```

### Test Cases

| Input    | Expected Result |
| -------- | --------------- |
| `x="40"` | ERROR KEY-001   |
| `x="60"` | PASS            |
| `x="80"` | PASS            |

## Files

- Issue details: `docs/design/wireframes/KEY-CONCEPTS-POSITION.issues.md`
- Affected SVGs: 43 files (all with Key Concepts row)

## Impact

Without this rule:

- Key Concepts misalignment goes undetected
- Visual inconsistency between annotation content (x=60) and Key Concepts (x=40)
- Manual QC required to catch layout issues

---

## Additional Context

Y-position (y=940) is correct per G-047. Only x-position needs validation.

G-047 in GENERAL_ISSUES.md should also be updated to specify x=60, but that's an Architect action.
