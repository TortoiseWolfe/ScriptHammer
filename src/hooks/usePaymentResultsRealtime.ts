import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createLogger } from '@/lib/logger/logger';

const logger = createLogger('hooks:usePaymentResultsRealtime');

/**
 * Connection state of the realtime channel, for a status indicator.
 * 'reconnecting' = the channel dropped AFTER being live and the client is
 * retrying (transient), distinct from 'error' which reads as terminal.
 */
export type RealtimeStatus = 'connecting' | 'live' | 'reconnecting' | 'error';

/**
 * Subscribe to `payment_results` changes and invoke `onChange` (debounced 1s)
 * whenever a row the user can see is inserted/updated/deleted. RLS scopes which
 * rows emit events server-side (same as {@link useConnections}), so no client
 * filter is needed.
 *
 * Returns the channel's connection status ('connecting' → 'live' on SUBSCRIBED,
 * 'error' on CHANNEL_ERROR) for a connection indicator.
 *
 * `onChange` is read through a ref so passing a fresh callback each render does
 * NOT tear down and re-create the subscription.
 *
 * `onBatch(count)` (optional) fires each time the debounce flushes, with the
 * number of realtime events coalesced into that single refetch. A burst of N
 * rapid changes → one onChange + one onBatch(N), so the UI can surface "N
 * updates" instead of silently folding them.
 *
 * `onEvent(payload)` (optional) fires immediately (NOT debounced) for each
 * individual change, with the event type and the new/old row. Lets the UI react
 * to *what* changed — e.g. surface an error notification when a payment_results
 * row arrives with status 'failed'.
 *
 * Pass `enabled: false` to skip the subscription entirely (e.g. in tests or
 * stories that must not open a live channel) — the hook then stays 'connecting'
 * and never touches the Supabase client.
 */
export interface PaymentResultsChange {
  eventType: string;
  new?: { status?: string; [k: string]: unknown } | null;
  old?: { status?: string; [k: string]: unknown } | null;
}

export function usePaymentResultsRealtime(
  onChange: () => void,
  enabled = true,
  onBatch?: (count: number) => void,
  onEvent?: (payload: PaymentResultsChange) => void
): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onBatchRef = useRef(onBatch);
  onBatchRef.current = onBatch;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  // Tracks whether the channel has ever reached SUBSCRIBED, so a later drop is
  // classified as 'reconnecting' (transient) rather than 'error' (terminal).
  const hasBeenLiveRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    // Count events coalesced into the pending debounce so onBatch can report
    // how many changes a single refetch represents. `countsTowardBatch: false`
    // schedules the same refetch WITHOUT counting — used by the join resync
    // below, which is bookkeeping rather than a change the user made happen.
    let pendingCount = 0;
    const debouncedChange = (countsTowardBatch = true) => {
      if (countsTowardBatch) pendingCount += 1;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const count = pendingCount;
        pendingCount = 0;
        onChangeRef.current();
        onBatchRef.current?.(count);
      }, 1000);
    };

    const channel = supabase
      .channel('payment-results-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_results' },
        (payload: PaymentResultsChange) => {
          logger.debug('Realtime: payment_results change', {
            event: payload.eventType,
          });
          // Per-event callback (immediate) so the UI can react to WHAT changed
          // (e.g. a failed payment); the list refetch stays debounced.
          onEventRef.current?.(payload);
          debouncedChange();
        }
      )
      .subscribe((subStatus: string, err?: { message?: string }) => {
        if (subStatus === 'SUBSCRIBED') {
          // Resync on EVERY join, the first one included (#497). Joining is not
          // instant — under load it took tens of seconds — and anything written
          // between the initial fetch and the join is published to nobody. The
          // list has no other refresh path (no polling, no revalidate-on-focus),
          // so a missed row stayed missing for the life of the page while the
          // indicator read "Live".
          //
          // A re-join counts toward the coalesced batch, as it always has; a
          // first join does not, or every page load would flash "N updates".
          //
          // The decision reads hasBeenLiveRef rather than the previous status
          // because it must not live inside a setStatus updater: React
          // double-invokes updaters in StrictMode, which fired the recovery
          // refetch twice.
          const isRejoin = hasBeenLiveRef.current;
          hasBeenLiveRef.current = true;
          setStatus('live');
          debouncedChange(isRejoin);
        } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT') {
          // After a prior SUBSCRIBED, a drop is transient (Supabase auto-retries)
          // → 'reconnecting', not the terminal-looking 'error'. Before ever
          // connecting, it's a genuine connection failure → 'error'.
          setStatus(hasBeenLiveRef.current ? 'reconnecting' : 'error');
          logger.error('Realtime subscription failed', {
            error: err?.message,
          });
        }
      });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return status;
}
