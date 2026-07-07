'use client';

import React from 'react';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

export interface QueueStatusIndicatorProps {
  /** Show retry button for failed messages */
  showRetryButton?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when retry is clicked */
  onRetry?: () => void;
}

/**
 * QueueStatusIndicator component
 * Tasks: T137
 *
 * Displays status of offline message queue:
 * - Queued message count
 * - Syncing indicator
 * - Failed message count with retry button
 * - Network status indicator
 *
 * @category atomic
 * @example
 * ```typescript
 * <QueueStatusIndicator showRetryButton onRetry={() => console.log('Retrying...')} />
 * ```
 */
export default function QueueStatusIndicator({
  showRetryButton = true,
  className = '',
  onRetry,
}: QueueStatusIndicatorProps) {
  const { queueCount, failedCount, isSyncing, isOnline, retryFailed } =
    useOfflineQueue();

  const handleRetry = async () => {
    onRetry?.();
    await retryFailed();
  };

  // Don't show anything if queue is empty and online
  if (queueCount === 0 && failedCount === 0 && isOnline) {
    return null;
  }

  return (
    <div
      className={`bg-base-200 flex items-center gap-2 rounded-lg px-4 py-2 text-sm${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Network status */}
      {!isOnline && (
        <div className="text-warning flex items-center gap-1">
          <span className="bg-warning h-2 w-2 rounded-full"></span>
          <span>Offline</span>
        </div>
      )}

      {/* Syncing indicator */}
      {isSyncing && (
        <div className="text-info flex items-center gap-1">
          <span className="loading loading-spinner loading-xs"></span>
          <span>Syncing...</span>
        </div>
      )}

      {/* Queued messages count */}
      {queueCount > 0 && !isSyncing && (
        <div className="text-info flex items-center gap-1">
          <span className="bg-info h-2 w-2 rounded-full"></span>
          <span>
            {queueCount} message{queueCount > 1 ? 's' : ''} queued
          </span>
        </div>
      )}

      {/* Failed messages count with retry button */}
      {failedCount > 0 && (
        <>
          <div className="text-error flex items-center gap-1">
            <span className="bg-error h-2 w-2 rounded-full"></span>
            <span>{failedCount} failed</span>
          </div>

          {showRetryButton && (
            <button
              type="button"
              onClick={handleRetry}
              className="btn btn-error btn-xs min-h-11 min-w-11"
              aria-label="Retry failed messages"
            >
              Retry
            </button>
          )}
        </>
      )}
    </div>
  );
}
