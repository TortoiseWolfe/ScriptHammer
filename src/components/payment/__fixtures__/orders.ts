import type { BuyerOrder } from '../OrderList/OrderList';

/**
 * Order rows as a BUYER reads them, shaped exactly like the PostgREST embed in
 * `OrderList` — `products` is the joined catalog row, and it is null whenever the SKU
 * is inactive, because the products SELECT policy is `USING (active = true)`.
 *
 * These exist because nothing in this repository has ever inserted an `orders` row for a
 * test or a seed. The three E2E route sweeps run as the authenticated primary user, who
 * owns no orders, so every automated gate that touches `/orders` measures its EMPTY state
 * and passes. Without fixtures the order card itself — the amount, the stage, the name,
 * the balance — would first render on a paying customer's screen.
 */

/** A deposit order: half of a $1,200 package, with the balance still to come. */
export const depositOrder: BuyerOrder = {
  id: '11111111-1111-4111-8111-111111111111',
  product_id: 'svc-landing',
  amount_charged: 60000,
  status: 'paid',
  created_at: '2026-09-08T14:04:00Z',
  products: { name: 'Landing Page', amount: 120000 },
};

/** Paid in full, nothing outstanding. */
export const paidInFullOrder: BuyerOrder = {
  id: '22222222-2222-4222-8222-222222222222',
  product_id: 'svc-discovery',
  amount_charged: 25000,
  status: 'delivered',
  created_at: '2026-08-30T09:12:00Z',
  products: { name: 'Discovery', amount: 25000 },
};

/**
 * An order for a SKU that is no longer `active`. The catalog embed comes back NULL through
 * RLS, so there is no name and no price to compare against — three seeded SKUs are in this
 * state today, and every one of them is a plan somebody could have subscribed to.
 */
export const retiredSkuOrder: BuyerOrder = {
  id: '33333333-3333-4333-8333-333333333333',
  product_id: 'svc-care',
  amount_charged: 9900,
  status: 'fulfilling',
  created_at: '2026-08-21T18:40:00Z',
  products: null,
};

/** Written by `create-order`, never confirmed by a webhook. All three prod rows look like this. */
export const unconfirmedOrder: BuyerOrder = {
  id: '44444444-4444-4444-8444-444444444444',
  product_id: 'svc-landing',
  amount_charged: 60000,
  status: 'pending',
  created_at: '2026-09-09T21:15:00Z',
  products: { name: 'Landing Page', amount: 120000 },
};

export const buyerOrders: BuyerOrder[] = [
  unconfirmedOrder,
  depositOrder,
  retiredSkuOrder,
  paidInFullOrder,
];
