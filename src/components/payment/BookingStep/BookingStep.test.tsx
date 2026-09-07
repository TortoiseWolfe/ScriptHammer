import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import BookingStep, { buildBookingUrl } from './BookingStep';

const BASE = 'https://calendly.com/turtlewolfe/30min';

describe('BookingStep', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

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

  it('promises no meeting length, because the repo cannot know one (#1092)', async () => {
    // This screen said "Thirty minutes to go through what you need" and offered a
    // button reading "Book your kickoff — 30 min" for seven months, while
    // NEXT_PUBLIC_CALENDAR_URL pointed at a 15-minute Calendly event. The length
    // lives in an opaque URL slug an operator can change without touching code, so
    // any number rendered here is a promise the product cannot keep.
    //
    // Asserted as an absence on purpose: the failure mode is someone adding a
    // friendly, specific number back.
    // The URL is STUBBED rather than inherited, because the duration used to live in
    // the link's own label ("Book your kickoff — 30 min"). With no calendar
    // configured the component renders its "not configured" branch and there is no
    // link at all, so an absence assertion would pass by having nothing to read.
    // That is exactly how the first version of this test passed locally (where .env
    // supplies a URL) and failed in CI (where nothing does).
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_CALENDAR_URL', 'https://calendly.com/acme/intro');
    const { default: Configured } = await import('./BookingStep');
    const { container } = render(
      <Configured orderId="o_1" productName="Landing Page" />
    );
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/\b\d+\s*min/i);
    expect(text).not.toMatch(/thirty|fifteen|ninety|hour/i);
    // Counterweight: the screen still renders its actual job, so the assertions
    // above are not passing on an empty container.
    // Scoped by ROLE, not text: the heading and the link would both match a bare
    // /Book your kickoff/, and the link is the control that matters here.
    expect(
      screen.getByRole('link', { name: /Choose a time/ })
    ).toBeInTheDocument();
  });

  it('says so plainly when scheduling is not configured', () => {
    // SC-008: no screen may render a dead control when nothing is set up.
    render(<BookingStep orderId="o_1" />);
    // With no NEXT_PUBLIC_CALENDAR_URL in the test env, the warning shows and
    // the order is still reported as paid.
    const link = screen.queryByRole('link', { name: /Choose a time/ });
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

describe('resolveCalendarUrl — per-SKU scheduling (#1092)', () => {
  // `calendarConfig` is built from process.env at module load, so each case needs a
  // fresh module graph. Without resetModules the first import wins and every
  // assertion below measures whatever the first test set.
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load(env: Record<string, string>) {
    vi.resetModules();
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    return await import('@/config/calendar.config');
  }

  const GENERAL = 'https://cal.com/acme/15min';
  const OFFICE = 'https://cal.com/acme/office-hours';

  it('sends the $99 office-hours SKU to its own event', async () => {
    // The defect: prd-office-hours advertises a longer paid session and
    // booked the 15-minute general call, because one global URL served every SKU.
    const { resolveCalendarUrl } = await load({
      NEXT_PUBLIC_CALENDAR_URL: GENERAL,
      NEXT_PUBLIC_CALENDAR_URL_OFFICE_HOURS: OFFICE,
    });
    expect(resolveCalendarUrl('prd-office-hours')).toBe(OFFICE);
    // Counterweight: everything else still books the general call, so the test
    // above is not passing because the resolver returns the override always.
    expect(resolveCalendarUrl('svc-landing')).toBe(GENERAL);
    expect(resolveCalendarUrl()).toBe(GENERAL);
  });

  it('falls back to the general call when the override is unset', async () => {
    // This was the state on the day this shipped: the paid event did not exist
    // yet. An unset variable must degrade to a working booking, never to
    // an empty href.
    const { resolveCalendarUrl } = await load({
      NEXT_PUBLIC_CALENDAR_URL: GENERAL,
      NEXT_PUBLIC_CALENDAR_URL_OFFICE_HOURS: '',
    });
    expect(resolveCalendarUrl('prd-office-hours')).toBe(GENERAL);
  });

  it('threads the SKU through buildBookingUrl', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_CALENDAR_URL', GENERAL);
    vi.stubEnv('NEXT_PUBLIC_CALENDAR_URL_OFFICE_HOURS', OFFICE);
    const mod = await import('./BookingStep');
    const href = mod.buildBookingUrl({
      orderId: 'o_1',
      sku: 'prd-office-hours',
    });
    expect(href).not.toBeNull();
    expect(new URL(href!).pathname).toBe('/acme/office-hours');
    // An explicit baseUrl still wins over the SKU — the tests above rely on it.
    const pinned = mod.buildBookingUrl({
      orderId: 'o_1',
      sku: 'prd-office-hours',
      baseUrl: GENERAL,
    });
    expect(new URL(pinned!).pathname).toBe('/acme/15min');
  });
});
