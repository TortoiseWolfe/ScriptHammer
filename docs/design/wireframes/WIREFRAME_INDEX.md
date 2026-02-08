# Wireframe Index

**Total**: 12 SVGs across 4/46 features (regenerating...)

**Theme:** `/wireframe` auto-selects theme per SVG

- UX wireframes → Light theme (Indigo palette)
- Backend wireframes → Dark theme (Slate/Violet palette)

## Status Tracking

**Source of Truth:** `docs/design/wireframes/wireframe-status.json`

Status is displayed dynamically in the wireframe viewer sidebar and can be updated via:

- `/wireframe` → sets `draft` or `regenerating`
- `/wireframe-review` → sets `review`, `issues`, `patchable`, or `approved`
- `/wireframe-status` → manual override with interactive menu

### Status Legend

| Emoji | Key          | Meaning               |
| ----- | ------------ | --------------------- |
| 📝    | draft        | Initial generation    |
| 🔄    | regenerating | Being regenerated     |
| 👁️    | review       | Under review          |
| 🔴    | issues       | Needs regeneration    |
| 🟡    | patchable    | Minor fixes only      |
| ✅    | approved     | Passed review         |
| 📋    | planning     | In /speckit.plan      |
| 🚧    | inprogress   | Being implemented     |
| ✅    | complete     | Implemented           |
| ⛔    | blocked      | Waiting on dependency |

---

## UX/Frontend Wireframes (85 SVGs)

User interfaces, forms, dashboards, modals, and interactive screens.

### Foundation (000-006)

#### 001-wcag-aa-compliance- `docs/design/wireframes/001-wcag-aa-compliance/01-accessibility-dashboard.svg` - Accessibility testing dashboard

#### 002-cookie-consent- `docs/design/wireframes/002-cookie-consent/01-consent-modal.svg` - Cookie consent modal

- `docs/design/wireframes/002-cookie-consent/02-privacy-settings.svg` - Privacy settings panel

#### 003-user-authentication- `docs/design/wireframes/003-user-authentication/01-login-signup.svg` - Login & Signup

- `docs/design/wireframes/003-user-authentication/02-email-verification.svg` - Email Verification
- `docs/design/wireframes/003-user-authentication/03-profile-settings.svg` - Profile & Settings
- `docs/design/wireframes/003-user-authentication/04-password-reset.svg` - Password Reset
- `docs/design/wireframes/003-user-authentication/05-auth-flow-architecture.svg` - Auth Flow Architecture

#### 004-mobile-first-design- `docs/design/wireframes/004-mobile-first-design/01-breakpoint-system.svg` - Responsive breakpoint system

- `docs/design/wireframes/004-mobile-first-design/02-navigation-responsive.svg` - Responsive navigation
- `docs/design/wireframes/004-mobile-first-design/03-content-layout.svg` - Responsive content layouts
- `docs/design/wireframes/004-mobile-first-design/04-image-error-states.svg` - Image error states

#### 005-security-hardening

- `docs/design/wireframes/005-security-hardening/02-security-ux.svg` - Security workflow UX

#### 006-template-fork-experience

- `docs/design/wireframes/006-template-fork-experience/02-setup-guidance-ui.svg` - Setup wizard UI

### Core Features (007-012)

#### 008-on-the-account

- `docs/design/wireframes/008-on-the-account/01-account-settings.svg` - Account settings page
- `docs/design/wireframes/008-on-the-account/02-crop-interface.svg` - Image crop tool
- `docs/design/wireframes/008-on-the-account/03-upload-states.svg` - File upload states

#### 009-user-messaging-system

- `docs/design/wireframes/009-user-messaging-system/01-connections-management.svg` - Contacts/connections list
- `docs/design/wireframes/009-user-messaging-system/02-conversation-thread.svg` - Chat conversation interface
- `docs/design/wireframes/009-user-messaging-system/03-conversation-list.svg` - Conversation list view
- `docs/design/wireframes/009-user-messaging-system/04-settings-gdpr.svg` - GDPR settings panel

#### 010-unified-blog-content

- `docs/design/wireframes/010-unified-blog-content/01-blog-list-post.svg` - Blog listing and post view
- `docs/design/wireframes/010-unified-blog-content/02-offline-editor.svg` - Blog editor with offline support
- `docs/design/wireframes/010-unified-blog-content/03-conflict-resolution.svg` - Sync conflict resolution UI

#### 011-group-chats

- `docs/design/wireframes/011-group-chats/01-create-group.svg` - Create group dialog
- `docs/design/wireframes/011-group-chats/02-group-conversation.svg` - Group chat interface
- `docs/design/wireframes/011-group-chats/03-group-info.svg` - Group info panel
- `docs/design/wireframes/011-group-chats/04-upgrade-to-group.svg` - Upgrade to group dialog

#### 012-welcome-message-architecture

- `docs/design/wireframes/012-welcome-message-architecture/02-welcome-message-ux.svg` - Welcome message UI

### Auth OAuth (013-016)

#### 013-oauth-messaging-password

- `docs/design/wireframes/013-oauth-messaging-password/01-setup-mode.svg` - OAuth password setup modal
- `docs/design/wireframes/013-oauth-messaging-password/02-unlock-mode.svg` - Unlock password modal
- `docs/design/wireframes/013-oauth-messaging-password/03-validation-states.svg` - Form validation states

#### 014-admin-welcome-email-gate

- `docs/design/wireframes/014-admin-welcome-email-gate/01-email-verification-gate.svg` - Email verification gate UI

#### 016-messaging-critical-fixes

- `docs/design/wireframes/016-messaging-critical-fixes/01-input-visibility-fix.svg` - Input field visibility improvements
- `docs/design/wireframes/016-messaging-critical-fixes/02-oauth-setup-page.svg` - OAuth setup page

### Enhancements (017-021)

#### 017-colorblind-mode

- `docs/design/wireframes/017-colorblind-mode/01-colorblind-settings.svg` - Colorblind mode settings panel
- `docs/design/wireframes/017-colorblind-mode/02-status-indicators-simulation.svg` - Colorblind-safe status indicators

#### 018-font-switcher

- `docs/design/wireframes/018-font-switcher/01-font-selector-panel.svg` - Font selection panel

#### 020-pwa-background-sync

- `docs/design/wireframes/020-pwa-background-sync/01-offline-queue-ui.svg` - Offline queue UI
- `docs/design/wireframes/020-pwa-background-sync/02-ui-states.svg` - Queue state indicators
- `docs/design/wireframes/020-pwa-background-sync/03-retry-states-notifications.svg` - Retry notifications

#### 021-geolocation-map

- `docs/design/wireframes/021-geolocation-map/01-map-interface.svg` - Map interface
- `docs/design/wireframes/021-geolocation-map/02-permission-states.svg` - Permission request dialogs
- `docs/design/wireframes/021-geolocation-map/03-keyboard-accessibility.svg` - Accessible map controls

### Integrations (022-026)

#### 022-web3forms-integration

- `docs/design/wireframes/022-web3forms-integration/01-contact-form-layout.svg` - Contact form layout
- `docs/design/wireframes/022-web3forms-integration/02-form-states.svg` - Form state indicators
- `docs/design/wireframes/022-web3forms-integration/03-offline-queue.svg` - Offline form queue

#### 023-emailjs-integration

- `docs/design/wireframes/023-emailjs-integration/02-health-dashboard.svg` - Email health monitoring dashboard

#### 024-payment-integration

- `docs/design/wireframes/024-payment-integration/01-one-time-payment.svg` - One-time payment form
- `docs/design/wireframes/024-payment-integration/02-subscription-plans.svg` - Subscription plan selection
- `docs/design/wireframes/024-payment-integration/03-payment-states.svg` - Payment state indicators

#### 025-blog-social-features

- `docs/design/wireframes/025-blog-social-features/01-blog-post-social.svg` - Social sharing on blog posts
- `docs/design/wireframes/025-blog-social-features/02-social-preview-metadata.svg` - Social preview metadata
- `docs/design/wireframes/025-blog-social-features/03-author-profile-states.svg` - Author profile UI

#### 026-unified-messaging-sidebar

- `docs/design/wireframes/026-unified-messaging-sidebar/01-sidebar-tabs.svg` - Messaging sidebar tabs
- `docs/design/wireframes/026-unified-messaging-sidebar/02-message-connection.svg` - Message connections UI
- `docs/design/wireframes/026-unified-messaging-sidebar/03-mobile-drawer.svg` - Mobile drawer UI

### Polish (027-030)

#### 027-ux-polish

- `docs/design/wireframes/027-ux-polish/01-character-count-fix.svg` - Character counter UI
- `docs/design/wireframes/027-ux-polish/02-markdown-rendering.svg` - Markdown preview

#### 028-enhanced-geolocation

- `docs/design/wireframes/028-enhanced-geolocation/01-desktop-location.svg` - Desktop location UI
- `docs/design/wireframes/028-enhanced-geolocation/02-mobile-gps.svg` - Mobile GPS interface
- `docs/design/wireframes/028-enhanced-geolocation/03-location-states.svg` - Location state indicators

#### 029-seo-editorial-assistant

- `docs/design/wireframes/029-seo-editorial-assistant/01-editor-seo-panel.svg` - Editor with SEO sidebar
- `docs/design/wireframes/029-seo-editorial-assistant/02-seo-score-states.svg` - SEO score indicators
- `docs/design/wireframes/029-seo-editorial-assistant/03-export-flow.svg` - Export dialog
- `docs/design/wireframes/029-seo-editorial-assistant/04-import-diff-view.svg` - Import diff viewer
- `docs/design/wireframes/029-seo-editorial-assistant/05-terminal-output.svg` - Terminal output view (backend - stays dark)

#### 030-calendar-integration

- `docs/design/wireframes/030-calendar-integration/01-schedule-page-booking.svg` - Calendar booking UI
- `docs/design/wireframes/030-calendar-integration/02-consent-flow-states.svg` - Consent flow states

### Payments (038-043)

#### 038-payment-dashboard

- `docs/design/wireframes/038-payment-dashboard/01-dashboard-overview.svg` - Payment dashboard overview
- `docs/design/wireframes/038-payment-dashboard/02-transaction-details.svg` - Transaction detail view
- `docs/design/wireframes/038-payment-dashboard/03-dashboard-states.svg` - Dashboard state variations

#### 039-payment-offline-queue

- `docs/design/wireframes/039-payment-offline-queue/01-queue-ui-overview.svg` - Offline queue overview
- `docs/design/wireframes/039-payment-offline-queue/02-retry-states.svg` - Retry state indicators

#### 040-payment-retry-ui

- `docs/design/wireframes/040-payment-retry-ui/01-error-display.svg` - Payment error display
- `docs/design/wireframes/040-payment-retry-ui/02-update-payment-method.svg` - Update payment method form
- `docs/design/wireframes/040-payment-retry-ui/03-recovery-wizard.svg` - Payment recovery wizard

#### 041-paypal-subscriptions

- `docs/design/wireframes/041-paypal-subscriptions/01-subscription-dashboard.svg` - Subscription dashboard
- `docs/design/wireframes/041-paypal-subscriptions/02-subscription-detail.svg` - Subscription detail view
- `docs/design/wireframes/041-paypal-subscriptions/03-cancel-confirmation.svg` - Cancel confirmation dialog
- `docs/design/wireframes/041-paypal-subscriptions/04-pause-resume-flow.svg` - Pause/resume flow

### Code Quality (044-045)

#### 044-error-handler-integrations

- `docs/design/wireframes/044-error-handler-integrations/02-toast-notifications.svg` - Toast notification system
- `docs/design/wireframes/044-error-handler-integrations/03-error-boundary-fallbacks.svg` - Error boundary fallback UI

#### 045-disqus-theme

- `docs/design/wireframes/045-disqus-theme/02-consent-states.svg` - Disqus consent states
- `docs/design/wireframes/045-disqus-theme/03-dynamic-theme-updates.svg` - Dynamic theme switching

---

## Backend/Abstract Wireframes (38 SVGs)

Architecture diagrams, data flows, test flows, and system diagrams.

### Foundation (000-006)

#### 000-rls-implementation- `docs/design/wireframes/000-rls-implementation/rls-architecture.svg` - Row Level Security architecture

#### 001-wcag-aa-compliance- `docs/design/wireframes/001-wcag-aa-compliance/02-wcag-testing-pipeline.svg` - WCAG testing pipeline

#### 005-security-hardening

- `docs/design/wireframes/005-security-hardening/01-security-architecture.svg` - Security architecture diagram

#### 006-template-fork-experience

- `docs/design/wireframes/006-template-fork-experience/01-rebrand-cli-flow.svg` - CLI rebrand flow diagram

#### 007-e2e-testing-framework

- `docs/design/wireframes/007-e2e-testing-framework/01-test-architecture.svg` - E2E test architecture
- `docs/design/wireframes/007-e2e-testing-framework/02-ci-cd-pipeline.svg` - CI/CD pipeline diagram

### Core Features (007-012)

#### 010-unified-blog-content

- `docs/design/wireframes/010-unified-blog-content/04-migration-dashboard.svg` - Content migration dashboard

#### 012-welcome-message-architecture

- `docs/design/wireframes/012-welcome-message-architecture/01-system-architecture.svg` - Welcome message system architecture

### Auth OAuth (013-016)

#### 014-admin-welcome-email-gate

- `docs/design/wireframes/014-admin-welcome-email-gate/02-admin-setup-architecture.svg` - Admin setup architecture

#### 015-oauth-display-name

- `docs/design/wireframes/015-oauth-display-name/01-oauth-flow-data-population.svg` - OAuth data population flow
- `docs/design/wireframes/015-oauth-display-name/02-fallback-cascade-migration.svg` - Data migration cascade

### Enhancements (017-021)

#### 018-font-switcher

- `docs/design/wireframes/018-font-switcher/02-font-persistence-theme.svg` - Font persistence architecture

#### 019-google-analytics

- `docs/design/wireframes/019-google-analytics/01-consent-analytics-flow.svg` - Analytics consent flow
- `docs/design/wireframes/019-google-analytics/02-events-webvitals-tracking.svg` - Event tracking architecture

#### 020-pwa-background-sync

- `docs/design/wireframes/020-pwa-background-sync/01-sync-flow-diagram.svg` - Background sync flow
- `docs/design/wireframes/020-pwa-background-sync/02-sync-flow-architecture.svg` - Sync architecture diagram

### Integrations (022-026)

#### 023-emailjs-integration

- `docs/design/wireframes/023-emailjs-integration/01-failover-architecture.svg` - Email failover architecture

#### 024-payment-integration

- `docs/design/wireframes/024-payment-integration/04-payment-architecture.svg` - Payment system architecture

### Polish (027-030)

#### 030-calendar-integration

- `docs/design/wireframes/030-calendar-integration/03-theme-provider-architecture.svg` - Theme provider architecture

### Testing (031-037)

#### 031-standardize-test-users

- `docs/design/wireframes/031-standardize-test-users/01-test-user-architecture.svg` - Test user architecture
- `docs/design/wireframes/031-standardize-test-users/02-test-execution-flow.svg` - Test execution flow

#### 032-signup-e2e-tests

- `docs/design/wireframes/032-signup-e2e-tests/01-test-user-factory-architecture.svg` - Test factory architecture
- `docs/design/wireframes/032-signup-e2e-tests/02-test-suite-coverage.svg` - Test coverage matrix

#### 033-seo-library-tests

- `docs/design/wireframes/033-seo-library-tests/01-module-test-architecture.svg` - Module test architecture
- `docs/design/wireframes/033-seo-library-tests/02-test-coverage-dashboard.svg` - Test coverage dashboard

#### 034-blog-library-tests

- `docs/design/wireframes/034-blog-library-tests/01-module-test-architecture.svg` - Module test architecture
- `docs/design/wireframes/034-blog-library-tests/02-test-coverage-matrix.svg` - Test coverage matrix

#### 035-messaging-service-tests

- `docs/design/wireframes/035-messaging-service-tests/01-service-test-architecture.svg` - Service test architecture
- `docs/design/wireframes/035-messaging-service-tests/02-test-coverage-security-matrix.svg` - Security coverage matrix

#### 036-auth-component-tests

- `docs/design/wireframes/036-auth-component-tests/01-test-suite-architecture.svg` - Test suite architecture
- `docs/design/wireframes/036-auth-component-tests/02-test-scenario-matrix.svg` - Test scenario matrix

#### 037-game-a11y-tests

- `docs/design/wireframes/037-game-a11y-tests/01-a11y-test-architecture.svg` - A11y test architecture
- `docs/design/wireframes/037-game-a11y-tests/02-component-coverage-matrix.svg` - Component coverage matrix

### Payments (038-043)

#### 042-payment-rls-policies

- `docs/design/wireframes/042-payment-rls-policies/01-rls-policy-architecture.svg` - RLS policy architecture
- `docs/design/wireframes/042-payment-rls-policies/02-access-control-matrix.svg` - Access control matrix

#### 043-group-service

- `docs/design/wireframes/043-group-service/01-service-architecture.svg` - Group service architecture
- `docs/design/wireframes/043-group-service/02-operation-flows.svg` - Service operation flows
- `docs/design/wireframes/043-group-service/03-permission-model.svg` - Permission model diagram

### Code Quality (044-045)

#### 044-error-handler-integrations

- `docs/design/wireframes/044-error-handler-integrations/01-error-monitoring-architecture.svg` - Error monitoring architecture

#### 045-disqus-theme

- `docs/design/wireframes/045-disqus-theme/01-theme-mapping-system.svg` - Theme mapping architecture
