import React from 'react';
import type { Product } from '@/types/commerce';

export interface CheckoutSummaryProps {
  /** The catalog row being purchased. Null while it is still loading. */
  product: Product | null;
  /**
   * Cents that will actually be charged now. Comes from `create-order`, never
   * from this component — the page shows a preview computed the same way, but
   * the server's number is the one that gets billed.
   */
  amountDueNow: number | null;
  className?: string;
}

/** `$1,200.00` from 120000. */
export function formatCents(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/**
 * Read the deposit percentage the catalog declares for this SKU.
 *
 * Mirrors `resolveChargeAmount` in the create-order Edge Function. It is a
 * PREVIEW: the server recomputes it and its answer wins. Showing a different
 * number here than the buyer is charged would be worse than showing none, so the
 * rules are kept deliberately identical — same guards, same rounding direction.
 */
export function depositPercent(product: Product): number | null {
  const raw = product.metadata?.['deposit_pct'];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  if (!Number.isInteger(raw) || raw <= 0 || raw >= 100) return null;
  return raw;
}

/** Round DOWN, exactly as the server does — never charge more than the price. */
export function previewAmountDue(product: Product): number {
  const pct = depositPercent(product);
  if (pct === null) return product.amount;
  const deposit = Math.floor((product.amount * pct) / 100);
  return deposit < 100 ? product.amount : deposit;
}

/**
 * What you are buying, and what leaves your card today.
 *
 * @category payment
 */
export default function CheckoutSummary({
  product,
  amountDueNow,
  className = '',
}: CheckoutSummaryProps) {
  if (!product) {
    return (
      <div className={`checkout-summary ${className}`}>
        <div className="skeleton h-32 w-full" aria-hidden="true" />
        <span className="sr-only">Loading your selection…</span>
      </div>
    );
  }

  const due = amountDueNow ?? previewAmountDue(product);
  const isDeposit = due < product.amount;
  const balance = product.amount - due;

  return (
    <div
      className={`checkout-summary card bg-base-200 min-w-0 ${className}`}
      aria-labelledby="summary-heading"
    >
      <div className="card-body">
        <h2
          id="summary-heading"
          className="text-base-content text-lg font-semibold"
        >
          Order summary
        </h2>

        <p className="text-base-content mt-1 font-medium">{product.name}</p>
        {product.tagline && (
          <p className="text-base-content text-sm">{product.tagline}</p>
        )}

        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-base-content">Package price</dt>
            <dd className="text-base-content">
              {formatCents(product.amount, product.currency)}
            </dd>
          </div>

          {isDeposit && (
            <div className="flex justify-between gap-4">
              <dt className="text-base-content">
                Balance on delivery{' '}
                <span className="text-base-content">(invoiced separately)</span>
              </dt>
              <dd className="text-base-content">
                {formatCents(balance, product.currency)}
              </dd>
            </div>
          )}

          <div className="border-base-300 flex justify-between gap-4 border-t pt-2 font-semibold">
            <dt className="text-base-content">
              {isDeposit ? 'Deposit due today' : 'Total today'}
            </dt>
            <dd className="text-base-content">
              {formatCents(due, product.currency)}
            </dd>
          </div>
        </dl>

        {isDeposit && (
          <p className="text-base-content mt-3 text-xs">
            {depositPercent(product)}% now, the rest when the work is delivered.
          </p>
        )}
      </div>
    </div>
  );
}
