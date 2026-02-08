# G-047 PATCH Queue: Missing "Key Concepts" Row

**Date:** 2026-01-16
**Issue:** G-047 - 40/45 wireframes missing "Key Concepts:" row
**Action:** PATCH to add row at y=730

## SVGs Needing PATCH (40 total)

| Feature                      | SVG                                   | Status  |
| ---------------------------- | ------------------------------------- | ------- |
| 000-landing-page             | 01-landing-page.svg                   | pending |
| 000-rls-implementation       | 01-policy-architecture.svg            | pending |
| 001-wcag-aa-compliance       | 01-accessibility-dashboard.svg        | pending |
| 001-wcag-aa-compliance       | 02-cicd-pipeline-integration.svg      | pending |
| 001-wcag-aa-compliance       | 03-accessibility-controls-overlay.svg | pending |
| 002-cookie-consent           | 01-consent-modal.svg                  | pending |
| 002-cookie-consent           | 02-cookie-preferences-panel.svg       | pending |
| 002-cookie-consent           | 03-privacy-settings-page.svg          | pending |
| 003-user-authentication      | 01-registration-sign-in.svg           | pending |
| 003-user-authentication      | 02-verification-password-reset.svg    | pending |
| 003-user-authentication      | 03-profile-session-management.svg     | pending |
| 005-security-hardening       | 01-security-ux-enhancements.svg       | pending |
| 005-security-hardening       | 02-session-timeout-warning.svg        | pending |
| 005-security-hardening       | 03-security-audit-dashboard.svg       | pending |
| 006-template-fork-experience | 01-service-setup-guidance.svg         | pending |
| 006-template-fork-experience | 02-rebrand-automation-flow.svg        | pending |
| 007-e2e-testing-framework    | 01-test-architecture-diagram.svg      | pending |
| 007-e2e-testing-framework    | 02-cicd-pipeline-flow.svg             | pending |
| 008-on-the-account           | 01-avatar-upload-flow.svg             | pending |
| 009-user-messaging-system    | 01-connection-and-chat.svg            | pending |
| 009-user-messaging-system    | 02-settings-and-data.svg              | pending |
| 010-unified-blog-content     | 01-editor-and-preview.svg             | pending |
| 010-unified-blog-content     | 02-conflict-resolution.svg            | pending |
| 011-group-chats              | 01-group-creation-messaging.svg       | pending |
| 011-group-chats              | 02-member-management.svg              | pending |
| 013-oauth-messaging-password | 01-oauth-password-setup.svg           | pending |
| 013-oauth-messaging-password | 02-oauth-password-unlock.svg          | pending |
| 014-admin-welcome-email-gate | 01-verification-gate.svg              | pending |
| 014-admin-welcome-email-gate | 02-admin-setup-process.svg            | pending |
| 015-oauth-display-name       | 01-profile-population-flow.svg        | pending |
| 016-messaging-critical-fixes | 01-conversation-view.svg              | pending |
| 016-messaging-critical-fixes | 01-message-input-visibility.svg       | pending |
| 016-messaging-critical-fixes | 02-oauth-setup-flow.svg               | pending |
| 016-messaging-critical-fixes | 03-conversation-error-states.svg      | pending |
| 017-colorblind-mode          | 01-accessibility-settings.svg         | pending |
| 017-colorblind-mode          | 02-type-selection.svg                 | pending |
| 021-geolocation-map          | 01-map-interface-permission.svg       | pending |
| 021-geolocation-map          | 02-markers-and-accessibility.svg      | pending |
| 022-web3forms-integration    | 01-contact-form-ui.svg                | pending |
| 022-web3forms-integration    | 02-submission-states.svg              | pending |

## SVGs Already Compliant (5 total)

| Feature                          | SVG                              | Label Used              |
| -------------------------------- | -------------------------------- | ----------------------- |
| 004-mobile-first-design          | 01-responsive-navigation.svg     | Key Concepts            |
| 004-mobile-first-design          | 02-touch-targets-performance.svg | Key Concepts            |
| 012-welcome-message-architecture | 01-user-onboarding-flow.svg      | Additional Requirements |
| 019-google-analytics             | 01-consent-flow.svg              | Key Concepts            |
| 019-google-analytics             | 02-analytics-dashboard.svg       | Key Concepts            |

## PATCH Specification

Add to each SVG before signature block:

```xml
<!-- Key Concepts Row (G-047) -->
<text x="40" y="730" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#374151">Key Concepts:</text>
<text x="140" y="730" font-family="system-ui, sans-serif" font-size="14" fill="#6b7280">[feature-specific terms | separated | by pipes]</text>
```

Position: y=730 (20px below user story badges, 330px above signature at y=1060)
