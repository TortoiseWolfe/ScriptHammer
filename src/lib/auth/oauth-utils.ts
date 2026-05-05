/**
 * OAuth Utility Functions
 * Helpers for detecting and handling OAuth users
 */

import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { createLogger } from '@/lib/logger';

/**
 * Extract display name from OAuth user metadata using fallback cascade.
 * Priority: full_name > name > user_name > preferred_username > email prefix > "Anonymous User"
 *
 * Provider-specific notes:
 * - Google sets `full_name` and `name`
 * - GitHub sets `name` (the user's display name) and `user_name` (the GitHub
 *   handle). The handle is preferred over email prefix because users with
 *   no display name set on GitHub still have a meaningful identifier.
 * - Other providers may use `preferred_username` (OIDC standard claim).
 *
 * Trims whitespace at each tier so a metadata field of "   " falls through
 * to the next tier instead of producing a whitespace-only display name.
 *
 * @param user - Supabase User object
 * @returns Display name string, never null
 */
export function extractOAuthDisplayName(user: User | null): string {
  if (!user) return 'Anonymous User';

  const meta = user.user_metadata ?? {};
  const tiers = [
    meta.full_name,
    meta.name,
    meta.user_name,
    meta.preferred_username,
  ];
  for (const tier of tiers) {
    if (typeof tier === 'string') {
      const trimmed = tier.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }

  // Email prefix fallback
  const email = user.email;
  if (email) {
    const prefix = email.split('@')[0];
    if (prefix && prefix.length > 0) return prefix;
  }

  return 'Anonymous User';
}

/**
 * Extract avatar URL from OAuth user metadata
 *
 * @param user - Supabase User object
 * @returns Avatar URL string or null if not available
 */
export function extractOAuthAvatarUrl(user: User | null): string | null {
  return user?.user_metadata?.avatar_url || null;
}

/**
 * Check if a user signed in via OAuth (Google, GitHub, etc.)
 * OAuth users don't have a password set in Supabase auth
 *
 * @param user - Supabase User object
 * @returns true if user signed in via OAuth provider
 */
export function isOAuthUser(user: User | null): boolean {
  if (!user) return false;

  // Check app_metadata.provider - set by Supabase on OAuth sign-in
  const provider = user.app_metadata?.provider;
  if (provider && provider !== 'email') {
    return true;
  }

  // Fallback: Check identities array for non-email providers
  const identities = user.identities || [];
  return identities.some(
    (identity) => identity.provider && identity.provider !== 'email'
  );
}

/**
 * Get the OAuth provider name for display
 *
 * @param user - Supabase User object
 * @returns Provider name (e.g., "Google", "GitHub") or null if email user
 */
export function getOAuthProvider(user: User | null): string | null {
  if (!user) return null;

  const provider = user.app_metadata?.provider;
  if (provider && provider !== 'email') {
    // Capitalize first letter
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }

  // Check identities
  const oauthIdentity = user.identities?.find(
    (i) => i.provider && i.provider !== 'email'
  );
  if (oauthIdentity) {
    return (
      oauthIdentity.provider.charAt(0).toUpperCase() +
      oauthIdentity.provider.slice(1)
    );
  }

  return null;
}

const logger = createLogger('lib:auth:oauth-utils');

/**
 * Populate user_profiles with OAuth metadata (display_name, avatar_url)
 * Only populates NULL values - never overwrites existing data (FR-003)
 * Errors are logged but do not block OAuth flow (NFR-001)
 *
 * @param user - Supabase User object with OAuth metadata
 * @returns true if any field was updated, false otherwise
 */
export async function populateOAuthProfile(user: User): Promise<boolean> {
  const supabase = createClient();

  try {
    // Query current profile
    const { data: profile, error: queryError } = await supabase
      .from('user_profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single();

    if (queryError || !profile) {
      logger.error('Failed to query user profile for OAuth population', {
        userId: user.id,
        error: queryError?.message,
      });
      return false;
    }

    // Check what needs updating (only NULL values)
    const updates: { display_name?: string; avatar_url?: string } = {};

    if (profile.display_name === null) {
      updates.display_name = extractOAuthDisplayName(user);
    }

    if (profile.avatar_url === null) {
      const oauthAvatar = extractOAuthAvatarUrl(user);
      if (oauthAvatar) {
        updates.avatar_url = oauthAvatar;
      }
    }

    // Nothing to update
    if (Object.keys(updates).length === 0) {
      logger.debug('OAuth profile already populated, skipping', {
        userId: user.id,
      });
      return false;
    }

    // Update profile
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', user.id);

    if (updateError) {
      logger.error('Failed to update user profile with OAuth data', {
        userId: user.id,
        error: updateError.message,
      });
      return false;
    }

    logger.info('OAuth profile populated successfully', {
      userId: user.id,
      updatedFields: Object.keys(updates),
    });

    return true;
  } catch (err) {
    logger.error('Unexpected error populating OAuth profile', {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
