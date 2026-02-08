# Test Coverage Gap Analysis: Tier 1-2 Features

**Date**: 2026-01-15
**Author**: QA Lead
**Scope**: Features 000-007, 005, 019 (Implementation Order Tier 1-2)

---

## Executive Summary

| Metric                          | Count |
| ------------------------------- | ----- |
| Tier 1-2 Features               | 8     |
| Features with Test Specs        | 1     |
| Features with UAT Checklist     | 4     |
| Features with Security Audit    | 4     |
| **Features Needing Test Specs** | **3** |

**Critical Gap**: 3 foundation features lack detailed test specifications.

---

## Tier 1-2 Feature Matrix

| Order | Feature | Name                     | Test Spec | UAT | Security | Status              |
| ----- | ------- | ------------------------ | --------- | --- | -------- | ------------------- |
| 1     | 000     | RLS Implementation       | ✓         | -   | ✓        | **COVERED**         |
| 2     | 003     | User Authentication      | -         | -   | ✓        | **NEEDS TEST SPEC** |
| 3     | 007     | E2E Testing Framework    | -         | -   | -        | **NEEDS TEST SPEC** |
| 4     | 006     | Template Fork Experience | -         | ✓   | -        | Partial             |
| 5     | 002     | Cookie Consent           | -         | ✓   | ✓        | Partial             |
| 6     | 001     | WCAG AA Compliance       | -         | ✓   | -        | Partial             |
| 7     | 005     | Security Hardening       | -         | -   | ✓        | **NEEDS TEST SPEC** |
| 8     | 019     | Google Analytics         | -         | ✓   | -        | Partial             |

---

## Existing Test Artifacts

### 000-RLS Implementation - COVERED

| Artifact         | Location                                           | Status |
| ---------------- | -------------------------------------------------- | ------ |
| Test Spec Review | `audits/2026-01-15-author-rls-test-spec-review.md` | ✓      |
| Test Files       | `tests/rls/*.test.ts` (4 files)                    | ✓      |
| Test Fixtures    | `tests/fixtures/test-users.ts`                     | ✓      |
| Security Audit   | `audits/2026-01-15-security-000-rls-audit.md`      | ✓      |

**Coverage**: All 5 user stories have test suites.

### 001, 002, 006, 019 - UAT Checklist Only

| Feature       | UAT Test Cases | Location                                                   |
| ------------- | -------------- | ---------------------------------------------------------- |
| 001-WCAG      | 13 cases       | `audits/2026-01-15-qa-lead-uat-checklist-full-coverage.md` |
| 002-Cookie    | 14 cases       | `audits/2026-01-15-qa-lead-uat-checklist-full-coverage.md` |
| 006-Template  | 13 cases       | `audits/2026-01-15-qa-lead-uat-checklist-full-coverage.md` |
| 019-Analytics | 12 cases       | `audits/2026-01-15-qa-lead-uat-checklist-full-coverage.md` |

**Gap**: UAT checklists are acceptance-level. Need detailed unit/integration test specs.

---

## Features Needing Test Specifications

### Priority 1: 003-User Authentication

**Why Critical**: All authenticated features depend on this (blocks Tier 3-9).

**User Stories** (from spec.md):
| ID | Story | Priority | Test Spec Needed |
|----|-------|----------|------------------|
| US-1 | Email/Password Registration | P0 | ✓ |
| US-2 | User Sign In | P0 | ✓ |
| US-3 | Password Reset | P1 | ✓ |
| US-4 | OAuth Sign In | P1 | ✓ |
| US-5 | Protected Route Access | P0 | ✓ |
| US-6 | Profile Management | P2 | ✓ |

**Required Test Categories**:

- Unit: Password validation, token generation
- Integration: Auth flow end-to-end
- Security: Brute force, session hijacking
- E2E: Full registration/login journeys

**Existing Coverage**: Security audit only (OWASP analysis).

---

### Priority 2: 005-Security Hardening

**Why Critical**: Payment data protection, OAuth security, CSRF.

**User Stories** (from spec.md):
| ID | Story | Priority | Test Spec Needed |
|----|-------|----------|------------------|
| US-1 | Payment Data Isolation | P0 | ✓ |
| US-2 | OAuth Account Protection | P0 | ✓ |
| US-3 | Brute Force Prevention | P0 | ✓ |
| US-4 | CSRF Protection | P0 | ✓ |
| US-5 | Malicious Data Prevention | P1 | ✓ |

**Required Test Categories**:

- Security: Penetration test scenarios
- Integration: RLS verification
- Unit: Rate limiter, CSRF token validation

**Existing Coverage**: Security audit only (OWASP analysis).

---

### Priority 3: 007-E2E Testing Framework

**Why Critical**: All test features (031-037) depend on this.

**User Stories** (from spec.md):
| ID | Story | Priority | Test Spec Needed |
|----|-------|----------|------------------|
| US-1 | Cross-Browser Test Execution | P0 | ✓ |
| US-2 | Critical User Journey Testing | P0 | ✓ |
| US-6 | CI/CD Integration | P0 | ✓ |

**Required Test Categories**:

- Infrastructure: Playwright setup validation
- CI: GitHub Actions workflow tests
- Fixture: Test user management

**Existing Coverage**: None.

---

## Recommendations

### Immediate Actions

1. **Draft 003-auth-test-plan.md**
   - 6 user stories, ~35 test cases
   - Include security test scenarios from audit
   - Map to wireframes when generated

2. **Draft 005-security-test-plan.md**
   - 5 user stories, ~30 test cases
   - Focus on penetration testing scenarios
   - Include CSRF, brute force, injection tests

3. **Draft 007-e2e-test-plan.md**
   - 3 P0 user stories, ~20 test cases
   - Playwright configuration validation
   - CI/CD integration tests

### Test Plan Template

Each test plan should include:

- User story mapping
- Unit test cases
- Integration test cases
- Security test cases (where applicable)
- E2E test cases
- Wireframe validation points
- Success criteria mapping

---

## Implementation Priority

| Priority | Feature                   | Estimated Cases | Blocks      |
| -------- | ------------------------- | --------------- | ----------- |
| 1        | 003-User Authentication   | ~35             | Tier 3+     |
| 2        | 005-Security Hardening    | ~30             | 024-Payment |
| 3        | 007-E2E Testing Framework | ~20             | Tier 8      |

**Total Estimated Test Cases**: ~85

---

## Summary

| Category          | Status                         |
| ----------------- | ------------------------------ |
| Fully Covered     | 1 feature (000-RLS)            |
| Partially Covered | 4 features (UAT only)          |
| **Needing Specs** | **3 features (003, 005, 007)** |

**Next Steps**:

1. Draft test spec for 003-User Authentication (highest priority)
2. Draft test spec for 005-Security Hardening
3. Draft test spec for 007-E2E Testing Framework
4. Expand UAT checklists to detailed test specs for 001, 002, 006, 019

---

_Gap Analysis completed by QA Lead terminal_
_Report: docs/interoffice/audits/2026-01-15-qa-lead-tier12-test-coverage-gaps.md_
