import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';
import {
  EMAIL_QUOTA_MESSAGE,
  REQUEST_RATE_MESSAGE,
} from '@/lib/auth/auth-rate-limit';
import {
  setPendingConfirmationEmail,
  getPendingConfirmationEmail,
} from '@/lib/auth/pending-confirmation';
import ResendConfirmation, {
  RESEND_FAILED_MESSAGE,
  RESEND_SENT_MESSAGE,
} from './ResendConfirmation';

/**
 * The state production actually produces (#1352): nobody is signed in, because Auth refuses an
 * unconfirmed address a session. Every case here runs with `user: null` — the component tests
 * for the signed-in controls mock a user with `email_confirmed_at: null`, a state that cannot
 * exist, which is how this dead end went unseen.
 */

const { authState, resendMock, captchaState } = vi.hoisted(() => ({
  authState: { current: null as unknown as Record<string, unknown> },
  resendMock: vi.fn(),
  captchaState: { enabled: false },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState.current,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { resend: resendMock } }),
}));

vi.mock('@/config/captcha.config', () => ({
  get captchaConfig() {
    return {
      enabled: captchaState.enabled,
      siteKey: captchaState.enabled ? '0x-site-key' : '',
      provider: 'turnstile',
    };
  },
}));

vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: { onSuccess: (t: string) => void }) => (
    <button
      type="button"
      data-testid="turnstile-stub"
      onClick={() => onSuccess('tok-abc')}
    >
      solve
    </button>
  ),
}));

const ask = async (address?: string) => {
  const field = screen.getByLabelText(/email/i);
  if (address !== undefined) {
    await userEvent.clear(field);
    await userEvent.type(field, address);
  }
  await userEvent.click(
    screen.getByRole('button', { name: /resend the confirmation email/i })
  );
};

beforeEach(() => {
  window.sessionStorage.clear();
  captchaState.enabled = false;
  resendMock.mockReset();
  resendMock.mockResolvedValue({ error: null });
  authState.current = { user: null, isLoading: false };
});

describe('ResendConfirmation, with no session (#1352)', () => {
  it('offers the control to a visitor nobody has signed in, with no user mocked', () => {
    render(<ResendConfirmation />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /resend the confirmation email/i })
    ).toBeEnabled();
  });

  it('renders nothing for a signed-in user, whichever way their address stands', () => {
    for (const email_confirmed_at of [null, '2026-01-01T00:00:00Z']) {
      authState.current = {
        user: { id: '1', email: 'a@example.com', email_confirmed_at },
        isLoading: false,
      };
      const { container, unmount } = render(<ResendConfirmation />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it('renders nothing while the session is still loading', () => {
    authState.current = { user: null, isLoading: true };
    const { container } = render(<ResendConfirmation />);
    expect(container).toBeEmptyDOMElement();
  });

  describe('the address', () => {
    it('is prefilled from what the sign-up or sign-in form carried', async () => {
      setPendingConfirmationEmail('carried@example.com');
      render(<ResendConfirmation />);

      await waitFor(() =>
        expect(screen.getByLabelText(/email/i)).toHaveValue(
          'carried@example.com'
        )
      );
      await ask();

      expect(resendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'signup',
          email: 'carried@example.com',
        })
      );
    });

    it('starts empty when nothing was carried, and uses what is typed', async () => {
      render(<ResendConfirmation />);
      expect(screen.getByLabelText(/email/i)).toHaveValue('');

      await ask('typed@example.com');

      expect(resendMock).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'typed@example.com' })
      );
    });

    it('never goes anywhere near the URL', async () => {
      setPendingConfirmationEmail('carried@example.com');
      render(<ResendConfirmation />);
      await ask();
      expect(window.location.href).not.toContain('carried');
    });

    it('refuses an invalid address without asking Auth', async () => {
      render(<ResendConfirmation />);
      await ask('not-an-address');

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(resendMock).not.toHaveBeenCalled();
    });
  });

  describe('asking Auth', () => {
    it('lands the new link on the callback page, which redeems the PKCE code', async () => {
      render(<ResendConfirmation />);
      await ask('typed@example.com');

      expect(resendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            emailRedirectTo: expect.stringMatching(/\/auth\/callback\/$/),
          }),
        })
      );
    });

    it('sends the challenge token when CAPTCHA is on, and refuses without one', async () => {
      captchaState.enabled = true;
      render(<ResendConfirmation />);

      await ask('typed@example.com');
      expect(await screen.findByRole('alert')).toHaveTextContent(
        /verification challenge/i
      );
      expect(resendMock).not.toHaveBeenCalled();
      // The refusal must not leave the control stuck.
      expect(
        screen.getByRole('button', { name: /resend the confirmation email/i })
      ).toBeEnabled();

      await userEvent.click(screen.getByTestId('turnstile-stub'));
      await ask();
      expect(resendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ captchaToken: 'tok-abc' }),
        })
      );
    });
  });

  describe('says the same thing whether or not anything was sent', () => {
    // GoTrue answers 200 for an address with no account, an account already confirmed and an
    // account waiting alike. The page must not be the thing that tells them apart.
    it('shows one sentence on success, and it claims no send', async () => {
      render(<ResendConfirmation />);
      await ask('anyone@example.com');

      const status = await screen.findByText(RESEND_SENT_MESSAGE);
      expect(status).toBeInTheDocument();
      expect(RESEND_SENT_MESSAGE).toMatch(/^If that address/);
      expect(RESEND_SENT_MESSAGE).not.toMatch(
        /\b(sent to you|we sent|no account|not found|already confirmed)\b/i
      );
    });

    it('shows the identical text for two different addresses', async () => {
      const texts: string[] = [];
      for (const address of [
        'registered@example.com',
        'stranger@example.com',
      ]) {
        const { unmount } = render(<ResendConfirmation />);
        await ask(address);
        await screen.findByRole('status');
        await waitFor(() =>
          expect(screen.getByRole('status')).not.toBeEmptyDOMElement()
        );
        texts.push(screen.getByRole('status').textContent ?? '');
        unmount();
      }
      expect(texts[0]).toBe(texts[1]);
      expect(texts[0]).toBe(RESEND_SENT_MESSAGE);
    });

    it('names a rate limit, because that says nothing about the account', async () => {
      resendMock.mockResolvedValueOnce({
        error: new AuthApiError('slow down', 429, 'over_request_rate_limit'),
      });
      render(<ResendConfirmation />);
      await ask('anyone@example.com');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        REQUEST_RATE_MESSAGE
      );
      expect(screen.queryByText(RESEND_SENT_MESSAGE)).not.toBeInTheDocument();
    });

    it('names the email quota the same way', async () => {
      resendMock.mockResolvedValueOnce({
        error: new AuthApiError('quota', 429, 'over_email_send_rate_limit'),
      });
      render(<ResendConfirmation />);
      await ask('anyone@example.com');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        EMAIL_QUOTA_MESSAGE
      );
    });

    it('gives every other failure one sentence that echoes nothing from Auth', async () => {
      resendMock.mockResolvedValueOnce({
        error: new AuthApiError('User not found', 400, 'user_not_found'),
      });
      render(<ResendConfirmation />);
      await ask('anyone@example.com');

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(RESEND_FAILED_MESSAGE);
      expect(alert).not.toHaveTextContent(/not found/i);
      expect(screen.queryByText(RESEND_SENT_MESSAGE)).not.toBeInTheDocument();
      // And the control comes back, or the person has no retry.
      expect(
        screen.getByRole('button', { name: /resend the confirmation email/i })
      ).toBeEnabled();
    });
  });

  it('leaves the carried address in place so a second send works', async () => {
    setPendingConfirmationEmail('carried@example.com');
    render(<ResendConfirmation />);
    await waitFor(() =>
      expect(screen.getByLabelText(/email/i)).toHaveValue('carried@example.com')
    );
    await ask();
    await screen.findByText(RESEND_SENT_MESSAGE);
    await ask();

    expect(resendMock).toHaveBeenCalledTimes(2);
    expect(getPendingConfirmationEmail()).toBe('carried@example.com');
  });
});
