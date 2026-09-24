import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { REQUEST_RATE_MESSAGE } from '@/lib/auth/auth-rate-limit';
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

// The setup file's useAuth returns a fresh spy per render, so no test can make sign-in fail.
// Same shape as that mock, with the one method these cases drive held where they can reach it.
const auth = vi.hoisted(() => ({
  signIn: vi.fn(async (..._args: unknown[]) => ({ error: null as unknown })),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: '123',
      email: 'test@example.com',
      user_metadata: { username: 'testuser' },
      email_confirmed_at: null,
    },
    session: { access_token: 'mock-token' },
    isLoading: false,
    isAuthenticated: true,
    signUp: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    refreshSession: vi.fn(async () => {}),
    signIn: auth.signIn,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const rpcNames = () =>
  vi.mocked(supabase.rpc).mock.calls.map(([name]) => name as string);

const submitWrongPassword = async () => {
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'someone@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'not-their-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
  return screen.findByRole('alert');
};

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

  // #1245 stage A2. The form used to ask an email-keyed limiter before calling Auth, and tell
  // it about every failure — which is how five anonymous calls could lock anyone out. The
  // only limit a person can meet now is Supabase Auth's, and it must read as one.
  describe("rate limits are Supabase Auth's, and only reported here (#1245)", () => {
    beforeEach(() => {
      auth.signIn.mockReset();
      auth.signIn.mockResolvedValue({ error: null });
      vi.mocked(supabase.rpc).mockClear();
    });

    it('reports a GoTrue 429 as a rate limit, not as its raw message', async () => {
      auth.signIn.mockResolvedValueOnce({
        error: new AuthApiError(
          'Request rate limit reached',
          429,
          'over_request_rate_limit'
        ),
      });
      render(<SignInForm />);
      expect(await submitWrongPassword()).toHaveTextContent(
        REQUEST_RATE_MESSAGE
      );
    });

    it('CONTROL: a wrong password shows exactly what Auth said, with no lockout countdown', async () => {
      auth.signIn.mockResolvedValueOnce({
        error: new AuthApiError(
          'Invalid login credentials',
          400,
          'invalid_credentials'
        ),
      });
      render(<SignInForm />);
      expect(await submitWrongPassword()).toHaveTextContent(
        /^Invalid login credentials$/
      );
    });

    it('a failed sign-in neither consults nor feeds the email-keyed limiter', async () => {
      auth.signIn.mockResolvedValueOnce({
        error: new AuthApiError(
          'Invalid login credentials',
          400,
          'invalid_credentials'
        ),
      });
      render(<SignInForm />);
      await submitWrongPassword();
      // The failure is still audited through rpc — which is what proves this spy sees the
      // form's calls at all, rather than passing because it sees none.
      await vi.waitFor(() => expect(rpcNames()).toContain('log_auth_event'));
      expect(rpcNames()).not.toContain('check_rate_limit');
      expect(rpcNames()).not.toContain('record_failed_attempt');
    });
  });
});
