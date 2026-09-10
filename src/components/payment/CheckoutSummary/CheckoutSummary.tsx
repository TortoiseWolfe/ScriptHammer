import React from 'react';
import Link from 'next/link';
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
 * What the buyer is told about cancellation BEFORE they pay (T034, #561).
 *
 * WHY THIS LIVES HERE. `/checkout` has promised "Terms are shown before payment" since
 * before #613, on a path that showed none. This component, `IntakeForm` and `BookingStep`
 * between them contained zero occurrences of terms, cancel or refund, and the app's only
 * link to `/terms` sat inside `PaymentConsentModal` — a GDPR script-consent gate that
 * renders only until consent is granted, and never on the signed-out branch at all. So the
 * sentence was true of nothing a buyer could see, on the one page where being wrong costs
 * money. This component is the right home because it is the only thing rendered on BOTH
 * branches of checkout, above the fold, beside the amount.
 *
 * The lines are derived from `/terms` §3–§5 rather than invented, so the card and the
 * linked page cannot drift into saying different things.
 *
 * THE RECURRING BRANCH IS DELIBERATELY NARROW. The plan stops; the site is not torn down.
 * What it does NOT promise is uptime, because that depends on things the seller does not
 * control — the domain registration, the account the site is hosted under, and whether the
 * buyer holds their own copy. Promising "your site stays up" would replace one false
 * assurance with another, which is the failure T034 exists to correct.
 */
export function cancellationTerms(product: Product): string[] {
  if (product.type === 'recurring') {
    const every = product.interval === 'year' ? 'year' : 'month';
    return [
      `Renews automatically every ${every} until you cancel.`,
      'Cancel any time. It takes effect at the end of the period you have already paid for, and you are not charged again.',
      'Cancelling stops maintenance and updates — it does not take your site down. Keeping it online is then yours to manage: the domain, the account it is hosted under, and your own copy of the site.',
    ];
  }

  const lines = ['Cancel before work begins for a full refund.'];
  lines.push(
    depositPercent(product) === null
      ? 'Once work has begun we refund the portion not yet performed.'
      : 'Once work has begun we refund the portion not yet performed. A deposit covering work already carried out is not refundable.'
  );
  return lines;
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

        {/*
          The terms the page has always claimed were "shown before payment" (#561 T034).
          `aria-labelledby` rather than a bare heading so the list is reachable as a named
          region: this is the one part of the summary a buyer may be looking FOR.
        */}
        <section
          className="border-base-300 mt-4 border-t pt-3"
          aria-labelledby="checkout-terms-heading"
        >
          <h3
            id="checkout-terms-heading"
            className="text-base-content text-sm font-semibold"
          >
            Before you pay
          </h3>
          <ul className="text-base-content mt-2 space-y-1 text-xs">
            {cancellationTerms(product).map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li>The price shown here is the price charged.</li>
          </ul>
          {/*
            Bare href. `next/link` prepends the runtime basePath, so this resolves to
            `/ScriptHammer/terms/` on a base-path deployment and `/terms/` without one.

            An earlier version of this comment claimed `getInternalUrl('/terms')` would
            double-prefix here. It does not: `next/link` skips an href that already carries
            the basePath, and a real build proves it — zero occurrences of
            `/ScriptHammer/ScriptHammer/` in `out/`, with GlobalNav using the helper inside a
            Link at three sites. Both forms work; bare is preferred only because it does not
            depend on that normalisation, and because a unit test can assert it directly,
            which is what PaymentConsentModal.test.tsx:247-256 pins for /privacy (#159).
          */}
          <Link
            href="/terms"
            className="link-hover link mt-2 inline-block text-xs"
          >
            Full terms, including refunds and renewals
          </Link>
        </section>
      </div>
    </div>
  );
}
