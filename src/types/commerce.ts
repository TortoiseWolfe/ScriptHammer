/**
 * Commerce catalog types (Feature 050, Phase 1 — #557).
 *
 * These mirror the `products` and `orders` tables in
 * `supabase/migrations/20251006_complete_monolithic_setup.sql`. The database is
 * the authority: every constraint expressed here also exists as a CHECK there,
 * because TypeScript cannot stop a tampered client and Postgres can.
 *
 * In particular, `Product.amount` is the ONLY authority on price. `create-order`
 * (#558) resolves from it and DISCARDS any amount the browser submits — FR-002
 * says "discarded, not validated" deliberately, since a validator that rejects a
 * mismatched amount leaks the real price and turns a silent server-authoritative
 * design into an oracle.
 */

/** Which side of the storefront a SKU belongs to. */
export type Lane = 'service' | 'product';

/**
 * `fixed` — the catalog names the price.
 * `variable` — pay-what-you-want, bounded by min_amount/max_amount. Exactly one
 * SKU uses this (`tip-jar`), and it is a first-class catalog concept rather than
 * an exception, so it resolves through the same server-side path as a $3,500
 * build. That is what lets the client's INSERT on payment_intents be revoked
 * outright rather than merely narrowed.
 */
export type AmountMode = 'fixed' | 'variable';

export type BillingType = 'one_time' | 'recurring';
export type BillingInterval = 'month' | 'year';
export type Currency = 'usd' | 'eur' | 'gbp' | 'cad' | 'aud';

/**
 * Order lifecycle. Advanced by the webhook and the admin panel ONLY — a buyer can
 * read their own stage and can never write it (FR-011). `paid` is reached only on
 * a verified provider event, never because the buyer returned from a redirect.
 */
export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'fulfilling'
  | 'delivered'
  | 'refunded'
  | 'canceled';

/** A file the buyer attached at checkout, tagged with what it represents. */
export interface IntakeAttachment {
  /** Storage path. Always prefixed with the uploader's uid — verified server-side. */
  path: string;
  name: string;
  bytes: number;
  mime: string;
  /**
   * "is this what you have, or what you want?" — asked at upload time so the
   * operator never has to ask it afterwards.
   */
  kind: 'current' | 'target' | 'unspecified';
}

export interface Product {
  /** Stable SKU, e.g. 'svc-landing'. Matches the storefront card exactly. */
  id: string;
  lane: Lane;
  name: string;
  tagline: string | null;
  description: string | null;
  /** Cents. For `variable`, the SUGGESTED default rather than the charge. */
  amount: number;
  amount_mode: AmountMode;
  /** Required when amount_mode is 'variable' — enforced by a CHECK. */
  min_amount: number | null;
  max_amount: number | null;
  currency: Currency;
  type: BillingType;
  interval: BillingInterval | null;
  /**
   * An ACTIVE recurring SKU must carry one of these, or it is a subscription
   * with nowhere to bill. Enforced by products_recurring_provider_check, which
   * is why the three recurring SKUs ship inactive until real ids exist.
   */
  stripe_price_id: string | null;
  paypal_plan_id: string | null;
  features: string[];
  metadata: Record<string, unknown>;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * What the buyer told us about the job. `phone` is not optional politeness: the
 * catalog promises every build ships with click-to-call and a form wired to the
 * buyer's phone, and the product cannot deliver what it sells without asking for
 * the number (FR-013).
 */
export interface IntakeData {
  phone?: string;
  business?: string;
  domain?: string;
  reference_url?: string;
  notes?: string;
  attachments?: IntakeAttachment[];
  booking?: { scheduled: boolean; event_uri?: string };
}

export interface Order {
  id: string;
  /** One of intent_id / subscription_id is always set — enforced by a CHECK. */
  intent_id: string | null;
  subscription_id: string | null;
  product_id: string;
  /** Null for a guest purchase. No account is required to buy (FR-007). */
  buyer_user_id: string | null;
  buyer_email: string;
  quantity: number;
  /** Cents, resolved server-side from the catalog. Never from the request. */
  amount_charged: number;
  promo_code: string | null;
  discount_amount: number;
  status: OrderStatus;
  fulfillment_notes: string | null;
  intake_data: IntakeData;
  created_at: string;
  updated_at: string;
}
