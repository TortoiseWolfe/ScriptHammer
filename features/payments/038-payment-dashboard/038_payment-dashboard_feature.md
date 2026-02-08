# Feature: Payment Dashboard

**Feature ID**: 038
**Category**: payments
**Source**: ScriptHammer README (SPEC-054)
**Status**: Ready for SpecKit

## Description

Real-time dashboard with payment history, recent transactions, and Supabase real-time updates. Provides users with comprehensive visibility into their payment activity and subscription status.

## User Scenarios

### US-1: Payment History View (P1)

Users view their complete payment history with filtering and search.

**Acceptance Criteria**:

1. Given dashboard loaded, when viewing history, then all payments displayed
2. Given filter applied, when searching, then results filtered correctly
3. Given date range selected, when applied, then only matching payments shown
4. Given payment clicked, when expanded, then full details displayed

### US-2: Recent Transactions (P1)

Users see their most recent transactions with real-time updates.

**Acceptance Criteria**:

1. Given new payment, when processed, then appears immediately
2. Given transaction status change, when updated, then dashboard reflects change
3. Given failed payment, when retried, then status updates in real-time
4. Given refund issued, when processed, then shown in recent transactions

### US-3: Subscription Overview (P2)

Users view active subscriptions and billing information.

**Acceptance Criteria**:

1. Given active subscription, when viewing, then next billing date shown
2. Given subscription details, when displayed, then plan information accurate
3. Given multiple subscriptions, when listed, then all shown with status
4. Given subscription action, when available, then upgrade/downgrade options shown

### US-4: Payment Analytics (P3)

Users access basic analytics about their payment patterns.

**Acceptance Criteria**:

1. Given payment data, when analyzed, then spending summary shown
2. Given time period, when selected, then charts update accordingly
3. Given export requested, when clicked, then payment data downloadable

## Requirements

### Functional

**Dashboard Layout**

- FR-001: Implement payment history table with pagination
- FR-002: Display recent transactions widget
- FR-003: Show subscription status cards
- FR-004: Add payment summary statistics
- FR-005: Create date range filter component

**Real-Time Updates**

- FR-006: Subscribe to payment status changes via Supabase
- FR-007: Update transaction list without page refresh
- FR-008: Show real-time payment processing indicators
- FR-009: Handle subscription renewal notifications

**Transaction Details**

- FR-010: Display expandable transaction rows
- FR-011: Show payment method used
- FR-012: Display receipt information
- FR-013: Include refund/dispute status

**Filtering & Search**

- FR-014: Filter by date range
- FR-015: Filter by payment status
- FR-016: Filter by payment method
- FR-017: Search by transaction ID

### Non-Functional

**Performance**

- NFR-001: Dashboard loads in < 2 seconds
- NFR-002: Real-time updates within 500ms
- NFR-003: Pagination for large datasets

**Accessibility**

- NFR-004: Screen reader support for tables
- NFR-005: Keyboard navigation for all actions
- NFR-006: ARIA live regions for updates

### Components (5-File Pattern)

All components MUST follow the 5-file pattern per constitution:

```
src/components/payments/
├── PaymentDashboard/
│   ├── index.tsx                          # Re-exports
│   ├── PaymentDashboard.tsx               # Main component
│   ├── PaymentDashboard.test.tsx          # Unit tests (Vitest)
│   ├── PaymentDashboard.stories.tsx       # Storybook stories
│   ├── PaymentDashboard.accessibility.test.tsx  # Pa11y a11y tests
│   ├── PaymentHistory.tsx                 # Sub-component
│   ├── RecentTransactions.tsx             # Sub-component
│   ├── SubscriptionOverview.tsx           # Sub-component
│   └── PaymentFilters.tsx                 # Sub-component
```

**Note**: Sub-components (PaymentHistory, etc.) that are only used internally don't need their own 5-file structure. Only export the main PaymentDashboard component.

### Database

```sql
-- Real-time subscription
CREATE OR REPLACE FUNCTION notify_payment_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('payment_changes', json_build_object(
    'user_id', NEW.user_id,
    'payment_id', NEW.id,
    'status', NEW.status
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Out of Scope

- Admin payment management
- Bulk payment operations
- Payment dispute handling UI
- Multi-currency conversion

## Success Criteria

- SC-001: Payment history displays all user payments
- SC-002: Real-time updates work reliably
- SC-003: Filters accurately narrow results
- SC-004: Dashboard accessible via keyboard
- SC-005: Performance meets NFR targets
