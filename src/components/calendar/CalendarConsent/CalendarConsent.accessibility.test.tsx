import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import CalendarConsent from './CalendarConsent';

expect.extend(toHaveNoViolations);

vi.mock('@/contexts/ConsentContext', () => ({
  useConsent: () => ({ updateConsent: vi.fn() }),
}));

const BOOKING = 'https://calendly.com/example/intro';

/**
 * This card IS the page for anyone who has not accepted third-party cookies, and
 * /schedule is the front door for every booking link in the product (#919). So its
 * accessibility is not a detail of a gate — it is the accessibility of booking.
 */
describe('CalendarConsent Accessibility', () => {
  it('has no violations with the escape hatch present', async () => {
    const { container } = render(
      <CalendarConsent provider="calendly" url={BOOKING} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations when no URL is configured', async () => {
    const { container } = render(<CalendarConsent provider="calcom" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('warns that the escape hatch opens a new tab', () => {
    render(<CalendarConsent provider="calendly" url={BOOKING} />);
    // An unannounced new tab disorients screen-reader and magnifier users; the
    // warning is sr-only text inside the link, so it is part of its name.
    expect(
      screen.getByRole('link', { name: /opens in a new tab/i })
    ).toHaveAttribute('href', BOOKING);
  });

  it('opens that tab safely', () => {
    render(<CalendarConsent provider="calendly" url={BOOKING} />);
    const link = screen.getByRole('link', { name: /Book on Calendly instead/ });
    // rel is not cosmetic with target=_blank: without noopener the opened page
    // gets a handle on this window.
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('meets the 44px touch floor on both controls', () => {
    render(<CalendarConsent provider="calendly" url={BOOKING} />);
    for (const el of [
      screen.getByRole('button', { name: 'Load the calendar' }),
      screen.getByRole('link', { name: /Book on Calendly instead/ }),
    ]) {
      expect(el.className).toContain('min-h-11');
      expect(el.className).toContain('min-w-11');
    }
  });

  it('has exactly one heading, and it names the goal', () => {
    render(<CalendarConsent provider="calendly" url={BOOKING} />);
    const headings = screen.getAllByRole('heading');
    expect(headings).toHaveLength(1);
    // "Calendar Consent Required" was the machinery talking (#919).
    expect(headings[0]).toHaveTextContent('Pick a time to talk');
  });
});
