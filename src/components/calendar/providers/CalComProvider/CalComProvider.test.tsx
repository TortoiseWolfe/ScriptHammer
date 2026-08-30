import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CalComProvider } from './CalComProvider';

/**
 * @calcom/embed-react is mocked so the props this component COMPUTES are observable.
 * The embed itself is a cross-origin iframe; everything worth asserting here — the
 * theme-derived brand colour, the light/dark flag, the event wiring — is in what we
 * hand it.
 */
const calProps = vi.fn();
const { calApi } = vi.hoisted(() => ({ calApi: vi.fn() }));

vi.mock('@calcom/embed-react', () => ({
  default: (props: Record<string, unknown>) => {
    calProps(props);
    return <div data-testid="cal-inline" />;
  },
  getCalApi: () => Promise.resolve(calApi),
}));

// Hoisted: createLogger runs at module level, before a plain const would exist.
const { info } = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info, warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

let themeColor = { hexWithHash: '#ff0000', isDark: false };
vi.mock('@/hooks/useEmbedThemeColor', () => ({
  useEmbedThemeColor: () => themeColor,
}));

const LINK = 'example/intro';

beforeEach(() => {
  calProps.mockClear();
  calApi.mockClear();
  info.mockClear();
  themeColor = { hexWithHash: '#ff0000', isDark: false };
});

describe('CalComProvider', () => {
  it('renders the inline embed by default', () => {
    render(<CalComProvider calLink={LINK} mode="inline" />);
    expect(screen.getByTestId('cal-inline')).toBeInTheDocument();
    expect(calProps.mock.calls[0][0].calLink).toBe(LINK);
  });

  it('takes its brand colour from the ACTIVE theme (#39)', () => {
    themeColor = { hexWithHash: '#00ff00', isDark: false };
    render(<CalComProvider calLink={LINK} mode="inline" />);
    expect(calProps.mock.calls[0][0].config.branding.brandColor).toBe(
      '#00ff00'
    );
  });

  it('passes a BINARY theme, because the embed has no "auto"', () => {
    themeColor = { hexWithHash: '#ff0000', isDark: true };
    render(<CalComProvider calLink={LINK} mode="inline" />);
    expect(calProps.mock.calls[0][0].config.theme).toBe('dark');
  });

  it('sizes the embed, since an iframe has no intrinsic height', () => {
    render(<CalComProvider calLink={LINK} mode="inline" />);
    expect(calProps.mock.calls[0][0].style).toMatchObject({
      width: '100%',
      height: '700px',
      minHeight: '500px',
    });
  });

  it('lets a caller override the height', () => {
    render(
      <CalComProvider
        calLink={LINK}
        mode="inline"
        styles={{ height: '900px' }}
      />
    );
    expect(calProps.mock.calls[0][0].style.height).toBe('900px');
  });

  it('carries caller config through WITHOUT letting it override the theme', () => {
    // Theme is spread AFTER config deliberately: the embed's light/dark must follow
    // the site, not a stale value a caller passed in.
    render(
      <CalComProvider
        calLink={LINK}
        mode="inline"
        config={{ name: 'Ada', email: 'ada@example.com', theme: 'dark' }}
      />
    );
    const { config } = calProps.mock.calls[0][0];
    expect(config).toMatchObject({ name: 'Ada', email: 'ada@example.com' });
    expect(config.theme).toBe('light');
  });

  it('renders a trigger button in popup mode, wired by data attributes', () => {
    render(<CalComProvider calLink={LINK} mode="popup" />);
    const button = screen.getByRole('button', { name: 'Schedule a Meeting' });
    expect(button).toHaveAttribute('data-cal-link', LINK);
    expect(JSON.parse(button.getAttribute('data-cal-config') ?? '{}')).toEqual({
      theme: 'light',
    });
  });

  it('subscribes to booking and ready events', async () => {
    render(<CalComProvider calLink={LINK} mode="inline" />);
    await waitFor(() => expect(calApi).toHaveBeenCalledTimes(2));
    const actions = calApi.mock.calls.map((c) => c[1].action);
    expect(actions).toEqual(['bookingSuccessful', 'linkReady']);
  });

  it('logs those events with the provider named', async () => {
    render(<CalComProvider calLink={LINK} mode="inline" />);
    await waitFor(() => expect(calApi).toHaveBeenCalledTimes(2));

    const booking = calApi.mock.calls.find(
      (c) => c[1].action === 'bookingSuccessful'
    )![1];
    booking.callback({ detail: { name: 'Ada' } });
    expect(info).toHaveBeenCalledWith('Calendar scheduled', {
      provider: 'Cal.com',
      name: 'Ada',
    });

    const ready = calApi.mock.calls.find(
      (c) => c[1].action === 'linkReady'
    )![1];
    ready.callback({});
    expect(info).toHaveBeenCalledWith('Calendar viewed', {
      provider: 'Cal.com',
    });
  });
});
