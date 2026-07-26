import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CaptchaWidget, { type CaptchaWidgetHandle } from './CaptchaWidget';

// The real widget injects Cloudflare's script and renders a cross-origin
// iframe — neither works in jsdom. Stub it down to the surface this component
// actually drives: the success/expire/error callbacks and the reset handle.
const mockReset = vi.fn();
vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({
    siteKey,
    onSuccess,
    onExpire,
    onError,
    ref,
  }: {
    siteKey: string;
    onSuccess: (t: string) => void;
    onExpire: () => void;
    onError: () => void;
    ref?: { current: { reset: () => void } | null };
  }) => {
    if (ref) ref.current = { reset: mockReset };
    return (
      <div data-testid="turnstile-stub" data-sitekey={siteKey}>
        <button onClick={() => onSuccess('tok-abc')}>solve</button>
        <button onClick={() => onExpire()}>expire</button>
        <button onClick={() => onError()}>error</button>
      </div>
    );
  },
}));

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

  it('applies a custom className', () => {
    configure('0x-site-key');
    const { container } = render(
      <CaptchaWidget onToken={vi.fn()} className="custom-test-class" />
    );
    expect(container.querySelector('.custom-test-class')).toBeInTheDocument();
  });
});
