import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BookingCta from './BookingCta';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

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

const LEAD = '3f6c1a2e-8b4d-4c7a-9e1f-2b5d6c7a8e90';

describe('BookingCta', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    push.mockClear();
    fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: LEAD }) });
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

  it('carries the lead id to the booking surface', async () => {
    // THE POINT OF THE WHOLE FEATURE. The id becomes the embed's hidden `lead_ref` field,
    // Cal.com returns it in the webhook payload, and calcom-webhook advances that exact lead.
    // Without it on the URL there is nothing for a booking to be matched against.
    render(<BookingCta source="pricing" />);
    fireEvent.click(screen.getByRole('link', { name: /book a call/i }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/schedule?lead=${LEAD}`)
    );
  });

  it('still goes to the calendar when the lead cannot be recorded', async () => {
    // An unattributed booking is a small loss. A visitor who thinks the button is broken is
    // a large one, so every failure path falls through to the plain navigation.
    fetchMock.mockRejectedValue(new Error('offline'));
    render(<BookingCta source="pricing" />);
    fireEvent.click(screen.getByRole('link', { name: /book a call/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/schedule'));
  });

  it('goes to the calendar without waiting forever on a slow response', async () => {
    // The cap, not the request, is what protects the visitor.
    vi.useFakeTimers();
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<BookingCta source="pricing" />);
    fireEvent.click(screen.getByRole('link', { name: /book a call/i }));
    expect(push).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1300);
    expect(push).toHaveBeenCalledWith('/schedule');
    vi.useRealTimers();
  });

  it('navigates once, even if the response lands after the timeout', async () => {
    // Both paths call the same guarded `once`. Without it a late response would push a
    // second navigation on top of the page the visitor is already reading.
    vi.useFakeTimers();
    let settle: (v: unknown) => void = () => {};
    fetchMock.mockReturnValue(new Promise((r) => (settle = r)));
    render(<BookingCta source="pricing" />);
    fireEvent.click(screen.getByRole('link', { name: /book a call/i }));
    vi.advanceTimersByTime(1300);
    settle({ ok: true, json: async () => ({ id: LEAD }) });
    await vi.runAllTimersAsync();
    expect(push).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('leaves a modified click to the browser, so open-in-new-tab still works', () => {
    // preventDefault on a ctrl/cmd click would drag a new tab back into this one.
    render(<BookingCta source="pricing" />);
    fireEvent.click(screen.getByRole('link', { name: /book a call/i }), {
      metaKey: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('sends the anonymous key, because the caller has no session', () => {
    render(<BookingCta source="pricing" />);
    fireEvent.click(screen.getByRole('link', { name: /book a call/i }));
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.apikey).toBe('anon-key');
    expect(headers.Authorization).toBe('Bearer anon-key');
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
