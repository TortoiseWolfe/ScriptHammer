'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { validateEmail } from '@/lib/auth/email-validator';
import { RateLimiter } from '@/lib/auth/rate-limiter';

export interface SignInFormProps {
  /** Callback on successful sign in */
  onSuccess?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SignInForm component
 * Email/password sign-in with rate limiting
 *
 * @category molecular
 */
export default function SignInForm({
  onSuccess,
  className = '',
}: SignInFormProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rateLimiter] = useState(() => new RateLimiter(email, 5, 15));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setError(emailValidation.error);
      return;
    }

    // Check rate limit
    if (!rateLimiter.isAllowed()) {
      const remaining = rateLimiter.getRemainingAttempts();
      const resetTime = Math.ceil(rateLimiter.getTimeUntilReset() / 60000);
      setError(`Too many attempts. Try again in ${resetTime} minutes.`);
      return;
    }

    setLoading(true);

    const { error: signInError } = await signIn(email, password);

    setLoading(false);

    if (signInError) {
      rateLimiter.recordAttempt();
      setError(signInError.message);
    } else {
      rateLimiter.clear();
      onSuccess?.();
    }
  };

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

      <div className="form-control">
        <label className="label" htmlFor="password">
          <span className="label-text">Password</span>
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input input-bordered min-h-11"
          placeholder="••••••••"
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
          'Sign In'
        )}
      </button>
    </form>
  );
}
