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
 * Pass `enabled: false` to skip the subscription entirely (e.g. in tests or
 * stories that must not open a live channel) — the hook then stays 'connecting'
 * and never touches the Supabase client.
 */
export function usePaymentResultsRealtime(
  onChange: () => void,
  enabled = true
): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Tracks whether the channel has ever reached SUBSCRIBED, so a later drop is
  // classified as 'reconnecting' (transient) rather than 'error' (terminal).
  const hasBeenLiveRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedChange = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => onChangeRef.current(), 1000);
    };

    const channel = supabase
      .channel('payment-results-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_results' },
        (payload: { eventType: string }) => {
          logger.debug('Realtime: payment_results change', {
            event: payload.eventType,
          });
          debouncedChange();
        }
      )
      .subscribe((subStatus: string, err?: { message?: string }) => {
        if (subStatus === 'SUBSCRIBED') {
          setStatus((prev) => {
            // Recovered after a drop → refetch so events missed while the
            // channel was down are not silently lost.
            if (prev === 'reconnecting') {
              debouncedChange();
            }
            return 'live';
          });
          hasBeenLiveRef.current = true;
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
