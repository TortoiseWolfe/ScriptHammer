/**
 * Group Key Service - Manages symmetric key encryption for groups
 * Feature 010: Group Chats
 *
 * Responsibilities:
 * - Generate AES-GCM-256 symmetric group keys
 * - Encrypt group key for each member using ECDH
 * - Decrypt group key for current user
 * - Rotate keys on member add/remove
 * - Cache decrypted keys in memory
 */

import { createClient } from '@/lib/supabase/client';
import { createMessagingClient } from '@/lib/supabase/messaging-client';
import { encryptionService } from '@/lib/messaging/encryption';
import { keyManagementService } from '@/services/messaging/key-service';
import { createLogger } from '@/lib/logger';
import type {
  GroupKey,
  CachedGroupKey,
  ConversationMember,
} from '@/types/messaging';
import {
  GROUP_KEY_CACHE_CONFIG,
  GROUP_CONSTRAINTS,
  GroupKeyError,
  EncryptionError,
  DecryptionError,
  AuthenticationError,
  ConnectionError,
  CRYPTO_PARAMS,
} from '@/types/messaging';

const logger = createLogger('messaging:group-keys');

/**
 * LRU Cache for decrypted group keys
 * T020: Group key caching mechanism
 */
class GroupKeyCache {
  private cache = new Map<string, CachedGroupKey>();
  private maxSize = GROUP_KEY_CACHE_CONFIG.MAX_KEYS;

  private makeKey(conversationId: string, version: number): string {
    return `${conversationId}:${version}`;
  }

  get(conversationId: string, version: number): CachedGroupKey | undefined {
    const key = this.makeKey(conversationId, version);
    const entry = this.cache.get(key);

    if (entry) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, entry);
    }

    return entry;
  }

  set(conversationId: string, version: number, cryptoKey: CryptoKey): void {
    const key = this.makeKey(conversationId, version);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }

    this.cache.set(key, {
      key: cryptoKey,
      version,
      cached_at: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * GroupKeyService handles symmetric key operations for group chats
 */
export class GroupKeyService {
  private supabase = createClient();
  private keyCache = new GroupKeyCache();

  /**
   * Generate a new AES-GCM-256 symmetric key
   * T016: Generate AES-GCM-256 symmetric key using Web Crypto API
   *
   * @returns CryptoKey for group encryption
   * @throws GroupKeyError if generation fails
   */
  async generateGroupKey(): Promise<CryptoKey> {
    try {
      if (!crypto.subtle) {
        throw new Error('Web Crypto API not available');
      }

      const key = await crypto.subtle.generateKey(
        {
          name: CRYPTO_PARAMS.AES_ALGORITHM,
          length: CRYPTO_PARAMS.AES_KEY_LENGTH,
        },
        true, // extractable for distribution
        ['encrypt', 'decrypt']
      );

      logger.debug('Generated new group key');
      return key;
    } catch (error) {
      throw new GroupKeyError('Failed to generate group key', error);
    }
  }

  /**
   * Encrypt the group key for a specific member using ECDH
   * T017: ECDH shared secret derivation + AES-GCM encryption of group key
   *
   * @param groupKey - The symmetric group key
   * @param memberPublicKey - Member's ECDH public key (JWK format)
   * @param senderPrivateKey - Sender's ECDH private key
   * @returns Base64-encoded encrypted key (IV || ciphertext)
   * @throws GroupKeyError if encryption fails
   */
  async encryptGroupKeyForMember(
    groupKey: CryptoKey,
    memberPublicKey: JsonWebKey,
    senderPrivateKey: CryptoKey
  ): Promise<string> {
    try {
      // Import member's public key from JWK
      const importedPublicKey = await crypto.subtle.importKey(
        'jwk',
        memberPublicKey,
        {
          name: CRYPTO_PARAMS.ALGORITHM,
          namedCurve: CRYPTO_PARAMS.CURVE,
        },
        false,
        []
      );

      // Derive shared secret using ECDH
      const sharedSecret = await encryptionService.deriveSharedSecret(
        senderPrivateKey,
        importedPublicKey
      );

      // Export group key bytes
      const groupKeyBytes = await this.exportKeyBytes(groupKey);

      // Generate random IV
      const iv = crypto.getRandomValues(
        new Uint8Array(CRYPTO_PARAMS.IV_LENGTH_BYTES)
      );

      // Encrypt group key with shared secret
      const ciphertextBuffer = await crypto.subtle.encrypt(
        {
          name: CRYPTO_PARAMS.AES_ALGORITHM,
          iv,
        },
        sharedSecret,
        groupKeyBytes
      );

      // Combine IV + ciphertext and encode as base64
      const combined = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(ciphertextBuffer), iv.length);

      const base64 = this.arrayBufferToBase64(combined.buffer);
      logger.debug('Encrypted group key for member');
      return base64;
    } catch (error) {
      if (error instanceof EncryptionError) {
        throw new GroupKeyError(
          'Failed to encrypt group key: ' + error.message,
          error
        );
      }
      throw new GroupKeyError('Failed to encrypt group key for member', error);
    }
  }

  /**
   * Decrypt the group key using current user's private key
   * T018: Decrypt member's encrypted group key copy
   *
   * @param encryptedKey - Base64-encoded encrypted key (IV || ciphertext)
   * @param senderPublicKey - Key creator's public key (JWK)
   * @param recipientPrivateKey - Current user's private key
   * @returns Decrypted CryptoKey
   * @throws GroupKeyError if decryption fails
   */
  async decryptGroupKey(
    encryptedKey: string,
    senderPublicKey: JsonWebKey,
    recipientPrivateKey: CryptoKey
  ): Promise<CryptoKey> {
    try {
      // Decode base64
      const combined = this.base64ToArrayBuffer(encryptedKey);

      // Extract IV and ciphertext
      const iv = combined.slice(0, CRYPTO_PARAMS.IV_LENGTH_BYTES);
      const ciphertext = combined.slice(CRYPTO_PARAMS.IV_LENGTH_BYTES);

      // Import sender's public key from JWK
      const importedPublicKey = await crypto.subtle.importKey(
        'jwk',
        senderPublicKey,
        {
          name: CRYPTO_PARAMS.ALGORITHM,
          namedCurve: CRYPTO_PARAMS.CURVE,
        },
        false,
        []
      );

      // Derive shared secret using ECDH
      const sharedSecret = await encryptionService.deriveSharedSecret(
        recipientPrivateKey,
        importedPublicKey
      );

      // Decrypt group key bytes
      const groupKeyBytes = await crypto.subtle.decrypt(
        {
          name: CRYPTO_PARAMS.AES_ALGORITHM,
          iv,
        },
        sharedSecret,
        ciphertext
      );

      // Import group key from bytes
      const groupKey = await this.importKeyBytes(groupKeyBytes);
      logger.debug('Decrypted group key');
      return groupKey;
    } catch (error) {
      if (
        error instanceof DecryptionError ||
        error instanceof EncryptionError
      ) {
        throw new GroupKeyError(
          'Failed to decrypt group key: ' + error.message,
          error
        );
      }
      throw new GroupKeyError('Failed to decrypt group key', error);
    }
  }

  /**
   * Get decrypted group key for a conversation (with caching)
   * T019: Fetch and cache decrypted group key
   *
   * @param conversationId - Group conversation ID
   * @param keyVersion - Key version to fetch
   * @returns Decrypted CryptoKey
   * @throws GroupKeyError if key not found or decryption fails
   * @throws AuthenticationError if not authenticated
   */
  async getGroupKeyForConversation(
    conversationId: string,
    keyVersion: number
  ): Promise<CryptoKey> {
    // Check cache first (T020)
    const cached = this.keyCache.get(conversationId, keyVersion);
    if (cached) {
      logger.debug('Group key cache hit', { conversationId, keyVersion });
      return cached.key;
    }

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await this.supabase.auth.getUser();
    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to access group keys'
      );
    }

    const msgClient = createMessagingClient(this.supabase);

    try {
      // Fetch encrypted key from database
      const { data: keyData, error: fetchError } = await msgClient
        .from('group_keys')
        .select('encrypted_key, created_by')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .eq('key_version', keyVersion)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          throw new GroupKeyError(
            `Group key not found for version ${keyVersion}`
          );
        }
        throw new ConnectionError(
          'Failed to fetch group key: ' + fetchError.message
        );
      }

      // Get the key creator's public key
      const creatorPublicKey = await keyManagementService.getUserPublicKey(
        keyData.created_by
      );
      if (!creatorPublicKey) {
        throw new GroupKeyError('Key creator public key not found');
      }

      // Get current user's private key
      const currentKeys = keyManagementService.getCurrentKeys();
      if (!currentKeys) {
        throw new GroupKeyError(
          'Encryption keys not available. Please sign in again.'
        );
      }

      // Decrypt the group key
      const groupKey = await this.decryptGroupKey(
        keyData.encrypted_key,
        creatorPublicKey,
        currentKeys.privateKey
      );

      // Cache the decrypted key (T020)
      this.keyCache.set(conversationId, keyVersion, groupKey);
      logger.debug('Group key fetched and cached', {
        conversationId,
        keyVersion,
      });

      return groupKey;
    } catch (error) {
      if (
        error instanceof GroupKeyError ||
        error instanceof AuthenticationError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new GroupKeyError(
        'Failed to get group key for conversation',
        error
      );
    }
  }

  /**
   * Distribute group key to all members
   * T024: Generate key, encrypt for each member, store in group_keys
   *
   * @param conversationId - Group conversation ID
   * @param members - Members to distribute to
   * @param keyVersion - Key version being distributed
   * @returns Object with successful and pending member IDs
   * @throws GroupKeyError if distribution fails
   * @throws AuthenticationError if not authenticated
   */
  async distributeGroupKey(
    conversationId: string,
    members: ConversationMember[],
    keyVersion: number
  ): Promise<{ successful: string[]; pending: string[] }> {
    const {
      data: { user },
      error: authError,
    } = await this.supabase.auth.getUser();
    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to distribute group keys'
      );
    }

    const msgClient = createMessagingClient(this.supabase);
    const successful: string[] = [];
    const pending: string[] = [];

    try {
      // Generate new group key
      const groupKey = await this.generateGroupKey();

      // Get current user's keys for signing
      const currentKeys = keyManagementService.getCurrentKeys();
      if (!currentKeys) {
        throw new GroupKeyError('Encryption keys not available');
      }

      // Process in batches for large groups
      const batchSize = GROUP_CONSTRAINTS.KEY_DISTRIBUTION_BATCH_SIZE;
      const batches = [];
      for (let i = 0; i < members.length; i += batchSize) {
        batches.push(members.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const keyRecords: Array<{
          conversation_id: string;
          user_id: string;
          key_version: number;
          encrypted_key: string;
          created_by: string;
        }> = [];

        for (const member of batch) {
          try {
            // Get member's public key
            const memberPublicKey = await keyManagementService.getUserPublicKey(
              member.user_id
            );
            if (!memberPublicKey) {
              logger.warn('Member has no public key, marking as pending', {
                userId: member.user_id,
              });
              pending.push(member.user_id);
              continue;
            }

            // Encrypt group key for this member
            const encryptedKey = await this.encryptGroupKeyForMember(
              groupKey,
              memberPublicKey,
              currentKeys.privateKey
            );

            keyRecords.push({
              conversation_id: conversationId,
              user_id: member.user_id,
              key_version: keyVersion,
              encrypted_key: encryptedKey,
              created_by: user.id,
            });

            successful.push(member.user_id);
          } catch (error) {
            logger.error('Failed to encrypt key for member', {
              userId: member.user_id,
              error,
            });
            pending.push(member.user_id);
          }
        }

        // Insert batch of key records
        if (keyRecords.length > 0) {
          const { error: insertError } = await msgClient
            .from('group_keys')
            .insert(keyRecords);

          if (insertError) {
            throw new ConnectionError(
              'Failed to store group keys: ' + insertError.message
            );
          }
        }
      }

      // Cache the key for current user
      this.keyCache.set(conversationId, keyVersion, groupKey);

      logger.info('Group key distributed', {
        conversationId,
        keyVersion,
        successful: successful.length,
        pending: pending.length,
      });

      return { successful, pending };
    } catch (error) {
      if (
        error instanceof GroupKeyError ||
        error instanceof AuthenticationError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new GroupKeyError('Failed to distribute group key', error);
    }
  }

  /**
   * Rotate group key (generate new version, distribute to members)
   * T044: Key rotation on member add/remove
   *
   * @param conversationId - Group conversation ID
   * @returns New key version number
   * @throws GroupKeyError if rotation fails
   */
  async rotateGroupKey(conversationId: string): Promise<number> {
    const {
      data: { user },
      error: authError,
    } = await this.supabase.auth.getUser();
    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to rotate group keys'
      );
    }

    const msgClient = createMessagingClient(this.supabase);

    try {
      // Get current key version from conversation
      const { data: conversation, error: convError } = await msgClient
        .from('conversations')
        .select('current_key_version')
        .eq('id', conversationId)
        .single();

      if (convError) {
        throw new ConnectionError(
          'Failed to get conversation: ' + convError.message
        );
      }

      const newVersion = (conversation.current_key_version || 1) + 1;

      // Get all active members
      const { data: members, error: membersError } = await msgClient
        .from('conversation_members')
        .select('id, conversation_id, user_id')
        .eq('conversation_id', conversationId)
        .is('left_at', null);

      if (membersError) {
        throw new ConnectionError(
          'Failed to get members: ' + membersError.message
        );
      }

      // Distribute new key to all active members
      const result = await this.distributeGroupKey(
        conversationId,
        members as ConversationMember[],
        newVersion
      );

      // Update conversation's current_key_version
      const { error: updateError } = await msgClient
        .from('conversations')
        .update({ current_key_version: newVersion })
        .eq('id', conversationId);

      if (updateError) {
        throw new ConnectionError(
          'Failed to update key version: ' + updateError.message
        );
      }

      // Update pending members' key_status
      if (result.pending.length > 0) {
        await msgClient
          .from('conversation_members')
          .update({ key_status: 'pending' })
          .eq('conversation_id', conversationId)
          .in('user_id', result.pending);
      }

      logger.info('Group key rotated', {
        conversationId,
        newVersion,
        distributed: result.successful.length,
        pending: result.pending.length,
      });

      return newVersion;
    } catch (error) {
      if (
        error instanceof GroupKeyError ||
        error instanceof AuthenticationError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new GroupKeyError('Failed to rotate group key', error);
    }
  }

  /**
   * Retry key distribution for pending members
   * T046: Retry logic for failed key distribution
   *
   * @param conversationId - Group conversation ID
   * @param memberIds - Members with pending status
   * @returns Updated pending member IDs (those still pending after retry)
   */
  async retryKeyDistribution(
    conversationId: string,
    memberIds: string[]
  ): Promise<string[]> {
    const {
      data: { user },
      error: authError,
    } = await this.supabase.auth.getUser();
    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to retry key distribution'
      );
    }

    const msgClient = createMessagingClient(this.supabase);
    const stillPending: string[] = [];

    try {
      // Get current key version
      const { data: conversation, error: convError } = await msgClient
        .from('conversations')
        .select('current_key_version')
        .eq('id', conversationId)
        .single();

      if (convError) {
        throw new ConnectionError(
          'Failed to get conversation: ' + convError.message
        );
      }

      const keyVersion = conversation.current_key_version || 1;

      // Get current user's keys
      const currentKeys = keyManagementService.getCurrentKeys();
      if (!currentKeys) {
        throw new GroupKeyError('Encryption keys not available');
      }

      // Try to get the existing group key from cache or fetch it
      let groupKey: CryptoKey;
      try {
        groupKey = await this.getGroupKeyForConversation(
          conversationId,
          keyVersion
        );
      } catch {
        // If we can't get the key, we can't retry
        throw new GroupKeyError('Cannot retry: group key not accessible');
      }

      // Try to distribute to each pending member
      for (const memberId of memberIds) {
        let retryCount = 0;
        let success = false;

        while (
          retryCount < GROUP_CONSTRAINTS.KEY_DISTRIBUTION_RETRY_COUNT &&
          !success
        ) {
          try {
            const memberPublicKey =
              await keyManagementService.getUserPublicKey(memberId);
            if (!memberPublicKey) {
              // Wait before retry
              await this.delay(
                GROUP_CONSTRAINTS.KEY_DISTRIBUTION_RETRY_DELAYS[retryCount] ||
                  4000
              );
              retryCount++;
              continue;
            }

            const encryptedKey = await this.encryptGroupKeyForMember(
              groupKey,
              memberPublicKey,
              currentKeys.privateKey
            );

            await msgClient.from('group_keys').insert({
              conversation_id: conversationId,
              user_id: memberId,
              key_version: keyVersion,
              encrypted_key: encryptedKey,
              created_by: user.id,
            });

            // Update member status to active
            await msgClient
              .from('conversation_members')
              .update({ key_status: 'active' })
              .eq('conversation_id', conversationId)
              .eq('user_id', memberId);

            success = true;
          } catch (error) {
            logger.warn('Retry failed for member', {
              memberId,
              retryCount,
              error,
            });
            await this.delay(
              GROUP_CONSTRAINTS.KEY_DISTRIBUTION_RETRY_DELAYS[retryCount] ||
                4000
            );
            retryCount++;
          }
        }

        if (!success) {
          stillPending.push(memberId);
        }
      }

      logger.info('Key distribution retry complete', {
        conversationId,
        attempted: memberIds.length,
        stillPending: stillPending.length,
      });

      return stillPending;
    } catch (error) {
      if (
        error instanceof GroupKeyError ||
        error instanceof AuthenticationError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new GroupKeyError('Failed to retry key distribution', error);
    }
  }

  /**
   * Clear the key cache (call on logout)
   */
  clearCache(): void {
    this.keyCache.clear();
    logger.debug('Group key cache cleared');
  }

  /**
   * Get cached key if available
   * @param conversationId - Group conversation ID
   * @param keyVersion - Key version
   * @returns Cached key or undefined
   */
  getCachedKey(
    conversationId: string,
    keyVersion: number
  ): CryptoKey | undefined {
    return this.keyCache.get(conversationId, keyVersion)?.key;
  }

  /**
   * Export group key bytes for storage
   * @param key - CryptoKey to export
   * @returns Raw key bytes
   */
  async exportKeyBytes(key: CryptoKey): Promise<ArrayBuffer> {
    return crypto.subtle.exportKey('raw', key);
  }

  /**
   * Import group key from bytes
   * @param keyBytes - Raw key bytes (ArrayBuffer or Uint8Array)
   * @returns CryptoKey
   */
  async importKeyBytes(keyBytes: ArrayBuffer | Uint8Array): Promise<CryptoKey> {
    // Ensure we have a proper Uint8Array for cross-platform compatibility
    const bytes =
      keyBytes instanceof Uint8Array ? keyBytes : new Uint8Array(keyBytes);
    return crypto.subtle.importKey(
      'raw',
      bytes as Uint8Array<ArrayBuffer>,
      { name: 'AES-GCM', length: 256 },
      true, // extractable for distribution
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Convert ArrayBuffer to base64 string
   * @private
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to Uint8Array
   * @private
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Helper to delay execution
   * @private
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const groupKeyService = new GroupKeyService();
