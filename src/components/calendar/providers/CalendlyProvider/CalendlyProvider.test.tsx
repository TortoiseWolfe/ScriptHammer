import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CalendlyProvider } from './CalendlyProvider';

/**
 * react-calendly is mocked so the props this component COMPUTES are observable.
 * Rendering the real widget would prove only that an iframe appeared; everything
 * worth checking here — the theme-derived colours, the event wiring, the height
 * defaults — lives in what gets handed to it.
 */
const inlineProps = vi.fn();
const popupProps = vi.fn();
let listeners: Record<string, (e: unknown) => void> = {};

vi.mock('react-calendly', () => ({
  InlineWidget: (props: Record<string, unknown>) => {
    inlineProps(props);
    return <div data-testid="inline-widget" />;
  },
  PopupWidget: (props: Record<string, unknown>) => {
    popupProps(props);
    return <div data-testid="popup-widget" />;
  },
  useCalendlyEventListener: (l: Record<string, (e: unknown) => void>) => {
    listeners = l;
  },
}));

// vi.hoisted, not a plain const: the component calls createLogger at MODULE level,
// so the factory runs during import — before a plain `const info = vi.fn()` has been
// initialised, which fails as "Cannot access 'info' before initialization".
const { info } = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info, warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

let themeColor = { hex: 'ff0000', isDark: false };
vi.mock('@/hooks/useEmbedThemeColor', () => ({
  useEmbedThemeColor: () => themeColor,
}));

const URL = 'https://calendly.com/example/intro';

beforeEach(() => {
  inlineProps.mockClear();
  popupProps.mockClear();
  info.mockClear();
  listeners = {};
  themeColor = { hex: 'ff0000', isDark: false };
});

describe('CalendlyProvider', () => {
  it('renders the inline widget by default', () => {
    render(<CalendlyProvider url={URL} mode="inline" />);
    expect(screen.getByTestId('inline-widget')).toBeInTheDocument();
    expect(inlineProps.mock.calls[0][0].url).toBe(URL);
  });

  it('takes its brand colour from the ACTIVE theme, not a constant', () => {
    // Issue #39. A hardcoded hex here is invisible until someone switches theme.
    themeColor = { hex: '00ff00', isDark: false };
    render(<CalendlyProvider url={URL} mode="inline" />);
    expect(inlineProps.mock.calls[0][0].pageSettings.primaryColor).toBe(
      '00ff00'
    );
  });

  it('flips background and text together with the theme', () => {
    themeColor = { hex: 'ff0000', isDark: true };
    render(<CalendlyProvider url={URL} mode="inline" />);
    const { pageSettings } = inlineProps.mock.calls[0][0];
    expect(pageSettings.backgroundColor).toBe('1a1a1a');
    expect(pageSettings.textColor).toBe('ffffff');
  });

  it('uses light surfaces on a light theme', () => {
    render(<CalendlyProvider url={URL} mode="inline" />);
    const { pageSettings } = inlineProps.mock.calls[0][0];
    expect(pageSettings.backgroundColor).toBe('ffffff');
    expect(pageSettings.textColor).toBe('000000');
  });

  it('gives the iframe a height, since an iframe has no intrinsic one', () => {
    render(<CalendlyProvider url={URL} mode="inline" />);
    expect(inlineProps.mock.calls[0][0].styles).toMatchObject({
      height: '1200px',
      minHeight: '1000px',
    });
  });

  it('lets a caller override the height', () => {
    render(
      <CalendlyProvider url={URL} mode="inline" styles={{ height: '600px' }} />
    );
    expect(inlineProps.mock.calls[0][0].styles.height).toBe('600px');
  });

  it('renders the popup widget in popup mode', () => {
    render(<CalendlyProvider url={URL} mode="popup" />);
    expect(screen.getByTestId('popup-widget')).toBeInTheDocument();
    expect(popupProps.mock.calls[0][0].text).toBe('Schedule a Meeting');
  });

  it('passes utm and prefill straight through', () => {
    const utm = { utmSource: 'test' };
    const prefill = { name: 'Ada', email: 'ada@example.com' };
    render(
      <CalendlyProvider url={URL} mode="inline" utm={utm} prefill={prefill} />
    );
    expect(inlineProps.mock.calls[0][0]).toMatchObject({ utm, prefill });
  });

  it('logs each stage of the booking, with the provider named', () => {
    render(<CalendlyProvider url={URL} mode="inline" />);
    listeners.onProfilePageViewed?.(undefined);
    listeners.onDateAndTimeSelected?.(undefined);
    listeners.onEventScheduled?.({
      data: { payload: { invitee: { uri: 'https://api/invitees/1' } } },
    } as never);

    expect(info).toHaveBeenCalledWith('Calendar viewed', {
      provider: 'Calendly',
    });
    expect(info).toHaveBeenCalledWith('Calendar time selected', {
      provider: 'Calendly',
    });
    expect(info).toHaveBeenCalledWith('Calendar scheduled', {
      provider: 'Calendly',
      inviteeUri: 'https://api/invitees/1',
    });
  });
});
