'use client';

import React, { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import CaptchaWidget, {
  type CaptchaWidgetHandle,
} from '@/components/auth/CaptchaWidget';
import { captchaConfig } from '@/config/captcha.config';

export interface EmailVerificationNoticeProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * EmailVerificationNotice component
 * Resend verification email notice
 *
 * @category molecular
 */
export default function EmailVerificationNotice({
  className = '',
}: EmailVerificationNoticeProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  // (#353) SECURITY_CAPTCHA_ENABLED is global to Supabase auth — resending a
  // confirmation is gated the same as sign-in and sign-up.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<CaptchaWidgetHandle>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resendVerification = async () => {
    if (!user?.email) return;

    setLoading(true);
    setError(null);

    if (captchaConfig.enabled && !captchaToken) {
      setError('Please complete the verification challenge.');
      return;
    }

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
      options: { captchaToken: captchaToken ?? undefined },
    });

    setLoading(false);

    if (resendError) {
      captchaRef.current?.reset();
      setError(resendError.message);
    } else {
      setSuccess(true);
    }
  };

  if (!user || user.email_confirmed_at) {
    return null;
  }

  if (success) {
    return (
      <div className={`alert alert-success${className ? ` ${className}` : ''}`}>
        <span>Verification email sent! Check your inbox.</span>
      </div>
    );
  }

  return (
    <div className={`alert alert-warning${className ? ` ${className}` : ''}`}>
      <span>Please verify your email address.</span>
      <CaptchaWidget ref={captchaRef} onToken={setCaptchaToken} />
      <button
        onClick={resendVerification}
        className="btn btn-sm min-h-11 min-w-11"
        disabled={loading}
      >
        {loading ? (
          <span className="loading loading-spinner loading-sm"></span>
        ) : (
          'Resend'
        )}
      </button>
      {error && <span className="text-error">{error}</span>}
    </div>
  );
}
