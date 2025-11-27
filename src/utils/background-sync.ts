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
import { createLogger } from '@/lib/logger';

const logger = createLogger('utils:backgroundSync');

const SYNC_TAG = 'form-submission-sync';
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // Start with 1 second

/**
 * Register background sync with Service Worker
 */
export async function registerBackgroundSync(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
    logger.debug('Not supported in this browser');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Type assertion for TypeScript - SyncManager is not in standard types yet
    const reg = registration as ServiceWorkerRegistration & {
      sync: { register: (tag: string) => Promise<void> };
    };
    await reg.sync.register(SYNC_TAG);
    logger.info('Registered successfully');
    return true;
  } catch (error) {
    logger.error('Registration failed', { error });
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
    logger.debug('Processing submission', { submissionId: submission.id });

    // Attempt to submit
    const response = await submitWithRetry(
      submission.data as ContactFormData,
      0 // No retries in background sync, we'll handle retry with queue
    );

    if (response.success) {
      logger.info('Submission successful', { submissionId: submission.id });
      await removeFromQueue(submission.id!);
      return true;
    } else {
      throw new Error(response.message || 'Submission failed');
    }
  } catch (error) {
    logger.error('Submission failed', {
      submissionId: submission.id,
      error,
    });

    // Update retry count
    const newRetryCount = submission.retryCount + 1;

    if (newRetryCount >= MAX_RETRIES) {
      logger.warn('Max retries reached, removing from queue', {
        submissionId: submission.id,
      });
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
  logger.debug('Processing queue...');

  try {
    const items = await getQueuedItems();
    logger.debug('Found items in queue', { count: items.length });

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
          logger.debug('Skipping item, not enough time since last attempt', {
            itemId: item.id,
          });
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
    logger.error('Queue processing error', { error });
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
      logger.error('Error getting sync tags', { error });
    }
  }

  try {
    const items = await getQueuedItems();
    queueSize = items.length;
  } catch (error) {
    logger.error('Error getting queue size', { error });
  }

  return { supported, registered, queueSize };
}
