/**
 * Logger Service - Structured Logging with Log Levels
 *
 * A lightweight, zero-dependency logger service that provides:
 * - Four log levels: debug, info, warn, error
 * - Category namespacing for grouping related logs
 * - Environment-aware output (production suppresses debug/info)
 * - ISO 8601 timestamps in development
 * - PII redaction for sensitive data
 * - Graceful handling of edge cases
 *
 * @example
 * ```typescript
 * import { createLogger } from '@/lib/logger';
 *
 * const logger = createLogger('auth');
 * logger.info('User logged in', { userId: '123' });
 * logger.error('Login failed', { error: 'Invalid credentials' });
 * ```
 */

// ============================================================================
// Types & Enums
// ============================================================================

/**
 * Log severity levels in ascending order.
 * Messages below the configured minLevel are suppressed.
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Context object for structured logging.
 */
export type LogContext = Record<string, unknown>;

/**
 * Logger configuration options.
 */
export interface LoggerConfig {
  minLevel: LogLevel;
  timestamps: boolean;
  showCategory: boolean;
}

/**
 * Logger instance interface.
 */
export interface Logger {
  readonly category: string;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

// ============================================================================
// Configuration
// ============================================================================

// Detect production environment
const isProduction =
  typeof process !== 'undefined' &&
  (process.env?.NODE_ENV === 'production' ||
    process.env?.NEXT_PUBLIC_VERCEL_ENV === 'production');

// Global configuration with environment-aware defaults
let globalConfig: LoggerConfig = {
  minLevel: isProduction ? LogLevel.ERROR : LogLevel.DEBUG,
  timestamps: !isProduction,
  showCategory: true,
};

/**
 * Configure global logger defaults.
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * Get current global logger configuration.
 */
export function getLoggerConfig(): LoggerConfig {
  return { ...globalConfig };
}

// ============================================================================
// Helper Functions
// ============================================================================

// Keys that should be redacted for security/privacy
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'email',
  'phone',
  'ssn',
  'creditcard',
  'credit_card',
]);

// Maximum message length before truncation (10KB)
const MAX_MESSAGE_LENGTH = 10240;

/**
 * Sanitize category name to alphanumeric + hyphens, lowercase.
 */
function sanitizeCategory(category: string): string {
  if (!category || category.trim() === '') {
    return 'app';
  }
  return category
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Redact sensitive values in context object.
 */
function redactSensitiveData(context: LogContext): LogContext {
  const redacted: LogContext = {};

  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      // Handle nested objects, but avoid circular references
      try {
        redacted[key] = JSON.parse(JSON.stringify(value));
      } catch {
        redacted[key] = '[Circular]';
      }
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Safely serialize context, handling circular references.
 */
function safeSerializeContext(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;

  try {
    // Test for circular references
    JSON.stringify(context);
    return redactSensitiveData(context);
  } catch {
    // Handle circular references
    const safe: LogContext = {};
    for (const [key, value] of Object.entries(context)) {
      try {
        JSON.stringify(value);
        const lowerKey = key.toLowerCase();
        safe[key] = SENSITIVE_KEYS.has(lowerKey) ? '[REDACTED]' : value;
      } catch {
        safe[key] = '[Circular]';
      }
    }
    return safe;
  }
}

/**
 * Truncate message if too long.
 */
function truncateMessage(message: string): string {
  if (message.length <= MAX_MESSAGE_LENGTH) {
    return message;
  }
  return message.slice(0, MAX_MESSAGE_LENGTH - 15) + '...[truncated]';
}

/**
 * Format the log prefix with optional timestamp and category.
 */
function formatPrefix(
  category: string,
  level: string,
  config: LoggerConfig
): string {
  const parts: string[] = [];

  if (config.timestamps) {
    parts.push(`[${new Date().toISOString()}]`);
  }

  if (config.showCategory) {
    parts.push(`[${category}]`);
  }

  parts.push(`${level}:`);

  return parts.join(' ');
}

// ============================================================================
// Logger Factory
// ============================================================================

/**
 * Create a new logger instance with the specified category.
 */
export function createLogger(
  category: string,
  config?: Partial<LoggerConfig>
): Logger {
  const sanitizedCategory = sanitizeCategory(category);
  const instanceConfig = config ? { ...globalConfig, ...config } : globalConfig;

  const log = (
    level: LogLevel,
    levelName: string,
    consoleMethod: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: LogContext
  ): void => {
    // Check if this log level should be output
    const currentConfig = config
      ? { ...globalConfig, ...config }
      : globalConfig;
    if (level < currentConfig.minLevel) {
      return;
    }

    // Safely get the console method
    const consoleFn = console?.[consoleMethod];
    if (typeof consoleFn !== 'function') {
      return;
    }

    // Format the message
    const prefix = formatPrefix(sanitizedCategory, levelName, currentConfig);
    const truncatedMessage = truncateMessage(message);
    const formattedMessage = `${prefix} ${truncatedMessage}`;

    // Serialize context safely
    const safeContext = safeSerializeContext(context);

    // Output to console
    if (safeContext && Object.keys(safeContext).length > 0) {
      consoleFn.call(console, formattedMessage, safeContext);
    } else {
      consoleFn.call(console, formattedMessage, {});
    }
  };

  return {
    category: sanitizedCategory,

    debug(message: string, context?: LogContext): void {
      log(LogLevel.DEBUG, 'DEBUG', 'debug', message, context);
    },

    info(message: string, context?: LogContext): void {
      log(LogLevel.INFO, 'INFO', 'info', message, context);
    },

    warn(message: string, context?: LogContext): void {
      log(LogLevel.WARN, 'WARN', 'warn', message, context);
    },

    error(message: string, context?: LogContext): void {
      log(LogLevel.ERROR, 'ERROR', 'error', message, context);
    },
  };
}

// ============================================================================
// Default Instance
// ============================================================================

/**
 * Default logger instance for general use.
 */
export const logger = createLogger('app');
