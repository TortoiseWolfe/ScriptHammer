'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { OrderStatus } from '@/types/commerce';

/**
 * The orders a buyer has placed, on a page they can reach (#561 T029).
 *
 * WHY IT EXISTED AS A GAP. `create-order` has written rows since #558, the webhook has
 * advanced them to `paid` since #1151, and `send-payment-email` has sent a receipt since
 * #1150 — and the only surface in the product that could display any of it was
 * `/admin/orders`, which a buyer cannot open. `src/types/commerce.ts:36` has said since
 * Phase 1 that a buyer "can read their own stage and can never write it (FR-011)"; the
 * reading half had nowhere to happen.
 *
 * IT FILTERS BY buyer_user_id EXPLICITLY, AND THAT IS NOT BELT-AND-BRACES. Two SELECT
 * policies sit on `orders` and Postgres ORs them: `Buyers can view own orders`
 * (`auth.uid() = buyer_user_id`, migration:1134) and `Admin can view all orders`
 * (`is_admin()`, migration:1505). Leaning on RLS alone — which is what the admin panel
 * correctly does — would mean an ADMIN opening this page saw every customer's orders on a
 * page captioned "Your orders". The filter makes the page mean the same thing for everyone.
 *
 * MONEY IS LABELLED "Charged", NEVER "Total". `orders.amount_charged` is the amount that
 * actually left the card, which for the two deposit SKUs is HALF the package price
 * (`deposit_pct: 50`, migration:454-463), and no column persists the balance. Rendering
 * "$600.00 · Landing Page" beside a $1,200 package would be a number that is true and a
 * sentence that is false. Where the catalog row is readable and the price is higher, the
 * remainder is named as invoiced separately; where it is not, nothing is invented.
 *
 * THE PRODUCT NAME CAN LEGITIMATELY BE NULL. The embed reads `products` through RLS, whose
 * SELECT policy is `USING (active = true)` (migration:1122) — so an order for a retired or
 * not-yet-launched SKU returns no catalog row at all. That is three of the seeded SKUs
 * today. The fallback is the raw `product_id`, which is what the admin panel shows every
 * order as, rather than a blank space where a name should be.
 */

/** One row as this component reads it. `products` is null whenever the SKU is inactive. */
export interface BuyerOrder {
  id: string;
  product_id: string;
  amount_charged: number | null;
  status: string;
  created_at: string;
  products: { name: string; amount: number } | null;
}

export interface OrderListProps {
  /** How many of the most recent orders to show. */
  limit?: number;
  /** Pre-loaded rows. Supplied by tests and Storybook; production fetches its own. */
  orders?: BuyerOrder[];
  className?: string;
}

/**
 * What each stage means to the person who paid, rather than to the database.
 *
 * Typed `Record<OrderStatus, …>`, so adding a value to the union in `types/commerce.ts`
 * without giving a buyer a word for it is a TYPE ERROR rather than a blank badge. The
 * union and the DB CHECK are kept in step by migration:408-409.
 *
 * DELIBERATELY NOT COLOUR-CODED. `badge-success`/`badge-warning` are used throughout this
 * repo, but every consumer is an admin organism behind `AdminGate` — a surface the AAA
 * contrast sweep never reaches. `/orders` IS on that sweep, and the sweep runs as a user
 * who owns no orders, so it would render the empty state and measure no badge at all.
 * Shipping colour that no gate has ever checked against the 7:1 floor is the "green in CI,
 * wrong in production" trade this repo keeps paying for. The stage is carried by the
 * words, which also satisfies WCAG 1.4.1 without needing a second cue. Add colour when
 * something seeds an order and the sweep can actually see it.
 */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Payment not confirmed yet',
  paid: 'Paid',
  fulfilling: 'In progress',
  delivered: 'Delivered',
  refunded: 'Refunded',
  canceled: 'Canceled',
};

/** `$1,200.00` from 120000. Em dash when there is genuinely no number, never `$0.00`. */
export function money(cents: number | null): string {
  if (cents === null) return '—';
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

/**
 * What is still owed on an order, or null when nothing is or nothing is knowable.
 *
 * Returns null rather than 0 for the unknowable case on purpose: a page that cannot read
 * the catalog row must say nothing about the balance, not imply there is none.
 */
export function balanceOf(order: BuyerOrder): number | null {
  if (order.products === null || order.amount_charged === null) return null;
  const rest = order.products.amount - order.amount_charged;
  return rest > 0 ? rest : null;
}

export default function OrderList({
  limit = 25,
  orders: provided,
  className = '',
}: OrderListProps) {
  const [orders, setOrders] = useState<BuyerOrder[]>(provided ?? []);
  const [loading, setLoading] = useState(provided === undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (provided !== undefined) return;
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        // ProtectedRoute owns the redirect. Reaching here without a user means the
        // session went away mid-render, and an empty list would read as "you never
        // bought anything" — which is the one thing it must never say by accident.
        setError('Your session ended. Sign in again to see your orders.');
        setLoading(false);
        return;
      }

      const { data, error: err } = await supabase
        .from('orders')
        .select(
          'id, product_id, amount_charged, status, created_at, products(name, amount)'
        )
        .eq('buyer_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (cancelled) return;
      if (err) {
        // A failed query and a buyer with no orders both arrive as an empty array if
        // you only check `data.length`. Say which one happened.
        setError(err.message);
      } else {
        setOrders((data ?? []) as unknown as BuyerOrder[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [limit, provided]);

  if (loading) {
    return (
      <p role="status" className="text-base-content p-4">
        Loading your orders…
      </p>
    );
  }

  return (
    <div className={`min-w-0 ${className}`}>
      {error && (
        <p role="alert" className="text-error mb-4 text-sm">
          {error}
        </p>
      )}

      {orders.length === 0 && !error && (
        <p className="text-base-content p-4">
          You have not placed an order yet.
        </p>
      )}

      <ul className="flex list-none flex-col gap-4 p-0">
        {orders.map((o) => {
          // Falls back to the raw value rather than nothing: an unknown status means the
          // database grew a stage this build has no word for, and a blank badge would
          // hide that from the one person entitled to know where their order is.
          const stage = STATUS_LABEL[o.status as OrderStatus] ?? o.status;
          const balance = balanceOf(o);
          return (
            <li
              key={o.id}
              className="sh-plate min-w-0 rounded-[18px] p-4 sm:p-6"
              data-testid="buyer-order"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                {o.products ? (
                  <span className="text-base-content text-lg font-semibold">
                    {o.products.name}
                  </span>
                ) : (
                  <span className="text-base-content font-mono text-sm">
                    {o.product_id}
                  </span>
                )}
                <span className="badge badge-outline text-base-content">
                  {stage}
                </span>
              </div>

              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-base-content">Charged</dt>
                  <dd className="text-base-content font-semibold">
                    {money(o.amount_charged)}
                  </dd>
                </div>
                {balance !== null && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-base-content">
                      Balance{' '}
                      <span className="text-base-content">
                        (invoiced separately)
                      </span>
                    </dt>
                    <dd className="text-base-content">{money(balance)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-base-content">Placed</dt>
                  <dd className="text-base-content">
                    {new Date(o.created_at).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
