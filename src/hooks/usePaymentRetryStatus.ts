/**
 * usePaymentRetryStatus
 *
 * Reads the parent payment intent and computes the retry button's state
 * — count, cap, cooling countdown, expiry — so PaymentStatusDisplay can
 * render the right UI before the user clicks (FR-008, FR-010).
 *
 * The retry-cap and cooling logic mirror the server-side checks in
 * `retryFailedPayment` (`src/lib/payments/payment-service.ts`). The hook
 * is a UX hint, not a security boundary — a user who manipulates client
 * state still hits the same checks server-side and gets a thrown error
 * caught by PaymentStatusDisplay's catch handler.
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { COOLING_PERIOD_MS, RETRY_LIMIT } from '@/lib/payments/payment-service';

export type RetryDisabledReason = 'limit' | 'cooling' | 'expired' | null;

export interface PaymentRetryStatus {
  loading: boolean;
  retryCount: number;
  maxRetries: number;
  canRetry: boolean;
  disabledReason: RetryDisabledReason;
  /** ms remaining until cooling expires; 0 when not cooling */
  coolingMsRemaining: number;
}

const INITIAL: PaymentRetryStatus = {
  loading: true,
  retryCount: 0,
  maxRetries: RETRY_LIMIT,
  canRetry: false,
  disabledReason: null,
  coolingMsRemaining: 0,
};

const RESOLVED_NULL: PaymentRetryStatus = {
  ...INITIAL,
  loading: false,
};

/** Tick interval for the cooling countdown. 1Hz is enough — the UI just
 * shows whole seconds, and we're not doing animations. */
const COOLING_TICK_MS = 1000;

export function usePaymentRetryStatus(
  intentId: string | null
): PaymentRetryStatus {
  const [status, setStatus] = useState<PaymentRetryStatus>(
    intentId ? INITIAL : RESOLVED_NULL
  );
  // Refs hold the parent's createdAt + expiresAt so the cooling tick can
  // recompute without re-fetching.
  const createdAtRef = useRef<number | null>(null);
  const expiresAtRef = useRef<number | null>(null);
  const retryCountRef = useRef<number>(0);

  // Fetch parent intent.
  useEffect(() => {
    if (!intentId) {
      setStatus(RESOLVED_NULL);
      return;
    }

    let cancelled = false;
    setStatus(INITIAL);

    (async () => {
      const { data, error } = await supabase
        .from('payment_intents')
        .select('id, retry_count, created_at, expires_at')
        .eq('id', intentId)
        .single();

      if (cancelled) return;

      if (error || !data) {
        setStatus({ ...RESOLVED_NULL, disabledReason: null });
        return;
      }

      const createdAt = new Date(
        (data as { created_at: string }).created_at
      ).getTime();
      const expiresAt = new Date(
        (data as { expires_at: string }).expires_at
      ).getTime();
      const retryCount = (data as { retry_count: number }).retry_count;

      createdAtRef.current = createdAt;
      expiresAtRef.current = expiresAt;
      retryCountRef.current = retryCount;

      setStatus(computeStatus(retryCount, createdAt, expiresAt, false));
    })();

    return () => {
      cancelled = true;
    };
  }, [intentId]);

  // Cooling countdown tick.
  useEffect(() => {
    if (status.disabledReason !== 'cooling') return;

    const tick = setInterval(() => {
      if (createdAtRef.current === null || expiresAtRef.current === null) {
        return;
      }
      setStatus(
        computeStatus(
          retryCountRef.current,
          createdAtRef.current,
          expiresAtRef.current,
          false
        )
      );
    }, COOLING_TICK_MS);

    return () => clearInterval(tick);
  }, [status.disabledReason]);

  return status;
}

function computeStatus(
  retryCount: number,
  createdAt: number,
  expiresAt: number,
  loading: boolean
): PaymentRetryStatus {
  const now = Date.now();
  const base = {
    loading,
    retryCount,
    maxRetries: RETRY_LIMIT,
    coolingMsRemaining: 0,
  };

  if (retryCount >= RETRY_LIMIT) {
    return { ...base, canRetry: false, disabledReason: 'limit' };
  }
  if (expiresAt < now) {
    return { ...base, canRetry: false, disabledReason: 'expired' };
  }

  const elapsedMs = now - createdAt;
  if (elapsedMs < COOLING_PERIOD_MS) {
    return {
      ...base,
      canRetry: false,
      disabledReason: 'cooling',
      coolingMsRemaining: COOLING_PERIOD_MS - elapsedMs,
    };
  }

  return { ...base, canRetry: true, disabledReason: null };
}
