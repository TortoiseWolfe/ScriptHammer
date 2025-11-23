'use client';

import React from 'react';
import { useNetworkStatus } from './useNetworkStatus';

export interface NetworkStatusProps {
  /** Whether to show compact mode (badge only) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * NetworkStatus component
 * Task: T119
 *
 * Displays online/offline network status indicator.
 * Shows badge with appropriate color and text.
 *
 * States:
 * - Online: Green badge with checkmark
 * - Offline: Red badge with warning icon
 * - Reconnected: Green badge with "Reconnected" text (3s duration)
 *
 * @category atomic
 */
export default function NetworkStatus({
  compact = false,
  className = '',
}: NetworkStatusProps) {
  const { isOnline, wasOffline } = useNetworkStatus();

  // Don't show anything if online and never was offline (default state)
  if (isOnline && !wasOffline) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-2${className ? ` ${className}` : ''}`}
      data-testid="network-status"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {isOnline ? (
        // Reconnected state (shows for 3 seconds)
        <>
          <div className="bg-success h-2 w-2 rounded-full" aria-hidden="true" />
          {!compact && (
            <span className="text-success text-sm">
              {wasOffline ? 'Reconnected' : 'Online'}
            </span>
          )}
        </>
      ) : (
        // Offline state
        <>
          <div
            className="bg-error h-2 w-2 animate-pulse rounded-full"
            aria-hidden="true"
          />
          {!compact && <span className="text-error text-sm">Offline</span>}
        </>
      )}
    </div>
  );
}
