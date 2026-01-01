# Wireframe Review Plan

Visual quality review of all SVG wireframes using computer vision to document issues.

**Command**: `/wireframe-review`

---

## Progress Tracker

### Current Batches (wireframes exist)

| Batch | Features | SVGs | Status | Issues | Reviewed |
|-------|----------|------|--------|--------|----------|
| 1 | Foundation (000-006) | 22 | Complete | 1 minor | 2026-01-01 |
| 2 | Core Features (007-012) | 21 | Complete | 0 | 2026-01-01 |
| 3 | Auth OAuth (013-016) | 9 | Not Started | - | - |
| 4 | Enhancements (017-021) | 12 | Not Started | - | - |
| 5 | Integrations (022-026) | 16 | Not Started | - | - |
| 6 | Polish (027-030) | 12 | Not Started | - | - |
| 7 | Testing Part 1 (031-033) | 6 | Not Started | - | - |

### Future Batches (wireframes pending)

| Batch | Features | Category | Status |
|-------|----------|----------|--------|
| 8 | 034-037 | Testing Part 2 | Pending Wireframes |
| 9 | 038-043 | Payments | Pending Wireframes |
| 10 | 044-045 | Code Quality | Pending Wireframes |

**Totals**: 98 SVGs ready | 43 reviewed | 1 issue found

---

## Issue Categories Checklist

### Visual/Rendering Issues
- [ ] **Text overlap** - Labels, headings, or body text overlapping each other
- [ ] **Text truncation** - Content cut off by container boundaries
- [ ] **Element clipping** - UI elements extending beyond their panels/frames
- [ ] **Broken connectors** - Arrows or lines not connecting properly (architecture diagrams)
- [ ] **Missing elements** - Incomplete UI components or empty placeholder areas

### Layout Issues
- [ ] **Misalignment** - Elements not properly aligned (horizontal/vertical)
- [ ] **Spacing inconsistencies** - Uneven margins, padding, or gutters
- [ ] **Mobile frame issues** - Mobile viewport content not fitting properly
- [ ] **Desktop/mobile parity** - Missing elements in one view that exist in the other

### Accessibility/Contrast Issues
- [ ] **Low contrast text** - Text difficult to read against background
- [ ] **Missing labels** - Icons or buttons without text alternatives
- [ ] **Color-only indicators** - Status shown only by color (a11y concern)

### Content/Spec Compliance
- [ ] **Missing FR coverage** - Functional requirements not represented
- [ ] **Typos** - Spelling/grammar errors in visible text
- [ ] **Wrong theme** - UI screens using dark theme or architecture using light
- [ ] **Outdated content** - Text that doesn't match current spec.md

---

## Feature List by Batch

### Batch 1 - Foundation (000-006)
| Feature | SVGs | Issue File |
|---------|------|------------|
| 000-rls-implementation | 3 | [WIREFRAME_ISSUES.md](wireframes/000-rls-implementation/WIREFRAME_ISSUES.md) |
| 001-wcag-aa-compliance | 3 | [WIREFRAME_ISSUES.md](wireframes/001-wcag-aa-compliance/WIREFRAME_ISSUES.md) |
| 002-cookie-consent | 2 | [WIREFRAME_ISSUES.md](wireframes/002-cookie-consent/WIREFRAME_ISSUES.md) |
| 003-user-authentication | 5 | [WIREFRAME_ISSUES.md](wireframes/003-user-authentication/WIREFRAME_ISSUES.md) |
| 004-mobile-first-design | 4 | [WIREFRAME_ISSUES.md](wireframes/004-mobile-first-design/WIREFRAME_ISSUES.md) |
| 005-security-hardening | 2 | [WIREFRAME_ISSUES.md](wireframes/005-security-hardening/WIREFRAME_ISSUES.md) |
| 006-template-fork-experience | 3 | [WIREFRAME_ISSUES.md](wireframes/006-template-fork-experience/WIREFRAME_ISSUES.md) |

### Batch 2 - Core Features (007-012)
| Feature | SVGs | Issue File |
|---------|------|------------|
| 007-e2e-testing-framework | 2 | [WIREFRAME_ISSUES.md](wireframes/007-e2e-testing-framework/WIREFRAME_ISSUES.md) |
| 008-on-the-account | 3 | [WIREFRAME_ISSUES.md](wireframes/008-on-the-account/WIREFRAME_ISSUES.md) |
| 009-user-messaging-system | 4 | [WIREFRAME_ISSUES.md](wireframes/009-user-messaging-system/WIREFRAME_ISSUES.md) |
| 010-unified-blog-content | 5 | [WIREFRAME_ISSUES.md](wireframes/010-unified-blog-content/WIREFRAME_ISSUES.md) |
| 011-group-chats | 4 | [WIREFRAME_ISSUES.md](wireframes/011-group-chats/WIREFRAME_ISSUES.md) |
| 012-welcome-message-architecture | 3 | [WIREFRAME_ISSUES.md](wireframes/012-welcome-message-architecture/WIREFRAME_ISSUES.md) |

### Batch 3 - Auth OAuth (013-016)
| Feature | SVGs | Issue File |
|---------|------|------------|
| 013-oauth-messaging-password | 2 | [WIREFRAME_ISSUES.md](wireframes/013-oauth-messaging-password/WIREFRAME_ISSUES.md) |
| 014-admin-welcome-email-gate | 2 | [WIREFRAME_ISSUES.md](wireframes/014-admin-welcome-email-gate/WIREFRAME_ISSUES.md) |
| 015-oauth-display-name | 2 | [WIREFRAME_ISSUES.md](wireframes/015-oauth-display-name/WIREFRAME_ISSUES.md) |
| 016-messaging-critical-fixes | 3 | [WIREFRAME_ISSUES.md](wireframes/016-messaging-critical-fixes/WIREFRAME_ISSUES.md) |

### Batch 4 - Enhancements (017-021)
| Feature | SVGs | Issue File |
|---------|------|------------|
| 017-colorblind-mode | 2 | [WIREFRAME_ISSUES.md](wireframes/017-colorblind-mode/WIREFRAME_ISSUES.md) |
| 018-font-switcher | 2 | [WIREFRAME_ISSUES.md](wireframes/018-font-switcher/WIREFRAME_ISSUES.md) |
| 019-google-analytics | 2 | [WIREFRAME_ISSUES.md](wireframes/019-google-analytics/WIREFRAME_ISSUES.md) |
| 020-pwa-background-sync | 3 | [WIREFRAME_ISSUES.md](wireframes/020-pwa-background-sync/WIREFRAME_ISSUES.md) |
| 021-geolocation-map | 3 | [WIREFRAME_ISSUES.md](wireframes/021-geolocation-map/WIREFRAME_ISSUES.md) |

### Batch 5 - Integrations (022-026)
| Feature | SVGs | Issue File |
|---------|------|------------|
| 022-web3forms-integration | 3 | [WIREFRAME_ISSUES.md](wireframes/022-web3forms-integration/WIREFRAME_ISSUES.md) |
| 023-emailjs-integration | 2 | [WIREFRAME_ISSUES.md](wireframes/023-emailjs-integration/WIREFRAME_ISSUES.md) |
| 024-payment-integration | 4 | [WIREFRAME_ISSUES.md](wireframes/024-payment-integration/WIREFRAME_ISSUES.md) |
| 025-blog-social-features | 3 | [WIREFRAME_ISSUES.md](wireframes/025-blog-social-features/WIREFRAME_ISSUES.md) |
| 026-unified-messaging-sidebar | 4 | [WIREFRAME_ISSUES.md](wireframes/026-unified-messaging-sidebar/WIREFRAME_ISSUES.md) |

### Batch 6 - Polish (027-030)
| Feature | SVGs | Issue File |
|---------|------|------------|
| 027-ux-polish | 2 | [WIREFRAME_ISSUES.md](wireframes/027-ux-polish/WIREFRAME_ISSUES.md) |
| 028-enhanced-geolocation | 2 | [WIREFRAME_ISSUES.md](wireframes/028-enhanced-geolocation/WIREFRAME_ISSUES.md) |
| 029-seo-editorial-assistant | 4 | [WIREFRAME_ISSUES.md](wireframes/029-seo-editorial-assistant/WIREFRAME_ISSUES.md) |
| 030-calendar-integration | 4 | [WIREFRAME_ISSUES.md](wireframes/030-calendar-integration/WIREFRAME_ISSUES.md) |

### Batch 7 - Testing Part 1 (031-033)
| Feature | SVGs | Issue File |
|---------|------|------------|
| 031-standardize-test-users | 2 | [WIREFRAME_ISSUES.md](wireframes/031-standardize-test-users/WIREFRAME_ISSUES.md) |
| 032-signup-e2e-tests | 2 | [WIREFRAME_ISSUES.md](wireframes/032-signup-e2e-tests/WIREFRAME_ISSUES.md) |
| 033-seo-library-tests | 2 | [WIREFRAME_ISSUES.md](wireframes/033-seo-library-tests/WIREFRAME_ISSUES.md) |

### Batch 8 - Testing Part 2 (034-037) *Pending Wireframes*
- 034-blog-library-tests
- 035-messaging-service-tests
- 036-auth-component-tests
- 037-game-a11y-tests

### Batch 9 - Payments (038-043) *Pending Wireframes*
- 038-payment-dashboard
- 039-subscription-management
- 040-invoice-system
- 041-refund-handling
- 042-payment-analytics
- 043-payment-notifications

### Batch 10 - Code Quality (044-045) *Pending Wireframes*
- 044-error-handling
- 045-themes

---

## Usage

```bash
/wireframe-review batch 1    # Review Foundation features (000-006)
/wireframe-review batch 8    # Review Testing batch 2 (034-037) - when ready
/wireframe-review 003        # Review just user-authentication
/wireframe-review all        # Review all existing wireframes
/wireframe-review new        # Review only features added since last review
```

---

## Review Log

*Dated entries will be added as batches are completed.*

| Date | Batch | SVGs Reviewed | Issues Found | Notes |
|------|-------|---------------|--------------|-------|
| 2026-01-01 | 1 (Foundation) | 22 | 1 minor | 000-rls-implementation: Anonymous role arrow doesn't show blocked result |
| 2026-01-01 | 2 (Core Features) | 21 | 0 | All wireframes passed review - high quality across messaging, blog, groups, account |
