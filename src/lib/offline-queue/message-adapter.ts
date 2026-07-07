/**
 * Message Queue Adapter
 *
 * Thin re-export of the existing messaging offline queue service.
 *
 * The fork's message-adapter extends BaseOfflineQueue, but this repo's
 * src/services/messaging/offline-queue-service.ts has a tightly integrated
 * send path: it stores encrypted_content/initialization_vector directly
 * and syncs without re-encryption. Per the port brief, that wiring must
 * not regress — so this adapter just surfaces it under the barrel's
 * expected names rather than reimplementing on top of BaseOfflineQueue.
 *
 * @module lib/offline-queue/message-adapter
 */

import {
  offlineQueueService,
  OfflineQueueService,
} from '@/services/messaging/offline-queue-service';

/** The message queue adapter is the existing service — same instance. */
export const messageQueue = offlineQueueService;

/** Re-export under both names so consumers can import either. */
export { offlineQueueService };

/** Export class under adapter-style name for symmetry with other adapters. */
export { OfflineQueueService as MessageQueueAdapter };
