/**
 * Logger Service Contract
 * Feature: 040-feature-040-code
 *
 * This file defines the interface contract for the logger service.
 * Implementation must adhere to these types exactly.
 */

// ============================================================================
// Log Levels
// ============================================================================

/**
 * Log severity levels in ascending order.
 * Messages below the configured minLevel are suppressed.
 */
export enum LogLevel {
  DEBUG = 0, // Development debugging, suppressed in production
  INFO = 1, // General information, suppressed in production
  WARN = 2, // Warnings that don't prevent operation
  ERROR = 3, // Errors that need attention
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Logger configuration options.
 * Can be set globally or per-logger instance.
 */
export interface LoggerConfig {
  /**
   * Minimum log level to output.
   * @default LogLevel.DEBUG in development, LogLevel.ERROR in production
   */
  minLevel: LogLevel;

  /**
   * Include ISO 8601 timestamps in log output.
   * @default true in development, false in production
   */
  timestamps: boolean;

  /**
   * Include category prefix in log output.
   * @default true
   */
  showCategory: boolean;
}

// ============================================================================
// Logger Interface
// ============================================================================

/**
 * Context object for structured logging.
 * Should be JSON-serializable (no circular references, no functions).
 */
export type LogContext = Record<string, unknown>;

/**
 * Logger instance interface.
 * Each logger has a category (namespace) for filtering/grouping.
 */
export interface Logger {
  /**
   * Category/namespace for this logger instance.
   * Used as prefix in log output: [category] message
   */
  readonly category: string;

  /**
   * Log debug-level message.
   * Suppressed in production environment.
   *
   * @param message - Human-readable log message
   * @param context - Optional structured data for debugging
   */
  debug(message: string, context?: LogContext): void;

  /**
   * Log info-level message.
   * Suppressed in production environment.
   *
   * @param message - Human-readable log message
   * @param context - Optional structured data
   */
  info(message: string, context?: LogContext): void;

  /**
   * Log warning-level message.
   * Shown in all environments.
   *
   * @param message - Human-readable warning message
   * @param context - Optional structured data
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Log error-level message.
   * Always shown in all environments.
   *
   * @param message - Human-readable error message
   * @param context - Optional structured data (include error details)
   */
  error(message: string, context?: LogContext): void;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new logger instance with the specified category.
 *
 * @param category - Namespace for this logger (e.g., 'auth', 'messaging', 'payment')
 * @param config - Optional configuration overrides
 * @returns Logger instance
 *
 * @example
 * ```typescript
 * const logger = createLogger('auth');
 * logger.info('User logged in', { userId: '123' });
 * logger.error('Login failed', { error: 'Invalid credentials' });
 * ```
 */
export type CreateLogger = (
  category: string,
  config?: Partial<LoggerConfig>
) => Logger;

// ============================================================================
// Global Configuration
// ============================================================================

/**
 * Configure global logger defaults.
 * Affects all loggers created after this call.
 *
 * @param config - Configuration options to set globally
 */
export type ConfigureLogger = (config: Partial<LoggerConfig>) => void;

/**
 * Get current global logger configuration.
 * @returns Current configuration
 */
export type GetLoggerConfig = () => LoggerConfig;

// ============================================================================
// Exports Contract
// ============================================================================

/**
 * Expected module exports from src/lib/logger/index.ts
 */
export interface LoggerModule {
  // Types
  LogLevel: typeof LogLevel;

  // Factory
  createLogger: CreateLogger;

  // Global config
  configureLogger: ConfigureLogger;
  getLoggerConfig: GetLoggerConfig;

  // Default instance for convenience
  logger: Logger;
}
