'use client';

import { useEffect, useState, useCallback } from 'react';

export interface OfflineStatus {
  isOffline: boolean;
  wasOffline: boolean;
  lastOnline: Date | null;
  connectionSpeed: 'slow' | 'fast' | 'unknown';
}

export function useOfflineStatus() {
  const [status, setStatus] = useState<OfflineStatus>({
    isOffline: typeof window !== 'undefined' ? !navigator.onLine : false,
    wasOffline: false,
    lastOnline: null,
    connectionSpeed: 'unknown',
  });

  const checkConnectionSpeed = useCallback(() => {
    if ('connection' in navigator) {
      const conn = (
        navigator as unknown as { connection: { effectiveType?: string } }
      ).connection;
      if (conn?.effectiveType) {
        switch (conn.effectiveType) {
          case 'slow-2g':
          case '2g':
            return 'slow';
          case '3g':
          case '4g':
            return 'fast';
          default:
            return 'unknown';
        }
      }
    }
    return 'unknown';
  }, []);

  const updateStatus = useCallback(
    (isOffline: boolean) => {
      setStatus((prev) => ({
        isOffline,
        wasOffline: prev.isOffline && !isOffline,
        lastOnline: isOffline ? prev.lastOnline : new Date(),
        connectionSpeed: checkConnectionSpeed(),
      }));
    },
    [checkConnectionSpeed]
  );

  useEffect(() => {
    // Check initial state - only on client side
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      updateStatus(!navigator.onLine);
    }

    const handleOnline = () => updateStatus(false);
    const handleOffline = () => updateStatus(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check connection changes
    if ('connection' in navigator) {
      const conn = (
        navigator as unknown as {
          connection: {
            addEventListener?: (event: string, handler: () => void) => void;
          };
        }
      ).connection;
      conn?.addEventListener?.('change', () => {
        setStatus((prev) => ({
          ...prev,
          connectionSpeed: checkConnectionSpeed(),
        }));
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateStatus, checkConnectionSpeed]);

  return status;
}
