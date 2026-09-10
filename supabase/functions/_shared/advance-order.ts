/**
 * Advance a paid order and tell the buyer — the transition nothing performed (#1151, #1150).
 *
 * WHAT WAS MISSING. `orders.status` was written once at insert and never again, while the
 * schema's own `COMMENT ON TABLE` claimed it was "advanced by the webhook and the admin panel
 * only". Neither existed: no webhook referenced `orders`, and `AdminOrdersPanel` has no mutation
 * of any kind. Separately, `send-payment-email` was deployed, contract-tested, and invoked by
 * nothing — so a completed purchase produced no confirmation from ScriptHammer.
 *
 * WHY HERE AND NOT THE RETURN LEG. The obvious home is `usePaymentReturn`, which already
 * resolves session → intent → payment_result → order. It runs in the BUYER'S BROWSER: a
 * customer who pays and closes the tab would never advance their own order, and the send would
 * depend on the very navigation #1126 showed had been broken for months. `send-payment-email`
 * also compares the caller against the service-role key, which a browser must never hold.
 *
 * So this is called from the webhook handlers, at the point where payment is already proven.
 */

/*
 * A TYPE-ONLY declaration, because this file is imported from two type worlds.
 *
 * It runs under Deno (the Edge Functions), but `tests/unit/advance-order.test.ts` imports it so
 * the logic is covered by the required `Test (20.x)` check — `supabase/functions/**` is excluded
 * from vitest and nothing runs `deno test`, so without that import none of this would ever
 * execute in CI. That import pulls the file into the app's tsconfig, which has no Deno types.
 *
 * `declare` is erased at compile time, so Deno still supplies the real global at runtime.
 */
declare const Deno: { env: { get(key: string): string | undefined } };

/** What the caller needs to render a receipt. `intentId` is the join key `orders.intent_id`. */
export interface AdvanceOrderInput {
  intentId: string;
  amount: number | null;
  currency: string | null;
  provider: 'stripe' | 'paypal';
}

export interface AdvanceOrderResult {
  advanced: boolean;
  /** Why nothing happened, for the log. Never an error — see the callers. */
  reason?: 'no-order' | 'already-advanced' | 'no-recipient';
  orderId?: string;
  emailed?: boolean;
}

/**
 * The paid state. Deliberately the ONLY transition this performs.
 *
 * `orders.status` has no CHECK constraint, so "advance" was undefined. Rather than invent
 * `fulfilled`/`refunded`/`cancelled` before anything needs them, this introduces exactly one
 * step — `pending` → `paid` — which is the one the money path actually knows about.
 */
const PAID = 'paid';
const PENDING = 'pending';

export async function advanceOrderAndNotify(
  supabase: any,
  input: AdvanceOrderInput
): Promise<AdvanceOrderResult> {
  const { intentId, amount, currency, provider } = input;

  const { data: order } = await supabase
    .from('orders')
    .select('id, buyer_email, product_id, status')
    .eq('intent_id', intentId)
    .maybeSingle();

  // A RETRIED INTENT LEGITIMATELY HAS NO ORDER ROW. `create-order`'s `op: 'retry'` path
  // deliberately skips the insert (#1126), so this is reachable with nothing wrong. It must NOT
  // throw: an error here fails the webhook, and Stripe then retries the event forever against a
  // row that will never exist.
  if (!order) {
    console.log(
      `advance-order: no order for intent ${intentId} — nothing to advance`
    );
    return { advanced: false, reason: 'no-order' };
  }

  /*
   * COMPARE-AND-SWAP, not a plain update.
   *
   * `.eq('status', PENDING)` makes the transition itself the idempotency guard. The webhook
   * already skips duplicate deliveries via `webhook_events (provider, provider_event_id)`, but
   * that only covers the same event arriving twice — it does not cover two DIFFERENT events for
   * one order (a `payment_intent.succeeded` and a `checkout.session.completed` both firing),
   * which is exactly the case that would email a buyer twice.
   *
   * Whoever flips the row wins; everyone else sees zero rows changed and stays quiet.
   */
  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update({ status: PAID })
    .eq('id', order.id)
    .eq('status', PENDING)
    .select('id');

  if (updateError) {
    // Log and continue. The payment IS recorded in payment_results either way, and failing the
    // webhook over a status write would trade a bookkeeping gap for a retry storm.
    console.error(`advance-order: failed to advance ${order.id}:`, updateError);
    return { advanced: false, orderId: order.id };
  }

  if (!updated || updated.length === 0) {
    console.log(
      `advance-order: ${order.id} was already advanced — not emailing again`
    );
    return { advanced: false, reason: 'already-advanced', orderId: order.id };
  }

  console.log(`advance-order: ${order.id} ${PENDING} -> ${PAID} (${provider})`);

  if (!order.buyer_email) {
    return { advanced: true, reason: 'no-recipient', orderId: order.id };
  }

  const emailed = await sendReceipt(supabase, {
    recipient: order.buyer_email,
    orderId: order.id,
    productId: order.product_id,
    amount,
    currency,
  });
  return { advanced: true, orderId: order.id, emailed };
}

/**
 * Fire-and-forget by design.
 *
 * THE TRAP THIS AVOIDS. If a Resend outage propagated out of the handler, Stripe would retry the
 * whole event — and retries are how one purchase becomes many emails. The order is already
 * `paid` by this point, which is the durable fact; the email is a courtesy on top of it. So
 * every failure here is logged and swallowed.
 */
async function sendReceipt(
  supabase: any,
  args: {
    recipient: string;
    orderId: string;
    productId: string | null;
    amount: number | null;
    currency: string | null;
  }
): Promise<boolean> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      console.error(
        'advance-order: cannot send receipt — SUPABASE_URL or key unset'
      );
      return false;
    }

    // Best-effort product name. The template falls back to `product_id`, so a failed lookup
    // costs a nicer line rather than the email.
    let productName: string | null = null;
    if (args.productId) {
      const { data: product } = await supabase
        .from('products')
        .select('name')
        .eq('id', args.productId)
        .maybeSingle();
      productName = product?.name ?? null;
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/send-payment-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        type: 'payment_success',
        recipient: args.recipient,
        data: {
          order_id: args.orderId,
          product_id: args.productId,
          product_name: productName,
          amount_charged: args.amount,
          currency: args.currency,
        },
      }),
    });

    if (!res.ok) {
      console.error(
        `advance-order: receipt for ${args.orderId} returned ${res.status} — order stays paid`
      );
      return false;
    }
    console.log(`advance-order: receipt sent for ${args.orderId}`);
    return true;
  } catch (err) {
    console.error(
      `advance-order: receipt for ${args.orderId} threw — order stays paid:`,
      err
    );
    return false;
  }
}
