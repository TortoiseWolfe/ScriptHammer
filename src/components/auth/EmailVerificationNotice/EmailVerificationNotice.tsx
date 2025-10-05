'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resendVerification = async () => {
    if (!user?.email) return;

    setLoading(true);
    setError(null);

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
    });

    setLoading(false);

    if (resendError) {
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
