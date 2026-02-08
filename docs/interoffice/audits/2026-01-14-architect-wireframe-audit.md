# Wireframe Consistency Audit

**Terminal**: Architect
**Date**: 2026-01-14
**Status**: Findings documented, action items assigned

---

## Issue Summary

### 1. Title X-Position Deviation (G-024)

- **Standard**: x=960 (centered on 1920px canvas)
- **Current**: 13 files use x=700 instead
- **Affected**: Features 001, 002, 003, 004, 006
- **Classification**: PATCH - coordinate change only

### 2. Missing Signature Blocks (G-025)

- **Standard**: "NNN:NN | Feature | ScriptHammer" at y=1060, 18px bold
- **Current**: Only Feature 003 has proper signatures (3 files)
- **Affected**: 18/21 files missing or malformed
- **Classification**: PATCH - add ~5 lines per file

### 3. Color Scheme Violations (G-001) - CRITICAL

- **Standard**: Panels use `#e8d4b8`, never `#ffffff`
- **Current**: 261 instances of `#ffffff` across 14 files

| Feature        | #ffffff Count | Severity |
| -------------- | ------------- | -------- |
| 003 (Auth)     | 101           | CRITICAL |
| 006 (Template) | 82            | CRITICAL |
| 007 (E2E)      | 42            | HIGH     |
| 002 (Cookie)   | 22            | MEDIUM   |

- Only **Feature 005 (Security Hardening)** is fully compliant with zero `#ffffff`
- **Classification**: REGEN - systemic palette issue

---

## Feature-by-Feature Assessment

| Feature      | Structure | Title   | Signature   | Colors         | Overall |
| ------------ | --------- | ------- | ----------- | -------------- | ------- |
| 001 WCAG     | ✓         | x=700 ✗ | Missing ✗   | 4 violations   | ⚠️      |
| 002 Cookie   | ✓         | x=700 ✗ | Partial ✗   | 22 violations  | ⚠️      |
| 003 Auth     | ✓         | x=700 ✗ | Correct ✓   | 101 violations | ⚠️      |
| 004 Mobile   | ✓         | x=700 ✗ | Missing ✗   | 10 violations  | ⚠️      |
| 005 Security | ✓         | x=960 ✓ | Missing ✗   | 0 violations ✓ | ✓ Best  |
| 006 Template | ✓         | x=700 ✗ | Malformed ✗ | 82 violations  | ⚠️      |
| 007 E2E      | ✓\*       | x=960 ✓ | Missing ✗   | 42 violations  | ⚠️      |

\*Feature 007-02 uses intentional full-width architecture diagram layout

---

## Root Cause Analysis

The systemic nature of these issues (same problems across 7 features, 21 files) suggests the `/wireframe` skill template may have:

- Incorrect title X default (700 vs 960)
- Missing signature block injection
- Wrong base color for panels (`#ffffff` vs `#e8d4b8`)

**Feature 005 (Security Hardening)** demonstrates correct implementation and should be used as the reference pattern.

---

## Architectural Recommendations

### P0 - Immediate (Toolsmith + Generators)

1. **Audit `/wireframe` skill** - Verify defaults generate:
   - Title at x=960 (not x=700)
   - Signature block template included
   - Color palette `#e8d4b8` (not `#ffffff`)

2. **Regenerate color-violating files** - Priority order:
   - Feature 003 (101 violations)
   - Feature 006 (82 violations)
   - Feature 007 (42 violations)

### P1 - Secondary

3. Patch title positions - 13 files need x=700 → x=960
4. Add signature blocks - 18 files need standard format
5. Document Feature 007 exception - Full-width architecture diagrams

---

## Action Items

| #   | Task                            | Assigned To | Status             |
| --- | ------------------------------- | ----------- | ------------------ |
| 1   | Audit /wireframe skill defaults | Toolsmith   | PENDING            |
| 2   | Fix template color palette      | Toolsmith   | PENDING            |
| 3   | Regenerate Feature 003 SVGs     | Generator   | BLOCKED (needs #1) |
| 4   | Regenerate Feature 006 SVGs     | Generator   | BLOCKED (needs #1) |
| 5   | Patch title positions           | Generator   | PENDING            |

---

## Notes

- Memo sent to Toolsmith: "Wireframe skill audit needed"
- Reference implementation: `005-security-hardening/*.svg`
