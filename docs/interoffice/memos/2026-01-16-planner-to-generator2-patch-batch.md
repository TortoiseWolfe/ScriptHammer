# DISPATCH: Generator2 PATCH Batch (015-022)

**From**: Planner
**To**: Generator2
**Date**: 2026-01-16
**Priority**: HIGH
**Action**: PATCH 9 SVGs + REGEN 2 SVGs

---

## Overview

You were cleared at 28% while working on 015-oauth-display-name. Reassigning features 015+ to you. Generator3 will be reassigned elsewhere.

## Fix Patterns

### G-037: Annotation Text Color

```xml
<!-- FIND -->
fill="#6b7280"

<!-- REPLACE WITH -->
fill="#374151"
```

### SIGNATURE-003: Signature Left-Alignment

```xml
<!-- FIND (centered) -->
<text x="960" y="1060" text-anchor="middle" ...>

<!-- REPLACE WITH (left-aligned) -->
<text x="40" y="1060" font-family="system-ui, sans-serif" font-size="18" font-weight="bold" fill="#374151">NNN:NN | Feature | ScriptHammer</text>
```

### SIGNATURE-004: Format Check

Ensure format is exactly: `NNN:NN | Feature Name | ScriptHammer`

### G-047: Key Concepts Position (VERIFY ON ALL)

```xml
<!-- REQUIRED: Key Concepts at x=40, y=940 -->
<text x="40" y="940" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#374151">Key Concepts:</text>
<text x="150" y="940" font-family="system-ui, sans-serif" font-size="14" fill="#374151">term1 | term2 | term3</text>
```

**Check every SVG** - if Key Concepts y < 900, fix it to y=940.

---

## SVG List (11 files)

### Batch A: G-037 Only (4 SVGs)

| #   | File                                                    | Fix   |
| --- | ------------------------------------------------------- | ----- |
| 1   | `015-oauth-display-name/01-profile-population-flow.svg` | G-037 |
| 2   | `016-messaging-critical-fixes/01-conversation-view.svg` | G-037 |
| 3   | `017-colorblind-mode/01-accessibility-settings.svg`     | G-037 |
| 4   | `017-colorblind-mode/02-type-selection.svg`             | G-037 |

### Batch B: SIGNATURE-003/004 + G-037 (3 SVGs)

| #   | File                                                            | Fixes                    |
| --- | --------------------------------------------------------------- | ------------------------ |
| 5   | `016-messaging-critical-fixes/01-message-input-visibility.svg`  | SIGNATURE-003/004, G-037 |
| 6   | `016-messaging-critical-fixes/02-oauth-setup-flow.svg`          | SIGNATURE-003/004, G-037 |
| 7   | `016-messaging-critical-fixes/03-conversation-error-states.svg` | SIGNATURE-003/004, G-037 |

### Batch C: SIGNATURE-003/004 Only (2 SVGs)

| #   | File                                                   | Fixes             |
| --- | ------------------------------------------------------ | ----------------- |
| 8   | `021-geolocation-map/01-map-interface-permission.svg`  | SIGNATURE-003/004 |
| 9   | `021-geolocation-map/02-markers-and-accessibility.svg` | SIGNATURE-003/004 |

### Batch D: REGEN - Wrong Content (2 SVGs)

| #   | File                                                 | Issue                                           |
| --- | ---------------------------------------------------- | ----------------------------------------------- |
| 10  | `022-web3forms-integration/01-contact-form-ui.svg`   | Shows Landing Page instead of Contact Form      |
| 11  | `022-web3forms-integration/02-submission-states.svg` | Shows Landing Page instead of Submission States |

**REGEN requires reading spec first**: `features/integrations/022-web3forms-integration/spec.md`

---

## Execution Strategy

1. **Batch A** - Quick G-037 color fix (4 SVGs)
2. **Batch B** - Signature + color fixes (3 SVGs)
3. **Batch C** - Signature fixes only (2 SVGs)
4. **Batch D** - Full regeneration from spec (2 SVGs) - save for last

## Validation

After each batch:

```bash
python docs/design/wireframes/validate-wireframe.py docs/design/wireframes/015-*/
python docs/design/wireframes/validate-wireframe.py docs/design/wireframes/016-*/
python docs/design/wireframes/validate-wireframe.py docs/design/wireframes/017-*/
python docs/design/wireframes/validate-wireframe.py docs/design/wireframes/021-*/
python docs/design/wireframes/validate-wireframe.py docs/design/wireframes/022-*/
```

## After Completion

1. Commit with message: `fix(wireframes): PATCH 9 + REGEN 2 SVGs in 015-022`
2. Update `.terminal-status.json` completedToday
3. Report back to Planner

---

**Base path**: `docs/design/wireframes/`
