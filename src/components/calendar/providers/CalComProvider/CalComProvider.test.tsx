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
const { calApi, getCalApiArgs } = vi.hoisted(() => ({
  calApi: vi.fn(),
  getCalApiArgs: vi.fn(),
}));

vi.mock('@calcom/embed-react', () => ({
  default: (props: Record<string, unknown>) => {
    calProps(props);
    return <div data-testid="cal-inline" />;
  },
  // Records its argument. It used to be `() => Promise.resolve(calApi)`, which threw the
  // argument away — so nothing could observe the namespace, which is exactly the value
  // #1111 turned on.
  getCalApi: (arg?: unknown) => {
    getCalApiArgs(arg);
    return Promise.resolve(calApi);
  },
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
  getCalApiArgs.mockClear();
  info.mockClear();
  themeColor = { hexWithHash: '#ff0000', isDark: false };
});

describe('CalComProvider', () => {
  it('renders the inline embed by default', () => {
    render(<CalComProvider calLink={LINK} mode="inline" />);
    expect(screen.getByTestId('cal-inline')).toBeInTheDocument();
    expect(calProps.mock.calls[0][0].calLink).toBe(LINK);
  });

  it('takes its brand colour from the ACTIVE theme, via `ui` (#39, #1111)', async () => {
    // THIS ASSERTION USED TO READ `config.branding.brandColor`, which is the defect, not the
    // feature. `config` becomes the iframe's QUERY STRING, and embed-core flattens it with
    // `URLSearchParams.set`, so a nested object produced a live URL containing
    // `branding=%5Bobject+Object%5D`. The test passed for the whole life of #39 because it
    // asserted the object this component computed and never the URL built from it.
    themeColor = { hexWithHash: '#00ff00', isDark: false };
    render(<CalComProvider calLink={LINK} mode="inline" />);
    await waitFor(() => expect(calApi).toHaveBeenCalledTimes(2));

    const ready = calApi.mock.calls.find(
      (c) => c[1].action === 'linkReady'
    )![1];
    ready.callback({});

    const ui = calApi.mock.calls.find((c) => c[0] === 'ui')!;
    expect(ui[1]).toEqual({ styles: { branding: { brandColor: '#00ff00' } } });
  });

  it('applies the colour only once the iframe is ready, never at mount (#1111)', async () => {
    // `ui` routes through `doInIframe`, which throws when no iframe exists yet. Calling it at
    // mount would reintroduce the exact error the namespace fix removes, by another route.
    render(<CalComProvider calLink={LINK} mode="inline" />);
    await waitFor(() => expect(calApi).toHaveBeenCalledTimes(2));
    expect(calApi.mock.calls.some((c) => c[0] === 'ui')).toBe(false);
  });

  it('ANTI-VACUITY: every value in `config` survives a URL (#1111)', () => {
    // The property that actually matters, stated so it cannot be satisfied by the broken
    // shape. Anything non-scalar in `config` is stringified by `URLSearchParams.set` into
    // `[object Object]` — invisible here, because the embed is a cross-origin iframe this
    // suite mocks away. Asserting the SHAPE of one key would not have caught #1111; asserting
    // that no key can be an object does, and catches the next one too.
    render(
      <CalComProvider
        calLink={LINK}
        mode="inline"
        config={{ name: 'Ada', email: 'ada@example.com' }}
      />
    );
    const { config } = calProps.mock.calls[0][0];
    const nested = Object.entries(config).filter(
      ([, v]) => v !== null && typeof v === 'object' && !Array.isArray(v)
    );
    expect(
      nested,
      `these config keys are objects and will reach the embed as "[object Object]": ` +
        `${nested.map(([k]) => k).join(', ')}. Brand colour belongs in cal('ui', …), which ` +
        `travels by postMessage rather than in the URL.`
    ).toEqual([]);
  });

  it('gives the embed a NON-EMPTY namespace everywhere it is read (#1111)', async () => {
    // `getCalApi()` defaults the namespace to `""`. `<Cal>` tests it as falsy and takes the
    // non-namespaced branch; the loader stub tests `typeof === "string"`, which is true for
    // `""`, and builds a SECOND instance that overwrites the action manager and owns no
    // iframe. Every inbound message then throws `iframe doesn't exist`. All three readers
    // must agree, so all three are asserted.
    const { unmount } = render(<CalComProvider calLink={LINK} mode="inline" />);
    await waitFor(() => expect(getCalApiArgs).toHaveBeenCalled());

    const ns = getCalApiArgs.mock.calls[0][0]?.namespace;
    expect(
      ns,
      'getCalApi was called with an empty or missing namespace'
    ).toBeTruthy();
    expect(calProps.mock.calls[0][0].namespace).toBe(ns);

    unmount();
    render(<CalComProvider calLink={LINK} mode="popup" />);
    expect(
      screen.getByRole('button', { name: 'Schedule a Meeting' })
    ).toHaveAttribute('data-cal-namespace', ns);
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
