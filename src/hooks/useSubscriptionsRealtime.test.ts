/**
 * Unit tests for useSubscriptionsRealtime — keeps the hub's SubscriptionManager
 * live on status/grace-period changes.
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

import { useSubscriptionsRealtime } from './useSubscriptionsRealtime';

describe('useSubscriptionsRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    changeHandler = null;
    statusCb = null;
  });

  it('subscribes to subscriptions changes on mount', () => {
    renderHook(() => useSubscriptionsRealtime(vi.fn()));
    expect(channel).toHaveBeenCalledWith('subscriptions-list');
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'subscriptions', event: '*' }),
      expect.any(Function)
    );
    vi.useRealTimers();
  });

  it('tracks connection status', () => {
    const { result } = renderHook(() => useSubscriptionsRealtime(vi.fn()));
    expect(result.current).toBe('connecting');
    act(() => statusCb?.('SUBSCRIBED'));
    expect(result.current).toBe('live');
    vi.useRealTimers();
  });

  it('opens NO channel when disabled (enabled=false)', () => {
    renderHook(() => useSubscriptionsRealtime(vi.fn(), false));
    expect(channel).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('debounces onChange and removes the channel on unmount', () => {
    const onChange = vi.fn();
    const { unmount } = renderHook(() => useSubscriptionsRealtime(onChange));
    act(() => {
      changeHandler?.({ eventType: 'UPDATE' });
      changeHandler?.({ eventType: 'UPDATE' });
      vi.advanceTimersByTime(1000);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    unmount();
    expect(removeChannel).toHaveBeenCalledWith(mockChannel);
    vi.useRealTimers();
  });
});
