import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

const estimateStorage = vi.fn();
vi.mock('@/lib/offline-queue/storage-quota', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/offline-queue/storage-quota')>();
  return { ...actual, estimateStorage: () => estimateStorage() };
});

vi.mock('@/hooks/useOfflineQueue', () => ({
  useOfflineQueue: () => ({
    queueCount: 1,
    failedCount: 0,
    isSyncing: false,
    isOnline: true,
    retryFailed: vi.fn(),
  }),
}));

import QueueStatusPill from './QueueStatusPill';

expect.extend(toHaveNoViolations);

describe('QueueStatusPill Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has no violations without a storage warning', async () => {
    estimateStorage.mockResolvedValue({
      usage: null,
      quota: null,
      ratio: null,
      warning: false,
      supported: true,
    });
    const { container } = render(<QueueStatusPill />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no violations with a storage warning shown', async () => {
    estimateStorage.mockResolvedValue({
      usage: 9 * 1024 * 1024,
      quota: 10 * 1024 * 1024,
      ratio: 0.9,
      warning: true,
      supported: true,
    });
    const { container, findByRole } = render(<QueueStatusPill />);
    await findByRole('alert');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
