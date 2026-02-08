# Inspector Audit: "Clean" SVGs - All Have Issues

**Date:** 2026-01-16
**Role:** Inspector Terminal
**Task:** Cross-SVG consistency check on 15 supposedly "clean" wireframes

---

## Summary

**ALL 15 SVGs have pattern violations.** None are actually clean.

| Violation Type                     | Count | Affected SVGs                             |
| ---------------------------------- | ----- | ----------------------------------------- |
| footer_nav_corners (G-044)         | 15/15 | ALL                                       |
| key_concepts_missing (G-047)       | 12/15 | All except 004:01, 004:02, 019:01, 019:02 |
| mobile_active_icon_missing (G-045) | 1/15  | 001:01                                    |
| signature_alignment                | 1/15  | 016:01 (message-input-visibility)         |
| signature_format                   | 1/15  | 016:01 (message-input-visibility)         |

**Total violations: 45 across 15 SVGs**

---

## Detailed Results

| SVG                              | Violations | Issues                                                              |
| -------------------------------- | ---------- | ------------------------------------------------------------------- |
| 001:01 accessibility-dashboard   | 4          | footer_corners, mobile_icon, key_concepts                           |
| 002:01 consent-modal             | 3          | footer_corners, key_concepts                                        |
| 002:03 privacy-settings-page     | 3          | footer_corners, key_concepts                                        |
| 004:01 responsive-navigation     | 2          | footer_corners only (HAS Key Concepts)                              |
| 004:02 touch-targets-performance | 2          | footer_corners only (HAS Key Concepts)                              |
| 005:02 session-timeout-warning   | 3          | footer_corners, key_concepts                                        |
| 005:03 security-audit-dashboard  | 3          | footer_corners, key_concepts                                        |
| 006:01 service-setup-guidance    | 3          | footer_corners, key_concepts                                        |
| 013:01 oauth-password-setup      | 3          | footer_corners, key_concepts                                        |
| 013:02 oauth-password-unlock     | 3          | footer_corners, key_concepts                                        |
| 016:01 message-input-visibility  | 5          | signature_alignment, signature_format, footer_corners, key_concepts |
| 016:01 conversation-view         | 3          | footer_corners, key_concepts                                        |
| 017:01 accessibility-settings    | 3          | footer_corners, key_concepts                                        |
| 017:02 type-selection            | 3          | footer_corners, key_concepts                                        |
| 019:01 consent-flow              | 2          | footer_corners only (HAS Key Concepts)                              |
| 019:02 analytics-dashboard       | 2          | footer_corners only (HAS Key Concepts)                              |

---

## Pattern Analysis

### G-044: Footer/Nav Corners (ALL 15 FAILING)

Every wireframe is missing `rx="4-8"` on:

- Desktop footer container rect
- Mobile bottom nav bar rect

**Fix:** Add `rx="8"` to footer/nav rect elements.

### G-047: Key Concepts Row (12/15 FAILING)

Only 4 wireframes have "Key Concepts:" row:

- 004:01 responsive-navigation ✓
- 004:02 touch-targets-performance ✓
- 019:01 consent-flow ✓
- 019:02 analytics-dashboard ✓

**Fix:** Add Key Concepts row at y≈940 in annotation panel.

### G-045: Mobile Active State Icon (1/15 FAILING)

001:01 has active state overlay but missing white icon path.

### Signature Issues (1/15 FAILING)

016:01 message-input-visibility has:

- Centered signature (x=960) instead of left-aligned (x=40)
- Wrong format: "ScriptHammer v0.1 - ..." instead of "016:01 | ... | ScriptHammer"

---

## Recommendations

### Priority 1: Footer Corners (ALL 15)

```bash
# Batch PATCH - add rx="8" to footer/nav rects
```

### Priority 2: Key Concepts Row (12/15)

```bash
# Add Key Concepts row to annotation panel
# Use 004:01 or 019:01 as reference templates
```

### Priority 3: Signature Fix (1/15)

016:01 message-input-visibility needs REGEN for signature fix.

---

## Issues Logged

Inspector violations automatically logged to:

- 001-wcag-aa-compliance/01-accessibility-dashboard.issues.md
- 002-cookie-consent/01-consent-modal.issues.md
- 002-cookie-consent/03-privacy-settings-page.issues.md
- 004-mobile-first-design/01-responsive-navigation.issues.md
- 004-mobile-first-design/02-touch-targets-performance.issues.md
- 005-security-hardening/02-session-timeout-warning.issues.md
- 005-security-hardening/03-security-audit-dashboard.issues.md
- 006-template-fork-experience/01-service-setup-guidance.issues.md
- 013-oauth-messaging-password/01-oauth-password-setup.issues.md
- 013-oauth-messaging-password/02-oauth-password-unlock.issues.md
- 016-messaging-critical-fixes/01-message-input-visibility.issues.md
- 016-messaging-critical-fixes/01-conversation-view.issues.md
- 017-colorblind-mode/01-accessibility-settings.issues.md
- 017-colorblind-mode/02-type-selection.issues.md
- 019-google-analytics/01-consent-flow.issues.md
- 019-google-analytics/02-analytics-dashboard.issues.md

---

## Conclusion

**Zero "clean" wireframes exist.** All 15 fail G-044 (footer corners). 12/15 also fail G-047 (Key Concepts missing).

The 4 wireframes with Key Concepts (004:01, 004:02, 019:01, 019:02) should be used as templates for adding this row to others.
