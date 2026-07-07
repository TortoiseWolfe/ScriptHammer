# Inspector Report: Batch004 Pattern Violations

**Date:** 2026-01-15
**Role:** Inspector Terminal
**Source:** `docs/design/wireframes/png/overviews_004/`
**Wireframes Inspected:** 22

---

## Summary

| Check                              | Violations | Severity |
| ---------------------------------- | ---------- | -------- |
| footer_nav_corners (G-044)         | 22/22      | PATCH    |
| signature_alignment                | 11/22      | PATCH    |
| signature_format                   | 4/22       | PATCH    |
| mobile_active_icon_missing (G-045) | 5/22       | PATCH    |
| mobile_active_corner_shape (G-046) | 3/22       | PATCH    |

**CRITICAL: ALL 22 wireframes fail G-044 (missing rx attribute on footer/nav)**

---

## Detailed Violations by Wireframe

### 1. Footer Corners (G-044) - ALL WIREFRAMES

Every batch004 wireframe missing `rx="8"` on:

- Desktop footer container
- Mobile bottom nav bar

**Fix:** Add `rx="8"` to footer/nav rect elements.

### 2. Signature Alignment (11 wireframes)

| Wireframe                                                 | Issue                       |
| --------------------------------------------------------- | --------------------------- |
| 003-user-authentication/01-registration-sign-in           | x=960, text-anchor="middle" |
| 003-user-authentication/02-verification-password-reset    | x=960, text-anchor="middle" |
| 003-user-authentication/03-profile-session-management     | x=960, text-anchor="middle" |
| 008-on-the-account/01-avatar-upload-flow                  | x=960, text-anchor="middle" |
| 010-unified-blog-content/01-editor-and-preview            | x=960, text-anchor="middle" |
| 010-unified-blog-content/02-conflict-resolution           | x=960, text-anchor="middle" |
| 011-group-chats/01-group-creation-messaging               | x=960, text-anchor="middle" |
| 011-group-chats/02-member-management                      | x=960, text-anchor="middle" |
| 016-messaging-critical-fixes/01-message-input-visibility  | x=960, text-anchor="middle" |
| 016-messaging-critical-fixes/03-conversation-error-states | x=960, text-anchor="middle" |
| 021-geolocation-map/02-markers-and-accessibility          | x=960, text-anchor="middle" |

**Expected:** `x="40"` (left-aligned, no text-anchor)

### 3. Signature Format (4 wireframes)

| Wireframe                                                 | Actual                            | Expected                                             |
| --------------------------------------------------------- | --------------------------------- | ---------------------------------------------------- |
| 010-unified-blog-content/01-editor-and-preview            | "ScriptHammer Wireframe v5 - ..." | "010:01 \| Unified Blog Content \| ScriptHammer"     |
| 010-unified-blog-content/02-conflict-resolution           | "ScriptHammer Wireframe v5 - ..." | "010:02 \| Unified Blog Content \| ScriptHammer"     |
| 016-messaging-critical-fixes/01-message-input-visibility  | "ScriptHammer v0.1 - ..."         | "016:01 \| Messaging Critical Fixes \| ScriptHammer" |
| 016-messaging-critical-fixes/03-conversation-error-states | "ScriptHammer v0.1 - ..."         | "016:03 \| Messaging Critical Fixes \| ScriptHammer" |

**Expected Format:** `NNN:NN | Feature Name | ScriptHammer`

### 4. Mobile Active State Missing Icon (G-045) - 5 wireframes

| Wireframe                                              |
| ------------------------------------------------------ |
| 003-user-authentication/01-registration-sign-in        |
| 003-user-authentication/02-verification-password-reset |
| 003-user-authentication/03-profile-session-management  |
| 009-user-messaging-system/01-connection-and-chat       |
| 009-user-messaging-system/02-settings-and-data         |

**Issue:** Mobile active state has text only, missing white icon path.

### 5. Mobile Corner Tab Shape (G-046) - 3 wireframes

| Wireframe                                              |
| ------------------------------------------------------ |
| 003-user-authentication/01-registration-sign-in        |
| 003-user-authentication/02-verification-password-reset |
| 003-user-authentication/03-profile-session-management  |

**Issue:** Corner tabs (Home/Account) use `<rect>` instead of `<path>` with rounded corner.

---

## Wireframes with CLEAN Signatures (11/22)

These wireframes have correct signature alignment and format:

- 000-landing-page/01-landing-page
- 000-rls-implementation/01-policy-architecture
- 002-cookie-consent/02-cookie-preferences-panel
- 005-security-hardening/01-security-ux-enhancements
- 005-security-hardening/02-session-timeout-warning
- 006-template-fork-experience/01-service-setup-guidance
- 006-template-fork-experience/02-rebrand-automation-flow
- 007-e2e-testing-framework/01-test-architecture-diagram
- 009-user-messaging-system/01-connection-and-chat
- 009-user-messaging-system/02-settings-and-data
- 012-welcome-message-architecture/01-user-onboarding-flow

---

## Cross-Reference with Operator QC Review

The Operator's QC review identified additional issues NOT detected by automated inspection:

| Category         | Count | Notes                                       |
| ---------------- | ----- | ------------------------------------------- |
| SPEC-ORDER       | 10    | User story sequence (requires spec changes) |
| REGEN (callouts) | 12    | Missing/hidden callouts (visual issue)      |
| PATCH (spacing)  | 3     | Annotation panel cramming                   |
| DESIGN-GAP       | 1     | Social discovery UX gap                     |

**Note:** Callout consistency and annotation spacing issues are VISUAL problems not detectable by the current inspector script. These require PNG screenshot review.

---

## Recommended Actions

### Priority 1: G-044 Footer Corners (ALL 22)

```bash
# Batch patch all SVGs - add rx="8" to footer/nav rects
# Classification: PATCH
```

### Priority 2: Signature Alignment (11)

```bash
# Change x="960" to x="40", remove text-anchor="middle"
# Classification: PATCH
```

### Priority 3: Signature Format (4)

```bash
# Regenerate with correct format: NNN:NN | Feature | ScriptHammer
# Classification: PATCH or REGEN
```

### Priority 4: Mobile Active States (5)

```bash
# G-045/G-046: Update mobile nav overlays with icons and path elements
# Classification: PATCH
```

---

## Issues Logged

Inspector violations automatically logged to respective `.issues.md` files:

- 000-landing-page/01-landing-page.issues.md
- 000-rls-implementation/01-policy-architecture.issues.md
- 002-cookie-consent/02-cookie-preferences-panel.issues.md
- 003-user-authentication/01-registration-sign-in.issues.md
- 003-user-authentication/02-verification-password-reset.issues.md
- 003-user-authentication/03-profile-session-management.issues.md
- 005-security-hardening/01-security-ux-enhancements.issues.md
- 005-security-hardening/02-session-timeout-warning.issues.md
- 006-template-fork-experience/01-service-setup-guidance.issues.md
- 006-template-fork-experience/02-rebrand-automation-flow.issues.md
- 007-e2e-testing-framework/01-test-architecture-diagram.issues.md
- 008-on-the-account/01-avatar-upload-flow.issues.md
- 009-user-messaging-system/01-connection-and-chat.issues.md
- 009-user-messaging-system/02-settings-and-data.issues.md
- 010-unified-blog-content/01-editor-and-preview.issues.md
- 010-unified-blog-content/02-conflict-resolution.issues.md
- 011-group-chats/01-group-creation-messaging.issues.md
- 011-group-chats/02-member-management.issues.md
- 012-welcome-message-architecture/01-user-onboarding-flow.issues.md
- 016-messaging-critical-fixes/01-message-input-visibility.issues.md
- 016-messaging-critical-fixes/03-conversation-error-states.issues.md
- 021-geolocation-map/02-markers-and-accessibility.issues.md
