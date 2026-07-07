/**
 * Logger Service - Barrel Export
 *
 * Re-exports all logger functionality for convenient imports.
 *
 * @example
 * ```typescript
 * import { createLogger, logger, LogLevel } from '@/lib/logger';
 *
 * const log = createLogger('myService');
 * log.info('Hello, world!');
 * ```
 */

export {
  // Enum
  LogLevel,
  // Types
  type LogContext,
  type LoggerConfig,
  type Logger,
  // Factory
  createLogger,
  // Configuration
  configureLogger,
  getLoggerConfig,
  // Default instance
  logger,
} from './logger';
