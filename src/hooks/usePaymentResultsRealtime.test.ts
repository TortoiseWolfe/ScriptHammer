/**
 * Unit tests for usePaymentResultsRealtime — the realtime subscription that
 * keeps the payment hub's PaymentHistory live.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/lib/logger/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Capture the postgres_changes handler + the subscribe status callback so the
// test can drive both the data-change path and the connection-status path.
let changeHandler:
  | ((payload: { eventType: string; new?: { status?: string } | null }) => void)
  | null = null;
let statusCb: ((status: string, err?: { message?: string }) => void) | null =
  null;
const removeChannel = vi.fn();
const mockChannel = {
  on: vi.fn((_evt: string, _filter: unknown, cb: typeof changeHandler) => {
    changeHandler = cb;
    return mockChannel;
  }),
  subscribe: vi.fn((cb: typeof statusCb) => {
    statusCb = cb;
    return mockChannel;
  }),
};
const channel = vi.fn(() => mockChannel);
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ channel, removeChannel }),
}));

import { usePaymentResultsRealtime } from './usePaymentResultsRealtime';

describe('usePaymentResultsRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    changeHandler = null;
    statusCb = null;
  });

  it('subscribes to payment_results changes on mount', () => {
    renderHook(() => usePaymentResultsRealtime(vi.fn()));
    expect(channel).toHaveBeenCalledWith('payment-results-list');
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'payment_results', event: '*' }),
      expect.any(Function)
    );
    expect(mockChannel.subscribe).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('returns "error" on CHANNEL_ERROR before ever connecting', () => {
    const { result } = renderHook(() => usePaymentResultsRealtime(vi.fn()));
    expect(result.current).toBe('connecting');
    // Never reached SUBSCRIBED → a failure is a genuine 'error'.
    act(() => statusCb?.('CHANNEL_ERROR', { message: 'boom' }));
    expect(result.current).toBe('error');
    vi.useRealTimers();
  });

  it('goes live → reconnecting → live on a drop+recover, and refetches on recovery', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => usePaymentResultsRealtime(onChange));

    act(() => statusCb?.('SUBSCRIBED'));
    expect(result.current).toBe('live');

    // Drop AFTER being live → transient 'reconnecting', not terminal 'error'.
    act(() => statusCb?.('CHANNEL_ERROR', { message: 'dropped' }));
    expect(result.current).toBe('reconnecting');

    // Recover → back to 'live' AND onChange fires (debounced) to refetch events
    // missed while the channel was down.
    act(() => statusCb?.('SUBSCRIBED'));
    expect(result.current).toBe('live');
    expect(onChange).not.toHaveBeenCalled(); // still in the debounce window
    act(() => vi.advanceTimersByTime(1000));
    expect(onChange).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('resyncs on the FIRST SUBSCRIBED, so a row inserted before the join is not lost', () => {
    // #497: the channel joining is not instant, and under load it took tens of
    // seconds. Anything written between the initial fetch and the join is
    // published to nobody — and the list has no other refresh path, so the
    // count stayed stale for the life of the page. The join itself must resync.
    const onChange = vi.fn();
    renderHook(() => usePaymentResultsRealtime(onChange));

    act(() => statusCb?.('SUBSCRIBED'));
    expect(onChange).not.toHaveBeenCalled(); // still inside the debounce window
    act(() => vi.advanceTimersByTime(1000));
    expect(onChange).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('does not inflate the "N updates" pill with the first-join resync', () => {
    // The resync is bookkeeping, not a change the user made happen. It must not
    // count toward the coalesced burst total, or every page load would flash a
    // spurious "N updates" pill.
    const onBatch = vi.fn();
    renderHook(() => usePaymentResultsRealtime(vi.fn(), true, onBatch));
    act(() => statusCb?.('SUBSCRIBED'));
    act(() => vi.advanceTimersByTime(1000));
    expect(onBatch).toHaveBeenCalledWith(0);
    vi.useRealTimers();
  });

  it('counts a real event landing in the same window as the join exactly once', () => {
    const onChange = vi.fn();
    const onBatch = vi.fn();
    renderHook(() => usePaymentResultsRealtime(onChange, true, onBatch));
    act(() => {
      statusCb?.('SUBSCRIBED');
      changeHandler?.({ eventType: 'INSERT' });
    });
    act(() => vi.advanceTimersByTime(1000));
    // One refetch covering both, and the batch reports the one real event.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onBatch).toHaveBeenCalledWith(1);
    vi.useRealTimers();
  });

  it('calls onChange once (debounced) for rapid changes', () => {
    const onChange = vi.fn();
    renderHook(() => usePaymentResultsRealtime(onChange));
    act(() => {
      changeHandler?.({ eventType: 'INSERT' });
      changeHandler?.({ eventType: 'INSERT' });
      changeHandler?.({ eventType: 'UPDATE' });
    });
    expect(onChange).not.toHaveBeenCalled(); // still within debounce window
    act(() => vi.advanceTimersByTime(1000));
    expect(onChange).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('reports the coalesced count via onBatch after a burst', () => {
    const onChange = vi.fn();
    const onBatch = vi.fn();
    renderHook(() => usePaymentResultsRealtime(onChange, true, onBatch));
    act(() => {
      changeHandler?.({ eventType: 'INSERT' });
      changeHandler?.({ eventType: 'INSERT' });
      changeHandler?.({ eventType: 'UPDATE' });
    });
    act(() => vi.advanceTimersByTime(1000));
    // One refetch, and onBatch reports all 3 coalesced events.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onBatch).toHaveBeenCalledTimes(1);
    expect(onBatch).toHaveBeenCalledWith(3);

    // A subsequent single change reports a batch of 1 (count resets per flush).
    onBatch.mockClear();
    act(() => changeHandler?.({ eventType: 'INSERT' }));
    act(() => vi.advanceTimersByTime(1000));
    expect(onBatch).toHaveBeenCalledWith(1);
    vi.useRealTimers();
  });

  it('fires onEvent immediately (not debounced) with the changed row', () => {
    const onEvent = vi.fn();
    renderHook(() =>
      usePaymentResultsRealtime(vi.fn(), true, undefined, onEvent)
    );
    const payload = { eventType: 'INSERT', new: { status: 'failed' } };
    act(() => changeHandler?.(payload));
    // onEvent fires synchronously per event (no debounce wait needed).
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(payload);
    vi.useRealTimers();
  });

  it('removes the channel on unmount', () => {
    const { unmount } = renderHook(() => usePaymentResultsRealtime(vi.fn()));
    unmount();
    expect(removeChannel).toHaveBeenCalledWith(mockChannel);
    vi.useRealTimers();
  });

  it('opens NO channel when disabled (enabled=false)', () => {
    renderHook(() => usePaymentResultsRealtime(vi.fn(), false));
    expect(channel).not.toHaveBeenCalled();
    expect(mockChannel.subscribe).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('uses the latest onChange without re-subscribing', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => usePaymentResultsRealtime(cb), {
      initialProps: { cb: first },
    });
    rerender({ cb: second });
    // Still only one subscription despite the prop change.
    expect(mockChannel.subscribe).toHaveBeenCalledTimes(1);
    act(() => {
      changeHandler?.({ eventType: 'INSERT' });
      vi.advanceTimersByTime(1000);
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
