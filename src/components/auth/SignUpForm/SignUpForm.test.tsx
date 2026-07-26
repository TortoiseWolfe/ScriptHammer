import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SignUpForm from './SignUpForm';

// (#353) CAPTCHA config is read at render time. Default to UNCONFIGURED so the
// pre-existing cases below exercise the same path every fork and local dev
// environment takes.
const mockConfig = vi.hoisted(() => ({
  captchaConfig: { provider: 'turnstile', siteKey: undefined, enabled: false },
}));
vi.mock('@/config/captcha.config', () => mockConfig);

// Cloudflare's widget can't mount in jsdom (external script + cross-origin
// iframe); stub it down to the solve callback.
vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: { onSuccess: (t: string) => void }) => (
    <button data-testid="turnstile-stub" onClick={() => onSuccess('tok-abc')}>
      solve
    </button>
  ),
}));

const configure = (siteKey?: string) => {
  mockConfig.captchaConfig.siteKey = siteKey as never;
  mockConfig.captchaConfig.enabled = Boolean(siteKey);
};

describe('SignUpForm', () => {
  beforeEach(() => configure(undefined));

  it('renders without crashing', () => {
    render(<SignUpForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign up/i })
    ).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-class';
    const { container } = render(<SignUpForm className={customClass} />);
    const form = container.querySelector('form');
    expect(form).toHaveClass(customClass);
  });

  describe('CAPTCHA gating (#353)', () => {
    const fillValidForm = () => {
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'someone@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'CorrectHorse1!' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password/i), {
        target: { value: 'CorrectHorse1!' },
      });
    };

    // The regression that would hurt most: render the widget unconditionally
    // and every fork / local-dev sign-up grows a challenge it has no key for.
    it('renders no challenge when no CAPTCHA is configured', () => {
      render(<SignUpForm />);
      expect(screen.queryByTestId('captcha-widget')).not.toBeInTheDocument();
    });

    it('renders the challenge when configured', () => {
      configure('0x-site-key');
      render(<SignUpForm />);
      expect(screen.getByTestId('captcha-widget')).toBeInTheDocument();
    });

    // The gate is in handleSubmit, not `disabled` — so the button stays
    // clickable (a dead button would strand users if Turnstile fails to load)
    // and an unsolved challenge surfaces an actionable message instead.
    it('the submit button is never disabled by an unsolved challenge', () => {
      configure('0x-site-key');
      render(<SignUpForm />);
      expect(screen.getByRole('button', { name: /sign up/i })).toBeEnabled();
    });

    it('refuses to submit until the challenge is solved', async () => {
      configure('0x-site-key');
      render(<SignUpForm />);
      fillValidForm();

      fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

      expect(
        await screen.findByText(/complete the verification challenge/i)
      ).toBeInTheDocument();
    });
  });
});
