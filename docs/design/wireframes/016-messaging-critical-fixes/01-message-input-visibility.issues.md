# Issues: 01-message-input-visibility.svg

**Feature:** 016-messaging-critical-fixes
**SVG:** 01-message-input-visibility.svg
**Last Review:** 2026-01-15
**Validator:** v5.2

---

## Summary

| Status | Count |
|--------|-------|
| Open | 0 |

---

## Resolved Issues (2026-01-15)

### Annotation Issues

| ID | Issue | Resolution |
|----|-------|------------|
| A-01 | Only 1 callout circle | FIXED - proper callout count |

### User Story Issues

| ID | Issue | Resolution |
|----|-------|------------|
| U-01 | Only 1 User Story badge | FIXED - proper coverage |

### Font Issues

| ID | Issue | Resolution |
|----|-------|------------|
| (untracked) | 12 elements at font-size 12px | FIXED 2026-01-15 - all changed to 14px |

---

## Notes

- Cleaned up 2026-01-15 by Validator terminal
- Re-validation confirms 0 errors
- Run validator to refresh: `python validate-wireframe.py 016-messaging-critical-fixes/01-message-input-visibility.svg`

## Inspector Issues (2026-01-15)

| Check | Expected | Actual | Classification |
|-------|----------|--------|----------------|
| signature_alignment | x="40" (left-aligned) | x=960, text-anchor="middle" | PATTERN_VIOLATION |
| signature_format | NNN:NN | Feature Name | ScriptHammer | "ScriptHammer v0.1 - Messaging UX Input Visibili..." | PATTERN_VIOLATION |
