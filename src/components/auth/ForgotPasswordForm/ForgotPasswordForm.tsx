'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { validateEmail } from '@/lib/auth/email-validator';

export interface ForgotPasswordFormProps {
  /** Callback on success */
  onSuccess?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ForgotPasswordForm component
 * Send password reset email
 *
 * @category molecular
 */
export default function ForgotPasswordForm({
  onSuccess,
  className = '',
}: ForgotPasswordFormProps) {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setError(emailValidation.error);
      return;
    }

    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
    } else {
      setSuccess(true);
      onSuccess?.();
    }
  };

  if (success) {
    return (
      <div className="alert alert-success">
        <span>Password reset email sent! Check your inbox.</span>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-4${className ? ` ${className}` : ''}`}
    >
      <div className="form-control">
        <label className="label" htmlFor="email">
          <span className="label-text">Email</span>
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input input-bordered min-h-11"
          placeholder="you@example.com"
          required
          disabled={loading}
        />
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary min-h-11 w-full"
        disabled={loading}
      >
        {loading ? (
          <span className="loading loading-spinner loading-md"></span>
        ) : (
          'Send Reset Link'
        )}
      </button>
    </form>
  );
}
