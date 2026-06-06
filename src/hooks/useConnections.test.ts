/**
 * Unit tests for useConnections — focuses on the #35 realtime subscription
 * that keeps the pending-connections badge live.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('@/lib/logger/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const emptyList = {
  pending_sent: [],
  pending_received: [],
  accepted: [],
  blocked: [],
};
const getConnections = vi.fn();
vi.mock('@/services/messaging/connection-service', () => ({
  connectionService: {
    getConnections: (...a: unknown[]) => getConnections(...a),
  },
}));

// Capture the postgres_changes handler the hook registers so we can fire it.
let changeHandler: ((payload: { eventType: string }) => void) | null = null;
const removeChannel = vi.fn();
const mockChannel = {
  on: vi.fn((_evt: string, _filter: unknown, cb: typeof changeHandler) => {
    changeHandler = cb;
    return mockChannel;
  }),
  subscribe: vi.fn(() => mockChannel),
};
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: vi.fn(() => mockChannel),
    removeChannel,
  }),
}));

import { useConnections } from './useConnections';

describe('useConnections realtime (#35)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    changeHandler = null;
    getConnections.mockResolvedValue(emptyList);
  });

  it('subscribes to user_connections changes on mount', async () => {
    renderHook(() => useConnections());
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'user_connections', event: '*' }),
      expect.any(Function)
    );
    expect(mockChannel.subscribe).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('refetches (debounced) when a user_connections change fires', async () => {
    renderHook(() => useConnections());
    // 1 initial fetch on mount (flush the mount-effect microtask).
    await act(async () => {
      await Promise.resolve();
    });
    expect(getConnections).toHaveBeenCalledTimes(1);

    // Fire a realtime change → debounced 1s refetch (not immediate).
    act(() => {
      changeHandler?.({ eventType: 'INSERT' });
    });
    expect(getConnections).toHaveBeenCalledTimes(1);

    // Advance past the 1s debounce and flush the refetch.
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(getConnections).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('removes the channel on unmount', () => {
    const { unmount } = renderHook(() => useConnections());
    unmount();
    expect(removeChannel).toHaveBeenCalledWith(mockChannel);
    vi.useRealTimers();
  });
});
