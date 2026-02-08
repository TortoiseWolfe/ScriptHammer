# Feature: Payment Offline Queue UI

**Feature ID**: 039
**Category**: payments
**Source**: ScriptHammer_v_001 README (SPEC-055)
**Status**: Ready for SpecKit

## Description

Queue status indicator, pending payment list, and retry mechanism UI. Enables users to view and manage payments that were initiated while offline and are waiting to be processed when connectivity is restored.

## User Scenarios

### US-1: Queue Status Indicator (P1)

Users see clear indication of pending offline payments.

**Acceptance Criteria**:

1. Given offline payment queued, when viewing UI, then indicator shows count
2. Given multiple pending payments, when displayed, then total count accurate
3. Given queue processing, when syncing, then progress indicator shown
4. Given all processed, when complete, then indicator clears

### US-2: Pending Payment List (P1)

Users view list of payments waiting to be processed.

**Acceptance Criteria**:

1. Given queued payments, when listing, then all pending shown
2. Given payment item, when displayed, then amount and description visible
3. Given timestamp, when shown, then queued time displayed
4. Given status, when updated, then reflects processing state

### US-3: Retry Mechanism (P2)

Users can manually retry failed offline payments.

**Acceptance Criteria**:

1. Given failed payment, when retry clicked, then payment reattempted
2. Given retry in progress, when processing, then loading state shown
3. Given retry successful, when complete, then payment moved to history
4. Given retry failed, when error occurs, then clear error message displayed

### US-4: Queue Management (P2)

Users can manage their offline payment queue.

**Acceptance Criteria**:

1. Given pending payment, when cancel clicked, then removed from queue
2. Given cancellation, when confirmed, then payment deleted
3. Given edit needed, when allowed, then payment details editable
4. Given clear all, when confirmed, then entire queue cleared

## Requirements

### Functional

**Queue Status**

- FR-001: Display badge with pending payment count
- FR-002: Show queue status in navigation/header
- FR-003: Indicate when queue is syncing
- FR-004: Update count in real-time as payments process

**Pending List**

- FR-005: List all pending offline payments
- FR-006: Display payment amount and description
- FR-007: Show time payment was queued
- FR-008: Indicate payment processing status
- FR-009: Sort by queue order or time

**Retry Functionality**

- FR-010: Implement retry button per payment
- FR-011: Implement retry all button
- FR-012: Show retry attempt count
- FR-013: Display last retry timestamp
- FR-014: Handle retry rate limiting

**Queue Management**

- FR-015: Allow individual payment cancellation
- FR-016: Implement clear all with confirmation
- FR-017: Enable payment editing (if applicable)
- FR-018: Persist queue in IndexedDB

### Non-Functional

**Reliability**

- NFR-001: Queue survives app restart
- NFR-002: Queue persists through browser close
- NFR-003: Automatic retry on reconnection

**Performance**

- NFR-004: Queue operations complete in < 100ms
- NFR-005: Batch processing for multiple retries

**User Experience**

- NFR-006: Clear visual distinction for queued vs processed
- NFR-007: Confirmation dialogs for destructive actions

### Components (5-File Pattern)

All components MUST follow the 5-file pattern per constitution:

```
src/components/payments/
├── OfflineQueue/
│   ├── index.tsx                          # Re-exports
│   ├── OfflineQueue.tsx                   # Main component
│   ├── OfflineQueue.test.tsx              # Unit tests (Vitest)
│   ├── OfflineQueue.stories.tsx           # Storybook stories
│   ├── OfflineQueue.accessibility.test.tsx  # Pa11y a11y tests
│   ├── QueueStatusBadge.tsx               # Sub-component
│   ├── PendingPaymentList.tsx             # Sub-component
│   ├── PendingPaymentItem.tsx             # Sub-component
│   └── QueueActions.tsx                   # Sub-component
```

### Storage Schema

```typescript
interface QueuedPayment {
  id: string;
  amount: number;
  description: string;
  queuedAt: Date;
  retryCount: number;
  lastRetryAt?: Date;
  status: 'pending' | 'processing' | 'failed';
  errorMessage?: string;
}
```

### Out of Scope

- Offline payment initiation (handled by PWA sync)
- Background sync implementation
- Server-side queue management

## Success Criteria

- SC-001: Queue badge accurately reflects pending count
- SC-002: All queued payments visible in list
- SC-003: Retry mechanism successfully processes payments
- SC-004: Queue persists across sessions
- SC-005: Clear feedback for all queue operations
