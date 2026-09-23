/**
 * Offline Queue Types - Shared Interfaces
 *
 * Ported from SpokeToWork fork (Feature 050 - Code Consolidation).
 * Defines common types for all offline queue adapters.
 *
 * BEFORE YOU ADD A BINARY PAYLOAD, READ THIS (#1209).
 *
 * **WebKit cannot store a `Blob` or a `File` in IndexedDB.** Nothing in this template
 * persists binary client-side today, so there is no bug to fix — but this interface is
 * exactly where a fork will eventually try to queue an attachment, and the failure mode
 * is unusually quiet.
 *
 * Measured against Playwright's own browser builds (`webkit-2203`):
 *
 * | stored value  | chromium | firefox | webkit   |
 * |---------------|----------|---------|----------|
 * | plain object  | OK       | OK      | OK       |
 * | `ArrayBuffer` | OK       | OK      | OK       |
 * | `Uint8Array`  | OK       | OK      | OK       |
 * | `Blob`        | OK       | OK      | **FAILS**|
 * | `File`        | OK       | OK      | **FAILS**|
 *
 * WHY IT IS HARD TO NOTICE. The write transaction fires `onerror` with a **null
 * `tx.error`**. It does not identify itself as a structured-clone failure and it does not
 * throw at the `put()` call. `fake-indexeddb` does not faithfully clone binary either, so
 * a unit suite goes green whichever shape you store; Chromium and Firefox both accept
 * Blobs, so local development and most of CI pass. The net effect is a feature that works
 * everywhere except the phone, with a green pipeline and nothing in the console.
 *
 * THE PATTERN. Store `ArrayBuffer` plus the MIME type as separate fields and rebuild the
 * Blob on read:
 *
 * ```ts
 * // write
 * { bytes: await blobToArrayBuffer(blob), type: blob.type || 'application/octet-stream' }
 * // read
 * new Blob([row.bytes], { type: row.type })
 * ```
 *
 * ONE RELATED TRAP. `Blob.prototype.arrayBuffer` does not exist in jsdom (nor `text()`
 * nor `stream()` — only `size` and `type`), and it is missing in older Safari. Without a
 * `FileReader` fallback the write path throws, gets swallowed by whatever guard stops a
 * storage failure from breaking the UI, stores nothing, and every test still passes.
 *
 * @module lib/offline-queue/types
 */

/**
 * Queue item status
 */
export type QueueStatus = 'pending' | 'processing' | 'failed' | 'completed';

/**
 * Base interface for all queue items
 */
export interface BaseQueueItem {
  /** Unique identifier (auto-generated if not provided) */
  id?: number;
  /** Current status of the item */
  status: QueueStatus;
  /** Number of retry attempts */
  retries: number;
  /** Timestamp when item was created (ms since epoch) */
  createdAt: number;
  /** Timestamp of last processing attempt */
  lastAttempt?: number;
  /** Error message from last failed attempt */
  lastError?: string;
}

/**
 * Configuration for queue behavior
 */
export interface QueueConfig {
  /** IndexedDB database name */
  dbName: string;
  /** IndexedDB table/store name */
  tableName: string;
  /** Maximum retry attempts before marking as failed */
  maxRetries: number;
  /** Initial delay in ms for exponential backoff */
  initialDelayMs: number;
  /** Backoff multiplier (e.g., 2 for doubling) */
  backoffMultiplier: number;
  /**
   * Watchdog: reclaim items stuck in `processing` longer than this (ms).
   * Defends against tab crashes between claim and completion. Default 60_000.
   * The processItem implementation must be idempotent for safe reclaim — see
   * payment-adapter's idempotency_key path for the pattern.
   */
  processingTimeoutMs: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_QUEUE_CONFIG: Omit<QueueConfig, 'dbName' | 'tableName'> = {
  maxRetries: 5,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  processingTimeoutMs: 60_000,
};

/**
 * Result of queue sync operation
 */
export interface SyncResult {
  /** Number of items successfully processed (fresh work) */
  success: number;
  /** Number of items that failed */
  failed: number;
  /** Number of items skipped (e.g., still in backoff) */
  skipped: number;
  /** Number of items completed via dedupe (server already had this work) */
  conflicted: number;
}

/**
 * Optional return value from processItem. Subclasses that don't need to
 * distinguish fresh-success from dedupe can keep returning void; void is
 * treated as `{ status: 'completed' }`.
 */
export type ProcessItemResult = { status: 'completed' | 'conflicted' };

/**
 * Form queue item (for form submissions)
 */
export interface FormQueueItem extends BaseQueueItem {
  /** Form data to be submitted */
  formData: Record<string, unknown>;
}

/**
 * Message queue item (for encrypted messages)
 */
export interface MessageQueueItem extends BaseQueueItem {
  /** Message UUID */
  messageId: string;
  /** Conversation ID */
  conversationId: string;
  /** Sender user ID */
  senderId: string;
  /** Encrypted message content (base64) */
  encryptedContent: string;
  /** Initialization vector for decryption (base64) */
  initializationVector: string;
  /** Whether message has been synced to server */
  synced: boolean;
  /** Sequence number assigned after sync */
  sequenceNumber?: number;
}

/**
 * Payment queue item (for payment operations)
 *
 * Note: `userId` added vs fork — local payment-service.ts captures the
 * authenticated user at queue time (REQ-SEC-001). This is more secure
 * than re-fetching auth at processing time, since the user may have
 * signed out between queuing and sync.
 */
export interface PaymentQueueItem extends BaseQueueItem {
  /** Type of payment operation */
  type: 'payment_intent' | 'subscription_update';
  /** Operation-specific data */
  data: Record<string, unknown>;
  /** User ID captured at queue time (preferred over auth.getUser at sync time) */
  userId?: string;
}

/**
 * Company queue item (for company sync with conflict resolution)
 */
export interface CompanyQueueItem extends BaseQueueItem {
  /** Company ID */
  companyId: string;
  /** Action to perform */
  action: 'create' | 'update' | 'delete';
  /** Payload data */
  payload: Record<string, unknown> | null;
  /** Local version number */
  localVersion: number;
  /** Server version number (for conflict detection) */
  serverVersion: number;
}

/**
 * Conflict resolution result
 */
export interface ConflictResolution {
  companyId: string;
  resolution: 'local' | 'server';
  resolvedAt: string;
}
