# Validator Report: Batch004 SVG Validation

**Date:** 2026-01-15
**Validator:** Validator Terminal
**Source QC:** `2026-01-15-operator-batch004-qc-review.md`
**SVG Count:** 22

---

## Validator Results Summary

| #   | SVG                             | Validator | Errors | QC Issue                 |
| --- | ------------------------------- | --------- | ------ | ------------------------ |
| 1   | 000-landing-page_01             | PASS      | 0      | SPEC-ORDER               |
| 2   | 000-rls-implementation_01       | PASS      | 0      | REGEN (layout)           |
| 3   | 002-cookie-consent_02           | PASS      | 0      | PATCH (order)            |
| 4   | 003-user-authentication_01      | FAIL      | 2      | REGEN (mobile callouts)  |
| 5   | 003-user-authentication_02      | FAIL      | 2      | REGEN (z-index + mobile) |
| 6   | 003-user-authentication_03      | FAIL      | 2      | REGEN (mobile callout)   |
| 7   | 005-security-hardening_01       | PASS      | 0      | SPEC-ORDER               |
| 8   | 005-security-hardening_02       | PASS      | 0      | SPEC-ORDER               |
| 9   | 006-template-fork-experience_01 | PASS      | 0      | PATCH (spacing)          |
| 10  | 006-template-fork-experience_02 | PASS      | 0      | PATCH + REGEN            |
| 11  | 007-e2e-testing-framework_01    | PASS      | 0      | SPEC-ORDER               |
| 12  | 008-on-the-account_01           | FAIL      | 4      | REGEN (z-index + mobile) |
| 13  | 009-user-messaging-system_01    | PASS      | 0      | REGEN (mobile callout)   |
| 14  | 009-user-messaging-system_02    | PASS      | 0      | PATCH (z-index)          |
| 15  | 010-unified-blog-content_01     | FAIL      | 4      | REGEN (missing callouts) |
| 16  | 010-unified-blog-content_02     | FAIL      | 4      | REGEN (missing callouts) |
| 17  | 011-group-chats_01              | FAIL      | 2      | REGEN (mobile callouts)  |
| 18  | 011-group-chats_02              | FAIL      | 2      | REGEN + PATCH            |
| 19  | 012-welcome-message_01          | PASS      | 0      | REGEN + PATCH            |
| 20  | 016-messaging-critical-fixes_01 | FAIL      | 3      | SPEC-ORDER               |
| 21  | 016-messaging-critical-fixes_03 | FAIL      | 3      | SPEC-ORDER               |
| 22  | 021-geolocation-map_02          | FAIL      | 3      | REGEN (mobile callouts)  |

---

## Validator Error Breakdown

| Error Code    | Count | Classification |
| ------------- | ----- | -------------- |
| SIGNATURE-003 | 24    | PATCH          |
| SIGNATURE-004 | 6     | PATCH          |
| G-044         | 4     | PATCH          |

**Total Validator Errors:** 34 across 12 SVGs

---

## Gap Analysis: Validator vs Visual QC

The validator does NOT detect these QC-identified issues:

| Issue Type                           | Detected by Validator | Detected by QC |
| ------------------------------------ | --------------------- | -------------- |
| Signature position                   | YES                   | -              |
| Signature format                     | YES                   | -              |
| Footer/nav corners                   | YES                   | -              |
| Missing callouts on mobile           | NO                    | YES            |
| Z-index (callouts behind containers) | NO                    | YES            |
| Callout pointing to wrong element    | NO                    | YES            |
| Annotation panel spacing             | NO                    | YES            |
| User story sequence (SPEC-ORDER)     | NO                    | YES            |

**Recommendation:** Add validator checks for mobile callout parity and z-index ordering.

---

## Classification: REGEN vs PATCH

### REGEN (12 SVGs) - Structural Issues

| SVG                             | Reason                                    |
| ------------------------------- | ----------------------------------------- |
| 000-rls-implementation_01       | Annotation panel layout crammed           |
| 003-user-authentication_01      | Mobile missing callouts 2, 4              |
| 003-user-authentication_02      | Desktop z-index + mobile missing callouts |
| 003-user-authentication_03      | Mobile missing callout 4                  |
| 006-template-fork-experience_02 | Mobile missing callout 4, mislabeled 5/6  |
| 008-on-the-account_01           | Callout 3 z-index + NO mobile callouts    |
| 009-user-messaging-system_01    | Mobile missing callout 1                  |
| 010-unified-blog-content_01     | Callouts missing throughout               |
| 010-unified-blog-content_02     | Callouts missing + structural issues      |
| 011-group-chats_01              | Mobile missing callouts                   |
| 011-group-chats_02              | Mobile missing callouts                   |
| 012-welcome-message_01          | Mobile missing callout 3                  |
| 021-geolocation-map_02          | Mobile missing callouts 1, 3              |

### PATCH (6 SVGs) - Cosmetic Fixes

| SVG                             | Fix Required                           |
| ------------------------------- | -------------------------------------- |
| 002-cookie-consent_02           | Callout order in annotation panel      |
| 006-template-fork-experience_01 | Annotation spacing (callouts 5/6)      |
| 009-user-messaging-system_02    | Callout z-index redraw                 |
| 011-group-chats_02              | Column gap in annotation panel         |
| 012-welcome-message_01          | "Additional Requirements" row position |
| All 12 FAIL SVGs                | Signature PATCH (SIGNATURE-003/004)    |

### SPEC-ORDER (10 SVGs) - Needs Technical Writer

| SVG                             | Issue                                    |
| ------------------------------- | ---------------------------------------- |
| 000-landing-page_01             | Callouts 2/3 need reversed               |
| 005-security-hardening_01       | Callout 1 at bottom but listed first     |
| 005-security-hardening_02       | Callout 1 last in flow but first in spec |
| 007-e2e-testing-framework_01    | Numbering doesn't match visual flow      |
| 008-on-the-account_01           | Callouts 1/2 need reordering             |
| 011-group-chats_01              | Desktop traces wrong order               |
| 012-welcome-message_01          | Mobile callout 2 wrong position          |
| 016-messaging-critical-fixes_01 | Sequence doesn't match flow              |
| 016-messaging-critical-fixes_03 | Sequence doesn't match flow              |

---

## Priority Action Queue

### Priority 1: REGEN Queue (Generator Terminals)

```
1. 003-user-authentication_01 (FAIL + visual)
2. 003-user-authentication_02 (FAIL + visual)
3. 003-user-authentication_03 (FAIL + visual)
4. 008-on-the-account_01 (FAIL + visual)
5. 010-unified-blog-content_01 (FAIL + visual)
6. 010-unified-blog-content_02 (FAIL + visual)
7. 011-group-chats_01 (FAIL + visual)
8. 011-group-chats_02 (FAIL + visual)
9. 021-geolocation-map_02 (FAIL + visual)
10. 009-user-messaging-system_01 (visual only)
11. 012-welcome-message_01 (visual only)
12. 000-rls-implementation_01 (visual only)
13. 006-template-fork-experience_02 (visual only)
```

### Priority 2: PATCH Queue (Quick Fixes)

```
1. 016-messaging-critical-fixes_01 (SIGNATURE-003/004)
2. 016-messaging-critical-fixes_03 (SIGNATURE-003/004)
3. 002-cookie-consent_02 (callout order)
4. 006-template-fork-experience_01 (spacing)
5. 009-user-messaging-system_02 (z-index)
```

### Priority 3: SPEC-ORDER (Technical Writer)

```
Dispatch to Technical Writer terminal for spec.md updates:
- 000-landing-page
- 005-security-hardening (01 + 02)
- 007-e2e-testing-framework
- 008-on-the-account
- 011-group-chats
- 012-welcome-message
- 016-messaging-critical-fixes (01 + 03)
```

---

## Summary

| Category             | Count |
| -------------------- | ----- |
| Validator PASS       | 10    |
| Validator FAIL       | 12    |
| Need REGEN           | 13    |
| Need PATCH only      | 5     |
| Need SPEC-ORDER      | 10    |
| DESIGN-GAP (Council) | 1     |

**Key Finding:** 10 SVGs pass validator but still need REGEN due to visual issues (missing mobile callouts, z-index problems) that validator doesn't detect. Visual QC remains essential.
