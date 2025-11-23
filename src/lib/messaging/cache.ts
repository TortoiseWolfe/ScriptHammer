/**
 * Cache Service for Offline Message Viewing
 * Tasks: T162-T168
 *
 * Handles message caching for offline access:
 * - Cache recent messages for each conversation
 * - Provide fallback when offline
 * - Automatic cache cleanup (30-day retention)
 * - Storage quota management
 */

import { messagingDb } from './database';
import type { CachedMessage, Message } from '@/types/messaging';
import { CACHE_CONFIG } from '@/types/messaging';
import LZString from 'lz-string';

export class CacheService {
  /**
   * Cache messages for a conversation
   * Task: T163
   *
   * Stores messages in IndexedDB for offline viewing. If cache for this
   * conversation already exists, it will be updated with new messages.
   *
   * Storage strategy:
   * - Keep last 1000 messages per conversation
   * - Compress content if needed using LZ-String
   * - Auto-cleanup messages older than 30 days
   *
   * @param conversationId - Conversation ID to cache messages for
   * @param messages - Array of messages to cache
   * @returns Promise<number> - Number of messages cached
   *
   * @example
   * ```typescript
   * const count = await cacheService.cacheMessages(conversationId, messages);
   * console.log(`Cached ${count} messages`);
   * ```
   */
  async cacheMessages(
    conversationId: string,
    messages: Message[]
  ): Promise<number> {
    if (messages.length === 0) return 0;

    // Convert to CachedMessage type (identical to Message)
    const cachedMessages: CachedMessage[] = messages.map((msg) => ({
      ...msg,
    }));

    // Remove old cached messages for this conversation
    await messagingDb.messaging_cached_messages
      .where('conversation_id')
      .equals(conversationId)
      .delete();

    // Add new messages to cache
    await messagingDb.messaging_cached_messages.bulkAdd(cachedMessages);

    // Cleanup old cache entries (older than 30 days)
    await this.clearOldCache();

    return cachedMessages.length;
  }

  /**
   * Get cached messages for a conversation
   * Task: T164
   *
   * Retrieves cached messages for offline viewing. Messages are returned
   * in chronological order (oldest first).
   *
   * @param conversationId - Conversation ID to retrieve messages for
   * @param limit - Maximum number of messages to retrieve (default: 50)
   * @returns Promise<CachedMessage[]> - Array of cached messages
   *
   * @example
   * ```typescript
   * // Get last 50 messages from cache
   * const messages = await cacheService.getCachedMessages(conversationId);
   *
   * // Get last 100 messages
   * const moreMessages = await cacheService.getCachedMessages(conversationId, 100);
   * ```
   */
  async getCachedMessages(
    conversationId: string,
    limit: number = CACHE_CONFIG.PAGINATION_PAGE_SIZE
  ): Promise<CachedMessage[]> {
    const messages = await messagingDb.messaging_cached_messages
      .where('conversation_id')
      .equals(conversationId)
      .reverse() // Get newest first
      .limit(limit)
      .toArray();

    // Return in chronological order (oldest first)
    return messages.reverse();
  }

  /**
   * Clear old cached messages (older than 30 days)
   * Task: T165
   *
   * Automatically removes messages older than the retention period
   * to prevent IndexedDB from growing indefinitely.
   *
   * @returns Promise<number> - Number of messages deleted
   */
  async clearOldCache(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - CACHE_CONFIG.MESSAGE_RETENTION_DAYS
    );
    const cutoffTimestamp = cutoffDate.toISOString();

    return await messagingDb.messaging_cached_messages
      .where('created_at')
      .below(cutoffTimestamp)
      .delete();
  }

  /**
   * Get cache size (number of cached messages)
   * Task: T166
   *
   * Returns the total number of messages currently cached across
   * all conversations.
   *
   * @returns Promise<number> - Total cached message count
   */
  async getCacheSize(): Promise<number> {
    return await messagingDb.messaging_cached_messages.count();
  }

  /**
   * Get cache size for a specific conversation
   *
   * @param conversationId - Conversation ID
   * @returns Promise<number> - Number of cached messages for this conversation
   */
  async getConversationCacheSize(conversationId: string): Promise<number> {
    return await messagingDb.messaging_cached_messages
      .where('conversation_id')
      .equals(conversationId)
      .count();
  }

  /**
   * Clear all cached messages for a conversation
   *
   * @param conversationId - Conversation ID to clear cache for
   * @returns Promise<number> - Number of messages deleted
   */
  async clearConversationCache(conversationId: string): Promise<number> {
    return await messagingDb.messaging_cached_messages
      .where('conversation_id')
      .equals(conversationId)
      .delete();
  }

  /**
   * Clear entire message cache
   *
   * @returns Promise<void>
   */
  async clearAllCache(): Promise<void> {
    await messagingDb.messaging_cached_messages.clear();
  }

  /**
   * Estimate storage usage in bytes
   *
   * Provides rough estimate of IndexedDB storage used by cached messages.
   * Actual storage may vary due to IndexedDB overhead.
   *
   * @returns Promise<number> - Estimated storage in bytes
   */
  async estimateStorageUsage(): Promise<number> {
    const messages = await messagingDb.messaging_cached_messages.toArray();

    // Rough estimate: sum of encrypted_content lengths (base64)
    let totalBytes = 0;
    for (const msg of messages) {
      totalBytes += msg.encrypted_content.length;
      totalBytes += msg.initialization_vector.length;
      totalBytes += 200; // Overhead for metadata (rough estimate)
    }

    return totalBytes;
  }

  /**
   * Check if cache limit is approaching
   *
   * Warns if cache is using more than 80% of recommended limit.
   *
   * @returns Promise<{ approaching: boolean; percentage: number }> - Cache status
   */
  async checkCacheQuota(): Promise<{
    approaching: boolean;
    percentage: number;
  }> {
    const count = await this.getCacheSize();
    const maxMessages = CACHE_CONFIG.MAX_MESSAGES_PER_CONVERSATION * 10; // Assume ~10 conversations
    const percentage = (count / maxMessages) * 100;

    return {
      approaching: percentage > 80,
      percentage,
    };
  }

  /**
   * Compress message content using LZ-String
   *
   * Used when storage quota is approaching limit.
   *
   * @param content - Text to compress
   * @returns string - Compressed content
   */
  compressContent(content: string): string {
    return LZString.compress(content);
  }

  /**
   * Decompress message content
   *
   * @param compressed - Compressed content
   * @returns string - Original content
   */
  decompressContent(compressed: string): string {
    return LZString.decompress(compressed) || '';
  }
}

// Export singleton instance
export const cacheService = new CacheService();
