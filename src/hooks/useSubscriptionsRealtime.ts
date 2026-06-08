import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createLogger } from '@/lib/logger/logger';
import type { RealtimeStatus } from './usePaymentResultsRealtime';

const logger = createLogger('hooks:useSubscriptionsRealtime');

/**
 * Subscribe to `subscriptions` changes and invoke `onChange` (debounced 1s)
 * whenever the user's subscription row changes (status flips, grace-period
 * updates). Mirrors {@link usePaymentResultsRealtime}; RLS scopes the events.
 */
export function useSubscriptionsRealtime(
  onChange: () => void,
  enabled = true
): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedChange = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => onChangeRef.current(), 1000);
    };

    const channel = supabase
      .channel('subscriptions-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions' },
        (payload: { eventType: string }) => {
          logger.debug('Realtime: subscriptions change', {
            event: payload.eventType,
          });
          debouncedChange();
        }
      )
      .subscribe((subStatus: string, err?: { message?: string }) => {
        if (subStatus === 'SUBSCRIBED') {
          setStatus('live');
        } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT') {
          setStatus('error');
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
