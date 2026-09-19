'use client';

import Link from 'next/link';
import { trackEvent } from '@/utils/analytics';

/**
 * A pricing CTA that reports the click to GA4 (#115 measurement arc).
 *
 * WHY IT EXISTS AS A SEPARATE FILE. `pricing/page.tsx` is a SERVER component — it exports
 * `Metadata` and has no `'use client'` — so it cannot carry an onClick. Making the whole
 * page or the whole `Card` a client component to add one handler would ship every product
 * literal, every CSS-module import and the whole card tree to the browser for the sake of
 * four lines. This is the smallest client boundary that does the job, and it sits beside
 * the route rather than in `src/components` because it is route-specific — the same shape
 * as `AdminGate`, `SearchParamsReader` and `BlogPostPageClient`.
 *
 * (It also means the 5-file component rule does not apply, which is correct rather than
 * convenient: that rule governs the shared library under `src/components`, and a one-route
 * link wrapper is not a library component.)
 *
 * WHY NO CONSENT CHECK. `trackEvent` no-ops unless `window.gtag` exists, and the gtag
 * script is only mounted when analytics consent is granted (`GoogleAnalytics.tsx:63`
 * returns null without it). SDK presence IS the gate — the same reasoning `BookingCta`
 * already applies to its ad-conversion call. A second check here would be a copy to keep
 * in sync, and pulling in `useAnalytics()` would require a `ConsentProvider` in every test
 * that renders a price card.
 *
 * WHAT IT ANSWERS. GA could say somebody reached `/pricing` and nothing about whether any
 * price moved them. `sku` is the label, so the report reads as a ranked list of which
 * product people click, and `value` carries the price in whole currency units so GA can
 * weight a $2,500 click against a $39 one.
 */
/**
 * Display price -> whole dollars for GA's numeric `value`, or undefined.
 *
 * The catalog on this page carries price as a STRING because it is display copy — "$2,500",
 * "$39", "Free", "Let's talk". GA's `value` is numeric and is what lets a report weight a
 * $2,500 click against a $39 one, so it has to be derived rather than invented.
 *
 * Returns undefined rather than 0 for the non-numeric ones. Zero is a real price in GA and
 * would silently drag the average of every conversion report toward nothing; absent is the
 * honest answer for "Free" and "Let's talk".
 */
export function priceToUsd(price: string): number | undefined {
  const digits = price.replace(/[^0-9.]/g, '');
  if (!digits) return undefined;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function BuyLink({
  sku,
  href,
  className,
  priceUsd,
  external = false,
  children,
}: {
  sku: string;
  href: string;
  className?: string;
  /** Whole dollars, for GA's numeric `value`. Omit for "let's talk" CTAs with no price. */
  priceUsd?: number;
  external?: boolean;
  children: React.ReactNode;
}) {
  const onClick = () =>
    trackEvent('pricing_cta_click', 'Conversion', sku, priceUsd, {
      outbound: external,
    });

  // An external CTA is a real navigation away; a plain <a> is correct and `Link` would
  // prefetch a route that does not exist.
  if (external) {
    return (
      <a
        className={className}
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={href} onClick={onClick}>
      {children}
    </Link>
  );
}
