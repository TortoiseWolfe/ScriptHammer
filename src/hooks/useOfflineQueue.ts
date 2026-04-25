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
import { createLogger } from '@/lib/logger';
import type { QueuedMessage } from '@/types/messaging';

const logger = createLogger('hooks:offlineQueue');

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
  /** Reload queue immediately (use after queuing a message to show it without waiting for poll) */
  refresh: () => Promise<void>;
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
      logger.error('Failed to load offline queue', { error });
    }
  }, []);

  // Sync queue with server. Guard only on the in-flight flag, not on
  // navigator.onLine — the latter is unreliable under Playwright emulation
  // and the underlying REST insert fails fast if truly offline anyway.
  const syncQueue = useCallback(async () => {
    if (isSyncing) {
      return;
    }

    setIsSyncing(true);

    try {
      const result = await offlineQueueService.syncQueue();
      logger.info('Sync complete', {
        success: result.success,
        failed: result.failed,
      });

      // Reload queue to reflect changes
      await loadQueue();
    } catch (error) {
      logger.error('Failed to sync queue', { error });
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, loadQueue]);

  // Retry all failed messages
  const retryFailed = useCallback(async () => {
    try {
      const count = await offlineQueueService.retryFailed();
      logger.info('Reset failed messages for retry', { count });

      // Reload queue
      await loadQueue();

      // Trigger sync
      await syncQueue();
    } catch (error) {
      logger.error('Failed to retry messages', { error });
    }
  }, [loadQueue, syncQueue]);

  // Clear synced messages
  const clearSynced = useCallback(async () => {
    try {
      const count = await offlineQueueService.clearSyncedMessages();
      logger.info('Cleared synced messages', { count });

      await loadQueue();
    } catch (error) {
      logger.error('Failed to clear synced messages', { error });
    }
  }, [loadQueue]);

  // Get failed messages
  const getFailedMessages = useCallback(async () => {
    return await offlineQueueService.getFailedMessages();
  }, []);

  // E2E test escape hatch: expose syncQueue on window so tests can request
  // a flush deterministically after emulated offline → online transitions,
  // without depending on browser-specific event dispatch. Only installed
  // when the playwright_e2e flag is in localStorage; production users never
  // have it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.localStorage?.getItem('playwright_e2e') !== 'true') {
        return;
      }
    } catch {
      return;
    }
    const win = window as unknown as Record<string, unknown>;
    win.__scripthammer_syncQueue = () => syncQueue();
    return () => {
      delete win.__scripthammer_syncQueue;
    };
  }, [syncQueue]);

  // Opportunistic sync on online / visibility / focus events. The window
  // 'online' event is the primary trigger; visibility-change and focus act
  // as belt-and-suspenders for real-world cases where the online event
  // isn't emitted (laptop wake, tab reactivation, some browser emulation).
  // All idempotent — syncQueue bails when isSyncing is true, and the
  // underlying service has its own syncInProgress guard.
  useEffect(() => {
    const handleOnline = () => {
      logger.info('Network online - triggering queue sync');
      setIsOnline(true);
      syncQueue();
    };

    const handleOffline = () => {
      logger.info('Network offline');
      setIsOnline(false);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncQueue();
      }
    };

    const handleFocus = () => {
      syncQueue();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [syncQueue]);

  // Load queue on mount and set up polling. Every poll tick also attempts
  // a sync as a safety net for any missed event trigger above.
  useEffect(() => {
    // On mount, read the queue length directly from the service (not from
    // React state, which is 0 until loadQueue's setState commits) so we
    // only kick off a sync if there's actually work to do. A previous
    // attempt used a separate "sync on mount" effect that read queueCount
    // from closure, but that closure was always 0 at mount time and the
    // intended sync silently never fired.
    void (async () => {
      await loadQueue();
      try {
        const queued = await offlineQueueService.getQueue();
        if (queued.length > 0) void syncQueue();
      } catch {
        // loadQueue already logged any error; nothing more to do.
      }
    })();

    const interval = setInterval(() => {
      loadQueue();
      syncQueue();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadQueue, syncQueue]);

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
    refresh: loadQueue,
  };
}
