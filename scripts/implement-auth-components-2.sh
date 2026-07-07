#!/bin/bash
# Implement remaining auth components

# Email Verification Notice (T045)
cat > src/components/auth/EmailVerificationNotice/EmailVerificationNotice.tsx << 'EOF'
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
EOF

# User Profile Card (T046)
cat > src/components/auth/UserProfileCard/UserProfileCard.tsx << 'EOF'
'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface UserProfileCardProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * UserProfileCard component
 * Display user profile information
 *
 * @category molecular
 */
export default function UserProfileCard({
  className = '',
}: UserProfileCardProps) {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className={`card bg-base-200${className ? ` ${className}` : ''}`}>
      <div className="card-body">
        <div className="flex items-center gap-4">
          <div className="avatar placeholder">
            <div className="w-16 rounded-full bg-neutral text-neutral-content">
              <span className="text-xl">
                {user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="card-title">{user.user_metadata?.username || 'User'}</h3>
            <p className="text-sm opacity-70">{user.email}</p>
            {user.user_metadata?.bio && (
              <p className="mt-2 text-sm">{user.user_metadata.bio}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
EOF

# Account Settings (T047)
cat > src/components/auth/AccountSettings/AccountSettings.tsx << 'EOF'
'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { validatePassword } from '@/lib/auth/password-validator';

export interface AccountSettingsProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * AccountSettings component
 * Update profile, change password, delete account
 *
 * @category molecular
 */
export default function AccountSettings({
  className = '',
}: AccountSettingsProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const [username, setUsername] = useState(user?.user_metadata?.username || '');
  const [bio, setBio] = useState(user?.user_metadata?.bio || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      data: { username, bio },
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.error);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
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
      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This cannot be undone.')) {
      return;
    }

    setError(null);
    setLoading(true);

    const { error: deleteError } = await supabase.rpc('delete_user');

    setLoading(false);

    if (deleteError) {
      setError(deleteError.message);
    }
  };

  return (
    <div className={`space-y-6${className ? ` ${className}` : ''}`}>
      {/* Profile Settings */}
      <form onSubmit={handleUpdateProfile} className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title">Profile Settings</h3>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Username</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input input-bordered min-h-11"
              disabled={loading}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Bio</span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="textarea textarea-bordered"
              rows={3}
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary min-h-11"
            disabled={loading}
          >
            Update Profile
          </button>
        </div>
      </form>

      {/* Password Change */}
      <form onSubmit={handleChangePassword} className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title">Change Password</h3>
          <div className="form-control">
            <label className="label">
              <span className="label-text">New Password</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input input-bordered min-h-11"
              disabled={loading}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Confirm Password</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input input-bordered min-h-11"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary min-h-11"
            disabled={loading}
          >
            Change Password
          </button>
        </div>
      </form>

      {/* Delete Account */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title text-error">Danger Zone</h3>
          <p className="text-sm opacity-70">
            Once you delete your account, there is no going back.
          </p>
          <button
            onClick={handleDeleteAccount}
            className="btn btn-error min-h-11"
            disabled={loading}
          >
            Delete Account
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <span>Settings updated successfully!</span>
        </div>
      )}
    </div>
  );
}
EOF

# ProtectedRoute Component (T048) - redirect wrapper
cat > src/components/auth/ProtectedRoute/ProtectedRoute.tsx << 'EOF'
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface ProtectedRouteProps {
  /** Children to render if authenticated */
  children: React.ReactNode;
  /** Redirect path if not authenticated */
  redirectTo?: string;
}

/**
 * ProtectedRoute component
 * Wraps children and redirects to sign-in if not authenticated
 *
 * @category molecular
 */
export default function ProtectedRoute({
  children,
  redirectTo = '/auth/sign-in',
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
EOF

# AuthGuard Component (T049) - redirect for unverified users
cat > src/components/auth/AuthGuard/AuthGuard.tsx << 'EOF'
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface AuthGuardProps {
  /** Children to render if verified */
  children: React.ReactNode;
  /** Require email verification */
  requireVerification?: boolean;
  /** Redirect path if not verified */
  redirectTo?: string;
}

/**
 * AuthGuard component
 * Redirects unverified users
 *
 * @category molecular
 */
export default function AuthGuard({
  children,
  requireVerification = true,
  redirectTo = '/verify-email',
}: AuthGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && requireVerification && !user.email_confirmed_at) {
      router.push(redirectTo);
    }
  }, [user, isLoading, requireVerification, router, redirectTo]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (requireVerification && user && !user.email_confirmed_at) {
    return null;
  }

  return <>{children}</>;
}
EOF

echo "Remaining auth component implementations complete"
