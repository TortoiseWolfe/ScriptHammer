import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SignInForm from './SignInForm';

// (#353) Default UNCONFIGURED so the pre-existing cases exercise the path every
// fork and local dev environment takes.
const mockConfig = vi.hoisted(() => ({
  captchaConfig: { provider: 'turnstile', siteKey: undefined, enabled: false },
}));
vi.mock('@/config/captcha.config', () => mockConfig);

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

describe('SignInForm', () => {
  beforeEach(() => configure(undefined));
  it('renders without crashing', () => {
    render(<SignInForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it('renders Remember Me checkbox unchecked by default', () => {
    render(<SignInForm />);
    const checkbox = screen.getByLabelText(/remember me/i);
    expect(checkbox).not.toBeChecked();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-class';
    const { container } = render(<SignInForm className={customClass} />);
    const form = container.querySelector('form');
    expect(form).toHaveClass(customClass);
  });

  // Supabase's SECURITY_CAPTCHA_ENABLED is GLOBAL to auth — it gates sign-IN,
  // not just sign-up. Wiring only the sign-up form locked every existing user
  // out of production. These cases exist so that cannot recur silently.
  describe('CAPTCHA gating (#353)', () => {
    it('renders no challenge when CAPTCHA is unconfigured', () => {
      render(<SignInForm />);
      expect(screen.queryByTestId('captcha-widget')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
    });

    it('renders the challenge when configured', () => {
      configure('0x-site-key');
      render(<SignInForm />);
      expect(screen.getByTestId('captcha-widget')).toBeInTheDocument();
    });

    it('refuses to submit until the challenge is solved', async () => {
      configure('0x-site-key');
      render(<SignInForm />);
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'someone@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'CorrectHorse1!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(
        await screen.findByText(/complete the verification challenge/i)
      ).toBeInTheDocument();
    });
  });
});
