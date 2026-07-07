# Signature Alignment Detail Report

**Date:** 2026-01-15
**Role:** Inspector
**Check:** `signature_alignment`
**Tool:** `python3 inspect-wireframes.py --report`

---

## Summary

| Metric                           | Value                                   |
| -------------------------------- | --------------------------------------- |
| Total SVGs with alignment issues | 18                                      |
| Current position (all)           | `x="960"` with `text-anchor="middle"`   |
| Expected position                | `x="40"` (left-aligned, no text-anchor) |

---

## All 18 SVGs with Signature Alignment Issues

| #   | SVG Path                                                        | Current x | Expected x |
| --- | --------------------------------------------------------------- | --------- | ---------- |
| 1   | `003-user-authentication/01-registration-sign-in.svg`           | 960       | 40         |
| 2   | `003-user-authentication/02-verification-password-reset.svg`    | 960       | 40         |
| 3   | `003-user-authentication/03-profile-session-management.svg`     | 960       | 40         |
| 4   | `007-e2e-testing-framework/02-cicd-pipeline-flow.svg`           | 960       | 40         |
| 5   | `008-on-the-account/01-avatar-upload-flow.svg`                  | 960       | 40         |
| 6   | `010-unified-blog-content/01-editor-and-preview.svg`            | 960       | 40         |
| 7   | `010-unified-blog-content/02-conflict-resolution.svg`           | 960       | 40         |
| 8   | `011-group-chats/01-group-creation-messaging.svg`               | 960       | 40         |
| 9   | `011-group-chats/02-member-management.svg`                      | 960       | 40         |
| 10  | `014-admin-welcome-email-gate/01-verification-gate.svg`         | 960       | 40         |
| 11  | `014-admin-welcome-email-gate/02-admin-setup-process.svg`       | 960       | 40         |
| 12  | `016-messaging-critical-fixes/01-message-input-visibility.svg`  | 960       | 40         |
| 13  | `016-messaging-critical-fixes/02-oauth-setup-flow.svg`          | 960       | 40         |
| 14  | `016-messaging-critical-fixes/03-conversation-error-states.svg` | 960       | 40         |
| 15  | `021-geolocation-map/01-map-interface-permission.svg`           | 960       | 40         |
| 16  | `021-geolocation-map/02-markers-and-accessibility.svg`          | 960       | 40         |
| 17  | `022-web3forms-integration/01-contact-form-ui.svg`              | 960       | 40         |
| 18  | `022-web3forms-integration/02-submission-states.svg`            | 960       | 40         |

---

## Grouped by Feature

### 003-user-authentication (3 files)

- `01-registration-sign-in.svg` - x=960 → x=40
- `02-verification-password-reset.svg` - x=960 → x=40
- `03-profile-session-management.svg` - x=960 → x=40

### 007-e2e-testing-framework (1 file)

- `02-cicd-pipeline-flow.svg` - x=960 → x=40

### 008-on-the-account (1 file)

- `01-avatar-upload-flow.svg` - x=960 → x=40

### 010-unified-blog-content (2 files)

- `01-editor-and-preview.svg` - x=960 → x=40
- `02-conflict-resolution.svg` - x=960 → x=40

### 011-group-chats (2 files)

- `01-group-creation-messaging.svg` - x=960 → x=40
- `02-member-management.svg` - x=960 → x=40

### 014-admin-welcome-email-gate (2 files)

- `01-verification-gate.svg` - x=960 → x=40
- `02-admin-setup-process.svg` - x=960 → x=40

### 016-messaging-critical-fixes (3 files)

- `01-message-input-visibility.svg` - x=960 → x=40
- `02-oauth-setup-flow.svg` - x=960 → x=40
- `03-conversation-error-states.svg` - x=960 → x=40

### 021-geolocation-map (2 files)

- `01-map-interface-permission.svg` - x=960 → x=40
- `02-markers-and-accessibility.svg` - x=960 → x=40

### 022-web3forms-integration (2 files)

- `01-contact-form-ui.svg` - x=960 → x=40
- `02-submission-states.svg` - x=960 → x=40

---

## Fix Required

**Current (wrong):**

```xml
<text x="960" y="1060" text-anchor="middle" ...>NNN:NN | Feature | ScriptHammer</text>
```

**Expected (correct):**

```xml
<text x="40" y="1060" ...>NNN:NN | Feature | ScriptHammer</text>
```

**Changes:**

1. `x="960"` → `x="40"`
2. Remove `text-anchor="middle"`

---

## Classification

**PATCH** - Simple attribute edit, no regeneration needed.

---

## Reference

- GENERAL_ISSUES.md: G-040 (signature left-alignment)
- wireframe-pipeline.md: Signature Block rules
