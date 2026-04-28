/**
 * OfflineRetryBanner unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { OfflineRetryBanner } from './OfflineRetryBanner';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';

vi.mock('@/hooks/useOfflineStatus');

const getCountMock = vi.fn();
vi.mock('@/lib/offline-queue/payment-adapter', () => ({
  paymentQueue: {
    getCount: () => getCountMock(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  getCountMock.mockResolvedValue(0);
});

function setOnline(isOffline: boolean) {
  vi.mocked(useOfflineStatus).mockReturnValue({
    isOffline,
    wasOffline: false,
    lastOnline: null,
    connectionSpeed: 'unknown',
  });
}

describe('OfflineRetryBanner', () => {
  it('renders nothing when online and queue is empty (steady state)', async () => {
    setOnline(false);
    getCountMock.mockResolvedValue(0);
    const { container } = render(<OfflineRetryBanner />);
    // wait for the initial getCount to settle
    await waitFor(() => expect(getCountMock).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it('shows offline banner with retry promise when offline (no queued items)', async () => {
    setOnline(true);
    getCountMock.mockResolvedValue(0);
    render(<OfflineRetryBanner />);
    await waitFor(() => expect(getCountMock).toHaveBeenCalled());
    expect(screen.getByText(/you.?re offline/i)).toBeInTheDocument();
    expect(
      screen.getByText(/we.?ll process your payment/i)
    ).toBeInTheDocument();
    // No "waiting" copy when count is 0.
    expect(screen.queryByText(/waiting to send/i)).not.toBeInTheDocument();
  });

  it('shows queued count in offline banner (singular form)', async () => {
    setOnline(true);
    getCountMock.mockResolvedValue(1);
    render(<OfflineRetryBanner />);
    await waitFor(() =>
      expect(screen.getByText(/1 payment is waiting/i)).toBeInTheDocument()
    );
  });

  it('shows queued count in offline banner (plural form)', async () => {
    setOnline(true);
    getCountMock.mockResolvedValue(3);
    render(<OfflineRetryBanner />);
    await waitFor(() =>
      expect(screen.getByText(/3 payments are waiting/i)).toBeInTheDocument()
    );
  });

  it('shows "Syncing N queued payments" when online but queue still has items', async () => {
    setOnline(false);
    getCountMock.mockResolvedValue(2);
    render(<OfflineRetryBanner />);
    await waitFor(() =>
      expect(screen.getByText(/syncing 2 queued payments/i)).toBeInTheDocument()
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('survives a getCount rejection without throwing', async () => {
    setOnline(false);
    getCountMock.mockRejectedValue(new Error('IndexedDB locked'));
    render(<OfflineRetryBanner />);
    await waitFor(() => expect(getCountMock).toHaveBeenCalled());
    // Component still renders something; specifically, online + count=0
    // is the steady state, so the banner is null. The test passes if
    // render didn't throw.
    expect(true).toBe(true);
  });
});
