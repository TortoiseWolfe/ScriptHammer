/**
 * What the auth callback does with a link it cannot redeem (#1255).
 *
 * Sign-in links are now bound to the browser that asked for them: a `?code=` is redeemable
 * only with the verifier stored when the flow started, and tokens handed over in the URL are
 * never consumed. So a real user can arrive here WITHOUT being signed in — a confirmation
 * email opened on their phone, a link clicked after the five-minute window, a resent link.
 * GoTrue has already confirmed their address by then; what they need is to be told so and sent
 * to sign in, not a spinner followed by a silent bounce.
 *
 * A link carrying someone else's session must also not leave that session sitting in the
 * address bar and history, so the page strips it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { authState, push } = vi.hoisted(() => ({
  authState: {
    user: null as null | { id: string; email: string },
    isLoading: false,
  },
  push: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: push }),
}));
vi.mock('@/lib/auth/oauth-utils', () => ({
  isOAuthUser: () => false,
  populateOAuthProfile: vi.fn(),
}));

import AuthCallbackPage from './page';

const TOKENS =
  'access_token=AT&expires_in=3600&refresh_token=RT&token_type=bearer&type=signup';

beforeEach(() => {
  push.mockReset();
  authState.user = null;
  authState.isLoading = false;
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('auth callback: links this browser cannot redeem (#1255)', () => {
  it('tells someone holding an unredeemable code to sign in, instead of bouncing them', async () => {
    window.history.replaceState(null, '', '/auth/callback/?code=abc');

    render(<AuthCallbackPage />);

    expect(
      await screen.findByRole('heading', { name: /sign in to continue/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/confirmed/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/sign-in\/?$/)
    );
    // Held long enough for the old 2-second fallback to have fired: nothing navigates.
    await new Promise((r) => setTimeout(r, 2100));
    expect(push).not.toHaveBeenCalled();
  });

  it('does not sign anyone in from tokens in the fragment, and strips them from the URL', async () => {
    window.history.replaceState(null, '', `/auth/callback/#${TOKENS}`);

    render(<AuthCallbackPage />);

    expect(
      await screen.findByRole('heading', { name: /sign in to continue/i })
    ).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe(''));
    expect(window.location.href).not.toContain('access_token');
    expect(window.location.pathname).toBe('/auth/callback/');
  });

  it('control: a redeemed link still goes to the profile', async () => {
    window.history.replaceState(null, '', '/auth/callback/');
    authState.user = { id: 'u1', email: 'someone@example.com' };

    render(<AuthCallbackPage />);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/profile'));
    expect(
      screen.queryByRole('heading', { name: /sign in to continue/i })
    ).not.toBeInTheDocument();
  });

  it('control: an error from the provider is still shown as an error', async () => {
    window.history.replaceState(
      null,
      '',
      '/auth/callback/#error=access_denied&error_description=User+cancelled'
    );

    render(<AuthCallbackPage />);

    expect(
      await screen.findByText(/authentication error/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/user cancelled/i)).toBeInTheDocument();
  });
});
