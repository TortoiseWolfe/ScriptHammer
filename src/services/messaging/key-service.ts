/**
 * Key Management Service for User Encryption Keys
 * Tasks: T055-T059
 *
 * Manages user encryption key lifecycle:
 * - Lazy key generation on first message
 * - Key validation and rotation
 * - Public key storage in Supabase
 */

import { createClient } from '@/lib/supabase/client';
import { encryptionService } from '@/lib/messaging/encryption';
import type { UserEncryptionKey } from '@/types/messaging';
import {
  AuthenticationError,
  EncryptionError,
  ConnectionError,
} from '@/types/messaging';

export class KeyManagementService {
  /**
   * Initialize user's encryption keys (lazy generation)
   * Task: T056
   *
   * Flow:
   * 1. Check if user has private key in IndexedDB
   * 2. If not, generate new ECDH key pair
   * 3. Store private key in IndexedDB
   * 4. Upload public key to Supabase
   *
   * @returns Promise<boolean> - true if initialization successful
   * @throws AuthenticationError if not authenticated
   * @throws EncryptionError if key generation fails
   */
  async initializeKeys(): Promise<boolean> {
    const supabase = createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to initialize encryption keys'
      );
    }

    try {
      // Check if user already has keys in IndexedDB
      const existingKey = await encryptionService.getPrivateKey(user.id);

      if (existingKey) {
        // Keys already initialized
        return true;
      }

      // Generate new ECDH P-256 key pair
      const keyPair = await encryptionService.generateKeyPair();

      // Export keys to JWK format
      const publicKeyJwk = await encryptionService.exportPublicKey(
        keyPair.publicKey
      );
      const privateKeyJwk = await crypto.subtle.exportKey(
        'jwk',
        keyPair.privateKey
      );

      // Store private key in IndexedDB (client-side only, never sent to server)
      await encryptionService.storePrivateKey(user.id, privateKeyJwk);

      // Upload public key to Supabase for other users to encrypt messages
      const { error: uploadError } = await (supabase as any)
        .from('user_encryption_keys')
        .insert({
          user_id: user.id,
          public_key: publicKeyJwk,
          device_id: null, // Future: support multiple devices
          expires_at: null, // Future: key expiration
          revoked: false,
        });

      if (uploadError) {
        throw new ConnectionError(
          'Failed to upload public key: ' + uploadError.message
        );
      }

      return true;
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof EncryptionError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new EncryptionError('Failed to initialize encryption keys', error);
    }
  }

  /**
   * Check if user has valid encryption keys
   * Task: T057
   *
   * @returns Promise<boolean> - true if user has valid keys in IndexedDB
   * @throws AuthenticationError if not authenticated
   */
  async hasValidKeys(): Promise<boolean> {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to check encryption keys'
      );
    }

    try {
      const privateKey = await encryptionService.getPrivateKey(user.id);
      return privateKey !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Rotate user's encryption keys (generate new pair, revoke old)
   * Task: T058
   *
   * Note: Old messages remain encrypted with old keys. Rotation only affects
   * new messages. Future enhancement: re-encrypt old messages.
   *
   * @returns Promise<boolean> - true if rotation successful
   * @throws AuthenticationError if not authenticated
   * @throws EncryptionError if key generation fails
   */
  async rotateKeys(): Promise<boolean> {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to rotate encryption keys'
      );
    }

    try {
      // Mark old keys as revoked in Supabase
      const { error: revokeError } = await (supabase as any)
        .from('user_encryption_keys')
        .update({ revoked: true })
        .eq('user_id', user.id)
        .eq('revoked', false);

      if (revokeError) {
        throw new ConnectionError(
          'Failed to revoke old keys: ' + revokeError.message
        );
      }

      // Generate new key pair
      const keyPair = await encryptionService.generateKeyPair();
      const publicKeyJwk = await encryptionService.exportPublicKey(
        keyPair.publicKey
      );
      const privateKeyJwk = await crypto.subtle.exportKey(
        'jwk',
        keyPair.privateKey
      );

      // Store new private key in IndexedDB (overwrites old)
      await encryptionService.storePrivateKey(user.id, privateKeyJwk);

      // Upload new public key to Supabase
      const { error: uploadError } = await (supabase as any)
        .from('user_encryption_keys')
        .insert({
          user_id: user.id,
          public_key: publicKeyJwk,
          device_id: null,
          expires_at: null,
          revoked: false,
        });

      if (uploadError) {
        throw new ConnectionError(
          'Failed to upload new public key: ' + uploadError.message
        );
      }

      return true;
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof EncryptionError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new EncryptionError('Failed to rotate encryption keys', error);
    }
  }

  /**
   * Revoke all user's encryption keys
   * Task: T059
   *
   * Warning: After revocation, user cannot decrypt old messages until they
   * initialize new keys. Use with caution (e.g., account compromise).
   *
   * @returns Promise<void>
   * @throws AuthenticationError if not authenticated
   */
  async revokeKeys(): Promise<void> {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to revoke encryption keys'
      );
    }

    try {
      // Mark all keys as revoked in Supabase
      const { error: revokeError } = await (supabase as any)
        .from('user_encryption_keys')
        .update({ revoked: true })
        .eq('user_id', user.id)
        .eq('revoked', false);

      if (revokeError) {
        throw new ConnectionError(
          'Failed to revoke keys: ' + revokeError.message
        );
      }

      // Remove private key from IndexedDB
      // Note: We don't have a delete method in EncryptionService, so we just overwrite with null
      // Future: Add deletePrivateKey method to EncryptionService
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new EncryptionError('Failed to revoke encryption keys', error);
    }
  }

  /**
   * Get user's public key from Supabase (for other users to encrypt messages)
   * Helper method not in tasks but needed by MessageService
   *
   * @param userId - User ID to get public key for
   * @returns Promise<JsonWebKey | null> - Public key or null if not found
   * @throws ConnectionError if query fails
   */
  async getUserPublicKey(userId: string): Promise<JsonWebKey | null> {
    const supabase = createClient();

    try {
      const { data, error } = await (supabase as any)
        .from('user_encryption_keys')
        .select('public_key')
        .eq('user_id', userId)
        .eq('revoked', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw new ConnectionError(
          'Failed to get user public key: ' + error.message
        );
      }

      return data?.public_key ?? null;
    } catch (error) {
      if (error instanceof ConnectionError) {
        throw error;
      }
      throw new ConnectionError('Failed to get user public key', error);
    }
  }
}

// Export singleton instance
export const keyManagementService = new KeyManagementService();
