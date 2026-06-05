import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the storage-quota helper so we control the warning state.
const estimateStorage = vi.fn();
vi.mock('@/lib/offline-queue/storage-quota', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/offline-queue/storage-quota')>();
  return { ...actual, estimateStorage: () => estimateStorage() };
});

// Mock the offline-queue hook the wrapped indicator uses (keep it quiet/empty
// so the indicator renders nothing and we isolate the storage-warning behavior).
vi.mock('@/hooks/useOfflineQueue', () => ({
  useOfflineQueue: () => ({
    queueCount: 1, // non-empty so the indicator renders (not null)
    failedCount: 0,
    isSyncing: false,
    isOnline: true,
    retryFailed: vi.fn(),
  }),
}));

import QueueStatusPill from './QueueStatusPill';

describe('QueueStatusPill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    estimateStorage.mockResolvedValue({
      usage: null,
      quota: null,
      ratio: null,
      warning: false,
      supported: true,
    });
  });

  it('renders without crashing', () => {
    const { container } = render(<QueueStatusPill />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('does NOT show a storage warning under the threshold', async () => {
    render(<QueueStatusPill />);
    // give the effect a tick
    await waitFor(() => expect(estimateStorage).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a storage warning when usage is near quota', async () => {
    estimateStorage.mockResolvedValue({
      usage: 8.5 * 1024 * 1024,
      quota: 10 * 1024 * 1024,
      ratio: 0.85,
      warning: true,
      supported: true,
    });
    render(<QueueStatusPill />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/storage is almost full/i);
    expect(alert).toHaveTextContent(/8\.5 MB of 10\.0 MB/);
  });

  it('omits the usage figure when only the ratio is known', async () => {
    estimateStorage.mockResolvedValue({
      usage: null,
      quota: null,
      ratio: 0.9,
      warning: true,
      supported: true,
    });
    render(<QueueStatusPill />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/storage is almost full/i);
    expect(alert).not.toHaveTextContent(/MB of/);
  });
});
