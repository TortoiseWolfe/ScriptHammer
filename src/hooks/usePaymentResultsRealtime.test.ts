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
let changeHandler: ((payload: { eventType: string }) => void) | null = null;
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

  it('returns "live" once SUBSCRIBED and "error" on CHANNEL_ERROR', () => {
    const { result } = renderHook(() => usePaymentResultsRealtime(vi.fn()));
    expect(result.current).toBe('connecting');
    act(() => statusCb?.('SUBSCRIBED'));
    expect(result.current).toBe('live');
    act(() => statusCb?.('CHANNEL_ERROR', { message: 'boom' }));
    expect(result.current).toBe('error');
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
