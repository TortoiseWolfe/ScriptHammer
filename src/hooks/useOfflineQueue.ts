'use client';

/**
 * useOfflineQueue Hook
 * Tasks: T158-T161
 *
 * Provides offline message queue management with automatic sync:
 * - Monitor queue count
 * - Trigger sync on 'online' event
 * - Show queue processing status
 * - Manual retry for failed messages
 */

import { useState, useEffect, useCallback } from 'react';
import { offlineQueueService } from '@/services/messaging/offline-queue-service';
import type { QueuedMessage } from '@/types/messaging';

export interface UseOfflineQueueReturn {
  /** Queued messages (unsynced) */
  queue: QueuedMessage[];
  /** Number of queued messages */
  queueCount: number;
  /** Number of failed messages */
  failedCount: number;
  /** Whether queue is currently syncing */
  isSyncing: boolean;
  /** Whether user is online */
  isOnline: boolean;
  /** Manually trigger queue sync */
  syncQueue: () => Promise<void>;
  /** Retry all failed messages */
  retryFailed: () => Promise<void>;
  /** Clear all synced messages */
  clearSynced: () => Promise<void>;
  /** Get all failed messages */
  getFailedMessages: () => Promise<QueuedMessage[]>;
}

/**
 * Hook for managing offline message queue
 *
 * Features:
 * - Automatic sync on reconnection (online event)
 * - Queue count tracking
 * - Manual sync and retry
 * - Network status monitoring
 *
 * @returns UseOfflineQueueReturn - Queue state and control functions
 *
 * @example
 * ```typescript
 * function ChatWindow() {
 *   const { queueCount, isSyncing, syncQueue, isOnline } = useOfflineQueue();
 *
 *   return (
 *     <div>
 *       {!isOnline && <p>Offline mode - messages will sync when online</p>}
 *       {queueCount > 0 && <p>{queueCount} messages queued</p>}
 *       {isSyncing && <p>Syncing messages...</p>}
 *       <button onClick={syncQueue}>Retry Now</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useOfflineQueue(): UseOfflineQueueReturn {
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Load queue data
  const loadQueue = useCallback(async () => {
    try {
      const queuedMessages = await offlineQueueService.getQueue();
      const failedMessages = await offlineQueueService.getFailedMessages();

      setQueue(queuedMessages);
      setQueueCount(queuedMessages.length);
      setFailedCount(failedMessages.length);
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }, []);

  // Sync queue with server
  const syncQueue = useCallback(async () => {
    if (!navigator.onLine || isSyncing) {
      return;
    }

    setIsSyncing(true);

    try {
      const result = await offlineQueueService.syncQueue();
      console.log(
        `Sync complete: ${result.success} successful, ${result.failed} failed`
      );

      // Reload queue to reflect changes
      await loadQueue();
    } catch (error) {
      console.error('Failed to sync queue:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, loadQueue]);

  // Retry all failed messages
  const retryFailed = useCallback(async () => {
    try {
      const count = await offlineQueueService.retryFailed();
      console.log(`Reset ${count} failed messages for retry`);

      // Reload queue
      await loadQueue();

      // Trigger sync
      await syncQueue();
    } catch (error) {
      console.error('Failed to retry messages:', error);
    }
  }, [loadQueue, syncQueue]);

  // Clear synced messages
  const clearSynced = useCallback(async () => {
    try {
      const count = await offlineQueueService.clearSyncedMessages();
      console.log(`Cleared ${count} synced messages`);

      await loadQueue();
    } catch (error) {
      console.error('Failed to clear synced messages:', error);
    }
  }, [loadQueue]);

  // Get failed messages
  const getFailedMessages = useCallback(async () => {
    return await offlineQueueService.getFailedMessages();
  }, []);

  // Handle online event - automatic sync
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network online - triggering queue sync');
      setIsOnline(true);
      syncQueue();
    };

    const handleOffline = () => {
      console.log('Network offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue]);

  // Load queue on mount and set up polling
  useEffect(() => {
    loadQueue();

    // Poll queue every 30 seconds to keep count updated
    const interval = setInterval(loadQueue, 30000);

    return () => clearInterval(interval);
  }, [loadQueue]);

  // Trigger sync on mount if online and queue has items
  useEffect(() => {
    if (isOnline && queueCount > 0 && !isSyncing) {
      syncQueue();
    }
  }, []); // Only run once on mount

  return {
    queue,
    queueCount,
    failedCount,
    isSyncing,
    isOnline,
    syncQueue,
    retryFailed,
    clearSynced,
    getFailedMessages,
  };
}
