import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PaymentQueuePanel from './PaymentQueuePanel';
import type { PaymentQueueItem } from '@/lib/offline-queue/types';

const mockQueue = {
  getQueue: vi.fn(),
  retryFailed: vi.fn(),
  sync: vi.fn(),
  clear: vi.fn(),
};
let offline = false;

vi.mock('@/lib/offline-queue/payment-adapter', () => ({
  paymentQueue: {
    getQueue: (...a: unknown[]) => mockQueue.getQueue(...a),
    retryFailed: (...a: unknown[]) => mockQueue.retryFailed(...a),
    sync: (...a: unknown[]) => mockQueue.sync(...a),
    clear: (...a: unknown[]) => mockQueue.clear(...a),
  },
}));

vi.mock('@/hooks/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOffline: offline }),
}));

function makeItem(over: Partial<PaymentQueueItem> = {}): PaymentQueueItem {
  return {
    id: 1,
    status: 'pending',
    retries: 0,
    createdAt: Date.now(),
    type: 'payment_intent',
    data: { amount: 1000 },
    ...over,
  } as PaymentQueueItem;
}

describe('PaymentQueuePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    offline = false;
    mockQueue.getQueue.mockResolvedValue([]);
    mockQueue.retryFailed.mockResolvedValue(0);
    mockQueue.sync.mockResolvedValue({
      success: 0,
      failed: 0,
      skipped: 0,
      conflicted: 0,
    });
    mockQueue.clear.mockResolvedValue(undefined);
  });

  it('shows the empty state when the queue is empty', async () => {
    render(<PaymentQueuePanel pollIntervalMs={999999} />);
    await waitFor(() =>
      expect(screen.getByTestId('queue-count')).toHaveTextContent(
        /no queued payments/i
      )
    );
    expect(screen.getByTestId('queue-retry')).toBeDisabled();
    expect(screen.getByTestId('queue-clear')).toBeDisabled();
  });

  it('lists queued items with their retry counts', async () => {
    mockQueue.getQueue.mockResolvedValue([
      makeItem({ id: 1, retries: 2 }),
      makeItem({ id: 2, status: 'failed', retries: 5, lastError: 'boom' }),
    ]);
    render(<PaymentQueuePanel pollIntervalMs={999999} />);
    await waitFor(() =>
      expect(screen.getByTestId('queue-items')).toBeInTheDocument()
    );
    expect(screen.getByTestId('queue-item-retries-1')).toHaveTextContent(
      /attempt 2\/5/i
    );
    // At max retries → "Max retries"
    expect(screen.getByTestId('queue-item-retries-2')).toHaveTextContent(
      /max retries/i
    );
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.getByTestId('queue-count')).toHaveTextContent(/1 pending/i);
    expect(screen.getByTestId('queue-count')).toHaveTextContent(/1 failed/i);
  });

  it('retry calls retryFailed then sync', async () => {
    mockQueue.getQueue.mockResolvedValue([
      makeItem({ status: 'failed', retries: 1 }),
    ]);
    render(<PaymentQueuePanel pollIntervalMs={999999} />);
    await waitFor(() =>
      expect(screen.getByTestId('queue-retry')).toBeEnabled()
    );
    fireEvent.click(screen.getByTestId('queue-retry'));
    await waitFor(() => expect(mockQueue.retryFailed).toHaveBeenCalledTimes(1));
    expect(mockQueue.sync).toHaveBeenCalledTimes(1);
  });

  it('disables Retry now when offline', async () => {
    offline = true;
    mockQueue.getQueue.mockResolvedValue([makeItem()]);
    render(<PaymentQueuePanel pollIntervalMs={999999} />);
    await waitFor(() =>
      expect(screen.getByTestId('queue-conn-state')).toHaveTextContent(
        /offline/i
      )
    );
    expect(screen.getByTestId('queue-retry')).toBeDisabled();
  });

  it('clear requires confirmation before calling clear()', async () => {
    mockQueue.getQueue.mockResolvedValue([makeItem()]);
    render(<PaymentQueuePanel pollIntervalMs={999999} />);
    await waitFor(() =>
      expect(screen.getByTestId('queue-clear')).toBeEnabled()
    );

    fireEvent.click(screen.getByTestId('queue-clear'));
    // Confirmation appears; clear NOT yet called.
    expect(screen.getByTestId('queue-clear-confirm')).toBeInTheDocument();
    expect(mockQueue.clear).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('queue-clear-confirm-yes'));
    await waitFor(() => expect(mockQueue.clear).toHaveBeenCalledTimes(1));
  });
});
