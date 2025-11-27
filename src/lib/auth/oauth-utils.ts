/**
 * OAuth Utility Functions
 * Helpers for detecting and handling OAuth users
 */

import type { User } from '@supabase/supabase-js';

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
