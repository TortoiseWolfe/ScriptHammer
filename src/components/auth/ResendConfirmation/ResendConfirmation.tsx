'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getRedirectUrl } from '@/config/project.config';
import CaptchaWidget, {
  type CaptchaWidgetHandle,
} from '@/components/auth/CaptchaWidget';
import { captchaConfig } from '@/config/captcha.config';
import { validateEmail } from '@/lib/auth/email-validator';
import { authRateLimitMessage } from '@/lib/auth/auth-rate-limit';
import { getPendingConfirmationEmail } from '@/lib/auth/pending-confirmation';

export interface ResendConfirmationProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * What anyone is told after asking, whether or not an account exists at the address or is
 * waiting on confirmation. GoTrue answers the same either way, and so must this: a different
 * sentence for "no such account" would let anyone test which addresses are registered.
 */
export const RESEND_SENT_MESSAGE =
  'If that address is waiting to be confirmed, a new link is on its way. Check your inbox.';

export const RESEND_FAILED_MESSAGE =
  "We couldn't send that just now. Please try again in a minute.";

/**
 * Ask for a new confirmation email without being signed in (#1352).
 *
 * Production refuses an unconfirmed sign-in, so a person whose emailed link expired or never
 * arrived has no session, and the two "Resend" controls that need one (EmailVerificationNotice,
 * MessagingGate) never render for them. This is the control for that person: it needs only the
 * address. The address is carried here in sessionStorage by the sign-up form and by the
 * sign-in form's "Email not confirmed" branch; with nothing carried the field starts empty.
 *
 * Renders nothing once someone is signed in. An unconfirmed signed-in user is
 * EmailVerificationNotice's, and a confirmed one has nothing to resend.
 *
 * @category auth
 */
export default function ResendConfirmation({
  className = '',
}: ResendConfirmationProps) {
  const supabase = createClient();
  const { user, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  // (#353) SECURITY_CAPTCHA_ENABLED is global to Supabase auth — resending a
  // confirmation is gated the same as sign-in and sign-up.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<CaptchaWidgetHandle>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // After mount, not in the initial state: the page is statically exported, and
  // sessionStorage does not exist when it is prerendered.
  useEffect(() => {
    const carried = getPendingConfirmationEmail();
    if (carried) setEmail(carried);
  }, []);

  if (isLoading || user) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSent(false);

    const validation = validateEmail(email);
    if (!validation.valid) {
      setError(validation.errors[0] || 'Invalid email address');
      return;
    }

    // Check the challenge BEFORE entering the loading state; returning early afterwards
    // would leave the button stuck and disabled.
    if (captchaConfig.enabled && !captchaToken) {
      setError('Please complete the verification challenge.');
      return;
    }

    setLoading(true);

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        captchaToken: captchaToken ?? undefined,
        // The callback page redeems the PKCE code this browser stores when the request is made
        // (auth-js 2.117, #1298), so the link signs the person in if opened here.
        emailRedirectTo: getRedirectUrl('/auth/callback'),
      },
    });

    setLoading(false);
    // Turnstile tokens are single-use: the next send needs a fresh one.
    captchaRef.current?.reset();

    if (resendError) {
      // A rate limit may be named. Nothing else is: every other failure gets one sentence
      // that does not depend on what is, or is not, registered at the address.
      setError(authRateLimitMessage(resendError) ?? RESEND_FAILED_MESSAGE);
      return;
    }
    setSent(true);
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`alert alert-warning grid-flow-row grid-cols-1 items-stretch justify-items-stretch gap-3${className ? ` ${className}` : ''}`}
    >
      <p>Link expired or never arrived? Ask for a new one.</p>
      <div className="flex flex-col gap-2">
        <label className="label" htmlFor="resend-confirmation-email">
          <span className="label-text">Email</span>
        </label>
        <input
          id="resend-confirmation-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input input-bordered min-h-11 w-full"
          placeholder="you@example.com"
          autoComplete="email"
          required
          disabled={loading}
        />
      </div>
      <CaptchaWidget ref={captchaRef} onToken={setCaptchaToken} />
      <button
        type="submit"
        className="btn btn-sm min-h-11 min-w-11"
        disabled={loading}
      >
        {loading ? (
          <span className="loading loading-spinner loading-sm"></span>
        ) : (
          'Resend the confirmation email'
        )}
      </button>
      <div role="status" aria-live="polite">
        {sent && <span>{RESEND_SENT_MESSAGE}</span>}
      </div>
      {error && (
        <span className="text-error" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}
