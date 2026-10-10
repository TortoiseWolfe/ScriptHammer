/**
 * Send contact messages that were saved while the visitor was offline (#1321).
 *
 * WHAT THIS REPLACES. The old path relied on the service worker, and it could not work:
 * - The page registered the Background Sync tag `form-submission-sync`, but `public/sw.js`
 *   only handles `sync-offline-queue`. Even that handler only posts `SYNC_OFFLINE_QUEUE` to
 *   open pages, and nothing listens for it.
 * - The foreground fallback switched itself off wherever `SyncManager` exists, so on Chrome
 *   and Edge a saved message was never attempted at all.
 * - Elsewhere it replayed through Web3Forms only, which production has no key for, and
 *   deleted the message after three failures. The visitor had been told it would be sent.
 *
 * WHY THE PAGE SENDS, NOT THE WORKER. Every send needs a fresh single-use Turnstile token
 * (#1319), and only a rendered page can obtain one. So `ContactQueueSender`, mounted once in
 * the root layout, gets a token whenever the queue is non-empty and the visitor is online,
 * and calls `sendNextQueued` with it. The message goes through `EmailService`, which is the
 * same contact function as an online submit, with its idempotency key (#1322). So a send
 * whose response was lost and is then retried still delivers once.
 *
 * NOTHING IS DISCARDED SILENTLY. A message leaves the queue only when it was sent, or when
 * the visitor discards it themselves.
 */

import { emailService } from '@/utils/email/email-service';
import { formatErrorMessage } from '@/utils/web3forms';
import {
  getQueuedItems,
  removeFromQueue,
  updateRetryCount,
} from './offline-queue';

/** Fired on `window` whenever the saved-message queue changes. */
export const QUEUE_CHANGED_EVENT = 'contact-queue:changed';

export function notifyQueueChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
  }
}

export type QueuedSendResult =
  | { outcome: 'empty' }
  | { outcome: 'sent'; remaining: number }
  | { outcome: 'failed'; message: string; remaining: number };

/**
 * Send the oldest saved message. One message per call, because a Turnstile token is
 * single-use, so the caller fetches a fresh token for each.
 */
export async function sendNextQueued(
  captchaToken: string | null
): Promise<QueuedSendResult> {
  const items = await getQueuedItems();
  const item = items[0];
  if (!item || item.id === undefined) return { outcome: 'empty' };

  const data = item.data;
  try {
    await emailService.send({
      name: String(data.name ?? ''),
      email: String(data.email ?? ''),
      subject: String(data.subject ?? ''),
      message: String(data.message ?? ''),
      ...(captchaToken ? { captchaToken } : {}),
    });
  } catch (error) {
    // Kept, not dropped: the visitor was told this would be sent.
    await updateRetryCount(item.id, item.retryCount + 1);
    return {
      outcome: 'failed',
      message: formatErrorMessage(
        error instanceof Error ? error : new Error(String(error))
      ),
      remaining: items.length,
    };
  }

  await removeFromQueue(item.id);
  notifyQueueChanged();
  return { outcome: 'sent', remaining: items.length - 1 };
}

/** The visitor chose to give up on the oldest saved message. */
export async function discardNextQueued(): Promise<void> {
  const [item] = await getQueuedItems();
  if (item?.id !== undefined) {
    await removeFromQueue(item.id);
    notifyQueueChanged();
  }
}
