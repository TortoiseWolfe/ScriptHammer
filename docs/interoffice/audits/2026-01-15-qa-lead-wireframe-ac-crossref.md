# Wireframe-to-Acceptance-Criteria Cross-Reference

**Date**: 2026-01-15
**Auditor**: QA Lead
**Scope**: P0 features only (15 features, 32 stories)

---

## Executive Summary

| Metric                      | Count | Status  |
| --------------------------- | ----- | ------- |
| P0 Features                 | 15    | -       |
| P0 Stories                  | 32    | -       |
| Features WITH wireframes    | 8     | 53%     |
| Features WITHOUT wireframes | 7     | **GAP** |
| Total P0 SVGs               | 21    | -       |

**Finding**: 7 P0 features lack visual wireframes, blocking UAT readiness.

---

## P0 Features WITH Wireframes

### 000-RLS Implementation (2 P0 stories)

| SVG                        | Covers            | AC Mapped |
| -------------------------- | ----------------- | --------- |
| 01-policy-architecture.svg | Technical diagram | Partial   |

**Gap**: Technical diagram, not user-facing UI. Stories about data isolation need UI showing user-specific data views.

---

### 001-WCAG AA Compliance (3 P0 stories)

| SVG                                   | Covers                  | AC Mapped             |
| ------------------------------------- | ----------------------- | --------------------- |
| 01-accessibility-dashboard.svg        | CI/CD violation display | US-1: Zero violations |
| 02-cicd-pipeline-integration.svg      | Pipeline flow           | US-1: CI integration  |
| 03-accessibility-controls-overlay.svg | User controls           | US-3: Keyboard nav    |

**Status**: FULL COVERAGE

---

### 002-Cookie Consent (2 P0 stories)

| SVG                             | User Stories           | AC Mapped           |
| ------------------------------- | ---------------------- | ------------------- |
| 01-consent-modal.svg            | US-1, US-2             | First visit consent |
| 02-cookie-preferences-panel.svg | US-2, US-4             | Granular controls   |
| 03-privacy-settings-page.svg    | US-3, US-4, US-5, US-6 | Preferences page    |

**Status**: FULL COVERAGE - assignments.json explicitly maps user stories

---

### 003-User Authentication (3 P0 stories)

| SVG                                | User Stories     | AC Mapped               |
| ---------------------------------- | ---------------- | ----------------------- |
| 01-registration-sign-in.svg        | US-1, US-2, US-4 | Registration, Sign-in   |
| 02-verification-password-reset.svg | US-3             | Password reset (P1)     |
| 03-profile-session-management.svg  | US-6             | Profile management (P2) |

**P0 Coverage**:

- US-1 (Registration): 01-registration-sign-in.svg
- US-2 (Sign In): 01-registration-sign-in.svg
- US-5 (Protected Routes): NOT VISUALIZED

**Gap**: US-5 (Protected Route Access) - no wireframe shows redirect behavior

---

### 005-Security Hardening (4 P0 stories)

| SVG                             | Covers                   | AC Mapped            |
| ------------------------------- | ------------------------ | -------------------- |
| 01-security-ux-enhancements.svg | Lockout UI, error states | US-3: Brute force    |
| 02-session-timeout-warning.svg  | Session expiry           | Partial              |
| 03-security-audit-dashboard.svg | Admin audit view         | US-1: Data isolation |

**P0 Coverage**:

- US-1 (Payment Data Isolation): 03-security-audit-dashboard.svg (admin view)
- US-2 (OAuth Protection): NOT VISUALIZED
- US-3 (Brute Force): 01-security-ux-enhancements.svg
- US-4 (CSRF): NOT VISUALIZED (backend, no UI)

**Gap**: US-2 (OAuth hijack prevention) has no visual representation

---

### 006-Template Fork Experience (2 P0 stories)

| SVG                            | Covers                | AC Mapped        |
| ------------------------------ | --------------------- | ---------------- |
| 01-service-setup-guidance.svg  | Service configuration | US-1: Rebranding |
| 02-rebrand-automation-flow.svg | Automation flow       | US-1, US-2       |

**Status**: FULL COVERAGE

---

### 007-E2E Testing Framework (3 P0 stories)

| SVG                              | Covers            | AC Mapped           |
| -------------------------------- | ----------------- | ------------------- |
| 01-test-architecture-diagram.svg | Architecture      | US-1: Cross-browser |
| 02-cicd-pipeline-flow.svg        | CI/CD integration | US-6: CI/CD         |

**P0 Coverage**:

- US-1 (Cross-Browser): 01-test-architecture-diagram.svg
- US-2 (Critical Journeys): NOT VISUALIZED
- US-6 (CI/CD): 02-cicd-pipeline-flow.svg

**Gap**: US-2 (Critical user journey testing) - needs test execution UI

---

### 019-Google Analytics (1 P0 story)

| SVG                        | Covers                 | AC Mapped           |
| -------------------------- | ---------------------- | ------------------- |
| 01-consent-flow.svg        | Consent-gated tracking | US-1: Consent-gated |
| 02-analytics-dashboard.svg | Analytics display      | US-1                |

**Status**: FULL COVERAGE

---

## P0 Features WITHOUT Wireframes

| Feature                   | P0 Stories | Planned               | Status           |
| ------------------------- | ---------- | --------------------- | ---------------- |
| 017-colorblind-mode       | 2          | assignments.json only | NEEDS GENERATION |
| 018-font-switcher         | 2          | No folder             | NEEDS PLANNING   |
| 020-pwa-background-sync   | 2          | No folder             | NEEDS PLANNING   |
| 021-geolocation-map       | 1          | No folder             | NEEDS PLANNING   |
| 022-web3forms-integration | 2          | No folder             | NEEDS PLANNING   |
| 023-emailjs-integration   | 1          | No folder             | NEEDS PLANNING   |
| 024-payment-integration   | 2          | No folder             | NEEDS PLANNING   |

### Critical Gap: 017-Colorblind Mode

- **Planned SVGs**: 2 (in assignments.json)
- **P0 Stories**: Enable colorblind assistance, Persistence
- **Status**: Planned but not generated

### Critical Gap: 024-Payment Integration

- **P0 Stories**: One-time payment, Subscription payment
- **Impact**: Payment flows are core functionality
- **Status**: No wireframe folder exists

---

## Coverage Matrix

| Feature                      | P0 Stories | SVGs | Coverage                     |
| ---------------------------- | ---------- | ---- | ---------------------------- |
| 000-rls-implementation       | 2          | 1    | PARTIAL                      |
| 001-wcag-aa-compliance       | 3          | 3    | FULL                         |
| 002-cookie-consent           | 2          | 3    | FULL                         |
| 003-user-authentication      | 3          | 3    | PARTIAL (US-5 missing)       |
| 005-security-hardening       | 4          | 3    | PARTIAL (US-2, US-4 backend) |
| 006-template-fork-experience | 2          | 2    | FULL                         |
| 007-e2e-testing-framework    | 3          | 2    | PARTIAL (US-2 missing)       |
| 017-colorblind-mode          | 2          | 0    | NONE (planned)               |
| 018-font-switcher            | 2          | 0    | NONE                         |
| 019-google-analytics         | 1          | 2    | FULL                         |
| 020-pwa-background-sync      | 2          | 0    | NONE                         |
| 021-geolocation-map          | 1          | 0    | NONE                         |
| 022-web3forms-integration    | 2          | 0    | NONE                         |
| 023-emailjs-integration      | 1          | 0    | NONE                         |
| 024-payment-integration      | 2          | 0    | NONE                         |

---

## Recommendations

### Priority 1: Generate Missing P0 Wireframes

1. **024-payment-integration** - Core payment flows (2 P0 stories)
2. **017-colorblind-mode** - Already planned, needs generation
3. **022-web3forms-integration** - Contact form UI (2 P0 stories)

### Priority 2: Plan Remaining Features

1. **020-pwa-background-sync** - Offline queue UI
2. **018-font-switcher** - Settings panel
3. **021-geolocation-map** - Map interaction
4. **023-emailjs-integration** - Failover indication

### Priority 3: Address Partial Coverage

1. **003-user-authentication** US-5 - Protected route redirect visualization
2. **007-e2e-testing-framework** US-2 - Test execution UI

---

## UAT Readiness Score

| Category               | Score | Notes         |
| ---------------------- | ----- | ------------- |
| Foundation (000-006)   | 85%   | Most covered  |
| Enhancements (017-021) | 40%   | Major gaps    |
| Integrations (022-024) | 0%    | No wireframes |

**Overall P0 Wireframe Coverage**: 53% (8/15 features)

**Recommendation**: Block Phase 3 (implementation) for features without wireframes.

---

## Verification Commands

```bash
# List P0 features without wireframes
for f in 017 018 020 021 022 023 024; do
  ls docs/design/wireframes/*${f}*/*.svg 2>/dev/null || echo "MISSING: ${f}"
done

# Check planned but not generated
find docs/design/wireframes -name "assignments.json" -exec sh -c \
  'dir=$(dirname {}); [ ! -f "$dir"/*.svg ] && echo "PLANNED: $dir"' \;
```

---

_Cross-reference completed by QA Lead terminal_
_Report: docs/interoffice/audits/2026-01-15-qa-lead-wireframe-ac-crossref.md_
