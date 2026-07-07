/**
 * ServiceResult Type - Supabase-style Result Pattern
 *
 * Provides consistent error handling across all service functions.
 * Follows the Supabase pattern: { data, error } tuple.
 *
 * @example
 * ```typescript
 * import { ServiceResult, success, failure, isSuccess } from '@/types/result';
 *
 * async function getUser(id: string): Promise<ServiceResult<User>> {
 *   try {
 *     const user = await fetchUser(id);
 *     return success(user);
 *   } catch (error) {
 *     return failure(error instanceof Error ? error : new Error(String(error)));
 *   }
 * }
 *
 * const result = await getUser('123');
 * if (isSuccess(result)) {
 *   console.log(result.data.name); // TypeScript knows data is User
 * }
 * ```
 */

// ============================================================================
// Core Result Type
// ============================================================================

/**
 * Service result tuple following Supabase's pattern.
 *
 * Invariant: Exactly one of `data` or `error` is non-null.
 * - Success: { data: T, error: null }
 * - Failure: { data: null, error: Error }
 *
 * @template T - Type of the success data
 */
export type ServiceResult<T> =
  | { data: T; error: null }
  | { data: null; error: Error };

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a success result.
 *
 * @param data - The success data
 * @returns ServiceResult with data and null error
 *
 * @example
 * ```typescript
 * return success(user);
 * // Returns: { data: user, error: null }
 * ```
 */
export function success<T>(data: T): ServiceResult<T> {
  return { data, error: null };
}

/**
 * Create an error result.
 *
 * @param error - The error (string or Error object)
 * @returns ServiceResult with null data and error
 *
 * @example
 * ```typescript
 * return failure('User not found');
 * // Returns: { data: null, error: Error('User not found') }
 * ```
 */
export function failure(error: string | Error): ServiceResult<never> {
  const errorObj =
    error instanceof Error ? error : new Error(error || 'Unknown error');
  return { data: null, error: errorObj };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if result is a success.
 *
 * @param result - ServiceResult to check
 * @returns true if data is non-null (and error is null)
 *
 * @example
 * ```typescript
 * if (isSuccess(result)) {
 *   // TypeScript knows result.data is T, not null
 *   console.log(result.data.name);
 * }
 * ```
 */
export function isSuccess<T>(
  result: ServiceResult<T>
): result is { data: T; error: null } {
  return result.error === null;
}

/**
 * Check if result is a failure.
 *
 * @param result - ServiceResult to check
 * @returns true if error is non-null (and data is null)
 *
 * @example
 * ```typescript
 * if (isFailure(result)) {
 *   // TypeScript knows result.error is Error, not null
 *   logger.error('Failed', { error: result.error.message });
 * }
 * ```
 */
export function isFailure<T>(
  result: ServiceResult<T>
): result is { data: null; error: Error } {
  return result.error !== null;
}

// ============================================================================
// Async Wrapper
// ============================================================================

/**
 * Wrap an async operation in a try-catch that returns ServiceResult.
 *
 * @param fn - Async function to wrap
 * @returns ServiceResult with data on success, error on failure
 *
 * @example
 * ```typescript
 * const result = await tryCatch(async () => {
 *   const response = await fetch('/api/user');
 *   if (!response.ok) throw new Error('Fetch failed');
 *   return response.json();
 * });
 *
 * if (result.error) {
 *   logger.error('Fetch failed', { error: result.error });
 * }
 * ```
 */
export async function tryCatch<T>(
  fn: () => Promise<T>
): Promise<ServiceResult<T>> {
  try {
    const data = await fn();
    return success(data);
  } catch (error) {
    return failure(error instanceof Error ? error : new Error(String(error)));
  }
}
