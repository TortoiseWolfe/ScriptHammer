'use client';

import React from 'react';
import { calendarConfig, resolveCalendarUrl } from '@/config/calendar.config';

export interface BookingStepProps {
  /** Shown on the receipt so the buyer has something to quote. */
  orderId: string;
  buyerName?: string;
  buyerEmail?: string;
  /** What they bought, for the confirmation line. */
  productName?: string;
  /**
   * The SKU (`Product.id`), so a product with its own scheduler books it (#1092).
   * Omitted or unmapped falls back to the general call.
   */
  sku?: string;
  className?: string;
}

/**
 * Build the prefilled scheduler URL.
 *
 * A PLAIN LINK, NOT AN EMBED, and that is deliberate. `CalendarEmbed` runs a
 * cookie-consent gate (`CookieCategory.FUNCTIONAL`) BEFORE it reads `mode`, so
 * embedding here would put a second consent card in front of someone who has
 * just paid — and FR-020 says no second consent prompt on confirmation. An
 * outbound link loads no third-party script at all.
 *
 * `utm_content` carries the order id so a booking can be matched back to the
 * purchase when the Calendly webhook lands (#562). Note react-calendly and
 * Calendly's own URL params use different names — the widget wants `utmContent`,
 * a plain URL wants `utm_content`. This builds a URL, so it uses the URL form.
 */
export function buildBookingUrl(params: {
  orderId: string;
  name?: string;
  email?: string;
  /** `Product.id`. Resolves a per-SKU scheduler when one is configured (#1092). */
  sku?: string;
  baseUrl?: string;
}): string | null {
  // An explicit baseUrl still wins — it is how the tests pin a URL without touching
  // process.env. Otherwise the SKU decides, and an unmapped SKU gets the default.
  const base = params.baseUrl ?? resolveCalendarUrl(params.sku);
  if (!base) return null;

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }

  if (params.name) url.searchParams.set('name', params.name);
  if (params.email) url.searchParams.set('email', params.email);
  // CalendarConfig.utm is optional and so is every field in it, so default
  // rather than assert. Note these are the SNAKE_CASE names a plain Calendly URL
  // takes; react-calendly's embed wants utmSource/utmMedium/utmCampaign. The two
  // are not interchangeable, and mixing them drops attribution silently — which
  // is worth knowing, because calendar.config.ts stores {source, medium,
  // campaign} and hands them to the widget, where they are very likely being
  // ignored today.
  url.searchParams.set(
    'utm_source',
    calendarConfig.utm?.source ?? 'scripthammer'
  );
  url.searchParams.set('utm_medium', 'checkout');
  url.searchParams.set(
    'utm_campaign',
    calendarConfig.utm?.campaign ?? 'website'
  );
  url.searchParams.set('utm_content', `order_${params.orderId}`);
  return url.toString();
}

/**
 * Paid — now book the kickoff.
 *
 * @category payment
 */
export default function BookingStep({
  orderId,
  buyerName,
  buyerEmail,
  productName,
  sku,
  className = '',
}: BookingStepProps) {
  const href = buildBookingUrl({
    orderId,
    name: buyerName,
    email: buyerEmail,
    sku,
  });

  return (
    <section
      className={`min-w-0 ${className}`}
      aria-labelledby="booking-heading"
      data-testid="booking-step"
    >
      <div role="status" className="alert alert-success mb-6">
        <div className="min-w-0">
          <p className="font-semibold">
            Paid{productName ? ` — ${productName}` : ''}
          </p>
          <p className="text-sm break-words">
            Order <code>{orderId}</code>. A receipt is on its way
            {buyerEmail ? ` to ${buyerEmail}` : ''}.
          </p>
        </div>
      </div>

      <h2
        id="booking-heading"
        className="text-base-content mb-2 text-xl font-semibold"
      >
        Book your kickoff call
      </h2>
      {/*
        NO DURATION HERE, DELIBERATELY (#1092). This said "Thirty minutes" for seven
        months while linking to a 15-minute event, because the length is not data
        anywhere in this repo — it is an opaque slug inside a Calendly URL that an
        operator can change without touching code. Any number written here is a
        promise the product cannot keep. The scheduler states the real length on the
        page the buyer lands on.
      */}
      <p className="text-base-content mb-6">
        Pick a time that suits you — your name and email are already filled in.
      </p>

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary min-h-11 min-w-11"
        >
          Choose a time
        </a>
      ) : (
        // Every screen must render usefully with nothing configured (SC-008).
        // A dead button would be worse than saying so.
        <div role="alert" className="alert alert-warning">
          <div>
            <p className="font-semibold">Scheduling is not configured</p>
            <p className="text-sm">
              Set <code>NEXT_PUBLIC_CALENDAR_URL</code>. Your order is paid
              regardless — we will email you to arrange a time.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
