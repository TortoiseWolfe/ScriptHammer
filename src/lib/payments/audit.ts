/**
 * Payment-specific audit logging.
 *
 * Thin wrapper around `logAuthEvent` (`src/lib/auth/audit-logger.ts:55`)
 * that gives payment retry attempts a consistent event-data shape so the
 * admin audit dashboard at `/admin/audit` can render them without a
 * separate code path.
 *
 * Non-throwing — matches the existing audit-logger contract. An audit
 * write failure must never break the user's payment flow.
 */

import { logAuthEvent } from '@/lib/auth/audit-logger';
import { createLogger } from '@/lib/logger';
import type { PaymentErrorCategory } from './error-categorization';

const logger = createLogger('lib:payments:audit');

export interface PaymentRetryAuditParams {
  userId: string;
  originalIntentId: string;
  /** null when the retry was deduped by the unique idempotency_key index */
  newIntentId: string | null;
  retryCount: number;
  /** true when the upsert hit ON CONFLICT (server-side dedupe) */
  deduped: boolean;
  errorCategory?: PaymentErrorCategory;
}

/**
 * Record a payment retry attempt. NFR-007.
 *
 * Writes a `payment_retry` row to `auth_audit_logs` with:
 *   - user_id: the authenticated user
 *   - event_data: structured retry metadata (admin dashboard reads this)
 *   - success: false when deduped (the retry produced no new charge),
 *              true when a new intent was created
 */
export async function logPaymentRetryEvent(
  params: PaymentRetryAuditParams
): Promise<void> {
  try {
    await logAuthEvent({
      user_id: params.userId,
      event_type: 'payment_retry',
      event_data: {
        original_intent_id: params.originalIntentId,
        new_intent_id: params.newIntentId,
        retry_count: params.retryCount,
        deduped: params.deduped,
        ...(params.errorCategory !== undefined && {
          error_category: params.errorCategory,
        }),
      },
      // A deduped retry is not a "new" success — flag it so analytics can
      // distinguish "user retried and we created a fresh attempt" from
      // "user retried but the old attempt had already won the race".
      success: !params.deduped,
    });
  } catch (err) {
    logger.error('Failed to log payment_retry audit event', {
      err,
      originalIntentId: params.originalIntentId,
    });
    // Swallow — audit failures must not break payment UX.
  }
}
