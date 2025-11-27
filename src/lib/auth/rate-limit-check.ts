// Security Hardening: Rate Limiting Client Wrapper
// Feature 017 - Task T017
// Purpose: Client-side wrapper for server-side rate limiting functions

import { supabase } from '@/lib/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('auth:rateLimit');

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  locked_until: string | null;
  reason?: string;
}

/**
 * Check if an authentication attempt is allowed (server-side enforcement)
 *
 * @param identifier - Email address or IP being rate-limited
 * @param attemptType - Type of authentication attempt
 * @param ipAddress - Optional IP address for additional tracking
 * @returns RateLimitResult indicating if attempt is allowed
 *
 * @example
 * const result = await checkRateLimit('user@example.com', 'sign_in');
 * if (!result.allowed) {
 *   throw new Error(`Rate limited until ${result.locked_until}`);
 * }
 */
export async function checkRateLimit(
  identifier: string,
  attemptType: 'sign_in' | 'sign_up' | 'password_reset',
  ipAddress?: string
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_attempt_type: attemptType,
      p_ip_address: ipAddress || null,
    });

    if (error) {
      logger.error('Rate limit check failed', {
        error,
        identifier,
        attemptType,
        ipAddress,
      });
      // Fail open - allow attempt if rate limit check fails
      // This prevents rate limiting from becoming a DoS vector
      return {
        allowed: true,
        remaining: 5,
        locked_until: null,
      };
    }

    return data as unknown as RateLimitResult;
  } catch (error) {
    logger.error('Rate limit check error', {
      error,
      identifier,
      attemptType,
      ipAddress,
    });
    // Fail open
    return {
      allowed: true,
      remaining: 5,
      locked_until: null,
    };
  }
}

/**
 * Record a failed authentication attempt (increments counter)
 *
 * @param identifier - Email address or IP being rate-limited
 * @param attemptType - Type of authentication attempt
 * @param ipAddress - Optional IP address for audit trail
 *
 * @example
 * try {
 *   await signIn(email, password);
 * } catch (error) {
 *   await recordFailedAttempt(email, 'sign_in');
 *   throw error;
 * }
 */
export async function recordFailedAttempt(
  identifier: string,
  attemptType: 'sign_in' | 'sign_up' | 'password_reset',
  ipAddress?: string
): Promise<void> {
  try {
    const { error } = await supabase.rpc('record_failed_attempt', {
      p_identifier: identifier,
      p_attempt_type: attemptType,
      p_ip_address: ipAddress || null,
    });

    if (error) {
      logger.error('Failed to record failed attempt', {
        error,
        identifier,
        attemptType,
        ipAddress,
      });
      // Non-critical failure - don't throw
    }
  } catch (error) {
    logger.error('Error recording failed attempt', {
      error,
      identifier,
      attemptType,
      ipAddress,
    });
    // Non-critical failure - don't throw
  }
}

/**
 * Get client IP address (best effort)
 * Note: This is approximate and can be spoofed. Server-side IP detection is more reliable.
 */
export async function getClientIP(): Promise<string | undefined> {
  try {
    // In production, this would use a geolocation API or extract from request headers
    // For now, return undefined and let server handle it
    return undefined;
  } catch (error) {
    return undefined;
  }
}

/**
 * Format lockout time for user display
 */
export function formatLockoutTime(lockedUntil: string): string {
  const lockoutDate = new Date(lockedUntil);
  const now = new Date();
  const minutesRemaining = Math.ceil(
    (lockoutDate.getTime() - now.getTime()) / (1000 * 60)
  );

  if (minutesRemaining <= 0) {
    return 'shortly';
  } else if (minutesRemaining === 1) {
    return '1 minute';
  } else {
    return `${minutesRemaining} minutes`;
  }
}
