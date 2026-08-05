/**
 * usePaymentRealtime Hook
 * Subscribe to real-time payment result updates via Supabase
 */

'use client';

import { useEffect, useState } from 'react';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase/client';
import type { PaymentResult } from '@/types/payment';

const logger = createLogger('hooks:paymentRealtime');

export interface UsePaymentRealtimeReturn {
  paymentResult: PaymentResult | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for subscribing to real-time payment updates
 *
 * @param paymentResultId - ID of the payment result to watch
 *
 * @example
 * ```tsx
 * function PaymentStatus({ paymentId }) {
 *   const { paymentResult, loading } = usePaymentRealtime(paymentId);
 *
 *   if (loading) return <Spinner />;
 *   if (!paymentResult) return <p>No payment found</p>;
 *
 *   return <div>Status: {paymentResult.status}</div>;
 * }
 * ```
 */
export function usePaymentRealtime(
  paymentResultId: string | null
): UsePaymentRealtimeReturn {
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!paymentResultId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Fetch initial data
    const fetchInitialData = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('payment_results')
          .select('*')
          .eq('id', paymentResultId)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (isMounted) {
          setPaymentResult(data as PaymentResult | null);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err : new Error('Failed to fetch payment')
          );
          setLoading(false);
        }
      }
    };

    fetchInitialData();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`payment-result-${paymentResultId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_results',
          filter: `id=eq.${paymentResultId}`,
        },
        (payload) => {
          if (isMounted) {
            logger.debug('Payment result updated', {
              paymentResult: payload.new,
            });
            setPaymentResult(payload.new as PaymentResult);
          }
        }
      )
      .subscribe((status) => {
        // RE-READ ON JOIN (#499, the pattern proven in #497).
        //
        // Joining the channel is not instant — under 28-shard load #497
        // measured a row inserted ~2s after page load still missing 15s later,
        // three attempts running. Anything written between `fetchInitialData`
        // above and this callback is published to nobody.
        //
        // That is a stale render for most consumers. Here it is worse: this
        // hook backs /payment-result, and it has NO poll and NO focus refetch
        // behind it, so a webhook UPDATE landing in the join window leaves the
        // user on a stale status until they reload. Money path, unrecoverable.
        //
        // Every join re-reads, first or rejoin — unlike the list hooks there is
        // no coalesced-burst indicator here for a first-join resync to inflate,
        // so the two cases need no distinguishing.
        if (status === 'SUBSCRIBED') {
          void fetchInitialData();
        }
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [paymentResultId]);

  return { paymentResult, loading, error };
}
