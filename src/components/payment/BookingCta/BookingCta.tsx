'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { calendarConfig } from '@/config/calendar.config';
import { createLogger } from '@/lib/logger';

const logger = createLogger('components:payment:BookingCta');

/**
 * How long a click may wait for a lead id before going to the calendar without one.
 *
 * A booking that is not attributed is a small loss; a visitor who thinks the button is broken
 * is a large one. Short enough to feel like a normal navigation on a bad connection.
 */
const LEAD_WAIT_MS = 1200;

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
   * Record the click, then carry the lead id to the booking surface (#562 T039).
   *
   * THIS NOW AWAITS, AND THE REASON IS THE WHOLE FEATURE. The id has to reach the booking or
   * the webhook has nothing to join on: `/schedule` puts it in the embed's hidden `lead_ref`
   * field, Cal.com returns it in `responses.lead_ref`, and `calcom-webhook` advances that
   * exact lead to `scheduled`. Fire-and-forget cannot do that — the id only exists in the
   * response.
   *
   * IT IS STILL NEVER ALLOWED TO COST THE VISITOR THEIR BOOKING. The wait is capped, and
   * every failure — slow, offline, rate-limited, misconfigured — falls through to the plain
   * navigation. The worst case is an unattributed booking, which is exactly what happens
   * today anyway. It stays a real `<a href>` underneath, so no-JS and middle-click still
   * reach the calendar with no id and no wait.
   */
  const recordLead = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!base || !anon) return;

      // Let the browser handle anything that is not a plain left-click — a new tab must not
      // be hijacked into this tab by a preventDefault.
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

      e.preventDefault();

      const go = (leadId?: string) =>
        router.push(
          leadId ? `${href}?lead=${encodeURIComponent(leadId)}` : href
        );

      // The cap, not the request, is what protects the visitor. AbortSignal.timeout is not
      // available everywhere this ships, so the race is explicit.
      let settled = false;
      const once = (leadId?: string) => {
        if (settled) return;
        settled = true;
        go(leadId);
      };
      const timer = setTimeout(() => once(), LEAD_WAIT_MS);

      fetch(`${base}/functions/v1/create-lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anon,
          Authorization: `Bearer ${anon}`,
        },
        body: JSON.stringify({
          source,
          ...(productId ? { product_id: productId } : {}),
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { id?: string } | null) => {
          clearTimeout(timer);
          once(data?.id);
        })
        .catch((error) => {
          // Logged, not surfaced. A 429 here is the rate limiter working, not something to
          // tell a visitor about.
          logger.info('Lead not recorded', { source, error: String(error) });
          clearTimeout(timer);
          once();
        });
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
