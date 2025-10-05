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
