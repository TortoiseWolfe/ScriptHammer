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

  // Sync queue with server.
  //
  // Guard only on the in-flight flag. Historically this also early-returned
  // on `!navigator.onLine`, but Playwright's `context.setOffline(false)` on
  // firefox and webkit does not reliably flip `navigator.onLine` back to
  // true — meaning tests that queue messages while offline then reconnect
  // never flush, because this gate sees the stale `false` (observed in run
  // 24638748630 T149: both firefox-msg and webkit-msg fail here; the
  // offline-queue-service insert POSTs never fire). If we actually are
  // offline at this moment, the underlying REST insert will fail and the
  // queued entry gets retried — same outcome, one fewer layer of staleness.
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

  // Expose syncQueue on window as a test escape hatch. E2E tests that
  // emulate an offline → online transition via context.setOffline() cannot
  // always rely on Playwright to dispatch the window 'online' event on
  // firefox/webkit; rather than continuing to guess at why our listeners
  // don't fire, give the test a deterministic way to request a flush. Only
  // enabled when the E2E flag is present in localStorage (production users
  // never have this). Runs in the same mount-lifecycle useEffect so it
  // tears down with the hook.
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
    win.__scripthammer_syncQueue = async () => {
      console.log('[useOfflineQueue] sync trigger: test-hook');
      const queueBefore = await offlineQueueService
        .getQueue()
        .catch((e: Error) => ({ error: e.message }));
      console.log(
        `[useOfflineQueue] queue-before: ${JSON.stringify(queueBefore).slice(0, 400)}`
      );
      let result: unknown = null;
      let error: string | null = null;
      try {
        await syncQueue();
        result = 'ok';
      } catch (e) {
        error = (e as Error).message || String(e);
      }
      const queueAfter = await offlineQueueService
        .getQueue()
        .catch((e: Error) => ({ error: e.message }));
      console.log(
        `[useOfflineQueue] queue-after: ${JSON.stringify(queueAfter).slice(0, 400)}`
      );
      console.log(
        `[useOfflineQueue] sync-result: ${JSON.stringify({ result, error })}`
      );
      return { queueBefore, queueAfter, error };
    };
    return () => {
      delete win.__scripthammer_syncQueue;
    };
  }, [syncQueue]);

  // Handle online/offline/visibility/focus events - opportunistic sync.
  //
  // The window 'online' event is the primary trigger, but Playwright's
  // context.setOffline(false) on firefox and webkit does not reliably flip
  // navigator.onLine back to true or dispatch the window 'online' event
  // (run 24638748630 T149: both firefox-msg and webkit-msg fail here after
  // offline-queuing two messages; the offline-queue-service insert POSTs
  // never fire). Belt-and-suspenders: also trigger sync on tab visibility
  // change and window focus. All guarded by the in-flight flag in
  // syncQueue itself (and offline-queue-service.ts has its own
  // syncInProgress guard), so duplicate triggers are idempotent. We do NOT
  // gate on navigator.onLine here — let the REST insert decide.
  useEffect(() => {
    const trigger = (reason: string) => {
      // Use console.log so Playwright's browser-console capture picks this up.
      // `console.debug` is filtered out of the default Playwright browser
      // console stream, which blinded us during T149 debugging (run
      // 24638748630). Leave as log until we're confident the trigger path
      // is reliable on all three browsers.
      console.log(`[useOfflineQueue] sync trigger: ${reason}`);
      syncQueue();
    };

    const handleOnline = () => {
      logger.info('Network online - triggering queue sync');
      setIsOnline(true);
      trigger('online-event');
    };

    const handleOffline = () => {
      logger.info('Network offline');
      setIsOnline(false);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        trigger('visibility-change');
      }
    };

    const handleFocus = () => {
      trigger('window-focus');
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

  // Load queue on mount and set up polling.
  // Every poll tick also tries to flush pending messages if we're online —
  // a safety net for when the browser's online event is missed (see the
  // visibility/focus listeners above for the same reason).
  useEffect(() => {
    loadQueue();

    const interval = setInterval(() => {
      loadQueue();
      console.log('[useOfflineQueue] sync trigger: 30s-poll');
      syncQueue();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadQueue, syncQueue]);

  // Trigger sync on mount if online and queue has items
  useEffect(() => {
    if (isOnline && queueCount > 0 && !isSyncing) {
      syncQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - intentionally omitting deps

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
