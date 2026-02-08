# Test Plan: 024-Payment-Integration

**Date**: 2026-01-15
**Author**: QA Lead
**Status**: DRAFT - Pending Wireframes
**Feature**: Payment Integration System

---

## Overview

| Metric                  | Count |
| ----------------------- | ----- |
| User Stories            | 6     |
| P0 Stories              | 2     |
| P1 Stories              | 3     |
| P2 Stories              | 1     |
| Functional Requirements | 25    |
| Success Criteria        | 6     |
| Edge Cases              | 5     |
| **Total Test Cases**    | 58    |

### Dependencies

- 000-rls-implementation (RLS policies)
- 002-cookie-consent (consent framework)
- 003-user-authentication (auth for payment history)
- 020-pwa-background-sync (offline queue)

---

## Wireframe Mapping (TBD)

| Wireframe                      | Expected Content                                  | User Stories |
| ------------------------------ | ------------------------------------------------- | ------------ |
| 01-payment-flow.svg            | Payment selection, amount entry, provider buttons | US-1, US-3   |
| 02-subscription-management.svg | Plan selection, billing info, cancel flow         | US-2, US-5   |
| 03-payment-history.svg         | Transaction list, status indicators, retry UI     | US-4, US-6   |

_Note: Wireframes pending generation. Update mapping when available._

---

## P0 Test Cases (Critical Path)

### TC-024-01: One-Time Payment Flow

**User Story**: As a customer, I need to make a one-time payment

| ID   | Test Case                      | Precondition                   | Steps                               | Expected Result                           | Priority |
| ---- | ------------------------------ | ------------------------------ | ----------------------------------- | ----------------------------------------- | -------- |
| 01.1 | Payment redirect after consent | User on payment page           | Grant consent, click payment button | Redirected to payment page                | P0       |
| 01.2 | Payment verification           | Payment completed              | Provider sends callback             | Payment marked as verified                | P0       |
| 01.3 | Payment failure handling       | Payment attempt fails          | Error returned from provider        | Clear error message with retry option     | P0       |
| 01.4 | Preset amount selection        | On payment page                | View amount options                 | Preset amounts and custom input available | P0       |
| 01.5 | Custom amount entry            | On payment page                | Enter custom amount                 | Amount accepted within limits             | P0       |
| 01.6 | Amount validation - minimum    | On payment page                | Enter amount below minimum          | Validation error shown                    | P0       |
| 01.7 | Amount validation - maximum    | On payment page                | Enter amount above maximum          | Validation error shown                    | P0       |
| 01.8 | Currency display               | Multiple currencies configured | View payment amounts                | Correct currency symbols shown            | P1       |

**Wireframe Validation Points**:

- [ ] Payment button clearly visible (44px touch target)
- [ ] Amount selection UI matches wireframe
- [ ] Error states shown in wireframe
- [ ] Confirmation screen matches wireframe

---

### TC-024-02: Subscription Payment Flow

**User Story**: As a customer, I need to subscribe to a recurring plan

| ID   | Test Case                 | Precondition             | Steps                          | Expected Result                       | Priority |
| ---- | ------------------------- | ------------------------ | ------------------------------ | ------------------------------------- | -------- |
| 02.1 | Subscription setup        | Select subscription plan | Complete payment authorization | Recurring billing configured          | P0       |
| 02.2 | Automatic renewal         | Active subscription      | Billing date arrives           | Payment automatically charged         | P0       |
| 02.3 | Failed payment retry      | Payment fails            | Retry schedule triggers        | System retries after configured delay | P0       |
| 02.4 | Subscription cancellation | Active subscription      | Request cancellation           | Stops at end of current period        | P0       |
| 02.5 | Plan selection            | On subscription page     | View available plans           | All plans with pricing visible        | P0       |
| 02.6 | Billing date tracking     | Active subscription      | View subscription details      | Next billing date shown               | P1       |
| 02.7 | Cancellation confirmation | Request cancellation     | Confirm cancellation           | Confirmation with end date shown      | P1       |

**Wireframe Validation Points**:

- [ ] Plan comparison visible
- [ ] Billing date displayed
- [ ] Cancel button accessible
- [ ] Current plan highlighted

---

## P1 Test Cases (Should Ship)

### TC-024-03: Payment Consent Flow

**User Story**: As a privacy-conscious user, I need to consent before scripts load

| ID   | Test Case                      | Precondition        | Steps                    | Expected Result                     | Priority |
| ---- | ------------------------------ | ------------------- | ------------------------ | ----------------------------------- | -------- |
| 03.1 | Consent modal on first visit   | First-time visitor  | Navigate to payment page | Consent modal appears               | P1       |
| 03.2 | Scripts load after consent     | Consent modal shown | Grant consent            | Payment scripts load                | P1       |
| 03.3 | Alternative methods on decline | Consent modal shown | Decline consent          | Alternative payment options shown   | P1       |
| 03.4 | Re-prompt on return            | Previously declined | Return to payment page   | Consent modal appears again         | P1       |
| 03.5 | No scripts before consent      | Page loading        | Monitor network requests | Zero payment scripts before consent | P1       |

**Success Criteria**: SC-003 - 0% scripts load before consent

**Wireframe Validation Points**:

- [ ] Consent modal design matches
- [ ] Alternative payment options visible
- [ ] Clear accept/decline buttons

---

### TC-024-04: Payment Verification (Webhooks)

**User Story**: As a business owner, I need payments verified through secure callbacks

| ID   | Test Case                   | Precondition              | Steps                                   | Expected Result             | Priority |
| ---- | --------------------------- | ------------------------- | --------------------------------------- | --------------------------- | -------- |
| 04.1 | Valid callback processing   | Payment initiated         | Receive callback with valid signature   | Payment processed           | P1       |
| 04.2 | Invalid signature rejection | Payment initiated         | Receive callback with invalid signature | Callback rejected           | P1       |
| 04.3 | Duplicate callback handling | First callback processed  | Receive duplicate callback              | No duplicate record created | P1       |
| 04.4 | Callback retry handling     | Callback fails processing | Retry callback                          | Succeeds on retry           | P1       |
| 04.5 | Signature validation        | Any callback              | Validate signature                      | Correct validation result   | P1       |

**Success Criteria**: SC-004 - 100% callbacks verified idempotently

---

### TC-024-05: Subscription Retry Logic

**User Story**: As a subscription holder, I need automatic retry for failed payments

| ID   | Test Case                 | Precondition              | Steps                  | Expected Result                 | Priority |
| ---- | ------------------------- | ------------------------- | ---------------------- | ------------------------------- | -------- |
| 05.1 | First retry delay         | Payment fails             | Wait for first retry   | Retry occurs after short delay  | P1       |
| 05.2 | Exponential backoff       | Multiple retries fail     | Monitor retry schedule | Delays increase between retries | P1       |
| 05.3 | Grace period entry        | All retries exhausted     | Grace period begins    | Subscription enters grace state | P1       |
| 05.4 | Subscription cancellation | Grace period expires      | No successful payment  | Subscription cancelled          | P1       |
| 05.5 | Recovery during retry     | Retry succeeds            | Payment processes      | Subscription continues normally | P1       |
| 05.6 | Recovery during grace     | Payment succeeds in grace | Process payment        | Subscription restored           | P1       |

**Success Criteria**: SC-002 - 95% failed payments succeed within retry period

---

## P2 Test Cases (Nice to Have)

### TC-024-06: Offline Payment Queuing

**User Story**: As a user with unreliable connectivity, I need offline queuing

| ID   | Test Case                    | Precondition            | Steps                    | Expected Result           | Priority |
| ---- | ---------------------------- | ----------------------- | ------------------------ | ------------------------- | -------- |
| 06.1 | Queue on service unavailable | Backend unavailable     | Initiate payment         | Operation queued locally  | P2       |
| 06.2 | Sync on reconnection         | Queued operations exist | Connectivity restored    | Operations processed      | P2       |
| 06.3 | Offline indicator            | Offline mode            | View payment UI          | Offline indicator visible | P2       |
| 06.4 | Persist across sessions      | Queued operations exist | Close and reopen browser | Operations still pending  | P2       |
| 06.5 | Queue status visibility      | Operations queued       | View payment UI          | Queue count/status shown  | P2       |

**Success Criteria**: SC-005 - 0% operations lost during outages

---

## Edge Case Test Cases

### TC-024-EC: Edge Cases & Error Handling

| ID   | Test Case                      | Scenario                       | Expected Result                               | Priority |
| ---- | ------------------------------ | ------------------------------ | --------------------------------------------- | -------- |
| EC.1 | Provider unavailable           | Payment provider down          | Failover to alternate provider OR queue       | P1       |
| EC.2 | All retries exhausted          | Subscription fails all retries | Grace period with limited access, then cancel | P1       |
| EC.3 | Duplicate callbacks            | Same callback arrives twice    | First processed, duplicate ignored            | P1       |
| EC.4 | Payment dispute                | User disputes charge           | Payment marked disputed, owner notified       | P2       |
| EC.5 | Currency conversion            | User's currency differs        | Display in user's preferred currency          | P2       |
| EC.6 | Session timeout during payment | Session expires mid-flow       | Graceful handling, no lost payment            | P1       |
| EC.7 | Browser back during payment    | User presses back              | State preserved, can resume                   | P2       |

---

## Security Test Cases

### TC-024-SEC: Security Validation

| ID    | Test Case                   | Attack Vector                       | Expected Result                        | Priority |
| ----- | --------------------------- | ----------------------------------- | -------------------------------------- | -------- |
| SEC.1 | Callback signature bypass   | Forged callback without signature   | Rejected immediately                   | P0       |
| SEC.2 | Amount tampering            | Modified amount in request          | Server-side validation fails           | P0       |
| SEC.3 | Cross-user payment access   | Access other user's payments        | RLS blocks access                      | P0       |
| SEC.4 | CSRF on payment form        | Cross-site form submission          | CSRF protection rejects                | P0       |
| SEC.5 | Replay attack               | Reuse old callback                  | Idempotent handling prevents duplicate | P1       |
| SEC.6 | XSS in payment confirmation | Inject script in amount/description | Sanitized output                       | P1       |

---

## Integration Test Cases

### TC-024-INT: Cross-Feature Integration

| ID    | Test Case                     | Features                    | Expected Result                       | Priority |
| ----- | ----------------------------- | --------------------------- | ------------------------------------- | -------- |
| INT.1 | Auth required for history     | 003-auth + 024-payment      | Unauthenticated users redirected      | P0       |
| INT.2 | RLS on payment records        | 000-rls + 024-payment       | Users see only their payments         | P0       |
| INT.3 | Consent framework integration | 002-consent + 024-payment   | Payment consent uses same framework   | P1       |
| INT.4 | Offline queue integration     | 020-pwa + 024-payment       | Payments queue when offline           | P2       |
| INT.5 | Analytics on payment events   | 019-analytics + 024-payment | Payment events tracked (with consent) | P2       |

---

## Test Environment Requirements

### Test Accounts

| Provider | Account Type | Purpose           |
| -------- | ------------ | ----------------- |
| Stripe   | Test mode    | One-time payments |
| PayPal   | Sandbox      | Subscriptions     |
| Generic  | Mock         | Offline testing   |

### Test Cards

| Number              | Behavior           |
| ------------------- | ------------------ |
| 4242 4242 4242 4242 | Success            |
| 4000 0000 0000 0002 | Decline            |
| 4000 0000 0000 9995 | Insufficient funds |
| 4000 0000 0000 3220 | 3D Secure required |

### Browser Requirements

- Chrome (latest) - Primary
- Firefox (latest) - Secondary
- Safari (latest) - Mobile testing
- Offline mode simulation (DevTools)

---

## Test Execution Schedule

### Phase 1: Unit Tests (Pre-Wireframe)

- [ ] Payment amount validation
- [ ] Callback signature verification
- [ ] Retry schedule calculation
- [ ] Queue persistence logic

### Phase 2: Integration Tests (With Wireframes)

- [ ] End-to-end payment flow
- [ ] Subscription lifecycle
- [ ] Consent flow integration
- [ ] Offline queue sync

### Phase 3: UAT (Post-Implementation)

- [ ] All P0 test cases pass
- [ ] All P1 test cases pass
- [ ] Security test cases pass
- [ ] Cross-browser validation

---

## Success Criteria Validation

| ID     | Criteria                      | Test Cases           | Target |
| ------ | ----------------------------- | -------------------- | ------ |
| SC-001 | One-time payment success rate | TC-024-01.\*         | 99%    |
| SC-002 | Failed subscription recovery  | TC-024-05.\*         | 95%    |
| SC-003 | No scripts before consent     | TC-024-03.5          | 0%     |
| SC-004 | Callback verification         | TC-024-04.\*         | 100%   |
| SC-005 | No lost operations offline    | TC-024-06.\*         | 0%     |
| SC-006 | Notification delivery         | (notification tests) | <5 min |

---

## Sign-off

| Role          | Name         | Date         | Signature    |
| ------------- | ------------ | ------------ | ------------ |
| QA Lead       | **\_\_\_\_** | **\_\_\_\_** | **\_\_\_\_** |
| Developer     | **\_\_\_\_** | **\_\_\_\_** | **\_\_\_\_** |
| Security Lead | **\_\_\_\_** | **\_\_\_\_** | **\_\_\_\_** |
| Product Owner | **\_\_\_\_** | **\_\_\_\_** | **\_\_\_\_** |

---

## Summary

| Category      | Test Cases |
| ------------- | ---------- |
| P0 Functional | 15         |
| P1 Functional | 22         |
| P2 Functional | 5          |
| Edge Cases    | 7          |
| Security      | 6          |
| Integration   | 5          |
| **Total**     | **58**     |

**Status**: Ready for wireframe mapping. Update wireframe references when generated.

---

_Test Plan prepared by QA Lead terminal_
_Report: docs/interoffice/audits/2026-01-15-qa-lead-024-payment-test-plan.md_
