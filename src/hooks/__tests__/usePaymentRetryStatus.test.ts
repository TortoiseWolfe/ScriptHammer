/**
 * usePaymentRetryStatus tests — derives retry-button state (count, can-retry,
 * cooling countdown) from the parent intent so PaymentStatusDisplay can
 * render the correct UI before the user clicks (FR-008, FR-010).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePaymentRetryStatus } from '../usePaymentRetryStatus';
import { COOLING_PERIOD_MS, RETRY_LIMIT } from '@/lib/payments/payment-service';

// ── Mock parent-intent fetch ────────────────────────────────────────────
const mockSingle = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSingle,
        })),
      })),
    })),
  },
}));

beforeEach(() => {
  mockSingle.mockReset();
  // shouldAdvanceTime keeps microtask queues + waitFor internals working
  // while still letting us control setInterval / setTimeout deterministically.
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

const NOW = new Date('2026-04-27T20:00:00Z').getTime();

function setNow() {
  vi.setSystemTime(new Date(NOW));
}

function mockIntent(overrides: Record<string, unknown> = {}) {
  mockSingle.mockResolvedValue({
    data: {
      id: 'parent-1',
      retry_count: 0,
      created_at: new Date(NOW - COOLING_PERIOD_MS - 1000).toISOString(),
      expires_at: new Date(NOW + 3_600_000).toISOString(),
      ...overrides,
    },
    error: null,
  });
}

describe('usePaymentRetryStatus', () => {
  it('returns loading=true initially, then resolved status', async () => {
    setNow();
    mockIntent({ retry_count: 1 });
    const { result } = renderHook(() => usePaymentRetryStatus('parent-1'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.retryCount).toBe(1);
    expect(result.current.maxRetries).toBe(RETRY_LIMIT);
  });

  it('canRetry=false when retry_count >= RETRY_LIMIT', async () => {
    setNow();
    mockIntent({ retry_count: RETRY_LIMIT });
    const { result } = renderHook(() => usePaymentRetryStatus('parent-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canRetry).toBe(false);
    expect(result.current.disabledReason).toBe('limit');
  });

  it('canRetry=false when within cooling window; disabledReason=cooling', async () => {
    setNow();
    mockIntent({
      created_at: new Date(NOW - 5_000).toISOString(), // 5s ago
    });
    const { result } = renderHook(() => usePaymentRetryStatus('parent-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canRetry).toBe(false);
    expect(result.current.disabledReason).toBe('cooling');
    expect(result.current.coolingMsRemaining).toBeGreaterThan(0);
    expect(result.current.coolingMsRemaining).toBeLessThanOrEqual(
      COOLING_PERIOD_MS
    );
  });

  it('canRetry=false when expired; disabledReason=expired', async () => {
    setNow();
    mockIntent({
      expires_at: new Date(NOW - 1000).toISOString(),
    });
    const { result } = renderHook(() => usePaymentRetryStatus('parent-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canRetry).toBe(false);
    expect(result.current.disabledReason).toBe('expired');
  });

  it('canRetry=true when fresh, not maxed, not expired', async () => {
    setNow();
    mockIntent();
    const { result } = renderHook(() => usePaymentRetryStatus('parent-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canRetry).toBe(true);
    expect(result.current.disabledReason).toBe(null);
  });

  it('countdown ticks down while cooling and flips canRetry once it hits 0', async () => {
    setNow();
    mockIntent({
      created_at: new Date(NOW - (COOLING_PERIOD_MS - 3_000)).toISOString(),
    });
    const { result } = renderHook(() => usePaymentRetryStatus('parent-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canRetry).toBe(false);
    const initial = result.current.coolingMsRemaining;
    expect(initial).toBeGreaterThan(0);

    // Advance past the cooling window
    await act(async () => {
      vi.advanceTimersByTime(3_500);
    });
    expect(result.current.coolingMsRemaining).toBe(0);
    expect(result.current.canRetry).toBe(true);
  });

  it('returns { loading: false, canRetry: false, disabledReason: null } for a null intentId', async () => {
    setNow();
    const { result } = renderHook(() => usePaymentRetryStatus(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canRetry).toBe(false);
    expect(mockSingle).not.toHaveBeenCalled();
  });
});
