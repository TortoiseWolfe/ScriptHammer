'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { validatePassword } from '@/lib/auth/password-validator';
import { logAuthEvent } from '@/lib/auth/audit-logger';
import AvatarDisplay from '@/components/atomic/AvatarDisplay';
import AvatarUpload from '@/components/atomic/AvatarUpload';
import { removeAvatar } from '@/lib/avatar/upload';

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
  const { user, refreshSession } = useAuth();
  const [username, setUsername] = useState(user?.user_metadata?.username || '');
  const [bio, setBio] = useState(user?.user_metadata?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    (user?.user_metadata?.avatar_url as string) || null
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

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
      // Log failed password change (T035)
      if (user) {
        await logAuthEvent({
          user_id: user.id,
          event_type: 'password_change',
          success: false,
          error_message: updateError.message,
        });
      }

      setError(updateError.message);
    } else {
      // Log successful password change (T035)
      if (user) {
        await logAuthEvent({
          user_id: user.id,
          event_type: 'password_change',
        });
      }

      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !confirm(
        'Are you sure you want to delete your account? This cannot be undone.'
      )
    ) {
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

  const handleAvatarUploadComplete = async (url: string) => {
    setAvatarUrl(url);
    await refreshSession(); // Refresh to get updated user metadata
  };

  const handleRemoveAvatar = async () => {
    if (!confirm('Are you sure you want to remove your avatar?')) {
      return;
    }

    setError(null);
    setRemovingAvatar(true);

    const result = await removeAvatar();

    setRemovingAvatar(false);

    if (result.error) {
      setError(result.error);
    } else {
      setAvatarUrl(null);
      await refreshSession(); // Refresh to get updated user metadata
    }
  };

  return (
    <div className={`space-y-6${className ? ` ${className}` : ''}`}>
      {/* Profile Settings */}
      <form onSubmit={handleUpdateProfile} className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title">Profile Settings</h3>
          <div className="form-control">
            <label htmlFor="username-input" className="label">
              <span className="label-text">Username</span>
            </label>
            <input
              id="username-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input input-bordered min-h-11"
              disabled={loading}
            />
          </div>
          <div className="form-control">
            <label htmlFor="bio-textarea" className="label">
              <span className="label-text">Bio</span>
            </label>
            <textarea
              id="bio-textarea"
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

      {/* Avatar Settings */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title">Profile Picture</h3>

          {/* Current Avatar Display */}
          <div className="mb-4 flex flex-col items-center gap-4 sm:flex-row">
            <AvatarDisplay
              avatarUrl={avatarUrl}
              displayName={username || user?.email || 'User'}
              size="xl"
            />
            <div className="text-sm opacity-70">
              {avatarUrl ? (
                <p>Your current profile picture</p>
              ) : (
                <p>
                  No profile picture set. Upload one to personalize your
                  account.
                </p>
              )}
            </div>
          </div>

          {/* Upload Avatar */}
          <AvatarUpload onUploadComplete={handleAvatarUploadComplete} />

          {/* Remove Avatar Button */}
          {avatarUrl && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="btn btn-error btn-outline min-h-11"
              disabled={removingAvatar}
              aria-label="Remove avatar"
            >
              {removingAvatar ? 'Removing...' : 'Remove Avatar'}
            </button>
          )}
        </div>
      </div>

      {/* Password Change */}
      <form onSubmit={handleChangePassword} className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title">Change Password</h3>
          <div className="form-control">
            <label htmlFor="new-password-input" className="label">
              <span className="label-text">New Password</span>
            </label>
            <input
              id="new-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input input-bordered min-h-11"
              disabled={loading}
            />
          </div>
          <div className="form-control">
            <label htmlFor="confirm-password-input" className="label">
              <span className="label-text">Confirm Password</span>
            </label>
            <input
              id="confirm-password-input"
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
