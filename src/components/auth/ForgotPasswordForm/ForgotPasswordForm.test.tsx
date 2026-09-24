import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { EMAIL_QUOTA_MESSAGE } from '@/lib/auth/auth-rate-limit';
import ForgotPasswordForm from './ForgotPasswordForm';

const rpcNames = () =>
  vi.mocked(supabase.rpc).mock.calls.map(([name]) => name as string);

const requestReset = async () => {
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'someone@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
  return screen.findByRole('alert');
};

describe('ForgotPasswordForm', () => {
  it('renders without crashing', () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /send reset link/i })
    ).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-class';
    const { container } = render(
      <ForgotPasswordForm className={customClass} />
    );
    const form = container.querySelector('form');
    expect(form).toHaveClass(customClass);
  });

  // #1245 stage A2. The reset form used to consult an email-keyed limiter first, which let
  // anyone stop someone else from resetting their own password.
  describe("rate limits are Supabase Auth's, and only reported here (#1245)", () => {
    beforeEach(() => {
      vi.mocked(supabase.rpc).mockClear();
    });

    it('names the email quota when Auth refuses to send', async () => {
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
        data: null,
        error: new AuthApiError(
          'Email rate limit exceeded',
          429,
          'over_email_send_rate_limit'
        ),
      });
      render(<ForgotPasswordForm />);
      expect(await requestReset()).toHaveTextContent(EMAIL_QUOTA_MESSAGE);
    });

    it('a refused reset neither consults nor feeds the email-keyed limiter', async () => {
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
        data: null,
        error: new AuthApiError('Unable to process request', 400, undefined),
      });
      render(<ForgotPasswordForm />);
      // CONTROL for the message path: an ordinary refusal still says what Auth said.
      expect(await requestReset()).toHaveTextContent(
        /^Unable to process request$/
      );
      // Audited through rpc, which proves this spy sees the form's calls at all.
      await vi.waitFor(() => expect(rpcNames()).toContain('log_auth_event'));
      expect(rpcNames()).not.toContain('check_rate_limit');
      expect(rpcNames()).not.toContain('record_failed_attempt');
    });
  });
});
