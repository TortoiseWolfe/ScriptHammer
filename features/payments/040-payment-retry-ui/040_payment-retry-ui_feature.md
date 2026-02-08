# Feature: Payment Retry UI

**Feature ID**: 040
**Category**: payments
**Source**: ScriptHammer_v_001 README (SPEC-056)
**Status**: Ready for SpecKit

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
