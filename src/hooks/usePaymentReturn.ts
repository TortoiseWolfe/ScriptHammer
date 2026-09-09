'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getPaymentStatus } from '@/lib/payments/payment-service';
import { handleStripeRedirect } from '@/lib/payments/stripe';
import { UUID_RE } from '@/lib/payments/payment-return';
import type { Product } from '@/types/commerce';

/**
 * Resolve a hosted-Stripe return into the order and product behind it (#1126).
 *
 * WHY THIS EXISTS. Two pages need the same four steps, and only one of them had them.
 * `/checkout` implemented `session → intent → payment_result → order → product` inline and
 * mounted `BookingStep` on the result. `/payment-result` — the page Stripe's `success_url`
 * actually points at — resolved only `payment_results.id`, so it had none of the order, none of
 * the product, and no booking link. A buyer paid and was offered "Back to Payment Demo".
 *
 * Duplicating the pipeline into the second page would have entrenched exactly the split that
 * caused #1092 (the SKU going missing on one path but not the other). One hook, two consumers.
 *
 * THREE OF THE FOUR STEPS WERE ALREADY SHARED SEAMS — `handleStripeRedirect`,
 * `getPaymentStatus`, and `UUID_RE`. Only `intent → order → product` lived in one place, which
 * is why the two pages could drift without anything noticing.
 */
export type PaymentReturnState =
  /** No `session_id` in the URL — this is not a Stripe return. */
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'paid';
      intentId: string;
      orderId: string;
      buyerEmail: string | null;
      /**
       * Null when the order carries no `product_id`, or the lookup failed. NOT an error —
       * see the degradation note below.
       */
      product: Product | null;
    };

export function usePaymentReturn(sessionId: string | null): PaymentReturnState {
  const [state, setState] = useState<PaymentReturnState>(
    sessionId ? { kind: 'loading' } : { kind: 'idle' }
  );

  useEffect(() => {
    if (!sessionId) {
      setState({ kind: 'idle' });
      return;
    }
    setState({ kind: 'loading' });

    let cancelled = false;

    (async () => {
      const { intentId, error } = await handleStripeRedirect(sessionId);
      if (cancelled) return;
      if (!intentId || !UUID_RE.test(intentId)) {
        setState({
          kind: 'error',
          message: error ?? 'Could not verify that session',
        });
        return;
      }

      // Ask OUR records, not the redirect. A redirect parameter is attacker-supplied;
      // `payment_results` is written by the webhook.
      const result = await getPaymentStatus(intentId);
      if (cancelled) return;

      const { data: order } = await supabase
        .from('orders')
        .select('id, buyer_email, product_id')
        .eq('intent_id', intentId)
        .maybeSingle();
      if (cancelled) return;

      if (!result || !order) {
        // A RETRIED INTENT LEGITIMATELY HAS NO ORDER ROW. `create-order`'s `op: 'retry'` path
        // deliberately skips the insert, so this is reachable without anything being wrong.
        setState({
          kind: 'error',
          message:
            'Your payment is still being confirmed. Refresh in a moment — nothing is lost.',
        });
        return;
      }

      // THE SKU MUST COME FROM THE ORDER, NOT THE URL (#1092). Hosted Stripe Checkout returns
      // with no `sku`, so a page that reads the URL gets `undefined`, `resolveCalendarUrl`
      // falls through to the general call, and someone who paid for the long session books the
      // free intro one.
      //
      // `active` is deliberately NOT filtered, unlike a storefront query: this is a receipt.
      // Someone who bought a package the day before it was retired still needs the booking
      // link they paid for.
      //
      // A failed product lookup degrades to `null` rather than erroring. Losing the per-SKU
      // booking link is bad; showing no confirmation at all to someone whose card was charged
      // is worse.
      let product: Product | null = null;
      if (order.product_id) {
        const { data: row } = await supabase
          .from('products')
          .select('*')
          .eq('id', order.product_id)
          .maybeSingle();
        if (cancelled) return;
        product = (row as Product | null) ?? null;
      }

      setState({
        kind: 'paid',
        intentId,
        orderId: order.id,
        buyerEmail: order.buyer_email ?? null,
        product,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return state;
}
