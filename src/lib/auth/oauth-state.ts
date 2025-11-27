// Security Hardening: OAuth State Management
// Feature 017 - Task T021
// Purpose: Generate and validate OAuth state tokens for CSRF protection

import { supabase } from '@/lib/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('auth:oauth');

// Generate UUID v4 using crypto API (available in modern browsers and Node 16+)
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface OAuthStateValidationResult {
  valid: boolean;
  provider?: 'github' | 'google';
  error?: string;
}

/**
 * Generate a unique OAuth state token and store it in the database
 *
 * @param provider - OAuth provider (github or google)
 * @returns State token (UUID) to include in OAuth authorization URL
 *
 * @example
 * const stateToken = await generateOAuthState('github');
 * // Use stateToken in OAuth redirect URL
 */
export async function generateOAuthState(
  provider: 'github' | 'google'
): Promise<string> {
  const stateToken = generateUUID();
  const sessionId = getSessionId();
  const returnUrl = window.location.pathname;

  try {
    const { error } = await supabase.from('oauth_states').insert({
      state_token: stateToken,
      provider,
      session_id: sessionId,
      return_url: returnUrl,
      ip_address: null, // Will be set by RLS/triggers if needed
      user_agent: navigator.userAgent,
    });

    if (error) {
      logger.error('Failed to store OAuth state', {
        error,
        provider,
        stateToken,
      });
      // Still return the token - validation will fail later if needed
    }

    return stateToken;
  } catch (error) {
    logger.error('Error generating OAuth state', {
      error,
      provider,
      stateToken,
    });
    // Return a token anyway - fail open for better UX
    return stateToken;
  }
}

/**
 * Validate OAuth state token from callback
 *
 * @param stateToken - State parameter from OAuth callback URL
 * @returns Validation result indicating if state is valid
 *
 * @example
 * const result = await validateOAuthState(stateFromURL);
 * if (!result.valid) {
 *   throw new Error(result.error);
 * }
 */
export async function validateOAuthState(
  stateToken: string
): Promise<OAuthStateValidationResult> {
  if (!stateToken) {
    return {
      valid: false,
      error: 'state_not_found',
    };
  }

  try {
    // Fetch the state from database
    const { data: stateData, error: fetchError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state_token', stateToken)
      .single();

    if (fetchError || !stateData) {
      return {
        valid: false,
        error: 'state_not_found',
      };
    }

    // Check if already used
    if (stateData.used) {
      return {
        valid: false,
        error: 'state_already_used',
      };
    }

    // Check if expired (5 minutes)
    const expiresAt = new Date(stateData.expires_at);
    if (expiresAt < new Date()) {
      return {
        valid: false,
        error: 'state_expired',
      };
    }

    // Validate session ownership (CSRF protection)
    const currentSessionId = getSessionId();
    if (stateData.session_id && stateData.session_id !== currentSessionId) {
      return {
        valid: false,
        error: 'session_mismatch',
      };
    }

    // Mark state as used
    const { error: updateError } = await supabase
      .from('oauth_states')
      .update({ used: true })
      .eq('state_token', stateToken);

    if (updateError) {
      logger.error('Failed to mark state as used', {
        error: updateError,
        stateToken,
      });
      // Continue anyway - state was valid
    }

    return {
      valid: true,
      provider: stateData.provider as 'github' | 'google',
    };
  } catch (error) {
    logger.error('Error validating OAuth state', { error, stateToken });
    return {
      valid: false,
      error: 'validation_error',
    };
  }
}

/**
 * Get or create a session ID for CSRF validation
 * Uses sessionStorage to track the browser session
 */
function getSessionId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const SESSION_KEY = 'oauth_session_id';
  let sessionId = sessionStorage.getItem(SESSION_KEY);

  if (!sessionId) {
    sessionId = generateUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
}

/**
 * Cleanup expired OAuth states (maintenance function)
 * Should be called periodically or via cron job
 */
export async function cleanupExpiredStates(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('oauth_states')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) {
      logger.error('Failed to cleanup expired states', { error });
      return 0;
    }

    return data?.length || 0;
  } catch (error) {
    logger.error('Error cleaning up expired states', { error });
    return 0;
  }
}
