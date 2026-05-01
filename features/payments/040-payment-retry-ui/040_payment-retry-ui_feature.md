# Feature: Payment Retry UI

**Feature ID**: 040
**Category**: payments
**Source**: ScriptHammer README (SPEC-056)
**Status**: Mostly Shipped — recovery UX shipped; saved-method storage out of scope for static-export architecture (2026-04-28). Built: `payment-service.ts` retry logic with idempotency-key reuse + retry cap + cooling + expiry guard + audit log; `<PaymentStatusDisplay>` with categorized errors + attempt counter + cooling countdown + recovery-list disclosure; `/payment-result` route (commit `ffb33a1`, 2026-04-16); `<OfflineRetryBanner>`; `<SwitchProviderPanel>` for in-line provider switching after a decline; schema additions on `payment_intents` (`retry_count`, `parent_intent_id`) and `auth_audit_logs.event_type` (`payment_retry`). Architecture-fit reframings: US3 (Update Payment Method) became "switch payment method (provider switch)" since ScriptHammer never stores cards — every checkout is a fresh provider session; US4 (Guided Recovery Wizard) became inline progressive disclosure escalating with retry_count. Saved-card storage (Stripe Customer + saved_payment_methods table + stripe.js `<CardElement>`) remains explicitly out of scope for this template; would be a separate multi-PR feature behind a PCI scope review. Several E2E stubs in `tests/e2e/payment/03-failed-payment-retry.spec.ts` remain skipped pending Stripe API keys for the actual Checkout-flow tests.

## Description

Error display, retry button, and payment method update flow. Provides clear UI for handling failed payments with actionable options to resolve payment issues.

## User Scenarios

### US-1: Payment Error Display (P1)

Users see clear error messages when payments fail.

**Acceptance Criteria**:

1. Given payment failure, when displayed, then error reason shown
2. Given error type, when identified, then specific message provided
3. Given actionable error, when shown, then resolution steps displayed
4. Given contact needed, when appropriate, then support link provided

### US-2: Retry Button (P1)

Users can retry failed payments with a single click.

**Acceptance Criteria**:

1. Given failed payment, when retry available, then button displayed
2. Given retry clicked, when processing, then loading state shown
3. Given retry successful, when complete, then success confirmation shown
4. Given retry failed, when error persists, then updated error displayed

### US-3: Payment Method Update (P1)

Users can update their payment method when current method fails.

**Acceptance Criteria**:

1. Given card declined, when displayed, then update option shown
2. Given update clicked, when form opens, then current method pre-filled
3. Given new method entered, when saved, then retry with new method
4. Given method updated, when successful, then payment reattempted

### US-4: Failed Payment Recovery (P2)

Users follow guided flow to recover from payment failures.

**Acceptance Criteria**:

1. Given multiple options, when shown, then prioritized by likelihood of success
2. Given wizard flow, when followed, then steps clear and sequential
3. Given recovery complete, when successful, then return to normal flow
4. Given recovery failed, when exhausted, then escalation path provided

## Requirements

### Functional

**Error Display**

- FR-001: Display error code and human-readable message
- FR-002: Categorize errors (card declined, insufficient funds, expired, etc.)
- FR-003: Show error-specific resolution suggestions
- FR-004: Include transaction reference for support
- FR-005: Log errors for debugging

**Retry Mechanism**

- FR-006: Implement retry button with loading state
- FR-007: Track retry attempts
- FR-008: Implement exponential backoff for retries
- FR-009: Limit maximum retry attempts
- FR-010: Show retry attempt counter

**Payment Method Update**

- FR-011: Display current payment method info
- FR-012: Open payment method editor
- FR-013: Validate new payment method
- FR-014: Save updated method to profile
- FR-015: Auto-retry after method update

**Recovery Flow**

- FR-016: Guide user through resolution steps
- FR-017: Prioritize simplest solutions first
- FR-018: Provide alternative payment options
- FR-019: Enable support contact if needed

### Non-Functional

**User Experience**

- NFR-001: Error messages non-technical and actionable
- NFR-002: Retry process completes in < 5 seconds
- NFR-003: Clear visual feedback at each step

**Security**

- NFR-004: Never display full card numbers
- NFR-005: Rate limit retry attempts
- NFR-006: Log all retry attempts for audit

### Components (5-File Pattern)

All components MUST follow the 5-file pattern per constitution:

```
src/components/payments/
├── PaymentRetry/
│   ├── index.tsx                          # Re-exports
│   ├── PaymentRetry.tsx                   # Main component
│   ├── PaymentRetry.test.tsx              # Unit tests (Vitest)
│   ├── PaymentRetry.stories.tsx           # Storybook stories
│   ├── PaymentRetry.accessibility.test.tsx  # Pa11y a11y tests
│   ├── PaymentError.tsx                   # Sub-component
│   ├── RetryButton.tsx                    # Sub-component
│   ├── PaymentMethodUpdate.tsx            # Sub-component
│   └── RecoveryWizard.tsx                 # Sub-component
```

### Error Types

```typescript
type PaymentErrorType =
  | 'card_declined'
  | 'insufficient_funds'
  | 'expired_card'
  | 'invalid_card'
  | 'processing_error'
  | 'network_error'
  | 'authentication_required'
  | 'limit_exceeded';

interface PaymentError {
  type: PaymentErrorType;
  code: string;
  message: string;
  recoverable: boolean;
  suggestedActions: string[];
}
```

### Out of Scope

- Payment provider admin console
- Fraud detection UI
- Chargeback management
- Multi-payment retry orchestration

## Success Criteria

- SC-001: All error types display clear messages
- SC-002: Retry button functions correctly
- SC-003: Payment method update flow works end-to-end
- SC-004: Recovery wizard guides users to resolution
- SC-005: Failed payment recovery rate improves
