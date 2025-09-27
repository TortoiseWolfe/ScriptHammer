'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import errorHandler, {
  AppError,
  ErrorSeverity,
  ErrorCategory,
} from '@/utils/error-handler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  level?: 'page' | 'section' | 'component';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the whole app
 */
class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, level = 'component' } = this.props;

    // Log error using our error handler
    const appError = new AppError(error.message, {
      severity: this.getSeverityByLevel(level),
      category: ErrorCategory.SYSTEM,
      context: {
        componentStack: errorInfo.componentStack,
        level,
        errorBoundary: true,
      },
      originalError: error,
    });

    errorHandler.handle(appError);

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }

    // Update state with error info
    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Auto-reset after 10 seconds for non-critical errors
    if (level === 'component' && this.state.errorCount < 3) {
      this.scheduleReset(10000);
    }
  }

  override componentDidUpdate(prevProps: Props): void {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Reset on prop changes if enabled
    if (
      hasError &&
      prevProps.children !== this.props.children &&
      resetOnPropsChange
    ) {
      this.resetError();
    }

    // Reset when resetKeys change
    if (
      resetKeys &&
      prevProps.resetKeys &&
      this.hasResetKeyChanged(prevProps.resetKeys, resetKeys)
    ) {
      this.resetError();
    }
  }

  override componentWillUnmount(): void {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private getSeverityByLevel(level: string): ErrorSeverity {
    switch (level) {
      case 'page':
        return ErrorSeverity.CRITICAL;
      case 'section':
        return ErrorSeverity.HIGH;
      case 'component':
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  private hasResetKeyChanged(
    prevKeys: Array<string | number>,
    nextKeys: Array<string | number>
  ): boolean {
    return (
      prevKeys.length !== nextKeys.length ||
      prevKeys.some((key, index) => key !== nextKeys[index])
    );
  }

  private scheduleReset = (delay: number): void => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.resetTimeoutId = setTimeout(() => {
      this.resetError();
    }, delay);
  };

  private resetError = (): void => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleReset = (): void => {
    this.resetError();
    // Reset error count if manually reset
    this.setState({ errorCount: 0 });
  };

  override render(): ReactNode {
    const { hasError, error, errorInfo, errorCount } = this.state;
    const { children, fallback, level = 'component' } = this.props;

    if (hasError && error) {
      // Custom fallback provided
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <div className="error-boundary-fallback flex min-h-[200px] items-center justify-center p-4">
          <div className="card bg-base-100 w-full max-w-lg shadow-xl">
            <div className="card-body">
              <div className="mb-4 flex items-center gap-3">
                <div className="text-error">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-8 w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="card-title text-error">
                  {level === 'page'
                    ? 'Page Error'
                    : level === 'section'
                      ? 'Section Error'
                      : 'Something went wrong'}
                </h2>
              </div>

              <div className="space-y-2">
                <p className="text-base-content/70">
                  {level === 'page'
                    ? 'This page encountered an error and cannot be displayed.'
                    : level === 'section'
                      ? 'This section encountered an error.'
                      : 'This component encountered an error.'}
                </p>

                {process.env.NODE_ENV === 'development' && (
                  <details className="collapse-arrow bg-base-200 collapse">
                    <summary className="collapse-title text-sm font-medium">
                      Error Details
                    </summary>
                    <div className="collapse-content">
                      <div className="space-y-2 text-xs">
                        <div>
                          <strong>Error:</strong>
                          <pre className="bg-base-300 mt-1 rounded p-2 break-words whitespace-pre-wrap">
                            {error.message}
                          </pre>
                        </div>
                        {error.stack && (
                          <div>
                            <strong>Stack:</strong>
                            <pre className="bg-base-300 mt-1 max-h-40 overflow-auto rounded p-2 text-xs break-words whitespace-pre-wrap">
                              {error.stack}
                            </pre>
                          </div>
                        )}
                        {errorInfo?.componentStack && (
                          <div>
                            <strong>Component Stack:</strong>
                            <pre className="bg-base-300 mt-1 max-h-40 overflow-auto rounded p-2 text-xs break-words whitespace-pre-wrap">
                              {errorInfo.componentStack}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </details>
                )}

                {errorCount > 2 && (
                  <div className="alert alert-warning">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 shrink-0 stroke-current"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <span className="text-sm">
                      This component has crashed multiple times. Consider
                      refreshing the page.
                    </span>
                  </div>
                )}
              </div>

              <div className="card-actions mt-4 justify-end">
                <button
                  onClick={this.handleReset}
                  className="btn btn-primary btn-sm"
                >
                  Try Again
                </button>
                {level === 'page' && (
                  <button
                    onClick={() => (window.location.href = '/')}
                    className="btn btn-ghost btn-sm"
                  >
                    Go Home
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // No error, render children normally
    return children;
  }
}

export default ErrorBoundary;

/**
 * Hook for using error boundary imperatively
 */
export function useErrorHandler(): (error: Error) => void {
  return (error: Error) => {
    throw error;
  };
}
