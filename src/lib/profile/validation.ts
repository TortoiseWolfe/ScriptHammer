/**
 * Profile Validation Utilities
 * Feature: 034-fix-broken-user
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const logger = createLogger('lib:profile:validation');

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates username format
 * Rules: 3-30 chars, alphanumeric + underscore only, no spaces
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || username.trim() === '') {
    return { valid: true }; // Username is optional per schema
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return {
      valid: false,
      error: 'Username must be between 3 and 30 characters',
    };
  }

  if (trimmed.length > 30) {
    return {
      valid: false,
      error: 'Username must be between 3 and 30 characters',
    };
  }

  if (/\s/.test(trimmed)) {
    return {
      valid: false,
      error: 'Username cannot contain spaces',
    };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Username can only contain letters, numbers, and underscores',
    };
  }

  return { valid: true };
}

/**
 * Validates display name format
 * Rules: max 100 chars, optional (empty allowed)
 */
export function validateDisplayName(displayName: string): ValidationResult {
  if (!displayName || displayName.trim() === '') {
    return { valid: true }; // Display name is optional
  }

  if (displayName.length > 100) {
    return {
      valid: false,
      error: 'Display name must be 100 characters or less',
    };
  }

  return { valid: true };
}

/**
 * Validates bio format
 * Rules: max 500 chars, optional
 */
export function validateBio(bio: string): ValidationResult {
  if (!bio || bio.trim() === '') {
    return { valid: true }; // Bio is optional
  }

  if (bio.length > 500) {
    return {
      valid: false,
      error: 'Bio must be 500 characters or less',
    };
  }

  return { valid: true };
}

/**
 * Checks if a username is available (not taken by another user)
 * @param supabase - Supabase client instance
 * @param username - Username to check
 * @param currentUserId - Current user's ID to exclude from check
 * @returns true if available, false if taken
 */
export async function checkUsernameAvailable(
  supabase: SupabaseClient,
  username: string,
  currentUserId: string
): Promise<boolean> {
  if (!username || username.trim() === '') {
    return true; // Empty username is always "available"
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('username', username.trim().toLowerCase())
    .neq('id', currentUserId)
    .limit(1);

  if (error) {
    logger.error('Error checking username availability', {
      error,
      username,
      currentUserId,
    });
    return false; // Fail safely - assume taken if error
  }

  return !data || data.length === 0;
}
