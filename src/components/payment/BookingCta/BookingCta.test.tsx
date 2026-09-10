import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BookingCta from './BookingCta';

vi.mock('@/config/calendar.config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/calendar.config')>()),
  calendarConfig: {
    provider: 'calcom',
    url: 'https://cal.com/turtle-wolfe/15min',
    eventTypes: {},
    utm: {},
    styles: {},
  },
}));

describe('BookingCta', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const body = () => JSON.parse(fetchMock.mock.calls[0][1].body);

  it('is a real link, so the calendar is reachable without JavaScript', () => {
    // Not a button with a router push: middle-click, open-in-new-tab and a failed script
    // must all still reach the booking surface. The recording is the extra, not the path.
    render(<BookingCta source="pricing" />);
    expect(screen.getByRole('link', { name: /book a call/i })).toHaveAttribute(
      'href',
      '/schedule'
    );
  });

  it('records the lead on click, with the source and SKU', () => {
    render(<BookingCta source="pricing" productId="svc-landing" />);
    fireEvent.click(screen.getByRole('link', { name: /book a call/i }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/functions\/v1\/create-lead$/);
    expect(body()).toEqual({ source: 'pricing', product_id: 'svc-landing' });
  });

  it('omits product_id entirely when there is no SKU', () => {
    // A general "book a call" has no product behind it. Sending an empty string would be
    // a value the resolver has to interpret rather than an absence.
    render(<BookingCta source="pricing" />);
    fireEvent.click(screen.getByRole('link', { name: /book a call/i }));
    expect(body()).toEqual({ source: 'pricing' });
  });

  it('uses keepalive so the record survives the navigation it triggers', () => {
    // Without this the request is cancelled the moment the page starts unloading, which is
    // exactly when it is sent — the lead would be recorded only when the click was slow.
    render(<BookingCta source="pricing" />);
    fireEvent.click(screen.getByRole('link', { name: /book a call/i }));
    expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
  });

  it('sends the anonymous key, because the caller has no session', () => {
    render(<BookingCta source="pricing" />);
    fireEvent.click(screen.getByRole('link', { name: /book a call/i }));
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.apikey).toBe('anon-key');
    expect(headers.Authorization).toBe('Bearer anon-key');
  });

  it('does not throw at the visitor when recording fails', async () => {
    // A failed lead is an operator's missing row. It must never be a visitor's broken
    // booking, so the rejection is swallowed and the link still navigates.
    fetchMock.mockRejectedValue(new Error('offline'));
    render(<BookingCta source="pricing" />);
    expect(() =>
      fireEvent.click(screen.getByRole('link', { name: /book a call/i }))
    ).not.toThrow();
    await Promise.resolve();
  });

  it('says so rather than offering a dead control when no calendar is configured', async () => {
    // T035's own instruction. CalendarEmbed's "not configured" warning sits AFTER the
    // consent gate, so a fork with no scheduler URL shows a working-looking button that
    // leads to a consent card and then to nothing.
    vi.resetModules();
    vi.doMock('@/config/calendar.config', () => ({
      calendarConfig: {
        provider: 'calcom',
        url: '',
        eventTypes: {},
        utm: {},
        styles: {},
      },
    }));
    const { default: Unconfigured } = await import('./BookingCta');
    render(<Unconfigured source="pricing" />);
    expect(screen.getByRole('status')).toHaveTextContent(/not set up yet/i);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('records nothing when Supabase is not configured, rather than fetching undefined', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    render(<BookingCta source="pricing" />);
    fireEvent.click(screen.getByRole('link', { name: /book a call/i }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
