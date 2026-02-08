# Screen Inventory

Generated: 2026-01-15 | Refresh: `/refresh-inventories`

## Wireframe Status by Feature

| Feature                          | SVGs | Status          |
| -------------------------------- | ---- | --------------- |
| 000-landing-page                 | 1    | Complete        |
| 000-rls-implementation           | 1    | Complete        |
| 001-wcag-aa-compliance           | 3    | Review pending  |
| 002-cookie-consent               | 3    | Review pending  |
| 003-user-authentication          | 3    | Complete        |
| 004-mobile-first-design          | 2    | Review pending  |
| 005-security-hardening           | 3    | Review pending  |
| 006-template-fork-experience     | 2    | Complete        |
| 007-e2e-testing-framework        | 2    | Review pending  |
| 008-on-the-account               | 1    | Review pending  |
| 009-user-messaging-system        | 2    | Review pending  |
| 010-unified-blog-content         | 2    | Review pending  |
| 011-group-chats                  | 2    | Complete        |
| 012-welcome-message-architecture | 1    | Review pending  |
| 013-oauth-messaging-password     | 2    | Review pending  |
| 014-admin-welcome-email-gate     | 2    | Queued          |
| 015-oauth-display-name           | 1    | Review pending  |
| 016-messaging-critical-fixes     | 0    | Queued (3 SVGs) |
| 017-colorblind-mode              | 0    | Queued (2 SVGs) |
| 019-google-analytics             | 2    | Review pending  |

**Total SVGs**: 35 complete, 6 queued

## Features Awaiting Wireframes

| Feature                  | Category     | Est. Screens |
| ------------------------ | ------------ | ------------ |
| 018-font-switcher        | Enhancements | 2            |
| 020-pwa-background-sync  | Enhancements | 2            |
| 021-geolocation-map      | Enhancements | 2            |
| 022-web3forms            | Integrations | 1            |
| 023-emailjs              | Integrations | 1            |
| 024-payment-integration  | Payments     | 3            |
| 025-blog-social          | Content      | 2            |
| 026-unified-sidebar      | Messaging    | 2            |
| 027-ux-polish            | Polish       | 2            |
| 028-enhanced-geolocation | Enhancements | 2            |
| 029-seo-editorial        | Content      | 2            |
| 030-calendar-integration | Enhancements | 2            |
| 038-payment-dashboard    | Payments     | 3            |
| 039-payment-offline      | Payments     | 2            |
| 040-payment-retry        | Payments     | 2            |
| 041-paypal-subscriptions | Payments     | 2            |
| 042-payment-rls          | Payments     | 1            |
| 043-group-service        | Messaging    | 1            |
| 044-error-handlers       | Code Quality | 1            |
| 045-disqus-theme         | Code Quality | 1            |

## Screen Types

| Type          | Count | Examples                            |
| ------------- | ----- | ----------------------------------- |
| Dashboard     | 5     | Analytics, Security audit, Payment  |
| Form/Modal    | 8     | Registration, Consent, Password     |
| Flow diagram  | 6     | Auth flow, Onboarding, OAuth        |
| Settings page | 4     | Cookie prefs, Profile, Privacy      |
| Architecture  | 3     | RLS policies, Test framework, CI/CD |

## Quick Commands

```bash
# List all SVGs
ls docs/design/wireframes/*/*.svg | wc -l

# Find features without wireframes
ls features/*/* -d | while read f; do
  feature=$(basename "$f")
  [ ! -d "docs/design/wireframes/$feature" ] && echo "$feature"
done

# Check queue
cat docs/design/wireframes/.terminal-status.json | jq '.queue[] | select(.action=="GENERATE")'
```
