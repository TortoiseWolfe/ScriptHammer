import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the external sinks so we can assert the Sentry chokepoint behavior.
const captureAppError = vi.fn();
vi.mock('@/lib/monitoring/sentry', () => ({
  captureAppError: (...a: unknown[]) => captureAppError(...a),
}));
vi.mock('@/utils/analytics', () => ({ trackError: vi.fn() }));

import errorHandler, {
  AppError,
  ErrorCategory,
  ErrorSeverity,
} from './error-handler';

describe('errorHandler → Sentry chokepoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    errorHandler.clearQueue();
  });

  it('captures exactly once per handled error, preferring the original Error', () => {
    const original = new Error('db down');
    const appError = new AppError('wrapped', {
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.HIGH,
      context: { route: '/x' },
      originalError: original,
    });

    errorHandler.handle(appError);

    expect(captureAppError).toHaveBeenCalledTimes(1);
    expect(captureAppError.mock.calls[0][0]).toBe(original);
    expect(captureAppError.mock.calls[0][1]).toMatchObject({
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.HIGH,
      route: '/x',
    });
  });

  it('falls back to the AppError itself when there is no originalError', () => {
    const appError = new AppError('no original', {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
    });

    errorHandler.handle(appError);

    expect(captureAppError).toHaveBeenCalledTimes(1);
    expect(captureAppError.mock.calls[0][0]).toBe(appError);
  });
});
