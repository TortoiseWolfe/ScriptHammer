/**
 * Offline Queue Service for Message Synchronization
 * Tasks: T150-T156
 *
 * Handles offline message queuing and automatic synchronization:
 * - Queue messages when offline or send fails
 * - Automatically sync queue when connection restored
 * - Exponential backoff retry logic (1s, 2s, 4s, 8s, 16s)
 * - Maximum 5 retry attempts before marking as failed
 */

import { messagingDb } from '@/lib/messaging/database';
import { createClient } from '@/lib/supabase/client';
import {
  createMessagingClient,
  type MessageRow,
  type ConversationRow,
} from '@/lib/supabase/messaging-client';
import { encryptionService } from '@/lib/messaging/encryption';
import { keyManagementService } from './key-service';
import type {
  QueuedMessage,
  QueueStatus,
  SendMessageResult,
} from '@/types/messaging';
import {
  OFFLINE_QUEUE_CONFIG,
  ConnectionError,
  AuthenticationError,
  EncryptionError,
} from '@/types/messaging';

export class OfflineQueueService {
  private syncInProgress = false;

  /**
   * Add a message to the offline queue
   * Task: T151
   *
   * Stores encrypted message in IndexedDB for later synchronization.
   * The message is stored with status 'pending' and will be sent when online.
   *
   * @param message - Partial queued message (id, conversation_id, sender_id, encrypted_content, iv)
   * @returns Promise<QueuedMessage> - The queued message with full metadata
   *
   * @example
   * ```typescript
   * const queuedMsg = await offlineQueueService.queueMessage({
   *   id: crypto.randomUUID(),
   *   conversation_id: '123',
   *   sender_id: user.id,
   *   encrypted_content: 'base64...',
   *   initialization_vector: 'base64...'
   * });
   * ```
   */
  async queueMessage(
    message: Pick<
      QueuedMessage,
      | 'id'
      | 'conversation_id'
      | 'sender_id'
      | 'encrypted_content'
      | 'initialization_vector'
    >
  ): Promise<QueuedMessage> {
    const queuedMessage: QueuedMessage = {
      ...message,
      status: 'pending' as QueueStatus,
      synced: false,
      retries: 0,
      created_at: Date.now(),
    };

    await messagingDb.messaging_queued_messages.add(queuedMessage);
    return queuedMessage;
  }

  /**
   * Get all unsynced messages from the queue
   * Task: T152
   *
   * Retrieves messages that haven't been successfully sent (synced=false).
   * Orders by created_at to ensure FIFO processing.
   *
   * @returns Promise<QueuedMessage[]> - Array of unsynced messages
   */
  async getQueue(): Promise<QueuedMessage[]> {
    return await messagingDb.messaging_queued_messages
      .where('synced')
      .equals(0)
      .sortBy('created_at');
  }

  /**
   * Get count of queued messages by status
   *
   * @param status - Optional status filter
   * @returns Promise<number> - Count of messages
   */
  async getQueueCount(status?: QueueStatus): Promise<number> {
    if (status) {
      return await messagingDb.messaging_queued_messages
        .where('status')
        .equals(status)
        .count();
    }
    return await messagingDb.messaging_queued_messages
      .where('synced')
      .equals(0)
      .count();
  }

  /**
   * Sync the message queue
   * Task: T153
   *
   * Processes all unsynced messages with retry logic and exponential backoff.
   * Messages are sent to Supabase and marked as synced on success.
   * Failed messages increment retry counter and move to 'failed' status after max retries.
   *
   * Flow:
   * 1. Get all unsynced messages
   * 2. For each message:
   *    - Check retry count (max 5)
   *    - Calculate delay (exponential backoff)
   *    - Attempt to send to Supabase
   *    - Mark synced on success or increment retries on failure
   * 3. Return sync results
   *
   * @returns Promise<{ success: number; failed: number }> - Sync results
   * @throws AuthenticationError if user not signed in
   */
  async syncQueue(): Promise<{ success: number; failed: number }> {
    // Prevent concurrent sync operations
    if (this.syncInProgress) {
      return { success: 0, failed: 0 };
    }

    this.syncInProgress = true;

    try {
      const supabase = createClient();
      const msgClient = createMessagingClient(supabase);

      // Check authentication
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new AuthenticationError('You must be signed in to sync messages');
      }

      // Get unsynced messages
      const queue = await this.getQueue();

      if (queue.length === 0) {
        return { success: 0, failed: 0 };
      }

      let successCount = 0;
      let failedCount = 0;

      // Process each message
      for (const queuedMsg of queue) {
        try {
          // Check if max retries exceeded
          if (queuedMsg.retries >= OFFLINE_QUEUE_CONFIG.MAX_RETRIES) {
            await this.markAsFailed(queuedMsg.id);
            failedCount++;
            continue;
          }

          // Update status to processing
          await messagingDb.messaging_queued_messages.update(queuedMsg.id, {
            status: 'processing' as QueueStatus,
          });

          // Calculate retry delay (exponential backoff)
          if (queuedMsg.retries > 0) {
            const delay = this.getRetryDelay(queuedMsg.retries);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }

          // Get next sequence number for this conversation
          const { data: lastMessage } = await msgClient
            .from('messages')
            .select('sequence_number')
            .eq('conversation_id', queuedMsg.conversation_id)
            .order('sequence_number', { ascending: false })
            .limit(1)
            .single();

          const nextSequenceNumber = lastMessage
            ? lastMessage.sequence_number + 1
            : 1;

          // Insert message to Supabase
          const { data: message, error: insertError } = await msgClient
            .from('messages')
            .insert({
              conversation_id: queuedMsg.conversation_id,
              sender_id: queuedMsg.sender_id,
              encrypted_content: queuedMsg.encrypted_content,
              initialization_vector: queuedMsg.initialization_vector,
              sequence_number: nextSequenceNumber,
              deleted: false,
              edited: false,
              delivered_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (insertError) {
            throw new ConnectionError(
              'Failed to insert message: ' + insertError.message
            );
          }

          // Update conversation's last_message_at
          await msgClient
            .from('conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', queuedMsg.conversation_id);

          // Mark as synced
          await messagingDb.messaging_queued_messages.update(queuedMsg.id, {
            status: 'sent' as QueueStatus,
            synced: true,
            sequence_number: nextSequenceNumber,
          });

          successCount++;
        } catch (error) {
          // Increment retry count on failure
          await this.recordFailedAttempt(queuedMsg.id);
          failedCount++;
        }
      }

      return { success: successCount, failed: failedCount };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Remove a message from the queue
   * Task: T154
   *
   * Deletes a queued message by ID. Typically used after successful sync
   * or when user manually cancels a queued message.
   *
   * @param id - Message ID to remove
   * @returns Promise<void>
   */
  async removeFromQueue(id: string): Promise<void> {
    await messagingDb.messaging_queued_messages.delete(id);
  }

  /**
   * Clear all synced messages from the queue (cleanup)
   *
   * @returns Promise<number> - Number of messages deleted
   */
  async clearSyncedMessages(): Promise<number> {
    return await messagingDb.messaging_queued_messages
      .where('synced')
      .equals(1)
      .delete();
  }

  /**
   * Clear entire queue (use with caution - will lose unsent messages)
   *
   * @returns Promise<void>
   */
  async clearQueue(): Promise<void> {
    await messagingDb.messaging_queued_messages.clear();
  }

  /**
   * Get retry delay based on retry count (exponential backoff)
   * Task: T155
   *
   * Calculates delay using exponential backoff:
   * - Retry 1: 1s
   * - Retry 2: 2s
   * - Retry 3: 4s
   * - Retry 4: 8s
   * - Retry 5: 16s
   *
   * @param retryCount - Number of retries so far
   * @returns number - Delay in milliseconds
   */
  getRetryDelay(retryCount: number): number {
    const { INITIAL_DELAY_MS, BACKOFF_MULTIPLIER } = OFFLINE_QUEUE_CONFIG;
    return INITIAL_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, retryCount - 1);
  }

  /**
   * Record a failed send attempt
   * Task: T156 (part of retry logic)
   *
   * Increments retry counter and updates status. If max retries exceeded,
   * marks message as permanently failed.
   *
   * @param id - Message ID
   * @returns Promise<void>
   */
  private async recordFailedAttempt(id: string): Promise<void> {
    const message = await messagingDb.messaging_queued_messages.get(id);

    if (!message) return;

    const newRetries = message.retries + 1;

    if (newRetries >= OFFLINE_QUEUE_CONFIG.MAX_RETRIES) {
      await this.markAsFailed(id);
    } else {
      await messagingDb.messaging_queued_messages.update(id, {
        retries: newRetries,
        status: 'pending' as QueueStatus, // Back to pending for next retry
      });
    }
  }

  /**
   * Mark a message as permanently failed
   * Task: T156
   *
   * @param id - Message ID
   * @returns Promise<void>
   */
  private async markAsFailed(id: string): Promise<void> {
    await messagingDb.messaging_queued_messages.update(id, {
      status: 'failed' as QueueStatus,
    });
  }

  /**
   * Retry all failed messages
   *
   * Resets failed messages to pending status and clears retry count.
   * This allows manual retry of messages that exceeded max retries.
   *
   * @returns Promise<number> - Number of messages reset
   */
  async retryFailed(): Promise<number> {
    const failedMessages = await messagingDb.messaging_queued_messages
      .where('status')
      .equals('failed' as QueueStatus)
      .toArray();

    for (const msg of failedMessages) {
      await messagingDb.messaging_queued_messages.update(msg.id, {
        status: 'pending' as QueueStatus,
        retries: 0,
      });
    }

    return failedMessages.length;
  }

  /**
   * Get all failed messages
   *
   * @returns Promise<QueuedMessage[]> - Array of failed messages
   */
  async getFailedMessages(): Promise<QueuedMessage[]> {
    return await messagingDb.messaging_queued_messages
      .where('status')
      .equals('failed' as QueueStatus)
      .toArray();
  }

  /**
   * Check if queue is currently syncing
   *
   * @returns boolean - True if sync in progress
   */
  isSyncing(): boolean {
    return this.syncInProgress;
  }
}

// Export singleton instance
export const offlineQueueService = new OfflineQueueService();
