/**
 * OfflineRetryBanner
 *
 * Surfaces offline state on the payment-result page so users understand
 * why their retry isn't going through. Reads `useOfflineStatus` for the
 * connectivity bit and `paymentQueue.getCount()` for the count of pending
 * queued payments. When queued items exist and the user is offline, the
 * banner promises retry-when-online; otherwise it stays out of the way.
 *
 * Mount above PaymentStatusDisplay on /payment-result.
 */

'use client';

import React from 'react';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { paymentQueue } from '@/lib/offline-queue/payment-adapter';

export interface OfflineRetryBannerProps {
  /** Override the default polling interval for the queue count (ms). */
  pollIntervalMs?: number;
  className?: string;
}

const DEFAULT_POLL_MS = 5_000;

export const OfflineRetryBanner: React.FC<OfflineRetryBannerProps> = ({
  pollIntervalMs = DEFAULT_POLL_MS,
  className = '',
}) => {
  const { isOffline } = useOfflineStatus();
  const [queuedCount, setQueuedCount] = React.useState<number>(0);

  // Poll the queue count rather than subscribing — the queue API is Dexie
  // and doesn't expose a change emitter, and the count is small + cheap.
  React.useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const count = await paymentQueue.getCount();
        if (!cancelled) setQueuedCount(count);
      } catch {
        // Queue read failure is non-critical — banner just stays at 0.
      }
    }

    refresh();
    const id = window.setInterval(refresh, pollIntervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pollIntervalMs]);

  // Render nothing if there's nothing useful to say. The banner is meant
  // to be silent when the user is online and the queue is empty — which
  // is the expected steady state.
  if (!isOffline && queuedCount === 0) {
    return null;
  }

  if (isOffline) {
    return (
      <div
        className={`alert alert-warning ${className}`}
        role="status"
        aria-live="polite"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 shrink-0 stroke-current"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4 4 0 010-5.656M5.636 5.636a9 9 0 000 12.728m3.536-3.536a4 4 0 000-5.656"
          />
        </svg>
        <div>
          <p className="font-semibold">You&rsquo;re offline.</p>
          <p className="text-sm">
            We&rsquo;ll process your payment when your connection returns.
            {queuedCount > 0 && (
              <>
                {' '}
                {queuedCount === 1
                  ? '1 payment is waiting to send.'
                  : `${queuedCount} payments are waiting to send.`}
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  // Online but with queued items — happens briefly during sync, or when
  // the queue is in a stuck state. Surfaces it so the user isn't left
  // wondering why their action seemed to take effect but didn't show up.
  return (
    <div
      className={`alert alert-info ${className}`}
      role="status"
      aria-live="polite"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6 shrink-0 stroke-current"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      <span>
        Syncing{' '}
        {queuedCount === 1
          ? '1 queued payment'
          : `${queuedCount} queued payments`}
        &hellip;
      </span>
    </div>
  );
};

OfflineRetryBanner.displayName = 'OfflineRetryBanner';
