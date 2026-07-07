# Wireframe Plan: 024-payment-integration

**Priority**: P1 Critical (blocks 038-041)
**Planned**: 2026-01-16
**SVGs**: 3

## Feature Summary

Payment integration with Stripe/PayPal, GDPR consent flow, subscription management, and offline queuing.

---

## SVG Assignments

### 024:01 - Payment Selection & Consent Flow

**File**: `01-payment-consent-flow.svg`
**Assigned**: Generator-1
**Complexity**: High

**Desktop (x=40, y=60, 1280x720)**:

- Payment page with consent modal overlay (centered, 600x400)
- Modal content: GDPR text, Accept/Decline buttons
- Background (dimmed): Payment provider logos, amount presets

**Mobile (x=1360, y=60, 360x720)**:

- Full-screen consent flow
- Large touch targets (44px min) for Accept/Decline
- Alternative payment links visible (Cash App, Chime)

**Key UI Elements**:

1. Consent modal with privacy text
2. Accept button (primary, green accent)
3. Decline button (secondary, neutral)
4. "Why we ask" expandable section
5. Alternative payment links (no-script fallback)
6. Provider logos (Stripe, PayPal) behind modal

**Annotations**:

- [1] GDPR consent required before loading payment scripts (FR-017)
- [2] Alternative payment links shown if declined (FR-018, FR-019)
- [3] Touch targets 44px minimum for accessibility
- [4] Consent stored with timestamp and version

---

### 024:02 - Checkout Experience

**File**: `02-checkout-experience.svg`
**Assigned**: Generator-2
**Complexity**: High

**Desktop (x=40, y=60, 1280x720)**:

- Two-column layout: Payment form (left), Order summary (right)
- Tab interface: One-Time | Subscription
- Amount presets ($10, $25, $50, Custom)
- Provider selection: Stripe (card icon), PayPal (logo)
- Subscription plans: Monthly ($9.99), Yearly ($99.99)

**Mobile (x=1360, y=60, 360x720)**:

- Single column, stacked layout
- Large amount buttons
- Provider buttons full-width
- Clear call-to-action button

**Key UI Elements**:

1. Payment type tabs (One-Time / Subscription)
2. Amount preset buttons with custom input
3. Provider selection with icons
4. Subscription plan cards with pricing
5. "Pay Now" / "Subscribe" CTA button
6. Order summary panel
7. Offline indicator (when applicable)

**Annotations**:

- [1] Payment type selection (FR-001, FR-002, FR-003)
- [2] Amount validation: $1.00 - $999.99 (FR-004)
- [3] Multi-currency support dropdown (FR-005)
- [4] Subscription intervals: monthly/yearly (FR-012)
- [5] Offline indicator shows queue status (FR-025)

---

### 024:03 - Payment Dashboard

**File**: `03-payment-dashboard.svg`
**Assigned**: Generator-3
**Complexity**: Medium

**Desktop (x=40, y=60, 1280x720)**:

- Header: "Payment History" with filter controls
- Stats row: Total spent, Active subscriptions, Pending
- Transaction table: Date, Amount, Status, Provider, Actions
- Subscription panel: Current plan, Next billing, Cancel button
- Status badges: Succeeded (green), Pending (yellow), Failed (red)

**Mobile (x=1360, y=60, 360x720)**:

- Card-based transaction list (swipeable)
- Subscription summary card at top
- Filter dropdown (collapsed)
- Pull-to-refresh indicator

**Key UI Elements**:

1. Filter/sort controls (date range, status, provider)
2. Summary stats cards
3. Transaction list with status badges
4. Subscription status card with billing date
5. Retry button on failed transactions
6. Cancel subscription modal trigger
7. Export/download option

**Annotations**:

- [1] Users view own payments only (RLS policy)
- [2] Retry schedule: days 1, 3, 7 (FR-014)
- [3] Grace period indicator for at-risk subscriptions (FR-015)
- [4] Notifications for payment events (FR-020, FR-021)
- [5] Webhook verification status shown (FR-007)

---

## Generator Assignment Summary

| SVG    | Generator   | Focus                          |
| ------ | ----------- | ------------------------------ |
| 024:01 | Generator-1 | Consent modal, privacy flow    |
| 024:02 | Generator-2 | Checkout form, payment options |
| 024:03 | Generator-3 | Dashboard, transaction history |

## Dependencies

- 002-cookie-consent: Similar consent modal pattern
- 003-user-authentication: Auth required for dashboard
- 000-rls-implementation: Payment RLS policies

## Downstream Features (Blocked)

- 038-payment-dashboard (extends 024:03)
- 039-payment-offline-queue (extends offline indicator)
- 040-payment-retry-ui (extends retry functionality)
- 041-paypal-subscriptions (extends subscription flow)

---

## Dispatch Ready

Queue these for generators:

```json
[
  {
    "action": "GENERATE",
    "feature": "024-payment-integration",
    "svg": "01",
    "assignedTo": "generator-1"
  },
  {
    "action": "GENERATE",
    "feature": "024-payment-integration",
    "svg": "02",
    "assignedTo": "generator-2"
  },
  {
    "action": "GENERATE",
    "feature": "024-payment-integration",
    "svg": "03",
    "assignedTo": "generator-3"
  }
]
```
