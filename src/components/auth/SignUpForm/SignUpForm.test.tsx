import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import {
  EMAIL_QUOTA_MESSAGE,
  REQUEST_RATE_MESSAGE,
} from '@/lib/auth/auth-rate-limit';
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

// The setup file's useAuth returns a fresh spy per render, so no test can make sign-up fail.
// Same shape as that mock, with the one method these cases drive held where they can reach it.
const auth = vi.hoisted(() => ({
  signUp: vi.fn(async (..._args: unknown[]) => ({ error: null as unknown })),
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
    signIn: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    refreshSession: vi.fn(async () => {}),
    signUp: auth.signUp,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const rpcNames = () =>
  vi.mocked(supabase.rpc).mock.calls.map(([name]) => name as string);

const submitValidSignUp = async () => {
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'someone@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'CorrectHorse1!' },
  });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: 'CorrectHorse1!' },
  });
  fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
  return screen.findByRole('alert');
};

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

  // #1245 stage A2: no email-keyed limiter before or after the call. Sign-up sends mail, so
  // its 429 is usually the project's email quota — which minutes of waiting will not clear.
  describe("rate limits are Supabase Auth's, and only reported here (#1245)", () => {
    beforeEach(() => {
      auth.signUp.mockReset();
      auth.signUp.mockResolvedValue({ error: null });
      vi.mocked(supabase.rpc).mockClear();
    });

    it('names the email quota when that is the limit that refused', async () => {
      auth.signUp.mockResolvedValueOnce({
        error: new AuthApiError(
          'Email rate limit exceeded',
          429,
          'over_email_send_rate_limit'
        ),
      });
      render(<SignUpForm />);
      expect(await submitValidSignUp()).toHaveTextContent(EMAIL_QUOTA_MESSAGE);
    });

    it('names the request ceiling for any other 429', async () => {
      auth.signUp.mockResolvedValueOnce({
        error: new AuthApiError(
          'Request rate limit reached',
          429,
          'over_request_rate_limit'
        ),
      });
      render(<SignUpForm />);
      expect(await submitValidSignUp()).toHaveTextContent(REQUEST_RATE_MESSAGE);
    });

    it('a failed sign-up neither consults nor feeds the email-keyed limiter', async () => {
      auth.signUp.mockResolvedValueOnce({
        error: new AuthApiError(
          'User already registered',
          422,
          'user_already_exists'
        ),
      });
      render(<SignUpForm />);
      // CONTROL for the message path: an ordinary refusal still says what Auth said.
      expect(await submitValidSignUp()).toHaveTextContent(
        /^User already registered$/
      );
      // Audited through rpc, which proves this spy sees the form's calls at all.
      await vi.waitFor(() => expect(rpcNames()).toContain('log_auth_event'));
      expect(rpcNames()).not.toContain('check_rate_limit');
      expect(rpcNames()).not.toContain('record_failed_attempt');
    });
  });
});
