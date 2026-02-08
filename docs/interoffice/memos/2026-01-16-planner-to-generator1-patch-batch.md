# DISPATCH: Generator1 PATCH Batch (000-008)

**From**: Planner
**To**: Generator1
**Date**: 2026-01-16
**Priority**: HIGH
**Action**: PATCH 19 SVGs

---

## Overview

Your 000-008 batch passed initial generation but Validator's full sweep found consistency issues. These are quick mechanical fixes - no regeneration needed.

## Fix Patterns

### G-037: Annotation Text Color

```xml
<!-- FIND -->
fill="#6b7280"

<!-- REPLACE WITH -->
fill="#374151"
```

_Applies to annotation panel text elements only._

### SIGNATURE-003: Signature Left-Alignment

```xml
<!-- FIND (centered signature) -->
<text x="960" y="1060" text-anchor="middle" ...>NNN:NN | Feature | ScriptHammer</text>

<!-- REPLACE WITH (left-aligned) -->
<text x="40" y="1060" font-family="system-ui, sans-serif" font-size="18" font-weight="bold" fill="#374151">NNN:NN | Feature | ScriptHammer</text>
```

_Remove `text-anchor="middle"`, change `x="960"` to `x="40"`._

### G-044: Footer/Nav Rounded Corners

```xml
<!-- ADD rx="8" to footer and mobile nav containers -->
<rect ... rx="8" ...>
```

### G-047: Key Concepts Position (CRITICAL)

```xml
<!-- FIND - wrong position (y too low, x too close to edge) -->
<g transform="translate(20, 140)">
  <text ...>Key Concepts:</text>

<!-- OR direct positioning with wrong y -->
<text x="40" y="730" ...>Key Concepts:</text>

<!-- REPLACE WITH - correct position -->
<text x="40" y="940" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#374151">Key Concepts:</text>
<text x="150" y="940" font-family="system-ui, sans-serif" font-size="14" fill="#374151">term1 | term2 | term3</text>
```

**Required values**: x=40, y=940 (inside annotation panel which starts at y=800)

---

## SVG List (21 files)

### Batch A: G-037 Only (14 SVGs)

| #   | File                                                           | Fix   |
| --- | -------------------------------------------------------------- | ----- |
| 1   | `000-landing-page/01-landing-page.svg`                         | G-037 |
| 2   | `000-rls-implementation/01-policy-architecture.svg`            | G-037 |
| 3   | `001-wcag-aa-compliance/01-accessibility-dashboard.svg`        | G-037 |
| 4   | `001-wcag-aa-compliance/02-cicd-pipeline-integration.svg`      | G-037 |
| 5   | `001-wcag-aa-compliance/03-accessibility-controls-overlay.svg` | G-037 |
| 6   | `002-cookie-consent/01-consent-modal.svg`                      | G-037 |
| 7   | `002-cookie-consent/02-cookie-preferences-panel.svg`           | G-037 |
| 8   | `002-cookie-consent/03-privacy-settings-page.svg`              | G-037 |
| 9   | `005-security-hardening/01-security-ux-enhancements.svg`       | G-037 |
| 10  | `005-security-hardening/02-session-timeout-warning.svg`        | G-037 |
| 11  | `005-security-hardening/03-security-audit-dashboard.svg`       | G-037 |
| 12  | `006-template-fork-experience/01-service-setup-guidance.svg`   | G-037 |
| 13  | `006-template-fork-experience/02-rebrand-automation-flow.svg`  | G-037 |
| 14  | `007-e2e-testing-framework/01-test-architecture-diagram.svg`   | G-037 |

### Batch B: SIGNATURE-003 + G-037 (4 SVGs)

| #   | File                                                         | Fixes                |
| --- | ------------------------------------------------------------ | -------------------- |
| 15  | `003-user-authentication/01-registration-sign-in.svg`        | SIGNATURE-003, G-037 |
| 16  | `003-user-authentication/02-verification-password-reset.svg` | SIGNATURE-003, G-037 |
| 17  | `003-user-authentication/03-profile-session-management.svg`  | SIGNATURE-003, G-037 |
| 18  | `007-e2e-testing-framework/02-cicd-pipeline-flow.svg`        | SIGNATURE-003, G-037 |

### Batch C: SIGNATURE-003 + G-044 (1 SVG)

| #   | File                                           | Fixes                       |
| --- | ---------------------------------------------- | --------------------------- |
| 19  | `008-on-the-account/01-avatar-upload-flow.svg` | SIGNATURE-003, G-044, G-037 |

### Batch D: G-047 Key Concepts Position (2 SVGs) - CRITICAL

| #   | File                                                       | Fixes                                       |
| --- | ---------------------------------------------------------- | ------------------------------------------- |
| 20  | `004-mobile-first-design/01-responsive-navigation.svg`     | G-047 (translate(20,140)→direct x=40 y=940) |
| 21  | `004-mobile-first-design/02-touch-targets-performance.svg` | G-047 (translate(20,140)→direct x=40 y=940) |

**These have structural issues**: Key Concepts is in a `<g transform="translate(20, 140)">` group. Remove the group wrapper and use direct positioning.

---

## Execution Strategy

1. **Batch A first** - Use find/replace for `#6b7280` → `#374151` across all 14 files
2. **Batch B** - Fix signatures then colors
3. **Batch C** - Fix signature, add rounded corners, fix colors
4. **Batch D** - Fix Key Concepts positioning (structural change in 004-\* SVGs)

## Validation

After each batch, run:

```bash
python docs/design/wireframes/validate-wireframe.py docs/design/wireframes/000-*/
python docs/design/wireframes/validate-wireframe.py docs/design/wireframes/001-*/
# ... etc for each feature
```

## After Completion

1. Commit with message: `fix(wireframes): PATCH 21 SVGs in 000-008 (G-037, SIGNATURE-003, G-044, G-047)`
2. Update `.terminal-status.json` completedToday
3. Report back to Planner for next assignment (018-font-switcher GENERATE)

---

**Base path**: `docs/design/wireframes/`
