/**
 * OfflineRetryBanner Accessibility Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { OfflineRetryBanner } from './OfflineRetryBanner';

expect.extend(toHaveNoViolations);

vi.mock('@/hooks/useOfflineStatus', () => ({
  useOfflineStatus: vi.fn(() => ({
    isOffline: true,
    wasOffline: false,
    lastOnline: null,
    connectionSpeed: 'unknown',
  })),
}));

vi.mock('@/lib/offline-queue/payment-adapter', () => ({
  paymentQueue: {
    getCount: vi.fn(() => Promise.resolve(2)),
  },
}));

describe('OfflineRetryBanner Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has no a11y violations in offline state with queued items', async () => {
    const { container } = render(<OfflineRetryBanner />);
    await waitFor(() => container.querySelector('.alert'));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
