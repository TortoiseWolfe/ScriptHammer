/**
 * Result Type Contract
 * Feature: 040-feature-040-code
 *
 * Defines the Supabase-style result tuple pattern for service functions.
 * This pattern provides consistent error handling across all services.
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
 *
 * @example
 * ```typescript
 * // Success case
 * return { data: user, error: null };
 *
 * // Error case
 * return { data: null, error: new Error('User not found') };
 * ```
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
export type Success = <T>(data: T) => ServiceResult<T>;

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
 *
 * return failure(new Error('Database connection failed'));
 * // Returns: { data: null, error: Error('Database connection failed') }
 * ```
 */
export type Failure = (error: string | Error) => ServiceResult<never>;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if result is a success.
 *
 * @param result - ServiceResult to check
 * @returns true if data is non-null
 *
 * @example
 * ```typescript
 * const result = await getUser(id);
 * if (isSuccess(result)) {
 *   // TypeScript knows result.data is T, not null
 *   console.log(result.data.name);
 * }
 * ```
 */
export type IsSuccess = <T>(
  result: ServiceResult<T>
) => result is { data: T; error: null };

/**
 * Check if result is a failure.
 *
 * @param result - ServiceResult to check
 * @returns true if error is non-null
 *
 * @example
 * ```typescript
 * const result = await getUser(id);
 * if (isFailure(result)) {
 *   // TypeScript knows result.error is Error, not null
 *   logger.error('Failed', { error: result.error.message });
 * }
 * ```
 */
export type IsFailure = <T>(
  result: ServiceResult<T>
) => result is { data: null; error: Error };

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
 *   return response.json();
 * });
 *
 * if (result.error) {
 *   logger.error('Fetch failed', { error: result.error });
 * }
 * ```
 */
export type TryCatch = <T>(fn: () => Promise<T>) => Promise<ServiceResult<T>>;

// ============================================================================
// Exports Contract
// ============================================================================

/**
 * Expected module exports from src/types/result.ts
 */
export interface ResultModule {
  // Type (re-export for convenience)
  // ServiceResult<T> - exported as type

  // Helpers
  success: Success;
  failure: Failure;

  // Type guards
  isSuccess: IsSuccess;
  isFailure: IsFailure;

  // Async wrapper
  tryCatch: TryCatch;
}
