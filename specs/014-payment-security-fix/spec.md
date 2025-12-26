# Feature Specification: Payment Security Test Fix

**Feature Branch**: `014-payment-security-fix`
**Created**: 2025-12-26
**Status**: Complete
**SPEC-ID**: SPEC-046

## Problem Statement

Payment isolation E2E tests fail because they don't handle the GDPR consent step on the payment-demo page. The page shows a consent modal first (Step 1), and the payment form only appears after clicking "Accept & Continue".

**File**: `tests/e2e/security/payment-isolation.spec.ts`
**Root Cause**: Tests try to fill Amount/Email fields before accepting GDPR consent

## Requirements

### Functional Requirements

- **FR-001**: Tests MUST clear localStorage payment consent before each navigation
- **FR-002**: Tests MUST click "Accept & Continue" when consent step is visible
- **FR-003**: Tests MUST wait for Step 2 heading before interacting with form

## Success Criteria

- **SC-001**: All 5 payment isolation tests pass
- **SC-002**: Tests work across all viewports
