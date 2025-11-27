'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { validatePassword } from '@/lib/auth/password-validator';
import { logAuthEvent } from '@/lib/auth/audit-logger';
import AvatarDisplay from '@/components/atomic/AvatarDisplay';
import AvatarUpload from '@/components/atomic/AvatarUpload';
import { removeAvatar } from '@/lib/avatar/upload';
import DataExportButton from '@/components/atomic/DataExportButton';
import AccountDeletionModal from '@/components/molecular/AccountDeletionModal';
import { useUserProfile } from '@/hooks/useUserProfile';
import { validateDisplayName, validateBio } from '@/lib/profile/validation';
import { createLogger } from '@/lib/logger/logger';

const logger = createLogger('components:auth:AccountSettings');

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
  const {
    profile,
    loading: profileLoading,
    refetch: refetchProfile,
  } = useUserProfile();

  // Profile form state - initialize empty, populate from profile via useEffect
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Load initial values from user_profiles table
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Feature 038: Split error/success states for profile and password forms (FR-003)
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    // Feature 038: Use profile-specific states (FR-003)
    setProfileError(null);
    setProfileSuccess(false);

    // Validate display name
    const displayNameValidation = validateDisplayName(displayName);
    if (!displayNameValidation.valid) {
      setProfileError(displayNameValidation.error || 'Invalid display name');
      return;
    }

    // Validate bio
    const bioValidation = validateBio(bio);
    if (!bioValidation.valid) {
      setProfileError(bioValidation.error || 'Invalid bio');
      return;
    }

    setLoading(true);
    setIsUpdatingProfile(true);

    // Ensure user is authenticated before update
    if (!user?.id) {
      setProfileError('You must be signed in to update your profile');
      setLoading(false);
      setIsUpdatingProfile(false);
      return;
    }

    // Feature 035: Use .upsert() instead of .update() to handle missing rows
    // .update() returns error:null even when 0 rows updated (silent failure)
    // .upsert() with onConflict:'id' will INSERT if row missing, UPDATE if exists
    const { data, error: updateError } = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: user.id,
          display_name: displayName?.trim() || null,
          bio: bio?.trim() || null,
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    setLoading(false);
    setIsUpdatingProfile(false);

    // Feature 035: Check returned data exists, not just !error (FR-003)
    if (updateError) {
      logger.error('Error updating profile', { error: updateError });
      setProfileError('Failed to update profile. Please try again.');
    } else if (!data) {
      // FR-006: Show error if update failed silently (data is null)
      setProfileError('Profile update failed - please try again.');
    } else {
      setProfileSuccess(true);
      // FR-010: Refetch profile to ensure UI reflects database state
      await refetchProfile();
      // Feature 038 FR-013: Auto-dismiss success message after 3 seconds
      setTimeout(() => setProfileSuccess(false), 3000);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    // Feature 038: Use password-specific states (FR-003)
    setPasswordError(null);
    setPasswordSuccess(false);

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setPasswordError(passwordValidation.error);
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
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

      setPasswordError(updateError.message);
    } else {
      // Log successful password change (T035)
      if (user) {
        await logAuthEvent({
          user_id: user.id,
          event_type: 'password_change',
        });
      }

      setPasswordSuccess(true);
      // Feature 038 FR-014: Password fields NOT cleared on failure, but cleared on success
      setPassword('');
      setConfirmPassword('');
      // Feature 038 FR-013: Auto-dismiss success message after 3 seconds
      setTimeout(() => setPasswordSuccess(false), 3000);
    }
  };

  const handleOpenDeleteModal = () => {
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
  };

  const handleAvatarUploadComplete = async (url: string) => {
    setAvatarUrl(url);
    await refreshSession(); // Refresh to get updated user metadata
    // Feature 038 FR-001: Refetch profile to update navbar avatar immediately
    await refetchProfile();
  };

  const handleRemoveAvatar = async () => {
    if (!confirm('Are you sure you want to remove your avatar?')) {
      return;
    }

    // Feature 038: Use profile-specific error state for avatar operations
    setProfileError(null);
    setRemovingAvatar(true);

    const result = await removeAvatar();

    setRemovingAvatar(false);

    if (result.error) {
      // Feature 038 Edge Case 1: Avatar upload/removal fails - show error inline
      setProfileError(result.error);
    } else {
      setAvatarUrl(null);
      await refreshSession(); // Refresh to get updated user metadata
      // Feature 038 FR-001/FR-002: Refetch profile to update navbar avatar
      await refetchProfile();
    }
  };

  // Show loading state while profile is being fetched
  if (profileLoading) {
    return (
      <div className={`space-y-6${className ? ` ${className}` : ''}`}>
        <div className="card bg-base-200">
          <div className="card-body">
            <div className="flex items-center justify-center py-8">
              <span className="loading loading-spinner loading-lg"></span>
              <span className="ml-3">Loading profile...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6${className ? ` ${className}` : ''}`}>
      {/* Profile Settings */}
      <form onSubmit={handleUpdateProfile} className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title">Profile Settings</h3>

          {/* Display Name Field */}
          <div className="form-control">
            <label htmlFor="displayname-input" className="label">
              <span className="label-text">Display Name</span>
            </label>
            <input
              id="displayname-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input input-bordered min-h-11"
              placeholder="e.g., John Doe"
              disabled={loading || isUpdatingProfile}
            />
            <label className="label">
              <span className="label-text-alt">
                Your friendly name shown to other users
              </span>
            </label>
          </div>

          {/* Bio Field */}
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
              placeholder="Tell us about yourself..."
              disabled={loading || isUpdatingProfile}
            />
            <label className="label">
              <span className="label-text-alt">Maximum 500 characters</span>
            </label>
          </div>

          <button
            type="submit"
            className="btn btn-primary min-h-11"
            disabled={loading || profileLoading || isUpdatingProfile}
          >
            {isUpdatingProfile ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Saving...
              </>
            ) : (
              'Update Profile'
            )}
          </button>

          {/* Feature 038 FR-004: Profile alerts inline within card */}
          {profileError && (
            <div
              role="alert"
              aria-live="assertive"
              className="alert alert-error mt-4"
            >
              <span>{profileError}</span>
            </div>
          )}
          {profileSuccess && (
            <div
              role="status"
              aria-live="polite"
              className="alert alert-success mt-4"
            >
              <span>Profile updated successfully!</span>
            </div>
          )}
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
              displayName={displayName || user?.email || 'User'}
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
              disabled={loading || isUpdatingProfile}
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
              disabled={loading || isUpdatingProfile}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary min-h-11"
            disabled={loading}
          >
            Change Password
          </button>

          {/* Feature 038 FR-005: Password alerts inline within card */}
          {passwordError && (
            <div
              role="alert"
              aria-live="assertive"
              className="alert alert-error mt-4"
            >
              <span>{passwordError}</span>
            </div>
          )}
          {passwordSuccess && (
            <div
              role="status"
              aria-live="polite"
              className="alert alert-success mt-4"
            >
              <span>Password changed successfully!</span>
            </div>
          )}
        </div>
      </form>

      {/* Privacy & Data (GDPR Section) - Task T188 */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title">Privacy & Data</h3>
          <p className="text-sm opacity-70">
            Manage your personal data in compliance with GDPR regulations.
          </p>

          {/* Data Export Subsection */}
          <div className="divider"></div>
          <div className="space-y-3">
            <h4 className="font-semibold">Data Export</h4>
            <p className="text-sm opacity-70">
              Download all your data including messages (decrypted),
              connections, and profile information in JSON format.
            </p>
            <DataExportButton />
          </div>

          {/* Account Deletion Subsection */}
          <div className="divider"></div>
          <div className="space-y-3">
            <h4 className="text-error font-semibold">Account Deletion</h4>
            <p className="text-sm opacity-70">
              Permanently delete your account and all associated data. This
              action cannot be undone.
            </p>
            <button
              onClick={handleOpenDeleteModal}
              className="btn btn-error min-h-11"
              disabled={loading || isUpdatingProfile}
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Account Deletion Modal */}
      <AccountDeletionModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
      />

      {/* Feature 038 FR-006: Bottom-of-page alerts removed - now inline within cards */}
    </div>
  );
}
