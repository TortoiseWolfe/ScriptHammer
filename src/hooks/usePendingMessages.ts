'use client';

/**
 * usePendingMessages Hook
 *
 * Manages the optimistic-UI layer for queued outgoing messages.
 *
 * - Holds full {@link PendingMessage} objects in local state so the thread
 *   renders immediately on `addPending` (no waiting for the queue poll).
 * - Plaintext content is session-only (the IndexedDB queue stores ciphertext).
 * - Syncs `status` / `retries` from the underlying offline queue
 *   via {@link useOfflineQueue} when the queue poll catches up.
 * - Prunes an entry only after it has been seen in the queue poll AND has
 *   since disappeared (synced + cleared) or is marked `sent`.
 * - Fires `onSynced` so the page can reload real messages after sync.
 * - Provides a per-message `retry` that resets a failed item and re-syncs.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useOfflineQueue } from './useOfflineQueue';
import { createLogger } from '@/lib/logger';
import type { PendingMessage, QueueStatus } from '@/types/messaging';

const logger = createLogger('hooks:pendingMessages');

export interface UsePendingMessagesReturn {
  /** Pending messages for the active conversation, chronologically sorted */
  pendingMessages: PendingMessage[];
  /** Register a freshly-queued message so it appears in the thread */
  addPending: (id: string, content: string) => void;
  /** Retry a single failed queued message (resets retries, re-triggers sync) */
  retryMessage: (id: string) => Promise<void>;
  /** Remove a pending entry from local state (does NOT touch the queue) */
  removePending: (id: string) => void;
}

/**
 * @param conversationId - Active conversation; pending state is scoped to it.
 *                         When it changes, all local state is cleared.
 * @param onSynced       - Called when one or more pending entries have been
 *                         detected as synced (so the page can reload the
 *                         real message from Supabase).
 */
export function usePendingMessages(
  conversationId: string | null,
  onSynced?: () => void
): UsePendingMessagesReturn {
  // Full pending-message objects keyed by queue ID. Session-only.
  const [pendingById, setPendingById] = useState<Map<string, PendingMessage>>(
    () => new Map()
  );

  // IDs that have appeared in the queue poll at least once. An entry is only
  // eligible for pruning once it's been seen AND is now gone/sent — this
  // avoids a race where `addPending` creates an entry before the poll catches
  // up and the pruning effect deletes it as "not in queue".
  const seenInQueueRef = useRef<Set<string>>(new Set());

  // Ref-boxed callback so the effect doesn't need it as a dependency.
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  const { queue, syncQueue } = useOfflineQueue();

  // Reset all local state when the conversation changes.
  useEffect(() => {
    setPendingById(new Map());
    seenInQueueRef.current = new Set();
  }, [conversationId]);

  const addPending = useCallback(
    (id: string, content: string) => {
      if (!conversationId) return;
      setPendingById((prev) => {
        const next = new Map(prev);
        next.set(id, {
          id,
          conversation_id: conversationId,
          content,
          status: 'pending',
          retries: 0,
          created_at: new Date().toISOString(),
        });
        return next;
      });
    },
    [conversationId]
  );

  const removePending = useCallback((id: string) => {
    setPendingById((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const retryMessage = useCallback(
    async (id: string) => {
      try {
        // offlineQueueService.retryFailed() resets ALL failed messages. We
        // want a single-message reset, so update the record directly.
        const { messagingDb } = await import('@/lib/messaging/database');
        await messagingDb.messaging_queued_messages.update(id, {
          status: 'pending' as QueueStatus,
          retries: 0,
        });
        // Optimistically reflect the reset in local state so the spinner
        // shows immediately (queue poll is on a 30s interval).
        setPendingById((prev) => {
          const pm = prev.get(id);
          if (!pm) return prev;
          const next = new Map(prev);
          next.set(id, { ...pm, status: 'pending', retries: 0 });
          return next;
        });
        logger.info('Reset queued message for retry', { id });
        await syncQueue();
      } catch (error) {
        logger.error('Failed to retry queued message', { id, error });
      }
    },
    [syncQueue]
  );

  // Sync status/retries from the live queue and prune synced entries.
  useEffect(() => {
    if (pendingById.size === 0) return;

    const queueById = new Map(queue.map((qm) => [qm.id, qm]));

    // Mark all current queue IDs as "seen" so they become eligible for
    // pruning once they later disappear.
    for (const id of queueById.keys()) {
      seenInQueueRef.current.add(id);
    }

    let changed = false;
    let anySynced = false;
    const next = new Map(pendingById);

    for (const [id, pm] of pendingById) {
      const qm = queueById.get(id);

      if (qm) {
        if (qm.status === 'sent') {
          // Synced successfully while still in the poll window — remove.
          next.delete(id);
          changed = true;
          anySynced = true;
        } else if (qm.status !== pm.status || qm.retries !== pm.retries) {
          next.set(id, { ...pm, status: qm.status, retries: qm.retries });
          changed = true;
        }
      } else if (seenInQueueRef.current.has(id)) {
        // Was in queue before, now gone (synced + cleared) — remove.
        next.delete(id);
        changed = true;
        anySynced = true;
      }
      // Else: never seen in queue yet. Poll hasn't caught up — keep as-is.
    }

    if (changed) {
      setPendingById(next);
    }
    if (anySynced) {
      onSyncedRef.current?.();
    }
    // pendingById is read but intentionally omitted: the effect's state
    // update bails when `changed` is false, so re-firing on queue change
    // is all that's needed. Including pendingById would loop on the
    // setPendingById call above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  const pendingMessages = useMemo<PendingMessage[]>(() => {
    if (!conversationId) return [];
    return Array.from(pendingById.values())
      .filter((pm) => pm.conversation_id === conversationId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [pendingById, conversationId]);

  return {
    pendingMessages,
    addPending,
    retryMessage,
    removePending,
  };
}
