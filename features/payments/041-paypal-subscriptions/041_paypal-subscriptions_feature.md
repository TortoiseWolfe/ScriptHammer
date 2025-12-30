# Feature: PayPal Subscription Management

**Feature ID**: 041
**Category**: payments
**Source**: ScriptHammer_v_001 README (SPEC-057)
**Status**: Ready for SpecKit

## Description

Active subscriptions list, cancel/pause functionality, and billing cycle display for PayPal subscriptions. Provides comprehensive subscription management for users who pay via PayPal.

## User Scenarios

### US-1: Active Subscriptions List (P1)

Users view all their active PayPal subscriptions.

**Acceptance Criteria**:
1. Given active subscriptions, when viewing, then all listed
2. Given subscription details, when displayed, then plan name and price shown
3. Given subscription status, when shown, then current status clear
4. Given no subscriptions, when viewing, then empty state displayed

### US-2: Cancel Subscription (P1)

Users can cancel their PayPal subscriptions.

**Acceptance Criteria**:
1. Given active subscription, when cancel clicked, then confirmation shown
2. Given cancellation confirmed, when processed, then subscription cancelled
3. Given cancellation complete, when done, then end date displayed
4. Given cancellation failed, when error occurs, then error message shown

### US-3: Pause Subscription (P2)

Users can pause their subscriptions temporarily.

**Acceptance Criteria**:
1. Given pausable subscription, when pause clicked, then duration options shown
2. Given duration selected, when confirmed, then subscription paused
3. Given paused subscription, when viewing, then resume date shown
4. Given resume clicked, when processed, then subscription reactivated

### US-4: Billing Cycle Display (P1)

Users see their billing cycle information clearly.

**Acceptance Criteria**:
1. Given subscription, when viewing, then billing frequency shown
2. Given next billing date, when displayed, then accurate date shown
3. Given billing amount, when shown, then includes taxes/fees
4. Given billing history, when viewed, then past charges listed

## Requirements

### Functional

**Subscriptions List**
- FR-001: Fetch active subscriptions from PayPal API
- FR-002: Display subscription plan details
- FR-003: Show subscription status (active, paused, cancelled)
- FR-004: Display subscription ID for reference
- FR-005: Link to PayPal subscription management

**Cancel Flow**
- FR-006: Show cancellation confirmation dialog
- FR-007: Explain cancellation implications
- FR-008: Process cancellation via PayPal API
- FR-009: Update local subscription status
- FR-010: Send cancellation confirmation email

**Pause/Resume**
- FR-011: Check if subscription supports pausing
- FR-012: Offer pause duration options
- FR-013: Process pause via PayPal API
- FR-014: Display resume date
- FR-015: Implement resume functionality

**Billing Information**
- FR-016: Display billing frequency (monthly, yearly)
- FR-017: Show next billing date
- FR-018: Display total amount with breakdown
- FR-019: Show payment method info
- FR-020: Link to billing history

### Non-Functional

**Integration**
- NFR-001: Sync with PayPal within 5 minutes
- NFR-002: Handle PayPal API rate limits
- NFR-003: Cache subscription data appropriately

**User Experience**
- NFR-004: Actions complete within 10 seconds
- NFR-005: Clear loading states for all operations
- NFR-006: Mobile-friendly subscription cards

### Components

```
src/components/payments/
├── PayPalSubscriptions/
│   ├── PayPalSubscriptions.tsx
│   ├── PayPalSubscriptions.test.tsx
│   ├── SubscriptionCard.tsx
│   ├── CancelDialog.tsx
│   ├── PauseDialog.tsx
│   └── BillingCycle.tsx
```

### API Integration

```typescript
interface PayPalSubscription {
  id: string;
  planId: string;
  planName: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  startDate: Date;
  nextBillingDate: Date;
  billingInfo: {
    amount: number;
    currency: string;
    frequency: 'MONTH' | 'YEAR';
  };
}

// PayPal API endpoints
// GET /v1/billing/subscriptions/{subscription_id}
// POST /v1/billing/subscriptions/{subscription_id}/cancel
// POST /v1/billing/subscriptions/{subscription_id}/suspend
// POST /v1/billing/subscriptions/{subscription_id}/activate
```

### Out of Scope

- PayPal subscription creation (handled by checkout)
- Plan upgrade/downgrade via PayPal
- PayPal dispute management
- PayPal payment method management

## Success Criteria

- SC-001: All active subscriptions displayed correctly
- SC-002: Cancel flow completes successfully
- SC-003: Pause/resume functions as expected
- SC-004: Billing information accurate
- SC-005: PayPal API integration reliable
