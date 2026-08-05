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
// ...and the subscribe status callback, which is the only way to drive the
// channel-join path (#499). `subscribe` used to ignore its argument entirely.
let statusCb: ((status: string, err?: { message?: string }) => void) | null =
  null;
const removeChannel = vi.fn();
const mockChannel = {
  on: vi.fn((_evt: string, _filter: unknown, cb: typeof changeHandler) => {
    changeHandler = cb;
    return mockChannel;
  }),
  subscribe: vi.fn((cb?: typeof statusCb) => {
    statusCb = cb ?? null;
    return mockChannel;
  }),
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
    statusCb = null;
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

  it('resyncs on the FIRST SUBSCRIBED, so a change before the join is not missed (#499)', async () => {
    // The channel join is not instant — #497 measured a row inserted ~2s after
    // page load still missing 15s later. A connection accepted in that window
    // is published to nobody, and nothing else here refetches, so the list
    // stayed stale for the life of the page.
    renderHook(() => useConnections());
    await act(async () => {
      await Promise.resolve();
    });
    expect(getConnections).toHaveBeenCalledTimes(1); // mount fetch

    // The join itself must trigger a re-read.
    expect(
      statusCb,
      'subscribe() was called without a status callback — the hook cannot know ' +
        'when the channel joined'
    ).toBeTypeOf('function');
    act(() => {
      statusCb?.('SUBSCRIBED');
    });

    // Debounced, deliberately: a join racing a real event must cost one fetch.
    expect(getConnections).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(getConnections).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  // NOTE ON WHAT THIS DOES AND DOES NOT PROVE: this one passes with the #499
  // defect present — delete the SUBSCRIBED branch and it stays green, because
  // the change handler alone also produces exactly one fetch. It is not
  // resync coverage; the test above is. What it guards is the SHARED debounce:
  // it would fail if a future edit made the join bypass it and double-fetch on
  // every page load. Kept for that, labelled so nobody reads it as more.
  it('coalesces a join that races a real event into ONE refetch (#499)', async () => {
    renderHook(() => useConnections());
    await act(async () => {
      await Promise.resolve();
    });
    getConnections.mockClear();

    act(() => {
      statusCb?.('SUBSCRIBED');
      changeHandler?.({ eventType: 'INSERT' });
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    // Both paths share the debounce, so this is 1 — not 2.
    expect(getConnections).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('removes the channel on unmount', () => {
    const { unmount } = renderHook(() => useConnections());
    unmount();
    expect(removeChannel).toHaveBeenCalledWith(mockChannel);
    vi.useRealTimers();
  });
});
