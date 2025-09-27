'use client';

import { useState, useEffect, useCallback } from 'react';
import { addToQueue, getQueueSize } from '@/utils/offline-queue';
import {
  registerBackgroundSync,
  isBackgroundSyncSupported as checkBackgroundSyncSupport,
} from '@/utils/background-sync';

export interface UseOfflineQueueOptions {
  onQueueAdd?: (data: Record<string, unknown>) => void;
  onOnline?: () => void;
  onOffline?: () => void;
}

export interface UseOfflineQueueReturn {
  isOnline: boolean;
  isBackgroundSyncSupported: boolean;
  queueSize: number;
  addToOfflineQueue: (data: Record<string, unknown>) => Promise<boolean>;
  refreshQueueSize: () => Promise<void>;
}

/**
 * Hook for managing offline queue and network status
 */
export function useOfflineQueue(
  options: UseOfflineQueueOptions = {}
): UseOfflineQueueReturn {
  const { onQueueAdd, onOnline, onOffline } = options;

  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  );
  const [queueSize, setQueueSize] = useState(0);
  const [isBackgroundSyncSupported] = useState(() =>
    typeof window !== 'undefined' ? checkBackgroundSyncSupport() : false
  );

  // Refresh queue size
  const refreshQueueSize = useCallback(async () => {
    try {
      const size = await getQueueSize();
      setQueueSize(size);
    } catch (error) {
      console.error('Error getting queue size:', error);
    }
  }, []);

  // Add to offline queue
  const addToOfflineQueue = useCallback(
    async (data: Record<string, unknown>): Promise<boolean> => {
      try {
        const success = await addToQueue(data);

        if (success) {
          await refreshQueueSize();

          // Register for background sync if supported
          if (isBackgroundSyncSupported) {
            await registerBackgroundSync();
          }

          onQueueAdd?.(data);
        }

        return success;
      } catch (error) {
        console.error('Error adding to offline queue:', error);
        return false;
      }
    },
    [isBackgroundSyncSupported, onQueueAdd, refreshQueueSize]
  );

  // Handle online/offline events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      refreshQueueSize();
      onOnline?.();

      // Register background sync when coming online
      if (isBackgroundSyncSupported) {
        registerBackgroundSync();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      onOffline?.();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for background sync completion messages from Service Worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BACKGROUND_SYNC_COMPLETE') {
        refreshQueueSize();
      }
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }

    // Initial queue size check
    refreshQueueSize();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if ('serviceWorker' in navigator && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
    };
  }, [isBackgroundSyncSupported, onOnline, onOffline, refreshQueueSize]);

  return {
    isOnline,
    isBackgroundSyncSupported,
    queueSize,
    addToOfflineQueue,
    refreshQueueSize,
  };
}
