/**
 * #919: /schedule is the front door for every booking link — the nav, three places on the
 * home page, the countdown banner and the pricing page's "Book a call" — and a first-time
 * visitor met a cookie card instead of a calendar.
 *
 * The gate itself is right: Calendly is third-party content and loading it sets cookies.
 * What was wrong was the presentation. The heading named the MECHANISM ("Calendar Consent
 * Required") rather than the goal, nothing said what accepting actually does, and there
 * was no way past it — Accept was the only control, so a visitor who did not want
 * third-party cookies was simply dead-ended on the page that exists to book meetings.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalendarConsent from './CalendarConsent';
import { CookieCategory } from '@/utils/consent-types';

const mockUpdateConsent = vi.fn();
vi.mock('@/contexts/ConsentContext', () => ({
  useConsent: () => ({ updateConsent: mockUpdateConsent }),
}));

const BOOKING = 'https://calendly.com/example/intro';

beforeEach(() => mockUpdateConsent.mockClear());

describe('CalendarConsent (#919)', () => {
  it('leads with the goal, not the consent mechanism', () => {
    render(<CalendarConsent provider="calendly" url={BOOKING} />);
    // The visitor came to book a call. The heading should say so; "Consent Required" is
    // the machinery talking.
    const heading = screen.getByRole('heading');
    expect(heading.textContent).toMatch(/book|time|call/i);
    expect(heading.textContent).not.toMatch(/consent required/i);
  });

  it('says what accepting actually does', () => {
    render(<CalendarConsent provider="calendly" url={BOOKING} />);
    // getAllBy: the provider is named in the explanation AND on the fallback link,
    // which is intended — both places need to say whose calendar this is.
    expect(screen.getByText(/cookie/i)).toBeInTheDocument();
    expect(screen.getAllByText(/calendly/i).length).toBeGreaterThan(0);
  });

  it('OFFERS A WAY THROUGH WITHOUT CONSENTING — the dead end this fixes', () => {
    // Accept was the only control. Someone who declines third-party cookies could not
    // book at all, on the page whose entire job is booking.
    render(<CalendarConsent provider="calendly" url={BOOKING} />);
    const link = screen.getByRole('link', { name: /book|calendly|new tab/i });
    expect(link).toHaveAttribute('href', BOOKING);
  });

  it('opens that link safely', () => {
    render(<CalendarConsent provider="calendly" url={BOOKING} />);
    const link = screen.getByRole('link', { name: /book|calendly|new tab/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel') ?? '').toMatch(/noopener/);
  });

  it('renders no link at all when there is no booking URL to offer', () => {
    // A dead <a href=""> is worse than no link. ANTI-VACUITY for the two tests above:
    // without this they would pass on a component that always renders a link.
    render(<CalendarConsent provider="calendly" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('still grants functional consent when Accept is clicked', async () => {
    const user = userEvent.setup();
    render(<CalendarConsent provider="calendly" url={BOOKING} />);
    await user.click(screen.getByRole('button', { name: /accept|show|load/i }));
    expect(mockUpdateConsent).toHaveBeenCalledWith(
      CookieCategory.FUNCTIONAL,
      true
    );
  });

  it('names Cal.com when that is the provider', () => {
    render(<CalendarConsent provider="calcom" url={BOOKING} />);
    expect(screen.getAllByText(/cal\.com/i).length).toBeGreaterThan(0);
  });

  it('meets the 44px touch target on both controls', () => {
    render(<CalendarConsent provider="calendly" url={BOOKING} />);
    for (const el of [screen.getByRole('button'), screen.getByRole('link')]) {
      expect(el.className).toMatch(/min-h-11/);
    }
  });
});
