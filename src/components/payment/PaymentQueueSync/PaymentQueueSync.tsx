'use client';

import { useEffect } from 'react';
import { startConnectionListener } from '@/lib/payments/connection-listener';

/**
 * Drains the offline payment queue when connectivity returns (#895).
 *
 * WHAT WAS BROKEN. `src/lib/payments/connection-listener.ts` was written to
 * "auto-sync offline queue when online" and **nothing ever called it**.
 * `startConnectionListener` had zero callers, and it is the only caller of
 * `processPendingOperations()`, which is the only non-shim caller of
 * `paymentQueue.sync()`. So the whole automatic drain chain was dead: a payment
 * submitted offline was written to IndexedDB and then sat there — not on
 * reconnect, not on refocus, not on next load — until the buyer happened to
 * navigate to the payment hub and find the manual retry button.
 *
 * The form queue's equivalent fallback (`startFormQueueFallback`, wired at
 * `useWeb3Forms.ts:94`) documents itself as *mirroring* this payment listener.
 * The mirror got wired up; the original never did.
 *
 * WHY IT MOUNTS APP-WIDE RATHER THAN ON THE PAYMENT PAGES. A payment is queued
 * and then the buyer navigates away — that is the whole scenario. A drain that
 * only runs where payments are initiated would miss exactly the case it exists
 * for. This is why the listener's guard order had to be corrected first: it used
 * to issue a real Supabase query every 30 seconds before checking whether
 * anything was queued, which is a cost no app-wide mount could carry. With the
 * local queue count first, an empty queue costs one IndexedDB read.
 *
 * RENDERS NOTHING. Mount-only, like `StylesheetGuard`. The listener is a
 * module-level singleton guarded by `isListening`, so it must be mounted in
 * exactly ONE place — a second mount would hand back a stop function that
 * disarms the first.
 */
export default function PaymentQueueSync() {
  useEffect(() => {
    const stop = startConnectionListener();
    return stop;
  }, []);

  return null;
}
