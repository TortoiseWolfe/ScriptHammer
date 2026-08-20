import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EmailVerificationNotice from './EmailVerificationNotice';

/**
 * This component had no real coverage, in either layer, despite two test files and
 * a green suite (#850).
 *
 * The E2E that nominally covered it — `protected-routes.spec.ts` "should show email
 * verification notice for unverified users" — ran ZERO assertions on every shard, and
 * could never have run any: **an unverified user cannot hold a session.** Probed
 * directly against GoTrue, `admin.createUser({ email_confirm: false })` succeeds and
 * the subsequent `signInWithPassword` is rejected with "Email not confirmed". So the
 * only state in which this component renders anything is unreachable through the UI,
 * and the E2E's `if (isNoticeVisible)` guard was false by construction. It has been
 * deleted rather than left as decoration.
 *
 * The unit test that remained was a single "renders without crashing" that leaned on
 * the global AuthContext mock happening to set `email_confirmed_at: null`. It asserted
 * the notice appears; it never asserted the far more important half — that the notice
 * STAYS AWAY from verified users. A component that always announced "please verify your
 * email" would have passed it.
 *
 * These cases pin both directions plus the resend outcomes, at the layer that can
 * actually reach them.
 */

const { authState, resendMock } = vi.hoisted(() => ({
  authState: { current: null as unknown as Record<string, unknown> },
  resendMock: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState.current,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { resend: resendMock } }),
}));

// Pinned OFF deliberately. `captcha.config.ts` derives `enabled: Boolean(siteKey)`
// from NEXT_PUBLIC_CAPTCHA_SITE_KEY, so whether these tests reach `supabase.auth
// .resend()` at all would otherwise depend on whoever's .env the suite picked up —
// with a key present the component returns early on "complete the verification
// challenge" and every resend assertion below silently tests nothing. The captcha
// branch is a separate concern with its own coverage (#353).
vi.mock('@/config/captcha.config', () => ({
  captchaConfig: { enabled: false, siteKey: '', provider: 'none' },
}));

const unverifiedUser = {
  id: '123',
  email: 'unverified@example.com',
  email_confirmed_at: null,
};

beforeEach(() => {
  resendMock.mockReset();
  resendMock.mockResolvedValue({ error: null });
  authState.current = { user: unverifiedUser };
});

describe('EmailVerificationNotice', () => {
  it('prompts an unverified user to verify, with a way to act on it', async () => {
    render(<EmailVerificationNotice />);

    expect(
      screen.getByText(/please verify your email address/i)
    ).toBeInTheDocument();

    // The prompt is useless without the affordance. Asserting only the text would
    // pass against a notice that tells you to do something you cannot do.
    expect(screen.getByRole('button', { name: /resend/i })).toBeEnabled();
  });

  it('renders NOTHING for a verified user', () => {
    authState.current = {
      user: { ...unverifiedUser, email_confirmed_at: '2026-01-01T00:00:00Z' },
    };

    const { container } = render(<EmailVerificationNotice />);

    // The direction the old test could not fail on. A component that always nagged
    // every signed-in user would have passed "renders without crashing".
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/please verify/i)).not.toBeInTheDocument();
  });

  it('renders NOTHING when there is no user at all', () => {
    authState.current = { user: null };

    const { container } = render(<EmailVerificationNotice />);

    expect(container).toBeEmptyDOMElement();
  });

  it('confirms the email was sent, and asks Supabase for the right thing', async () => {
    render(<EmailVerificationNotice />);

    await userEvent.click(screen.getByRole('button', { name: /resend/i }));

    await waitFor(() =>
      expect(screen.getByText(/verification email sent/i)).toBeInTheDocument()
    );

    // Pin the call itself. A resend that silently targeted the wrong address or the
    // wrong flow type would still have flipped the success banner.
    expect(resendMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'signup', email: unverifiedUser.email })
    );
  });

  it('surfaces a resend failure instead of claiming success', async () => {
    resendMock.mockResolvedValue({ error: { message: 'rate limit exceeded' } });

    render(<EmailVerificationNotice />);
    await userEvent.click(screen.getByRole('button', { name: /resend/i }));

    await waitFor(() =>
      expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument()
    );

    // The failure must not be reported as a send.
    expect(
      screen.queryByText(/verification email sent/i)
    ).not.toBeInTheDocument();
    // And the button must come back, or the user is stuck with no retry.
    expect(screen.getByRole('button', { name: /resend/i })).toBeEnabled();
  });
});
