/**
 * Retry Utilities for Auth Operations
 *
 * Provides exponential backoff retry logic for transient auth failures.
 * Used by AuthContext for getSession() and other auth operations.
 *
 * @module lib/auth/retry-utils
 */

import { createLogger } from '@/lib/logger';

const logger = createLogger('auth:retry');

/**
 * Sleep for a specified duration
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param delays - Array of delay durations in ms (default: [1000, 2000, 4000])
 * @returns Result of the function if successful
 * @throws Error after all retries exhausted
 *
 * @example
 * ```ts
 * const session = await retryWithBackoff(
 *   () => supabase.auth.getSession(),
 *   3,
 *   [1000, 2000, 4000]
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delays: number[] = [1000, 2000, 4000]
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If we have more retries, wait before trying again
      if (attempt < maxRetries) {
        const delayMs = delays[attempt] || delays[delays.length - 1];
        logger.warn('Auth operation failed, retrying', {
          attempt: attempt + 1,
          maxAttempts: maxRetries + 1,
          delayMs,
          errorMessage: lastError.message,
        });
        await sleep(delayMs);
      }
    }
  }

  // All retries exhausted
  throw new Error(
    `Auth operation failed after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Wrap a Supabase auth operation with retry logic
 * Handles Supabase-specific error responses
 *
 * @param fn - Async function returning Supabase response with data/error
 * @param maxRetries - Maximum retry attempts
 * @param delays - Backoff delay array
 */
export async function retrySupabaseAuth<T>(
  fn: () => Promise<{ data: T; error: Error | null }>,
  maxRetries: number = 3,
  delays: number[] = [1000, 2000, 4000]
): Promise<{ data: T; error: Error | null }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();

      // If no error, return success
      if (!result.error) {
        return result;
      }

      // If error is not retryable (e.g., invalid credentials), return immediately
      const errorMessage = result.error.message.toLowerCase();
      if (
        errorMessage.includes('invalid') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('not found')
      ) {
        return result;
      }

      lastError = result.error;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    // If we have more retries, wait before trying again
    if (attempt < maxRetries) {
      const delayMs = delays[attempt] || delays[delays.length - 1];
      logger.warn('Auth operation failed, retrying', {
        attempt: attempt + 1,
        maxAttempts: maxRetries + 1,
        delayMs,
      });
      await sleep(delayMs);
    }
  }

  // All retries exhausted - return error response
  return {
    data: null as T,
    error:
      lastError ||
      new Error(`Auth operation failed after ${maxRetries + 1} attempts`),
  };
}
