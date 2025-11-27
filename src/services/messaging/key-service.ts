/**
 * Key Management Service for User Encryption Keys
 * Tasks: T055-T059, Feature 032 (T007)
 *
 * Manages user encryption key lifecycle:
 * - Password-derived keys (Argon2id + ECDH P-256)
 * - Keys held in memory only (no IndexedDB storage)
 * - Key derivation on login, clear on logout
 * - Migration support for legacy random keys
 *
 * Flow:
 * - New user: initializeKeys(password) → generate salt, derive keys, store salt+publicKey
 * - Existing user: deriveKeys(password) → fetch salt, derive keys, verify match
 * - Legacy user: needsMigration() returns true → migration flow (Phase 6)
 */

import { createClient } from '@/lib/supabase/client';
import { encryptionService } from '@/lib/messaging/encryption';
import { KeyDerivationService } from '@/lib/messaging/key-derivation';
import type { DerivedKeyPair } from '@/types/messaging';
import {
  AuthenticationError,
  EncryptionError,
  ConnectionError,
  KeyDerivationError,
  KeyMismatchError,
} from '@/types/messaging';

export class KeyManagementService {
  /** In-memory storage for derived keys (cleared on logout) */
  private derivedKeys: DerivedKeyPair | null = null;

  /** Key derivation service (Argon2id) */
  private keyDerivationService = new KeyDerivationService();

  /**
   * Initialize encryption keys for NEW user (first login after registration)
   * Task: T007 (Feature 032)
   *
   * Flow:
   * 1. Generate random salt
   * 2. Derive ECDH P-256 key pair from password + salt
   * 3. Store salt and public key in Supabase
   * 4. Hold keys in memory (never persisted to IndexedDB)
   *
   * @param password - User's plaintext password
   * @returns Promise<DerivedKeyPair> - Derived key pair
   * @throws AuthenticationError if not authenticated
   * @throws KeyDerivationError if derivation fails
   * @throws ConnectionError if Supabase upload fails
   */
  async initializeKeys(password: string): Promise<DerivedKeyPair> {
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
      // Step 1: Generate random salt
      const salt = this.keyDerivationService.generateSalt();

      // Step 2: Derive key pair from password
      const keyPair = await this.keyDerivationService.deriveKeyPair({
        password,
        salt,
      });

      // Step 3: Upload public key and salt to Supabase
      const { error: uploadError } = await (supabase as any)
        .from('user_encryption_keys')
        .insert({
          user_id: user.id,
          public_key: keyPair.publicKeyJwk,
          encryption_salt: keyPair.salt, // Base64-encoded salt
          device_id: null,
          expires_at: null,
          revoked: false,
        });

      if (uploadError) {
        throw new ConnectionError(
          'Failed to upload public key: ' + uploadError.message
        );
      }

      // Step 4: Store in memory
      this.derivedKeys = keyPair;

      console.log('[KeyService] Keys initialized for user:', user.id);
      return keyPair;
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof KeyDerivationError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new KeyDerivationError(
        'Failed to initialize encryption keys',
        error
      );
    }
  }

  /**
   * Derive keys for EXISTING user (on every login)
   * Task: T007 (Feature 032)
   *
   * Flow:
   * 1. Fetch salt from Supabase
   * 2. Derive key pair from password + salt
   * 3. Verify derived public key matches stored public key
   * 4. Hold keys in memory
   *
   * @param password - User's plaintext password
   * @returns Promise<DerivedKeyPair> - Derived key pair
   * @throws AuthenticationError if not authenticated
   * @throws KeyDerivationError if derivation fails
   * @throws KeyMismatchError if password is wrong (public keys don't match)
   */
  async deriveKeys(password: string): Promise<DerivedKeyPair> {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to derive encryption keys'
      );
    }

    try {
      // Step 1: Fetch salt and public key from Supabase
      // Use maybeSingle() instead of single() to handle case where user has no keys yet
      const { data, error } = await (supabase as any)
        .from('user_encryption_keys')
        .select('encryption_salt, public_key')
        .eq('user_id', user.id)
        .eq('revoked', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Only throw connection error for actual database errors, not "no rows" errors
      if (error && error.code !== 'PGRST116') {
        throw new ConnectionError(
          'Failed to fetch user key data: ' + error.message
        );
      }

      if (!data?.encryption_salt) {
        throw new KeyDerivationError(
          'No salt found. User may need migration or initialization.'
        );
      }

      // Decode base64 salt
      const saltBytes = Uint8Array.from(atob(data.encryption_salt), (c) =>
        c.charCodeAt(0)
      );

      // Step 2: Derive key pair from password
      const keyPair = await this.keyDerivationService.deriveKeyPair({
        password,
        salt: saltBytes,
      });

      // Step 3: Verify public key matches stored
      const isMatch = this.keyDerivationService.verifyPublicKey(
        keyPair.publicKeyJwk,
        data.public_key
      );

      if (!isMatch) {
        throw new KeyMismatchError();
      }

      // Step 4: Store in memory
      this.derivedKeys = keyPair;

      console.log('[KeyService] Keys derived for user:', user.id);
      return keyPair;
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof KeyDerivationError ||
        error instanceof KeyMismatchError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new KeyDerivationError('Failed to derive encryption keys', error);
    }
  }

  /**
   * Get current derived keys from memory
   * @returns DerivedKeyPair or null if not derived
   */
  getCurrentKeys(): DerivedKeyPair | null {
    return this.derivedKeys;
  }

  /**
   * Clear keys from memory (call on logout)
   */
  clearKeys(): void {
    this.derivedKeys = null;
    console.log('[KeyService] Keys cleared from memory');
  }

  /**
   * Check if user needs migration (has legacy random keys)
   * Feature 033: Fixed to check for ANY valid key, not just most recent
   *
   * @returns true only if user has keys but NONE have valid encryption_salt
   */
  async needsMigration(): Promise<boolean> {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return false; // Not authenticated, can't check
    }

    try {
      // Check if ANY active key has a valid salt
      const { data: validKeys, error: validError } = await (supabase as any)
        .from('user_encryption_keys')
        .select('id')
        .eq('user_id', user.id)
        .eq('revoked', false)
        .not('encryption_salt', 'is', null)
        .limit(1);

      if (validError) {
        console.error(
          '[KeyService] needsMigration: Error checking valid keys:',
          validError
        );
        return false; // Safe default - don't block users on error
      }

      // If user has at least one valid key, no migration needed
      if (validKeys && validKeys.length > 0) {
        return false;
      }

      // Check if user has ANY keys at all (to distinguish new user from legacy user)
      const { data: anyKeys, error: anyError } = await (supabase as any)
        .from('user_encryption_keys')
        .select('id')
        .eq('user_id', user.id)
        .eq('revoked', false)
        .limit(1);

      if (anyError) {
        console.error(
          '[KeyService] needsMigration: Error checking any keys:',
          anyError
        );
        return false;
      }

      // Needs migration only if has keys but none have salt
      // (New users with no keys don't need migration - they need initialization)
      return anyKeys && anyKeys.length > 0;
    } catch (error) {
      console.error('[KeyService] needsMigration: Unexpected error:', error);
      return false;
    }
  }

  /**
   * Check if user has any encryption keys (new or legacy)
   * @returns true if user has keys in Supabase
   */
  async hasKeys(): Promise<boolean> {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return false;
    }

    try {
      const { data, error } = await (supabase as any)
        .from('user_encryption_keys')
        .select('id')
        .eq('user_id', user.id)
        .eq('revoked', false)
        .limit(1)
        .single();

      return !error && data !== null;
    } catch {
      return false;
    }
  }

  /**
   * Legacy method - check if user has valid encryption keys
   * Task: T057 (kept for backwards compatibility during migration)
   *
   * @deprecated Use getCurrentKeys() !== null for in-memory check
   * @returns Promise<boolean> - true if user has valid keys
   * @throws AuthenticationError if not authenticated
   */
  async hasValidKeys(): Promise<boolean> {
    console.log(
      '[Decryption] hasValidKeys: Checking for valid encryption keys'
    );

    // First check in-memory keys
    if (this.derivedKeys !== null) {
      console.log('[Decryption] hasValidKeys: FOUND in-memory keys');
      return true;
    }

    // Fall back to IndexedDB check for legacy support
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Decryption] hasValidKeys: Not authenticated');
      throw new AuthenticationError(
        'You must be signed in to check encryption keys'
      );
    }

    try {
      const privateKey = await encryptionService.getPrivateKey(user.id);
      const hasKeys = privateKey !== null;
      console.log(
        '[Decryption] hasValidKeys:',
        hasKeys ? 'FOUND (IndexedDB)' : 'MISSING',
        'for user:',
        user.id
      );
      return hasKeys;
    } catch (error) {
      console.error('[Decryption] hasValidKeys: Error checking keys', error);
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
   * @param password - User's plaintext password (required for key derivation)
   * @returns Promise<boolean> - true if rotation successful
   * @throws AuthenticationError if not authenticated
   * @throws KeyDerivationError if key derivation fails
   * @throws ConnectionError if database operation fails
   */
  async rotateKeys(password: string): Promise<boolean> {
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

      // Generate new salt and derive key pair from password
      const salt = this.keyDerivationService.generateSalt();
      const keyPair = await this.keyDerivationService.deriveKeyPair({
        password,
        salt,
      });

      // Upload new public key AND salt to Supabase (no IndexedDB storage)
      const { error: uploadError } = await (supabase as any)
        .from('user_encryption_keys')
        .insert({
          user_id: user.id,
          public_key: keyPair.publicKeyJwk,
          encryption_salt: keyPair.salt, // REQUIRED: Base64-encoded salt
          device_id: null,
          expires_at: null,
          revoked: false,
        });

      if (uploadError) {
        throw new ConnectionError(
          'Failed to upload new public key: ' + uploadError.message
        );
      }

      // Update in-memory keys (password-derived keys are never persisted to IndexedDB)
      this.derivedKeys = keyPair;

      console.log('[KeyService] Keys rotated for user:', user.id);
      return true;
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof KeyDerivationError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new KeyDerivationError('Failed to rotate encryption keys', error);
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
    console.log(
      '[Decryption] getUserPublicKey: Fetching public key for user:',
      userId
    );
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
          console.log(
            '[Decryption] getUserPublicKey: NO KEY FOUND for user:',
            userId
          );
          return null;
        }
        console.error(
          '[Decryption] getUserPublicKey: Query error:',
          error.message
        );
        throw new ConnectionError(
          'Failed to get user public key: ' + error.message
        );
      }

      console.log(
        '[Decryption] getUserPublicKey: FOUND public key for user:',
        userId
      );
      return data?.public_key ?? null;
    } catch (error) {
      if (error instanceof ConnectionError) {
        throw error;
      }
      console.error('[Decryption] getUserPublicKey: Unexpected error', error);
      throw new ConnectionError('Failed to get user public key', error);
    }
  }
}

// Export singleton instance
export const keyManagementService = new KeyManagementService();
