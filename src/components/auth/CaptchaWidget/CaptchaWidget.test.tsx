import { render, screen, act } from '@testing-library/react';
import { createRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CaptchaWidget, {
  TURNSTILE_SCRIPT_ID,
  type CaptchaWidgetHandle,
} from './CaptchaWidget';

// The real widget injects Cloudflare's script and renders a cross-origin
// iframe — neither works in jsdom. Stub it down to the surface this component
// actually drives: the success/expire/error callbacks and the reset handle.
const mockReset = vi.fn();
// Counts genuine mounts (a useState initializer runs once per mount), so a test can
// tell a remount from a re-render.
const mounts = vi.hoisted(() => ({ count: 0 }));
vi.mock('@marsidev/react-turnstile', async () => {
  const React = await import('react');
  return {
    Turnstile: ({
      siteKey,
      onSuccess,
      onExpire,
      onError,
      options,
      ref,
    }: {
      siteKey: string;
      onSuccess: (t: string) => void;
      onExpire: () => void;
      onError: () => void;
      options?: { appearance?: string };
      ref?: { current: { reset: () => void } | null };
    }) => {
      if (ref) ref.current = { reset: mockReset };
      const [mountId] = React.useState(() => ++mounts.count);
      return (
        <div
          data-mount={mountId}
          data-testid="turnstile-stub"
          data-sitekey={siteKey}
          data-appearance={options?.appearance}
        >
          <button onClick={() => onSuccess('tok-abc')}>solve</button>
          <button onClick={() => onExpire()}>expire</button>
          <button onClick={() => onError()}>error</button>
        </div>
      );
    },
  };
});

const mockConfig = vi.hoisted(() => ({
  captchaConfig: { provider: 'turnstile', siteKey: undefined, enabled: false },
}));
vi.mock('@/config/captcha.config', () => mockConfig);

const configure = (siteKey?: string) => {
  mockConfig.captchaConfig.siteKey = siteKey as never;
  mockConfig.captchaConfig.enabled = Boolean(siteKey);
};

describe('CaptchaWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configure(undefined);
  });

  // The load-bearing behaviour: unconfigured must be a complete no-op, or every
  // fork and local dev environment gets a permanently un-submittable form.
  it('renders nothing and emits no token when no site key is configured', () => {
    const onToken = vi.fn();
    const { container } = render(<CaptchaWidget onToken={onToken} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('captcha-widget')).not.toBeInTheDocument();
    expect(onToken).not.toHaveBeenCalled();
  });

  it('renders the challenge with the configured site key', () => {
    configure('0x-site-key');
    render(<CaptchaWidget onToken={vi.fn()} />);

    expect(screen.getByTestId('captcha-widget')).toBeInTheDocument();
    expect(screen.getByTestId('turnstile-stub')).toHaveAttribute(
      'data-sitekey',
      '0x-site-key'
    );
  });

  // (#1319) Sign-up keeps the always-visible widget; /contact/ asks for
  // `interaction-only`, which Cloudflare renders at zero height and out of the
  // tab order unless it needs the visitor. Measured against the always-pass
  // test key: `always` took the Tab stop after the message field, this did not.
  it('shows the widget always by default, and passes interaction-only through', () => {
    configure('0x-site-key');
    const { unmount } = render(<CaptchaWidget onToken={vi.fn()} />);
    expect(screen.getByTestId('turnstile-stub')).toHaveAttribute(
      'data-appearance',
      'always'
    );
    unmount();

    render(<CaptchaWidget onToken={vi.fn()} appearance="interaction-only" />);
    expect(screen.getByTestId('turnstile-stub')).toHaveAttribute(
      'data-appearance',
      'interaction-only'
    );
  });

  it('reports the token on success', async () => {
    configure('0x-site-key');
    const onToken = vi.fn();
    render(<CaptchaWidget onToken={onToken} />);

    screen.getByText('solve').click();
    expect(onToken).toHaveBeenCalledWith('tok-abc');
  });

  // Tokens are single-use and short-lived; a stale one would be rejected by
  // Supabase with a confusing error, so both paths must clear it.
  it.each(['expire', 'error'])('clears the token on %s', (event) => {
    configure('0x-site-key');
    const onToken = vi.fn();
    render(<CaptchaWidget onToken={onToken} />);

    screen.getByText(event).click();
    expect(onToken).toHaveBeenCalledWith(null);
  });

  it('reset() re-challenges and clears the token', () => {
    configure('0x-site-key');
    const onToken = vi.fn();
    const ref = createRef<CaptchaWidgetHandle>();
    render(<CaptchaWidget ref={ref} onToken={onToken} />);

    ref.current?.reset();

    expect(mockReset).toHaveBeenCalled();
    expect(onToken).toHaveBeenCalledWith(null);
  });

  // (#1321) The library injects its script once and never again while the element
  // exists, even after a failed load. Without this, a visitor who opened the page
  // offline never got a token once the connection came back.
  describe("when Cloudflare's script failed to load", () => {
    const injectFailedScript = () => {
      const el = document.createElement('script');
      el.id = TURNSTILE_SCRIPT_ID;
      document.head.appendChild(el);
      // Resource errors don't bubble; the widget listens in the capture phase.
      act(() => {
        el.dispatchEvent(new Event('error'));
      });
      return el;
    };

    afterEach(() => document.getElementById(TURNSTILE_SCRIPT_ID)?.remove());

    it('reports it: no token, and onError so a caller can stop waiting', () => {
      configure('0x-site-key');
      const tokens = vi.fn();
      const errors = vi.fn();
      render(<CaptchaWidget onToken={tokens} onError={errors} />);

      injectFailedScript();

      expect(tokens).toHaveBeenCalledWith(null);
      expect(errors).toHaveBeenCalledTimes(1);
    });

    it('removes the dead script and remounts when the connection returns', () => {
      configure('0x-site-key');
      render(<CaptchaWidget onToken={vi.fn()} />);
      const before = screen.getByTestId('turnstile-stub').dataset.mount;

      const el = injectFailedScript();
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      expect(document.getElementById(TURNSTILE_SCRIPT_ID)).toBeNull();
      expect(el.isConnected).toBe(false);
      expect(screen.getByTestId('turnstile-stub').dataset.mount).not.toBe(
        before
      );
    });

    it('leaves a healthy script alone', () => {
      configure('0x-site-key');
      render(<CaptchaWidget onToken={vi.fn()} />);
      const before = screen.getByTestId('turnstile-stub').dataset.mount;
      const el = document.createElement('script');
      el.id = TURNSTILE_SCRIPT_ID;
      document.head.appendChild(el);

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      expect(el.isConnected).toBe(true);
      expect(screen.getByTestId('turnstile-stub').dataset.mount).toBe(before);
    });
  });

  it('applies a custom className', () => {
    configure('0x-site-key');
    const { container } = render(
      <CaptchaWidget onToken={vi.fn()} className="custom-test-class" />
    );
    expect(container.querySelector('.custom-test-class')).toBeInTheDocument();
  });
});
