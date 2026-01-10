# Issues: 02-rls-policy-patterns.svg

**Status**: 🟢 PATCHABLE (1 issue)
**Reviewed**: 2026-01-09

---

## Issue 1: Font Sizes Too Small (G-010)

**Classification**: 🟢 PATCHABLE

**Location**: CSS `<style>` block

| Class | Current | Should Be |
|-------|---------|-----------|
| `.legend-text` | 13px | 14px |
| `.us-narrative` | 13px | 14px |
| `.us-title` | 13px | 14px |

**Standard**: Body text = 14px (not 13px minimum)
**Reference**: G-010 in GENERAL_ISSUES.md

---

## Summary

| Issue | Description | Classification |
|-------|-------------|----------------|
| 1 | Font sizes too small (G-010) | 🟢 PATCHABLE |

**Next Action**: Run `/wireframe 000:02` to patch font sizes.
