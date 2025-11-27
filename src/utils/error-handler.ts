/**
 * Centralized error handling utility
 * Provides consistent error logging and handling across the application
 */

import { trackError } from '@/utils/analytics';
import { createLogger } from '@/lib/logger';

const logger = createLogger('utils:errorHandler');

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Error categories
export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  UNKNOWN = 'unknown',
}

// Custom error class with additional metadata
export class AppError extends Error {
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly timestamp: Date;
  public readonly context?: Record<string, unknown>;
  public readonly originalError?: Error;

  constructor(
    message: string,
    options?: {
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      context?: Record<string, unknown>;
      originalError?: Error;
    }
  ) {
    super(message);
    this.name = 'AppError';
    this.severity = options?.severity || ErrorSeverity.MEDIUM;
    this.category = options?.category || ErrorCategory.UNKNOWN;
    this.timestamp = new Date();
    this.context = options?.context;
    this.originalError = options?.originalError;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

// Error handler configuration
interface ErrorHandlerConfig {
  logToConsole: boolean;
  logToService: boolean;
  showUserNotification: boolean;
  isDevelopment: boolean;
}

// Default configuration
const defaultConfig: ErrorHandlerConfig = {
  logToConsole: true,
  logToService: true, // Enable analytics tracking by default
  showUserNotification: true,
  isDevelopment: process.env.NODE_ENV === 'development',
};

class ErrorHandler {
  private config: ErrorHandlerConfig;
  private errorQueue: AppError[] = [];
  private maxQueueSize = 100;

  constructor(config?: Partial<ErrorHandlerConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Main error handling method
   */
  public handle(
    error: Error | AppError | unknown,
    context?: Record<string, unknown>
  ): void {
    const appError = this.normalizeError(error, context);

    // Add to error queue
    this.addToQueue(appError);

    // Log the error
    this.logError(appError);

    // Send to external service if configured
    if (this.config.logToService) {
      this.sendToService(appError);
    }

    // Show user notification for high severity errors
    if (
      this.config.showUserNotification &&
      (appError.severity === ErrorSeverity.HIGH ||
        appError.severity === ErrorSeverity.CRITICAL)
    ) {
      this.notifyUser(appError);
    }
  }

  /**
   * Handle async errors with Promise rejection
   */
  public async handleAsync<T>(
    promise: Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T | null> {
    try {
      return await promise;
    } catch (error) {
      this.handle(error, context);
      return null;
    }
  }

  /**
   * Normalize various error types to AppError
   */
  private normalizeError(
    error: Error | AppError | unknown,
    context?: Record<string, unknown>
  ): AppError {
    // Already an AppError
    if (error instanceof AppError) {
      if (context) {
        // Create a new AppError with merged context
        return new AppError(error.message, {
          severity: error.severity,
          category: error.category,
          context: { ...error.context, ...context },
          originalError: error.originalError,
        });
      }
      return error;
    }

    // Standard Error
    if (error instanceof Error) {
      return new AppError(error.message, {
        category: this.categorizeError(error),
        context,
        originalError: error,
      });
    }

    // Unknown error type
    return new AppError('An unknown error occurred', {
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.UNKNOWN,
      context: { ...context, originalError: error },
    });
  }

  /**
   * Categorize standard errors
   */
  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
      return ErrorCategory.NETWORK;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }
    if (message.includes('unauthorized') || message.includes('401')) {
      return ErrorCategory.AUTHENTICATION;
    }
    if (message.includes('forbidden') || message.includes('403')) {
      return ErrorCategory.AUTHORIZATION;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Log error to console
   */
  private logError(error: AppError): void {
    if (!this.config.logToConsole) return;

    const logData = {
      message: error.message,
      severity: error.severity,
      category: error.category,
      timestamp: error.timestamp.toISOString(),
      context: error.context,
      stack: this.config.isDevelopment ? error.stack : undefined,
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        logger.error('Error occurred', logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('Warning occurred', logData);
        break;
      case ErrorSeverity.LOW:
        logger.info('Info', logData);
        break;
    }
  }

  /**
   * Send error to external logging service
   */
  private sendToService(error: AppError): void {
    // Track error to Google Analytics (respects user consent)
    const isFatal =
      error.severity === ErrorSeverity.CRITICAL ||
      error.severity === ErrorSeverity.HIGH;

    // Create error message with category for better tracking
    const errorMessage = `[${error.category}] ${error.message}`;

    // Track to analytics
    trackError(errorMessage, isFatal);

    // TODO: Implement additional integration with logging service
    // Example: Sentry, LogRocket, DataDog, etc.
    if (this.config.isDevelopment) {
      logger.debug('Error tracked to analytics', {
        message: error.message,
        severity: error.severity,
        category: error.category,
        isFatal,
      });
    }
  }

  /**
   * Show user-friendly notification
   */
  private notifyUser(error: AppError): void {
    // Get user-friendly message
    const userMessage = this.getUserMessage(error);

    // TODO: Integrate with your notification system
    // For now, just log to logger
    if (typeof window !== 'undefined') {
      logger.info('User notification', { message: userMessage });
    }
  }

  /**
   * Get user-friendly error message
   */
  private getUserMessage(error: AppError): string {
    switch (error.category) {
      case ErrorCategory.NETWORK:
        return 'Network error. Please check your connection and try again.';
      case ErrorCategory.VALIDATION:
        return 'Please check your input and try again.';
      case ErrorCategory.AUTHENTICATION:
        return 'Please log in to continue.';
      case ErrorCategory.AUTHORIZATION:
        return 'You do not have permission to perform this action.';
      case ErrorCategory.BUSINESS_LOGIC:
        return error.message; // Use the actual message for business logic errors
      default:
        return 'An unexpected error occurred. Please try again later.';
    }
  }

  /**
   * Add error to queue for batch processing
   */
  private addToQueue(error: AppError): void {
    this.errorQueue.push(error);

    // Prevent memory leaks by limiting queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }
  }

  /**
   * Get recent errors from queue
   */
  public getRecentErrors(count = 10): AppError[] {
    return this.errorQueue.slice(-count);
  }

  /**
   * Clear error queue
   */
  public clearQueue(): void {
    this.errorQueue = [];
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

// Export singleton instance and utility functions
export default errorHandler;

// Utility functions for common error scenarios
export const handleNetworkError = (
  message: string,
  context?: Record<string, unknown>
): void => {
  errorHandler.handle(
    new AppError(message, {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      context,
    })
  );
};

export const handleValidationError = (
  message: string,
  context?: Record<string, unknown>
): void => {
  errorHandler.handle(
    new AppError(message, {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      context,
    })
  );
};

export const handleAuthError = (
  message: string,
  context?: Record<string, unknown>
): void => {
  errorHandler.handle(
    new AppError(message, {
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.HIGH,
      context,
    })
  );
};

export const handleCriticalError = (
  message: string,
  context?: Record<string, unknown>
): void => {
  errorHandler.handle(
    new AppError(message, {
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.CRITICAL,
      context,
    })
  );
};
