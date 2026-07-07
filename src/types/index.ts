/**
 * Types - Barrel Export
 *
 * Central export point for all application types.
 */

// ServiceResult pattern for consistent error handling
export {
  type ServiceResult,
  success,
  failure,
  isSuccess,
  isFailure,
  tryCatch,
} from './result';
