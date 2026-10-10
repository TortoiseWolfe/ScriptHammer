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

import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineQueueService } from '@/services/messaging/offline-queue-service';
import { createLogger } from '@/lib/logger';
import type { QueuedMessage } from '@/types/messaging';

/** Pause between retry passes; the service adds its own backoff per message. */
const FOLLOW_UP_DELAY_MS = 500;

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
  // Optimistic `true`, corrected after mount.
  //
  // Two bugs in the old initialiser. First, `typeof navigator !== 'undefined'`
  // is TRUE on the server — Node 18+ ships a global `navigator` — and its
  // `onLine` is `undefined`, which is falsy, so the SERVER rendered this app as
  // OFFLINE. On /contact that meant the server sent an offline warning where the
  // client renders the form, which is the React #418 hydration mismatch seen on
  // production (#466).
  //
  // Second, even a correct `typeof window` guard would still be able to
  // disagree with the server when a visitor really is offline at hydration.
  // Seeding both renders with the same value and correcting in an effect is the
  // only initialiser that cannot mismatch.
  const [isOnline, setIsOnline] = useState(true);

  // Load queue data. Returns the rows it read so a caller can decide what to
  // do next without waiting for the state update to commit.
  const loadQueue = useCallback(async (): Promise<QueuedMessage[]> => {
    try {
      const queuedMessages = await offlineQueueService.getQueue();
      const failedMessages = await offlineQueueService.getFailedMessages();

      setQueue(queuedMessages);
      setQueueCount(queuedMessages.length);
      setFailedCount(failedMessages.length);
      return queuedMessages;
    } catch (error) {
      logger.error('Failed to load offline queue', { error });
      return [];
    }
  }, []);

  // In-flight guard as a ref, not state (#1262). With `isSyncing` in
  // syncQueue's dependencies its identity changed twice per sync, which re-ran
  // the mount effect below, which synced again — forever, while any row sat in
  // the queue. The state still drives the UI; the ref is what gates re-entry.
  const syncingRef = useRef(false);

  // The retry driver. The service makes ONE attempt per message per pass, and
  // applies the exponential backoff (1s, 2s, 4s, 8s) itself before a retry, so
  // something has to call it again while a message is still pending. That
  // used to be the accidental identity loop above, which also never stopped:
  // it treated rows already marked `failed` as work. This schedules the next
  // pass only while a `pending` row remains, so it ends when every message has
  // either sent or failed.
  const followUpRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncQueueRef = useRef<() => Promise<void>>(async () => {});
  // False once unmounted. A pass still in flight at unmount finishes afterwards,
  // and without this it scheduled a follow-up the unmount cleanup had already
  // missed: a timer outliving the component, calling the service every
  // FOLLOW_UP_DELAY_MS while a message stayed pending, from a hook nobody renders.
  const mountedRef = useRef(true);

  // Sync queue with server. Guard only on the in-flight flag, not on
  // navigator.onLine — the latter is unreliable under Playwright emulation
  // and the underlying REST insert fails fast if truly offline anyway.
  const syncQueue = useCallback(async () => {
    if (syncingRef.current) {
      return;
    }

    syncingRef.current = true;
    setIsSyncing(true);
    if (followUpRef.current !== null) {
      clearTimeout(followUpRef.current);
      followUpRef.current = null;
    }

    let stillPending = false;
    try {
      const result = await offlineQueueService.syncQueue();
      logger.info('Sync complete', {
        success: result.success,
        failed: result.failed,
      });

      // Reload queue to reflect changes
      const remaining = await loadQueue();
      stillPending = remaining.some((m) => m.status === 'pending');
    } catch (error) {
      logger.error('Failed to sync queue', { error });
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }

    if (stillPending && mountedRef.current) {
      followUpRef.current = setTimeout(() => {
        followUpRef.current = null;
        void syncQueueRef.current();
      }, FOLLOW_UP_DELAY_MS);
    }
  }, [loadQueue]);
  syncQueueRef.current = syncQueue;

  // Cancel a scheduled follow-up pass on unmount, and stop an in-flight one
  // from scheduling another. Set to true here, not only at creation, because
  // StrictMode runs this effect's cleanup and then the effect again.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (followUpRef.current !== null) clearTimeout(followUpRef.current);
    };
  }, []);

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

    // Read the REAL value now that we are on the client. The state is seeded
    // `true` so SSR and hydration agree (#466); without this line a visitor who
    // loads the page already offline would be reported online until a
    // transition fired, which is the very case the offline queue is for.
    setIsOnline(navigator.onLine);

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
        // Only rows that can still be sent. getQueue() returns every unsynced
        // row, including ones marked `failed` after their last retry, so one
        // dead message used to make this true on every mount (#1262).
        const queued = await offlineQueueService.getQueue();
        if (queued.some((m) => m.status === 'pending')) void syncQueue();
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

  const refresh = useCallback(async () => {
    await loadQueue();
  }, [loadQueue]);

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
    refresh,
  };
}
