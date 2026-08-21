'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { validatePassword } from '@/lib/auth/password-validator';

export interface ResetPasswordFormProps {
  /** Callback on success */
  onSuccess?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ResetPasswordForm component
 * Reset password with token validation
 *
 * @category molecular
 */
export default function ResetPasswordForm({
  onSuccess,
  className = '',
}: ResetPasswordFormProps) {
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  /**
   * The error for ONE named field, kept apart from `error` (#867, same shape as #857).
   *
   * TWO conditions here were funnelled into one form-level alert with no `id`: a password
   * that fails `validatePassword`, and a confirmation that does not match. Neither input
   * carried `aria-invalid` or `aria-describedby`, so "Passwords do not match" was
   * announced with nothing saying which of the two boxes to fix.
   *
   * The Supabase update failure stays form-level — it is not about one field.
   */
  const [fieldError, setFieldError] = useState<{
    field: 'password' | 'confirmPassword';
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setFieldError({
        field: 'password',
        // `error` is `string | null` on the validator's result; the field message is
        // not optional, so an invalid password without a message still says something.
        message:
          passwordValidation.error ?? 'Password does not meet the requirements',
      });
      return;
    }

    if (password !== confirmPassword) {
      // Announced against the CONFIRMATION box, not the password: that is the one the
      // user is being asked to change.
      setFieldError({
        field: 'confirmPassword',
        message: 'Passwords do not match',
      });
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      onSuccess?.();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-4${className ? ` ${className}` : ''}`}
    >
      <div>
        <label className="label" htmlFor="password">
          <span>New Password</span>
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`input min-h-11 ${
            fieldError?.field === 'password' ? 'input-error' : ''
          }`}
          placeholder="••••••••"
          required
          disabled={loading}
          aria-invalid={fieldError?.field === 'password'}
          aria-describedby={
            fieldError?.field === 'password' ? 'password-error' : undefined
          }
        />
        {fieldError?.field === 'password' && (
          <div className="label" id="password-error">
            <span className="text-error" role="alert" aria-live="polite">
              {fieldError.message}
            </span>
          </div>
        )}
      </div>

      <div>
        <label className="label" htmlFor="confirm-password">
          <span>Confirm Password</span>
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={`input min-h-11 ${
            fieldError?.field === 'confirmPassword' ? 'input-error' : ''
          }`}
          placeholder="••••••••"
          required
          disabled={loading}
          aria-invalid={fieldError?.field === 'confirmPassword'}
          aria-describedby={
            fieldError?.field === 'confirmPassword'
              ? 'confirm-password-error'
              : undefined
          }
        />
        {fieldError?.field === 'confirmPassword' && (
          <div className="label" id="confirm-password-error">
            <span className="text-error" role="alert" aria-live="polite">
              {fieldError.message}
            </span>
          </div>
        )}
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
          'Reset Password'
        )}
      </button>
    </form>
  );
}
