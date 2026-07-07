import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import PaymentQueuePanel from './PaymentQueuePanel';
import type { PaymentQueueItem } from '@/lib/offline-queue/types';

expect.extend(toHaveNoViolations);

const items: PaymentQueueItem[] = [
  {
    id: 1,
    status: 'failed',
    retries: 2,
    createdAt: Date.now(),
    type: 'payment_intent',
    data: { amount: 1000 },
    lastError: 'Network error',
  } as PaymentQueueItem,
];

let queueData: PaymentQueueItem[] = [];

vi.mock('@/lib/offline-queue/payment-adapter', () => ({
  paymentQueue: {
    getQueue: () => Promise.resolve(queueData),
    retryFailed: () => Promise.resolve(0),
    sync: () =>
      Promise.resolve({ success: 0, failed: 0, skipped: 0, conflicted: 0 }),
    clear: () => Promise.resolve(),
  },
}));

vi.mock('@/hooks/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOffline: false }),
}));

describe('PaymentQueuePanel Accessibility', () => {
  beforeEach(() => {
    queueData = [];
  });

  it('has no violations in the empty state', async () => {
    const { container } = render(<PaymentQueuePanel pollIntervalMs={999999} />);
    await waitFor(() => expect(container.firstChild).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with queued items', async () => {
    queueData = items;
    const { container, findByTestId } = render(
      <PaymentQueuePanel pollIntervalMs={999999} />
    );
    await findByTestId('queue-items');
    expect(await axe(container)).toHaveNoViolations();
  });
});
