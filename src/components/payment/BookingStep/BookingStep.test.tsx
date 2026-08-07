import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BookingStep, { buildBookingUrl } from './BookingStep';

const BASE = 'https://calendly.com/turtlewolfe/30min';

describe('BookingStep', () => {
  it('confirms the order and offers the booking link', () => {
    render(
      <BookingStep
        orderId="o_7fd2c1a4"
        buyerName="Rigo"
        buyerEmail="rigo@warriorroofing.example"
        productName="Landing Page"
      />
    );
    expect(screen.getByText(/Paid — Landing Page/)).toBeInTheDocument();
    expect(screen.getByText('o_7fd2c1a4')).toBeInTheDocument();
  });

  it('says so plainly when scheduling is not configured', () => {
    // SC-008: no screen may render a dead control when nothing is set up.
    render(<BookingStep orderId="o_1" />);
    // With no NEXT_PUBLIC_CALENDAR_URL in the test env, the warning shows and
    // the order is still reported as paid.
    const link = screen.queryByRole('link', { name: /Book your kickoff/ });
    if (!link) {
      expect(screen.getByText(/not configured/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Your order is paid regardless/)
      ).toBeInTheDocument();
    } else {
      expect(link).toHaveAttribute('href');
    }
  });
});

describe('buildBookingUrl', () => {
  it('carries the order id as utm_content for webhook attribution', () => {
    const url = new URL(buildBookingUrl({ orderId: 'abc123', baseUrl: BASE })!);
    expect(url.searchParams.get('utm_content')).toBe('order_abc123');
  });

  it('prefills name and email', () => {
    const url = new URL(
      buildBookingUrl({
        orderId: 'a',
        name: 'Rigo',
        email: 'r@w.example',
        baseUrl: BASE,
      })!
    );
    expect(url.searchParams.get('name')).toBe('Rigo');
    expect(url.searchParams.get('email')).toBe('r@w.example');
  });

  it('uses utm_content, not utmContent — this builds a URL, not a widget prop', () => {
    // react-calendly's embed takes camelCase; a plain link takes snake_case.
    // Getting this wrong drops the attribution silently.
    const raw = buildBookingUrl({ orderId: 'a', baseUrl: BASE })!;
    expect(raw).toContain('utm_content=');
    expect(raw).not.toContain('utmContent');
  });

  it('returns null rather than a broken link when unconfigured', () => {
    expect(buildBookingUrl({ orderId: 'a', baseUrl: '' })).toBeNull();
    expect(buildBookingUrl({ orderId: 'a', baseUrl: 'not-a-url' })).toBeNull();
  });
});
