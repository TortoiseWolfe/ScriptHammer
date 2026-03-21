/**
 * Offline Queue Types - Shared Interfaces
 *
 * Ported from SpokeToWork fork (Feature 050 - Code Consolidation).
 * Defines common types for all offline queue adapters.
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
}

/**
 * Default configuration values
 */
export const DEFAULT_QUEUE_CONFIG: Omit<QueueConfig, 'dbName' | 'tableName'> = {
  maxRetries: 5,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
};

/**
 * Result of queue sync operation
 */
export interface SyncResult {
  /** Number of items successfully processed */
  success: number;
  /** Number of items that failed */
  failed: number;
  /** Number of items skipped (e.g., still in backoff) */
  skipped: number;
}

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
