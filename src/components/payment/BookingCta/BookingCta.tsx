'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { calendarConfig } from '@/config/calendar.config';
import { recordLead } from '@/lib/leads/record-lead';
import { trackAdConversion } from '@/lib/analytics/ad-events';
import { trackEvent } from '@/utils/analytics';

/** Where the visitor asked from. Must match `leads_source_check` and `LEAD_SOURCES`. */
export type BookingSource = 'pricing' | 'schedule' | 'checkout';

export interface BookingCtaProps {
  /** Which surface this sits on. Recorded against the lead. */
  source: BookingSource;
  /** The SKU they were looking at, when there is one. */
  productId?: string;
  /** Where the click goes. The booking surface, not an outbound scheduler URL. */
  href?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * "Book a call", and a record that somebody asked (#562 T035, US-6).
 *
 * THE CLICK IS THE SIGNAL, AND IT IS THE ONLY ONE AVAILABLE. Feature 050 wanted a lead
 * whose name and email were filled in later from the booking confirmation, so a visitor
 * never meets a form before a calendar. That depended on the scheduler returning a
 * correlation identifier in its webhook, and Cal.com does not: it stores auto-tracked UTM
 * parameters in a separate table readable only in its own logged-in UI, and the request to
 * forward them has been open upstream since 2025-10-29 (#562). So a lead records that
 * somebody wanted to talk, and nothing about who — which is honest, and still tells the
 * operator something they had no way to see before.
 *
 * IT LINKS TO THE BOOKING SURFACE RATHER THAN OUT TO THE SCHEDULER. The spec asked for a
 * plain outbound anchor, and the reason it gave was the webhook backfill above. With that
 * gone, sending visitors off-site buys a click and nothing more, while leaving `/schedule`
 * as a second booking surface that records nothing — the split that produced #1092. One
 * surface, recorded at the door.
 *
 * RECORDING NEVER BLOCKS THE VISITOR, AND NEVER FAILS IN FRONT OF THEM. This is a real
 * `<Link>`, so it navigates whether or not the fetch succeeds, works on middle-click, and
 * needs no JavaScript to reach the calendar. `keepalive` lets the request outlive the
 * navigation. A failed lead is an operator's missing row; it must never be a visitor's
 * broken booking.
 */
export default function BookingCta({
  source,
  productId,
  href = '/schedule',
  children = 'Book a call',
  className = '',
}: BookingCtaProps) {
  const router = useRouter();

  /**
   * Mint the lead id here, carry it immediately, and record in the background (#1166).
   *
   * THE ID IS GENERATED ON THIS SIDE, AND THAT IS THE FIX. It has to be on the URL the moment
   * the visitor clicks — it becomes the booking's hidden `lead_ref`, which is the only thing
   * tying a booking back to a click. Asking the server for one meant waiting for `create-lead`
   * to answer, and a cold Edge Function start beat the 1200ms cap this used to allow: measured
   * on production, the first click after a quiet period navigated with no id at all while still
   * writing a perfect-looking lead. On a low-traffic site that is most clicks.
   *
   * GENERATED AT CLICK TIME, NOT RENDER TIME. This page is statically exported, so an id minted
   * during render would be baked into the HTML and every visitor would share one.
   *
   * The record is fire-and-forget again, with `keepalive` so it survives the navigation it
   * races. A failed record costs attribution, never the booking.
   */
  const onBookingClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Let the browser handle anything that is not a plain left-click — a new tab must not be
      // hijacked into this tab by a preventDefault.
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      /*
       * GA4, BEFORE the lead is minted, and that ordering is the point.
       *
       * This is the highest-intent action on the site and until now nothing reported it to
       * analytics — GA recorded that somebody reached /pricing and never that they asked to
       * talk, which is exactly the half of "what does an ad click do" that was missing.
       *
       * NO CONSENT CHECK HERE, for the same reason the ad conversion below has none: the
       * gtag script is only mounted with analytics consent (GoogleAnalytics.tsx:63 returns
       * null without it), so `window.gtag` being absent IS the gate. A second check would be
       * a copy to keep in sync, and `useAnalytics()` would drag a ConsentProvider into every
       * test that renders this button.
       *
       * It runs BEFORE the `!leadId` return so a failed lead write does not also lose the
       * analytics event. GA then reads >= leads, and the gap between them is itself the
       * signal that lead recording is dropping clicks.
       */
      trackEvent(
        'booking_cta_click',
        'Conversion',
        productId ?? source,
        undefined,
        {
          booking_source: source,
        }
      );

      // One recorder for every surface (#562). `/schedule` calls the same function for a
      // visitor who arrives without a lead, so the request shape cannot drift between them.
      const leadId = recordLead(source, productId);
      if (!leadId) return; // nothing to carry — leave the plain link alone

      // Report the ad conversion, if this visitor came from an ad AND consented. No-ops
      // otherwise: the pixel is only mounted with marketing consent, so an absent SDK is the
      // gate rather than a second check to keep in sync. Never awaited and never throws — a
      // failed report must cost attribution, never the booking (see the note above).
      trackAdConversion('lead_created');

      e.preventDefault();
      router.push(`${href}?lead=${encodeURIComponent(leadId)}`);
    },
    [source, productId, href, router]
  );

  /*
   * T035's own instruction: check `calendarConfig.url` HERE. `CalendarEmbed` does render a
   * "not configured" warning, but it sits AFTER the consent gate, so a fork that has not set
   * a scheduler URL shows a working-looking button that leads to a consent card and then to
   * nothing. A control that cannot do its job should say so where it is.
   */
  if (!calendarConfig.url) {
    return (
      <p role="status" className={`text-base-content ${className}`}>
        Booking is not set up yet.
      </p>
    );
  }

  return (
    <Link href={href} className={className} onClick={onBookingClick}>
      {children}
    </Link>
  );
}
