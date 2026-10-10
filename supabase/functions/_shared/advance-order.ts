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

/**
 * How many retries a walk will follow: create-order's RETRY_LIMIT (3) plus one, which also bounds a
 * cycle no legitimate chain can contain.
 */
export const MAX_RETRY_HOPS = 4;

/** The fields a retry copies from the purchase it retries, plus the link itself. */
interface IntentLink {
  id: string;
  parent_intent_id: string | null;
  amount: number;
  currency: string;
  template_user_id: string;
}

/**
 * Whether `parent` is the purchase `child` retried: the same price, currency and buyer. Pure.
 *
 * `buildRetryIntentRow` copies all three from the parent, and only the service role can write
 * `payment_intents`. The check is the second line of defence for the walk below: without it, any
 * way of pointing a cheap intent at an expensive one would let a $1 payment mark that order paid.
 */
export function isFaithfulRetry(
  child: IntentLink,
  parent: IntentLink
): boolean {
  return (
    child.amount === parent.amount &&
    child.currency === parent.currency &&
    child.template_user_id === parent.template_user_id
  );
}

async function orderForIntent(supabase: any, intentId: string) {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, buyer_email, product_id, status')
    .eq('intent_id', intentId)
    .maybeSingle();
  // A READ ERROR IS NOT "NO ORDER" (#1307). Treating it as one marked the webhook event
  // processed while a paid order was never advanced or receipted. Throw, and the webhook claim
  // retries the event; that is safe because every write below is a compare-and-swap.
  if (orderError) throw orderError;
  return order;
}

async function intentLink(
  supabase: any,
  id: string
): Promise<IntentLink | null> {
  const { data, error: intentError } = await supabase
    .from('payment_intents')
    .select('id, parent_intent_id, amount, currency, template_user_id')
    .eq('id', id)
    .maybeSingle();
  if (intentError) throw intentError;
  return data;
}

/**
 * The order an intent paid for, following retries back to the purchase (#1308).
 *
 * create-order's retry branch inserts a CHILD intent and deliberately no order row, so the order
 * belongs to the root of the chain. Looking only at the paid intent's own id found nothing for a
 * retry: the buyer was charged, the order stayed `pending`, and no receipt went out.
 * `src/lib/payments/retry-chain.ts` is the same walk on the buyer's return page.
 */
async function findOrderThroughRetries(supabase: any, intentId: string) {
  const own = await orderForIntent(supabase, intentId);
  if (own) return own;

  let child = await intentLink(supabase, intentId);
  for (let hop = 0; hop < MAX_RETRY_HOPS && child?.parent_intent_id; hop++) {
    const parent = await intentLink(supabase, child.parent_intent_id);
    if (!parent || !isFaithfulRetry(child, parent)) return null;
    const order = await orderForIntent(supabase, parent.id);
    if (order) return order;
    child = parent;
  }
  return null;
}

export async function advanceOrderAndNotify(
  supabase: any,
  input: AdvanceOrderInput
): Promise<AdvanceOrderResult> {
  const { intentId, amount, currency, provider } = input;

  const order = await findOrderThroughRetries(supabase, intentId);

  // NO ORDER IS STILL NOT AN ERROR. A retried intent has no order row of its own (#1126), but the
  // walk above now finds its purchase's order (#1308). What reaches here is an intent nothing
  // ordered: a payment made outside the checkout, or a chain whose links do not match. It must
  // NOT throw: an error here fails the webhook, and the provider then retries the event against
  // a row that will never exist.
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

  // A FAILED STATUS WRITE THROWS (#1307). This used to log and continue, on the reasoning that
  // failing the webhook would trade a bookkeeping gap for a retry storm. The gap was the worse
  // trade: a paid order never advanced and the buyer never got a receipt. The webhook claim now
  // bounds retries (MAX_ATTEMPTS, then permanently_failed and the liveness alarm), and the
  // compare-and-swap makes a retry harmless.
  if (updateError) {
    console.error(`advance-order: failed to advance ${order.id}:`, updateError);
    throw updateError;
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
