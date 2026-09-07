/**
 * `toCalLink` — the URL-to-embed-path narrowing that makes the Cal.com provider usable (#1100).
 *
 * WHY THIS EXISTS. `CalComProvider` hands its `calLink` straight to `@calcom/embed-react`
 * and to `data-cal-link`, both of which want a bare `user/event-slug`. `CalendarEmbed`
 * previously passed the configured URL through unchanged, so the Cal.com branch had never
 * worked — it was typed, tested and shipped, but every path through it embedded a value the
 * widget cannot resolve. Nothing caught it because nothing ran with
 * `NEXT_PUBLIC_CALENDAR_PROVIDER=calcom`.
 *
 * THE ASYMMETRY THAT DECIDES THE DIRECTION. The same configured value also reaches
 * `buildBookingUrl`, which does `new URL(base)` and returns `null` on failure — so storing
 * the bare form instead would silently remove the booking link from the checkout
 * confirmation of a $99 purchase. Narrowing at the embed is the only direction that keeps
 * both consumers working, and these tests pin that direction rather than just the string
 * transformation.
 */

import { describe, it, expect } from 'vitest';
import { toCalLink } from './calendar.config';

describe('toCalLink (#1100)', () => {
  it('strips the origin from a cal.com booking URL', () => {
    expect(toCalLink('https://cal.com/turtle-wolfe/office-hours')).toBe(
      'turtle-wolfe/office-hours'
    );
  });

  it('handles the app. subdomain, which is what the dashboard copies', () => {
    expect(toCalLink('https://app.cal.com/turtle-wolfe/15min')).toBe(
      'turtle-wolfe/15min'
    );
  });

  it('preserves a self-hosted origin by discarding it, not by hardcoding cal.com', () => {
    // The reason this narrows a URL rather than reconstructing one: reconstructing would
    // put a literal `https://cal.com` in the source and break self-hosted instances, which
    // are the entire point of Cal.com being AGPL.
    expect(toCalLink('https://booking.example.org/team/intro')).toBe(
      'team/intro'
    );
  });

  it('drops query and hash, which data-cal-link cannot carry', () => {
    expect(
      toCalLink('https://cal.com/turtle-wolfe/office-hours?month=2026-09#top')
    ).toBe('turtle-wolfe/office-hours');
  });

  it('passes an already-bare link through unchanged', () => {
    // A fork may configure `user/slug` directly. It still embeds; it just gets no checkout
    // link, which is the documented behaviour for an unparseable URL rather than a new
    // failure mode.
    expect(toCalLink('turtle-wolfe/office-hours')).toBe(
      'turtle-wolfe/office-hours'
    );
  });

  it('normalises stray slashes and whitespace', () => {
    expect(toCalLink('  https://cal.com/turtle-wolfe/office-hours/  ')).toBe(
      'turtle-wolfe/office-hours'
    );
    expect(toCalLink('/turtle-wolfe/office-hours')).toBe(
      'turtle-wolfe/office-hours'
    );
  });

  it('returns empty for an unconfigured value', () => {
    expect(toCalLink('')).toBe('');
    expect(toCalLink('   ')).toBe('');
  });

  it('returns empty for an origin with no event path', () => {
    // `https://cal.com/` is configured-but-useless. Returning '' routes it to
    // CalendarEmbed's "not configured" warning instead of mounting an empty embed.
    expect(toCalLink('https://cal.com/')).toBe('');
    expect(toCalLink('https://cal.com')).toBe('');
  });

  it('ANTI-VACUITY: the output is never a parseable absolute URL', () => {
    // The load-bearing property, stated as the failure rather than the success. If someone
    // "simplifies" toCalLink back into a pass-through, every assertion above could still be
    // made to pass with a clever regex while this one cannot — a calLink that still parses
    // as a URL is exactly the bug (#1100), and it is invisible in a rendered test because
    // the embed fails inside a third-party iframe.
    for (const input of [
      'https://cal.com/turtle-wolfe/office-hours',
      'https://app.cal.com/turtle-wolfe/15min',
      'https://booking.example.org/team/intro',
    ]) {
      const out = toCalLink(input);
      expect(() => new URL(out)).toThrow();
      expect(out).not.toContain('://');
    }
  });
});
