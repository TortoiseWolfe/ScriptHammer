/**
 * PaymentQueuePanel
 *
 * User-facing management surface for the offline payment queue (#4). The queue
 * backend (paymentQueue, IndexedDB via Dexie) was already shipped; this is the
 * missing UI layer: live online/offline/syncing/queued status, the queued items
 * with their retry counts, a manual "Retry now" affordance (paymentQueue
 * retryFailed + sync), and a destructive "Clear queue" behind a confirmation.
 *
 * The queue API has no change emitter, so we poll getQueue() like
 * OfflineRetryBanner does.
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { paymentQueue } from '@/lib/offline-queue/payment-adapter';
import { DEFAULT_QUEUE_CONFIG } from '@/lib/offline-queue/types';
import type { PaymentQueueItem } from '@/lib/offline-queue/types';

export interface PaymentQueuePanelProps {
  /** Override the queue-poll interval (ms). */
  pollIntervalMs?: number;
  className?: string;
  testId?: string;
}

const DEFAULT_POLL_MS = 5_000;
const MAX_RETRIES = DEFAULT_QUEUE_CONFIG.maxRetries;

type ConnState = 'online' | 'offline' | 'syncing';

export const PaymentQueuePanel: React.FC<PaymentQueuePanelProps> = ({
  pollIntervalMs = DEFAULT_POLL_MS,
  className = '',
  testId = 'payment-queue-panel',
}) => {
  const { isOffline } = useOfflineStatus();
  const [items, setItems] = useState<PaymentQueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const queue = await paymentQueue.getQueue();
      setItems(queue);
    } catch {
      // Non-critical; leave the last-known list.
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, pollIntervalMs);
    return () => window.clearInterval(id);
  }, [refresh, pollIntervalMs]);

  const handleRetry = useCallback(async () => {
    setActionError(null);
    setSyncing(true);
    try {
      // Reset failed items to pending, then drain the queue.
      await paymentQueue.retryFailed();
      await paymentQueue.sync();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to retry queued payments'
      );
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [refresh]);

  const handleClear = useCallback(async () => {
    setActionError(null);
    try {
      await paymentQueue.clear();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to clear the queue'
      );
    } finally {
      setConfirmingClear(false);
      await refresh();
    }
  }, [refresh]);

  const pendingCount = items.filter(
    (i) => i.status === 'pending' || i.status === 'processing'
  ).length;
  const failedCount = items.filter((i) => i.status === 'failed').length;

  const connState: ConnState = isOffline
    ? 'offline'
    : syncing
      ? 'syncing'
      : 'online';

  const statusBadge =
    connState === 'offline' ? (
      <span
        className="badge badge-warning gap-1"
        data-testid="queue-conn-state"
      >
        Offline
      </span>
    ) : connState === 'syncing' ? (
      <span className="badge badge-info gap-1" data-testid="queue-conn-state">
        <span className="loading loading-spinner loading-xs" />
        Syncing
      </span>
    ) : (
      <span
        className="badge badge-success gap-1"
        data-testid="queue-conn-state"
      >
        Online
      </span>
    );

  return (
    <div
      className={`card bg-base-100 shadow-xl ${className}`}
      data-testid={testId}
    >
      <div className="card-body">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title">Offline Payment Queue</h2>
          {statusBadge}
        </div>

        <p className="text-base-content/85 text-sm" data-testid="queue-count">
          {items.length === 0
            ? 'No queued payments.'
            : `${pendingCount} pending` +
              (failedCount > 0 ? `, ${failedCount} failed` : '') +
              ` (${items.length} total)`}
        </p>

        {actionError && (
          <div className="alert alert-error p-2 text-xs" role="alert">
            <span>{actionError}</span>
          </div>
        )}

        {items.length > 0 && (
          <ul className="divide-base-300 divide-y" data-testid="queue-items">
            {items.map((item) => {
              const atMax = item.retries >= MAX_RETRIES;
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 py-2 text-sm"
                  data-testid={`queue-item-${item.id}`}
                >
                  <div className="min-w-0">
                    <span className="font-semibold capitalize">
                      {item.type.replace('_', ' ')}
                    </span>
                    {item.lastError && (
                      <span className="text-error block truncate text-xs">
                        {item.lastError}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`badge badge-sm ${atMax ? 'badge-error' : 'badge-ghost'}`}
                      data-testid={`queue-item-retries-${item.id}`}
                    >
                      {atMax
                        ? 'Max retries'
                        : `Attempt ${item.retries}/${MAX_RETRIES}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="card-actions mt-2 justify-end">
          <button
            type="button"
            className="btn btn-primary btn-sm min-h-11"
            onClick={handleRetry}
            disabled={syncing || isOffline || items.length === 0}
            data-testid="queue-retry"
            aria-label="Retry queued payments now"
          >
            {syncing ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Retrying…
              </>
            ) : (
              'Retry now'
            )}
          </button>

          {confirmingClear ? (
            <div
              className="flex items-center gap-2"
              data-testid="queue-clear-confirm"
            >
              <span className="text-xs">Clear all queued payments?</span>
              <button
                type="button"
                className="btn btn-error btn-sm min-h-11"
                onClick={handleClear}
                data-testid="queue-clear-confirm-yes"
                aria-label="Confirm clear queue"
              >
                Yes, clear
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm min-h-11"
                onClick={() => setConfirmingClear(false)}
                aria-label="Cancel clearing the queue"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-outline btn-error btn-sm min-h-11"
              onClick={() => setConfirmingClear(true)}
              disabled={items.length === 0}
              data-testid="queue-clear"
              aria-label="Clear queued payments"
            >
              Clear queue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

PaymentQueuePanel.displayName = 'PaymentQueuePanel';

export default PaymentQueuePanel;
