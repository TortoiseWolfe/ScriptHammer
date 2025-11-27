/**
 * Development-only logging utility
 * Console statements are removed in production builds for Best Practices score
 *
 * @deprecated This logger is deprecated. Use the structured logger from @/lib/logger instead:
 * ```typescript
 * import { createLogger } from '@/lib/logger';
 * const logger = createLogger('category:name');
 * logger.info('message', { context });
 * ```
 */

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  error: (...args: unknown[]) => {
    if (isDev) {
      console.error(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
};
