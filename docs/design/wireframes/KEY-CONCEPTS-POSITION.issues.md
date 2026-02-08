# Key Concepts Position Issue

**Date**: 2026-01-16
**Reporter**: Validator
**Severity**: PATCH (43 files affected)
**Status**: OPEN

---

## Issue Summary

Key Concepts row is positioned at x=40 (panel edge) instead of x=60 (with 20px padding matching annotation content). This affects ALL 43 SVGs containing Key Concepts.

## Technical Details

### Current State (WRONG)

```xml
<text x="40" y="940" ...>Key Concepts:</text>
<text x="140" y="940" ...>term1 | term2 | ...</text>
```

### Expected State (CORRECT)

```xml
<text x="60" y="940" ...>Key Concepts:</text>
<text x="160" y="940" ...>term1 | term2 | ...</text>
```

### Layout Analysis

| Element                           | Current X | Expected X | Issue                    |
| --------------------------------- | --------- | ---------- | ------------------------ |
| Annotation panel edge             | 40        | 40         | -                        |
| Annotation content (inside panel) | 60        | 60         | Correct (20px padding)   |
| Key Concepts label                | 40        | 60         | **Missing 20px padding** |
| Key Concepts terms                | 140       | 160        | **Missing 20px padding** |

### Y Position

Y=940 is **CORRECT** per G-047 specification.

## Affected Files (43 total)

All SVGs with Key Concepts row - run to list:

```bash
grep -rl "Key Concepts" --include="*.svg" docs/design/wireframes/
```

## Root Cause

G-047 in GENERAL_ISSUES.md specifies `transform="translate(40, 940)"` which places content at x=40. Should be `transform="translate(60, 940)"` or use absolute x=60.

## Fix Classification

**PATCH** - Simple coordinate change, no structural issues.

## Actions Required

1. **Generator**: Change x="40" to x="60" for Key Concepts label
2. **Generator**: Change x="140" to x="160" for Key Concepts terms
3. **Toolsmith**: Add validation rule (see escalation)
4. **Architect**: Update G-047 spec to x=60

---

## Escalation: Toolsmith

**ESCALATED TO**: Toolsmith
**REASON**: Validator gap - validate-wireframe.py does not check Key Concepts x-position

### Requested Validation Rule

Add check for Key Concepts positioning:

```python
# Proposed rule: KEY-CONCEPTS-001
# Key Concepts label must be at x >= 60 (20px inside annotation panel)
# Key Concepts terms must be at x >= 160 (120px offset from label)
```

### Acceptance Criteria

- [ ] Validator flags Key Concepts at x < 60 as error
- [ ] Error code: KEY-001 (Key Concepts x-position)
- [ ] Error message: "Key Concepts at x={x}, expected x>=60 (20px panel padding)"

---

## Related

- G-047 in GENERAL_ISSUES.md (Annotation Bottom Row Standards)
- G-011 (Container Boundary Validation)
