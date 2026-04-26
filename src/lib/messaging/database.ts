/**
 * IndexedDB Database Schema for User Messaging System
 * Using Dexie.js v4.0.10
 *
 * Stores:
 * - messaging_queued_messages: Offline message queue with status tracking
 * - messaging_cached_messages: Cached messages for offline viewing
 * - messaging_private_keys: User's private encryption keys
 * - messaging_sync_metadata: Sync state and metadata
 */

import Dexie, { type EntityTable } from 'dexie';
import type {
  QueuedMessage,
  CachedMessage,
  PrivateKey,
  SyncMetadata,
} from '@/types/messaging';

export class MessagingDatabase extends Dexie {
  messaging_queued_messages!: EntityTable<QueuedMessage, 'id'>;
  messaging_cached_messages!: EntityTable<CachedMessage, 'id'>;
  messaging_private_keys!: EntityTable<PrivateKey, 'userId'>;
  messaging_sync_metadata!: EntityTable<SyncMetadata, 'key'>;

  constructor() {
    super('MessagingDB');

    this.version(1).stores({
      messaging_queued_messages:
        'id, conversation_id, status, synced, created_at, sender_id',
      messaging_cached_messages: 'id, conversation_id, created_at, sender_id',
      messaging_private_keys: 'userId',
      messaging_sync_metadata: 'key, updated_at',
    });

    // v2: messaging_private_keys.privateKey changed from JsonWebKey to a
    // non-extractable CryptoKey. Wipe legacy JWK rows on upgrade — users
    // re-derive on next signin. See plan: continue-the-scripthammer-lucky-hamster.md
    this.version(2)
      .stores({
        messaging_queued_messages:
          'id, conversation_id, status, synced, created_at, sender_id',
        messaging_cached_messages: 'id, conversation_id, created_at, sender_id',
        messaging_private_keys: 'userId',
        messaging_sync_metadata: 'key, updated_at',
      })
      .upgrade(async (tx) => {
        await tx.table('messaging_private_keys').clear();
      });
  }
}

export const messagingDb = new MessagingDatabase();

// Export alias for backward compatibility with existing encryption.ts
export const db = messagingDb;

export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}
