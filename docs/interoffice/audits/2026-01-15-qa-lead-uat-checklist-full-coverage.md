# UAT Checklist: P0 Features with Full Wireframe Coverage

**Date**: 2026-01-15
**Author**: QA Lead
**Scope**: 4 P0 features with complete wireframe coverage
**Status**: Ready for UAT when implementation complete

---

## Overview

| Feature                      | P0 Stories | P1 Stories | Wireframes | UAT Ready |
| ---------------------------- | ---------- | ---------- | ---------- | --------- |
| 001-wcag-aa-compliance       | 3          | 3          | 3 SVGs     | Yes       |
| 002-cookie-consent           | 2          | 2          | 3 SVGs     | Yes       |
| 006-template-fork-experience | 2          | 2          | 2 SVGs     | Yes       |
| 019-google-analytics         | 1          | 2          | 2 SVGs     | Yes       |

**Total Test Cases**: 47 (P0: 27, P1: 20)

---

## Feature 001: WCAG AA Compliance

### Wireframe Reference

- `01-accessibility-dashboard.svg` - CI violation display
- `02-cicd-pipeline-integration.svg` - Pipeline flow
- `03-accessibility-controls-overlay.svg` - User controls

### P0 Test Cases

#### TC-001-01: Zero Critical Violations in CI

| #   | Test Case                 | Given                     | When              | Then                              | Pass |
| --- | ------------------------- | ------------------------- | ----------------- | --------------------------------- | ---- |
| 1   | Build fails on violation  | PR with a11y violation    | CI runs           | Build fails with clear error      | [ ]  |
| 2   | Build succeeds when clean | All pages pass a11y tests | CI runs           | Build succeeds                    | [ ]  |
| 3   | Error details displayed   | Violation detected        | Viewing CI output | Element, issue, remediation shown | [ ]  |
| 4   | Historical tracking       | CI completes              | Results available | Stored for tracking               | [ ]  |

**Wireframe Validation**: Compare `01-accessibility-dashboard.svg` against violation display

#### TC-001-02: AAA-Level Contrast Compliance

| #   | Test Case            | Given                    | When               | Then                | Pass |
| --- | -------------------- | ------------------------ | ------------------ | ------------------- | ---- |
| 1   | Normal text contrast | Any text element         | Contrast measured  | Meets 7:1 ratio     | [ ]  |
| 2   | Large text contrast  | Text 18pt+ or 14pt+ bold | Contrast measured  | Meets 4.5:1 ratio   | [ ]  |
| 3   | Theme compliance     | Any theme applied        | All themes tested  | AAA contrast met    | [ ]  |
| 4   | Interactive states   | Links, buttons           | Hover/focus/active | Contrast maintained | [ ]  |

**Wireframe Validation**: Verify color values in `03-accessibility-controls-overlay.svg`

#### TC-001-03: Keyboard-Only Navigation

| #   | Test Case           | Given                | When              | Then                    | Pass |
| --- | ------------------- | -------------------- | ----------------- | ----------------------- | ---- |
| 1   | Tab navigation      | Any page             | Press Tab         | Focus moves logically   | [ ]  |
| 2   | Element activation  | Focused element      | Press Enter/Space | Element activates       | [ ]  |
| 3   | Escape closes modal | Modal/dropdown open  | Press Escape      | Closes, focus returns   | [ ]  |
| 4   | Focus visibility    | Focus on any element | Visible           | 2px+ outline visible    | [ ]  |
| 5   | Widget navigation   | Complex widget       | Arrow keys        | Works per ARIA patterns | [ ]  |

**Wireframe Validation**: Check focus indicators in all wireframes

---

## Feature 002: Cookie Consent & GDPR

### Wireframe Reference

- `01-consent-modal.svg` - First visit experience
- `02-cookie-preferences-panel.svg` - Granular controls
- `03-privacy-settings-page.svg` - Full privacy management

### P0 Test Cases

#### TC-002-01: First Visit Consent

| #   | Test Case                 | Given              | When                       | Then                                 | Pass |
| --- | ------------------------- | ------------------ | -------------------------- | ------------------------------------ | ---- |
| 1   | Modal appears first visit | First-time visitor | Page loads                 | Consent modal appears before cookies | [ ]  |
| 2   | Accept All works          | Modal displayed    | Click "Accept All"         | All categories enabled, modal closes | [ ]  |
| 3   | Reject All works          | Modal displayed    | Click "Reject All"         | Only necessary cookies, modal closes | [ ]  |
| 4   | Manage Preferences        | Modal displayed    | Click "Manage Preferences" | Granular controls shown              | [ ]  |

**Wireframe Validation**: Match `01-consent-modal.svg` layout and buttons

#### TC-002-02: Granular Cookie Control

| #   | Test Case               | Given                  | When               | Then                                        | Pass |
| --- | ----------------------- | ---------------------- | ------------------ | ------------------------------------------- | ---- |
| 1   | Four categories visible | Preferences panel open | View categories    | Necessary, Functional, Analytics, Marketing | [ ]  |
| 2   | Toggle reflects change  | Category toggle        | Enable/disable     | UI updates immediately                      | [ ]  |
| 3   | Settings persist        | Preferences saved      | New session        | Settings maintained                         | [ ]  |
| 4   | Necessary locked        | Necessary cookies      | Attempt to disable | Toggle disabled with explanation            | [ ]  |

**Wireframe Validation**: Match `02-cookie-preferences-panel.svg` toggle states

### P1 Test Cases

#### TC-002-03: Preference Persistence

| #   | Test Case              | Given                      | When           | Then                    | Pass |
| --- | ---------------------- | -------------------------- | -------------- | ----------------------- | ---- |
| 1   | No modal on return     | Previously set preferences | Return to app  | Modal does not appear   | [ ]  |
| 2   | Behavior matches saved | Stored preferences         | App loads      | Cookie behavior matches | [ ]  |
| 3   | Re-consent on update   | Old preferences            | Policy updated | Prompted to re-consent  | [ ]  |

#### TC-002-04: Update Preferences Anytime

| #   | Test Case           | Given                | When                      | Then                       | Pass |
| --- | ------------------- | -------------------- | ------------------------- | -------------------------- | ---- |
| 1   | View current status | Previously consented | Navigate to settings      | Current status visible     | [ ]  |
| 2   | Changes take effect | Privacy settings     | Modify and save           | Immediate effect           | [ ]  |
| 3   | Link accessible     | Footer/settings menu | Look for privacy controls | Clearly labeled link found | [ ]  |

**Wireframe Validation**: Match `03-privacy-settings-page.svg` for settings access

---

## Feature 006: Template Fork Experience

### Wireframe Reference

- `01-service-setup-guidance.svg` - Service configuration
- `02-rebrand-automation-flow.svg` - Automation flow

### P0 Test Cases

#### TC-006-01: Automated Rebranding

| #   | Test Case               | Given                    | When                         | Then                              | Pass |
| --- | ----------------------- | ------------------------ | ---------------------------- | --------------------------------- | ---- |
| 1   | All references replaced | Fresh fork               | Run rebrand with new details | Original refs replaced            | [ ]  |
| 2   | Build succeeds          | Rebrand completed        | Build project                | Zero errors                       | [ ]  |
| 3   | Files renamed           | Files with original name | Rebrand runs                 | Files use new name                | [ ]  |
| 4   | Deploy config updated   | Rebrand runs             | Check deploy files           | Original settings cleared/updated | [ ]  |

**Wireframe Validation**: Match `02-rebrand-automation-flow.svg` for user flow

#### TC-006-02: Tests Pass Without External Services

| #   | Test Case          | Given                  | When           | Then                          | Pass |
| --- | ------------------ | ---------------------- | -------------- | ----------------------------- | ---- |
| 1   | Unit tests pass    | No external config     | Run test suite | All unit tests pass           | [ ]  |
| 2   | Mocks work         | Auth/DB/realtime tests | Execute        | Comprehensive mocks used      | [ ]  |
| 3   | Generic assertions | Tests after rebranding | Run            | No specific text dependencies | [ ]  |

**Wireframe Validation**: Match `01-service-setup-guidance.svg` for setup instructions

### P1 Test Cases

#### TC-006-03: Deployment Works Automatically

| #   | Test Case             | Given                 | When               | Then                         | Pass |
| --- | --------------------- | --------------------- | ------------------ | ---------------------------- | ---- |
| 1   | Auto-detect base path | No custom base path   | Deploy             | Path auto-detected from repo | [ ]  |
| 2   | Empty = auto          | Empty base path value | Deploy             | Treated as auto-detect       | [ ]  |
| 3   | Correct derivation    | Auto-detection        | Runs in deploy env | Correct path for forks       | [ ]  |

#### TC-006-04: Development Environment Git

| #   | Test Case           | Given               | When                     | Then                       | Pass |
| --- | ------------------- | ------------------- | ------------------------ | -------------------------- | ---- |
| 1   | Permissions correct | Dev container       | Starts                   | Git permissions configured | [ ]  |
| 2   | Docs clear          | Documentation       | Read commit instructions | Workflow understood        | [ ]  |
| 3   | Author info works   | Env config examples | Set up                   | Git author configured      | [ ]  |

---

## Feature 019: Google Analytics

### Wireframe Reference

- `01-consent-flow.svg` - Consent-gated tracking
- `02-analytics-dashboard.svg` - Analytics display

### P0 Test Cases

#### TC-019-01: Consent-Gated Analytics

| #   | Test Case                   | Given               | When                 | Then                             | Pass |
| --- | --------------------------- | ------------------- | -------------------- | -------------------------------- | ---- |
| 1   | No tracking without consent | No consent provided | Page loads           | No analytics scripts load        | [ ]  |
| 2   | Tracking starts on consent  | User grants consent | Page loads/refreshes | Analytics initializes            | [ ]  |
| 3   | Tracking stops on withdraw  | Previously granted  | Consent withdrawn    | Tracking stops next load         | [ ]  |
| 4   | Continues across pages      | Consent granted     | Navigate pages       | Tracking continues, no re-prompt | [ ]  |

**Wireframe Validation**: Match `01-consent-flow.svg` for consent interaction

### P1 Test Cases

#### TC-019-02: Page View Tracking

| #   | Test Case               | Given             | When                 | Then                     | Pass |
| --- | ----------------------- | ----------------- | -------------------- | ------------------------ | ---- |
| 1   | Page view recorded      | Consent granted   | Navigate to any page | Page view event recorded | [ ]  |
| 2   | SPA navigation tracked  | Route changes     | SPA navigation       | New page view sent       | [ ]  |
| 3   | Event includes metadata | Page view tracked | Event recorded       | Path and title included  | [ ]  |
| 4   | Browser nav tracked     | User navigates    | Back/forward buttons | Views tracked correctly  | [ ]  |

#### TC-019-03: Graceful Degradation

| #   | Test Case              | Given                 | When             | Then                       | Pass |
| --- | ---------------------- | --------------------- | ---------------- | -------------------------- | ---- |
| 1   | No errors with blocker | Ad blocker active     | Page loads       | No errors thrown/displayed | [ ]  |
| 2   | Silent failure         | Scripts blocked       | Attempt to track | Failures handled silently  | [ ]  |
| 3   | Site still works       | Analytics unavailable | User interacts   | All functionality works    | [ ]  |
| 4   | Mid-session block      | Analytics was working | Becomes blocked  | Site continues functioning | [ ]  |

**Wireframe Validation**: Match `02-analytics-dashboard.svg` for display when available

---

## UAT Execution Guide

### Pre-UAT Checklist

- [ ] All wireframes reviewed and approved
- [ ] Implementation complete for all 4 features
- [ ] Development environment available
- [ ] Test accounts/browsers prepared
- [ ] Accessibility testing tools installed (axe, WAVE)

### Testing Environment

| Browser          | Required |
| ---------------- | -------- |
| Chrome (latest)  | Yes      |
| Firefox (latest) | Yes      |
| Safari (latest)  | Yes      |
| Edge (latest)    | Optional |

### Accessibility Tools Required

- Browser DevTools (contrast checker)
- axe DevTools extension
- Keyboard-only testing (no mouse)
- Screen reader (NVDA/VoiceOver)

### Test Data Required

- Fresh browser profile (incognito)
- Ad blocker extension
- GitHub/Google OAuth test accounts (if applicable)

---

## Sign-off

| Role          | Name         | Date         | Signature    |
| ------------- | ------------ | ------------ | ------------ |
| QA Lead       | **\_\_\_\_** | **\_\_\_\_** | **\_\_\_\_** |
| Developer     | **\_\_\_\_** | **\_\_\_\_** | **\_\_\_\_** |
| Product Owner | **\_\_\_\_** | **\_\_\_\_** | **\_\_\_\_** |

---

## Summary

| Priority  | Test Cases | Features |
| --------- | ---------- | -------- |
| P0        | 27         | 4        |
| P1        | 20         | 4        |
| **Total** | **47**     | **4**    |

**Estimated UAT Duration**: 4-6 hours (single tester)

---

_UAT Checklist prepared by QA Lead terminal_
_Report: docs/interoffice/audits/2026-01-15-qa-lead-uat-checklist-full-coverage.md_
