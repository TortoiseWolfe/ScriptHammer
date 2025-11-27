'use client';

import React, { useState } from 'react';
import { createLogger } from '@/lib/logger/logger';

const logger = createLogger('components:atomic:CopyButton');

export interface CopyButtonProps {
  content: string;
  onCopySuccess?: () => void;
  onCopyError?: (error: Error) => void;
  className?: string;
}

/**
 * Copy button component with clipboard API integration
 * Provides visual feedback on copy success/failure
 */
export const CopyButton: React.FC<CopyButtonProps> = ({
  content,
  onCopySuccess,
  onCopyError,
  className = '',
}) => {
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>(
    'idle'
  );
  const [isAnimating, setIsAnimating] = useState(false);

  const handleCopy = async () => {
    try {
      // Check if Clipboard API is available
      if (!navigator.clipboard) {
        throw new Error('Clipboard API not available');
      }

      await navigator.clipboard.writeText(content);
      setCopyState('success');
      setIsAnimating(true);

      // Call success callback
      onCopySuccess?.();

      // Reset state after animation
      setTimeout(() => {
        setCopyState('idle');
        setIsAnimating(false);
      }, 2000);
    } catch (error) {
      logger.error('Failed to copy', { error });
      setCopyState('error');
      setIsAnimating(true);

      // Call error callback
      onCopyError?.(error as Error);

      // Reset state after showing error
      setTimeout(() => {
        setCopyState('idle');
        setIsAnimating(false);
      }, 3000);
    }
  };

  const getIcon = () => {
    switch (copyState) {
      case 'success':
        return (
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        );
      case 'error':
        return (
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
      default:
        return (
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        );
    }
  };

  const getButtonClass = () => {
    const baseClass = 'btn btn-xs btn-ghost';
    const stateClass =
      copyState === 'success'
        ? 'text-success'
        : copyState === 'error'
          ? 'text-error'
          : '';
    const animationClass = isAnimating ? 'animate-pulse' : '';

    return `${baseClass} ${stateClass} ${animationClass} ${className}`.trim();
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={getButtonClass()}
      aria-label={
        copyState === 'success'
          ? 'Copied!'
          : copyState === 'error'
            ? 'Copy failed'
            : 'Copy code to clipboard'
      }
      disabled={isAnimating}
    >
      <span className="sr-only">
        {copyState === 'success'
          ? 'Copied to clipboard'
          : copyState === 'error'
            ? 'Failed to copy'
            : 'Copy to clipboard'}
      </span>
      <span
        className={`transition-transform ${isAnimating ? 'scale-110' : ''}`}
      >
        {getIcon()}
      </span>
      <span className="ml-1 text-xs">
        {copyState === 'success'
          ? 'Copied!'
          : copyState === 'error'
            ? 'Failed'
            : 'Copy'}
      </span>
    </button>
  );
};
