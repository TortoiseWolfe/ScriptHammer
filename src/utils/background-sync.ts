/**
 * Background sync management for offline form submissions
 */

import { submitWithRetry } from './web3forms';
import {
  getQueuedItems,
  removeFromQueue,
  updateRetryCount,
  type QueuedSubmission,
} from './offline-queue';
import type { ContactFormData } from '@/schemas/contact.schema';

const SYNC_TAG = 'form-submission-sync';
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // Start with 1 second

/**
 * Register background sync with Service Worker
 */
export async function registerBackgroundSync(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
    console.log('[Background Sync] Not supported in this browser');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Type assertion for TypeScript - SyncManager is not in standard types yet
    const reg = registration as ServiceWorkerRegistration & {
      sync: { register: (tag: string) => Promise<void> };
    };
    await reg.sync.register(SYNC_TAG);
    console.log('[Background Sync] Registered successfully');
    return true;
  } catch (error) {
    console.error('[Background Sync] Registration failed:', error);
    return false;
  }
}

/**
 * Process a single queued submission
 */
async function processQueuedSubmission(
  submission: QueuedSubmission
): Promise<boolean> {
  try {
    console.log(`[Background Sync] Processing submission ${submission.id}`);

    // Attempt to submit
    const response = await submitWithRetry(
      submission.data as ContactFormData,
      0 // No retries in background sync, we'll handle retry with queue
    );

    if (response.success) {
      console.log(`[Background Sync] Submission ${submission.id} successful`);
      await removeFromQueue(submission.id!);
      return true;
    } else {
      throw new Error(response.message || 'Submission failed');
    }
  } catch (error) {
    console.error(
      `[Background Sync] Submission ${submission.id} failed:`,
      error
    );

    // Update retry count
    const newRetryCount = submission.retryCount + 1;

    if (newRetryCount >= MAX_RETRIES) {
      console.log(
        `[Background Sync] Max retries reached for ${submission.id}, removing from queue`
      );
      await removeFromQueue(submission.id!);

      // Could store in a "failed" queue or notify user
      return false;
    }

    await updateRetryCount(submission.id!, newRetryCount);
    return false;
  }
}

/**
 * Process all queued submissions
 * Called by Service Worker during sync event
 */
export async function processQueue(): Promise<void> {
  console.log('[Background Sync] Processing queue...');

  try {
    const items = await getQueuedItems();
    console.log(`[Background Sync] Found ${items.length} items in queue`);

    if (items.length === 0) {
      return;
    }

    // Process items sequentially with delay between attempts
    for (const item of items) {
      // Check if enough time has passed since last attempt
      if (item.lastAttempt) {
        const timeSinceLastAttempt = Date.now() - item.lastAttempt;
        const requiredDelay = RETRY_DELAY_BASE * Math.pow(2, item.retryCount);

        if (timeSinceLastAttempt < requiredDelay) {
          console.log(
            `[Background Sync] Skipping ${item.id}, not enough time since last attempt`
          );
          continue;
        }
      }

      await processQueuedSubmission(item);

      // Small delay between submissions to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Check if there are still items in queue
    const remainingItems = await getQueuedItems();
    if (remainingItems.length > 0) {
      // Register for another sync
      await registerBackgroundSync();
    }
  } catch (error) {
    console.error('[Background Sync] Queue processing error:', error);
  }
}

/**
 * Check if background sync is supported
 */
export function isBackgroundSyncSupported(): boolean {
  return 'serviceWorker' in navigator && 'SyncManager' in window;
}

/**
 * Get sync status for debugging
 */
export async function getSyncStatus(): Promise<{
  supported: boolean;
  registered: boolean;
  queueSize: number;
}> {
  const supported = isBackgroundSyncSupported();
  let registered = false;
  let queueSize = 0;

  if (supported) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const reg = registration as ServiceWorkerRegistration & {
        sync: { getTags: () => Promise<string[]> };
      };
      const tags = await reg.sync.getTags();
      registered = tags.includes(SYNC_TAG);
    } catch (error) {
      console.error('[Background Sync] Error getting sync tags:', error);
    }
  }

  try {
    const items = await getQueuedItems();
    queueSize = items.length;
  } catch (error) {
    console.error('[Background Sync] Error getting queue size:', error);
  }

  return { supported, registered, queueSize };
}
