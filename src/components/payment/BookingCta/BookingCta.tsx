'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
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
  const recordLead = useCallback(() => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!base || !anon) return;

    // Fire-and-forget on purpose. No await, no state, nothing rendered from the result —
    // the navigation is already happening and the visitor is owed a calendar, not a
    // spinner over a bookkeeping call.
    void fetch(`${base}/functions/v1/create-lead`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({
        source,
        ...(productId ? { product_id: productId } : {}),
      }),
    }).catch((error) => {
      // Logged, not surfaced. Rate limiting answers 429 here and that is the system
      // working, not something to tell a visitor about.
      logger.info('Lead not recorded', { source, error: String(error) });
    });
  }, [source, productId]);

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
