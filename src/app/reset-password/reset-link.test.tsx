/**
 * What the password-reset page shows when its link could not sign anyone in (#1255).
 *
 * A reset link is now redeemable only in the browser that requested it, and GoTrue expires the
 * flow five minutes after the request. Before this, the page rendered the new-password form no
 * matter what; with no session behind it, submitting answered "Auth session missing!" — after
 * the person had already chosen and typed a new password twice.
 *
 * So: with a session, the form. Without one once auth has settled, an explanation and a way to
 * request a fresh link.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { authState } = vi.hoisted(() => ({
  authState: { user: null as null | { id: string }, isLoading: false },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

import ResetPasswordPage from './page';

beforeEach(() => {
  authState.user = null;
  authState.isLoading = false;
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('reset-password page (#1255)', () => {
  it('explains a link this browser cannot redeem and offers a new one', async () => {
    window.history.replaceState(null, '', '/reset-password/?code=abc');

    render(<ResetPasswordPage />);

    expect(
      await screen.findByText(/only works in the browser/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /request a new link/i })
    ).toHaveAttribute('href', expect.stringMatching(/\/forgot-password\/?$/));
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
  });

  it('asks for the emailed link when someone arrives with none', async () => {
    window.history.replaceState(null, '', '/reset-password/');

    render(<ResetPasswordPage />);

    expect(
      await screen.findByRole('link', { name: /request a new link/i })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
  });

  it('strips a session handed over in the fragment', async () => {
    window.history.replaceState(
      null,
      '',
      '/reset-password/#access_token=AT&refresh_token=RT&expires_in=3600&token_type=bearer&type=recovery'
    );

    render(<ResetPasswordPage />);

    await waitFor(() => expect(window.location.hash).toBe(''));
    expect(window.location.pathname).toBe('/reset-password/');
  });

  it('control: a redeemed link gets the form', () => {
    window.history.replaceState(null, '', '/reset-password/');
    authState.user = { id: 'u1' };

    render(<ResetPasswordPage />);

    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /request a new link/i })
    ).not.toBeInTheDocument();
  });

  it('control: the form is on the page while auth is still settling', () => {
    // The static HTML carries the form, and the signed-in case must not flash an error.
    window.history.replaceState(null, '', '/reset-password/?code=abc');
    authState.isLoading = true;

    render(<ResetPasswordPage />);

    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
  });
});
