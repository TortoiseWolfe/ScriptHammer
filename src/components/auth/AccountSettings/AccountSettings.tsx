'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { validatePassword } from '@/lib/auth/password-validator';
import { logAuthEvent } from '@/lib/auth/audit-logger';
import AvatarDisplay from '@/components/atomic/AvatarDisplay';
import AvatarUpload from '@/components/molecular/AvatarUpload';
import { removeAvatar } from '@/lib/avatar/upload';
import DataExportButton from '@/components/atomic/DataExportButton';
import AccountDeletionModal from '@/components/molecular/AccountDeletionModal';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
  checkUsernameAvailable,
  validateBio,
  validateDisplayName,
  validateUsername,
} from '@/lib/profile/validation';
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
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Load initial values from user_profiles table
  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
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

    // Usernames are optional. The profile contract allows 3-30 character
    // handles with letters, numbers, underscores, and hyphens.
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      setProfileError(usernameValidation.error || 'Invalid username');
      return;
    }
    // The app writes canonical lower-case handles. The database's unique
    // constraint is case-sensitive, so database-level case-insensitive
    // uniqueness needs a separate migration and collision audit.
    const normalizedUsername = username.trim().toLowerCase();

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

    // Ensure user is authenticated before update
    if (!user?.id) {
      setProfileError('You must be signed in to update your profile');
      return;
    }

    setLoading(true);
    setIsUpdatingProfile(true);

    if (normalizedUsername) {
      const isAvailable = await checkUsernameAvailable(
        supabase,
        normalizedUsername,
        user.id
      );
      if (!isAvailable) {
        setProfileError('This username is already taken');
        setLoading(false);
        setIsUpdatingProfile(false);
        return;
      }
    }

    // Feature 035: Use .upsert() instead of .update() to handle missing rows
    // .update() returns error:null even when 0 rows updated (silent failure)
    // .upsert() with onConflict:'id' will INSERT if row missing, UPDATE if exists
    const { data, error: updateError } = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: user.id,
          username: normalizedUsername || null,
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
      setProfileError(
        updateError.code === '23505'
          ? 'This username is already taken'
          : 'Failed to update profile. Please try again.'
      );
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

          {/* Username Field */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-x-6">
            <label
              htmlFor="username-input"
              className="label sm:w-36 sm:shrink-0 sm:text-right"
            >
              <span className="label-text">Username</span>
            </label>
            <div className="min-w-0 flex-1">
              <input
                id="username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input input-bordered min-h-11 w-full"
                placeholder="e.g., john_doe"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby="username-description"
                disabled={loading || isUpdatingProfile}
              />
              <p id="username-description" className="mt-2 text-sm">
                <span className="text-sm">
                  3–30 characters: letters, numbers, underscores, and hyphens
                </span>
              </p>
            </div>
          </div>

          {/* Display Name Field */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-x-6">
            <label
              htmlFor="displayname-input"
              className="label sm:w-36 sm:shrink-0 sm:text-right"
            >
              <span className="label-text">Display Name</span>
            </label>
            <div className="min-w-0 flex-1">
              <input
                id="displayname-input"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input input-bordered min-h-11 w-full"
                placeholder="e.g., John Doe"
                disabled={loading || isUpdatingProfile}
              />
              <label className="label mt-2">
                <span className="text-sm">
                  Your friendly name shown to other users
                </span>
              </label>
            </div>
          </div>

          {/* Bio Field */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-x-6">
            <label
              htmlFor="bio-textarea"
              className="label sm:w-36 sm:shrink-0 sm:text-right"
            >
              <span className="label-text">Bio</span>
            </label>
            <div className="min-w-0 flex-1">
              <textarea
                id="bio-textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="textarea w-full"
                rows={3}
                placeholder="Tell us about yourself..."
                disabled={loading || isUpdatingProfile}
              />
              <label className="label mt-2">
                <span className="text-sm">Maximum 500 characters</span>
              </label>
            </div>
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
      {/* `section` + aria-labelledby, not a bare div: the avatar controls are a
          named region, and without the association a screen reader announces
          "Upload avatar" / "Remove avatar" with no indication of what they
          belong to. `avatar-section-title` is also the hook the a11y E2E uses —
          before this, `[aria-labelledby*="avatar"]` matched nothing anywhere in
          the app, so that test could never run (#850). */}
      <section
        aria-labelledby="avatar-section-title"
        className="card bg-base-200"
      >
        <div className="card-body">
          <h3 id="avatar-section-title" className="card-title">
            Profile Picture
          </h3>

          {/* Current Avatar Display */}
          <div className="mb-4 flex flex-col items-center gap-4 sm:flex-row">
            <AvatarDisplay
              avatarUrl={avatarUrl}
              displayName={displayName || user?.email || 'User'}
              size="xl"
            />
            <div className="text-base-content text-sm">
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
      </section>

      {/* Password Change */}
      <form onSubmit={handleChangePassword} className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title">Change Password</h3>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-x-6">
            <label
              htmlFor="new-password-input"
              className="label sm:w-36 sm:shrink-0 sm:text-right"
            >
              <span className="label-text">New Password</span>
            </label>
            <div className="min-w-0 flex-1">
              <input
                id="new-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input input-bordered min-h-11 w-full"
                disabled={loading || isUpdatingProfile}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-x-6">
            <label
              htmlFor="confirm-password-input"
              className="label sm:w-36 sm:shrink-0 sm:text-right"
            >
              <span className="label-text">Confirm Password</span>
            </label>
            <div className="min-w-0 flex-1">
              <input
                id="confirm-password-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input input-bordered min-h-11 w-full"
                disabled={loading || isUpdatingProfile}
              />
            </div>
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
          <p className="text-base-content text-sm">
            Manage your personal data in compliance with GDPR regulations.
          </p>

          {/* Data Export Subsection */}
          <div className="divider"></div>
          <div className="space-y-3">
            <h4 className="font-semibold">Data Export</h4>
            <p className="text-base-content text-sm">
              Download all your data including messages (decrypted),
              connections, and profile information in JSON format.
            </p>
            <DataExportButton />
          </div>
        </div>
      </div>

      {/* Account deletion gets its OWN plate. It shared one with data export,
          separated by nothing but a divider - so an irreversible action read as
          a sibling of a reversible one. The error-toned edge is the only place
          in these settings that carries it, which is the point. */}
      <div className="card bg-base-200 border-error/60 border">
        <div className="card-body space-y-3">
          <h3 className="card-title text-error">Account Deletion</h3>
          <p className="text-base-content text-sm">
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </p>
          <button
            onClick={handleOpenDeleteModal}
            className="btn btn-error min-h-11 self-start"
            disabled={loading || isUpdatingProfile}
          >
            Delete Account
          </button>
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
