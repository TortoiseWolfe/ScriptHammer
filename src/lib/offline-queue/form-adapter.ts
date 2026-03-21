/**
 * Form Queue Adapter
 *
 * Ported from SpokeToWork fork (Feature 050 - Code Consolidation).
 * Handles offline queuing for form submissions.
 *
 * Replaces the raw-IndexedDB implementation that lived in
 * src/utils/offline-queue.ts (that file is now a re-export shim).
 *
 * @module lib/offline-queue/form-adapter
 */

import { BaseOfflineQueue } from './base-queue';
import { FormQueueItem, DEFAULT_QUEUE_CONFIG } from './types';

/**
 * Form queue for offline form submissions
 *
 * @example
 * ```typescript
 * // Queue a form submission
 * await formQueue.queueSubmission({
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   message: 'Hello world',
 * });
 *
 * // Process queue when back online
 * const result = await formQueue.sync();
 * ```
 */
export class FormQueueAdapter extends BaseOfflineQueue<FormQueueItem> {
  /** Submission handler function */
  private submitHandler?: (data: Record<string, unknown>) => Promise<void>;

  constructor() {
    super({
      // V2 DB name — the original src/utils/offline-queue.ts used raw
      // IndexedDB with 'OfflineFormSubmissions' and NO indexes. Opening
      // the same name here with Dexie's '++id, status, createdAt, retries'
      // index spec would throw a SchemaError. New DB name starts clean.
      // Any items stranded in the V1 DB were transient form drafts; they
      // can be safely abandoned.
      dbName: 'OfflineFormSubmissionsV2',
      tableName: 'submissions',
      ...DEFAULT_QUEUE_CONFIG,
    });
  }

  /**
   * Set the submission handler for processing queued forms
   *
   * @param handler - Async function that submits form data to server
   */
  setSubmitHandler(
    handler: (data: Record<string, unknown>) => Promise<void>
  ): void {
    this.submitHandler = handler;
  }

  /**
   * Queue a form submission
   */
  async queueSubmission(
    formData: Record<string, unknown>
  ): Promise<FormQueueItem> {
    return await this.queue({
      formData,
    } as Omit<FormQueueItem, 'id' | 'status' | 'retries' | 'createdAt'>);
  }

  /**
   * Process a single form queue item
   */
  protected async processItem(item: FormQueueItem): Promise<void> {
    if (!this.submitHandler) {
      throw new Error(
        'No submit handler configured. Call setSubmitHandler() first.'
      );
    }

    await this.submitHandler(item.formData);
  }
}

// Export singleton instance
export const formQueue = new FormQueueAdapter();
