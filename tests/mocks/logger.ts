/**
 * Logger Mock for Testing
 *
 * Provides a mock logger instance and factory for use in unit tests.
 * All methods are Vitest mock functions that can be asserted against.
 *
 * @example
 * ```typescript
 * import { vi } from 'vitest';
 * import { mockLogger, createMockLogger } from '@tests/mocks/logger';
 *
 * vi.mock('@/lib/logger', () => ({
 *   createLogger: vi.fn(() => mockLogger),
 *   logger: mockLogger,
 * }));
 *
 * // In test:
 * expect(mockLogger.error).toHaveBeenCalledWith('message', { context: 'value' });
 * ```
 */
import { vi } from 'vitest';

/**
 * Mock logger instance with all methods as Vitest mock functions.
 * Reset between tests using `vi.clearAllMocks()` or `mockLogger.debug.mockClear()`.
 */
export const mockLogger = {
  category: 'test',
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

/**
 * Factory function to create a fresh mock logger instance.
 * Useful when testing components that create their own logger.
 *
 * @param category - Optional category name (defaults to 'test')
 * @returns A new mock logger instance
 */
export function createMockLogger(category = 'test') {
  return {
    category,
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

/**
 * Reset all mock logger functions.
 * Call this in `beforeEach` to ensure clean state between tests.
 */
export function resetMockLogger(): void {
  mockLogger.debug.mockClear();
  mockLogger.info.mockClear();
  mockLogger.warn.mockClear();
  mockLogger.error.mockClear();
}

/**
 * Type for mock logger - matches the Logger interface from src/lib/logger
 */
export type MockLogger = typeof mockLogger;
