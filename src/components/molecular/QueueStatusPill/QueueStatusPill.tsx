'use client';

import React, { useEffect, useState } from 'react';
import QueueStatusIndicator from '@/components/atomic/QueueStatusIndicator';
import {
  estimateStorage,
  formatStorageUsage,
  type StorageEstimateResult,
} from '@/lib/offline-queue/storage-quota';

export interface QueueStatusPillProps {
  /** Show retry button for failed messages (passed through to the indicator). */
  showRetryButton?: boolean;
  /** Callback when retry is clicked. */
  onRetry?: () => void;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * QueueStatusPill component (#32, feature 020).
 *
 * Composes the atomic QueueStatusIndicator (queued / syncing / failed / offline)
 * with a **storage-quota warning**: when the origin's IndexedDB usage is at/over
 * 80% of quota, it surfaces a warning so the user knows the offline queue may
 * stop persisting new items. Storage info degrades gracefully — browsers without
 * the StorageManager API simply show no warning.
 *
 * @category molecular
 */
export default function QueueStatusPill({
  showRetryButton = true,
  onRetry,
  className = '',
}: QueueStatusPillProps) {
  const [storage, setStorage] = useState<StorageEstimateResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void estimateStorage().then((result) => {
      if (!cancelled) setStorage(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const showStorageWarning = storage?.warning === true;

  return (
    <div className={`queue-status-pill${className ? ` ${className}` : ''}`}>
      <QueueStatusIndicator
        showRetryButton={showRetryButton}
        onRetry={onRetry}
      />

      {showStorageWarning && (
        <div
          role="alert"
          className="alert alert-warning mt-2 text-sm"
          aria-live="polite"
        >
          <span>
            Device storage is almost full
            {formatStorageUsage(storage.usage, storage.quota)
              ? ` (${formatStorageUsage(storage.usage, storage.quota)})`
              : ''}
            . Queued messages may not be saved until you free up space or come
            back online.
          </span>
        </div>
      )}
    </div>
  );
}
