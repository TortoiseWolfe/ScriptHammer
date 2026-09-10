'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { calendarConfig } from '@/config/calendar.config';
import { createLogger } from '@/lib/logger';

const logger = createLogger('components:payment:BookingCta');

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
  const recordLead = useCallback(
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

      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      // No id to carry and nothing to record: leave the plain link alone.
      if (!base || !anon || typeof crypto?.randomUUID !== 'function') return;

      const leadId = crypto.randomUUID();
      e.preventDefault();

      void fetch(`${base}/functions/v1/create-lead`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          apikey: anon,
          Authorization: `Bearer ${anon}`,
        },
        body: JSON.stringify({
          id: leadId,
          source,
          ...(productId ? { product_id: productId } : {}),
        }),
      }).catch((error) => {
        // Logged, not surfaced. A 429 here is the rate limiter working.
        logger.info('Lead not recorded', { source, error: String(error) });
      });

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
    <Link href={href} className={className} onClick={recordLead}>
      {children}
    </Link>
  );
}
