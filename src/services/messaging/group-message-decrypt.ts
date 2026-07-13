/**
 * Shared group-message decryption (#248).
 *
 * Group messages use a two-stage scheme: a symmetric AES-GCM group key is
 * wrapped per member (ECDH) and rotated over time, so each message carries the
 * key_version it was encrypted under. Decrypting a page of group messages means
 * resolving the group key per distinct key_version (memoized) and AES-GCM
 * decrypting each message with the matching version's key.
 *
 * This helper is the ONE place that logic lives, so the live group history view
 * (message-service.getGroupMessageHistory) and the GDPR export
 * (gdpr-service.exportUserData) can't drift apart. It is deliberately
 * order-agnostic: it returns results 1:1 with the input order and never
 * reverses — callers impose their own chronology (the live view fetches
 * descending and reverses; the export fetches ascending and does not).
 */

import { encryptionService } from '@/lib/messaging/encryption';
import { groupKeyService } from './group-key-service';
import type { MessageRow } from '@/lib/supabase/messaging-client';

/** The placeholder shown when a group message can't be decrypted. */
export const GROUP_DECRYPT_PLACEHOLDER = 'Encrypted with previous keys';

export interface GroupDecryptedMessage {
  row: MessageRow;
  /** Decrypted plaintext, a system-message marker, or the failure placeholder. */
  content: string;
  /** True when decryption failed and `content` is the placeholder. */
  decryptionError: boolean;
}

/**
 * Decrypt a batch of group messages for one conversation, preserving input
 * order. System messages (is_system_message) are NOT E2E-encrypted — their
 * plaintext JSON marker is surfaced as-is rather than run through the group key
 * (which would fail and hide recoverable data, a GDPR-portability gap). Any
 * individual message that fails to decrypt degrades to the placeholder so one
 * bad row never aborts the whole batch.
 *
 * @param conversationId  the group conversation id
 * @param rows            messages to decrypt, in the caller's desired order
 * @returns one result per input row, in the same order
 */
export async function decryptGroupMessages(
  conversationId: string,
  rows: MessageRow[]
): Promise<GroupDecryptedMessage[]> {
  // Resolve (and memoize) the group key for each distinct key_version.
  const keyByVersion = new Map<number, Promise<CryptoKey>>();
  const groupKeyFor = (version: number): Promise<CryptoKey> => {
    let keyPromise = keyByVersion.get(version);
    if (!keyPromise) {
      keyPromise = groupKeyService.getGroupKeyForConversation(
        conversationId,
        version
      );
      keyByVersion.set(version, keyPromise);
    }
    return keyPromise;
  };

  return Promise.all(
    rows.map(async (row) => {
      // System messages carry a plaintext JSON marker, not ciphertext.
      if (row.is_system_message) {
        return { row, content: row.encrypted_content, decryptionError: false };
      }
      try {
        const groupKey = await groupKeyFor(row.key_version ?? 1);
        const content = await encryptionService.decryptMessage(
          row.encrypted_content,
          row.initialization_vector,
          groupKey
        );
        return { row, content, decryptionError: false };
      } catch {
        return {
          row,
          content: GROUP_DECRYPT_PLACEHOLDER,
          decryptionError: true,
        };
      }
    })
  );
}
