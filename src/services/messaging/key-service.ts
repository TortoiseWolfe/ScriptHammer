/**
 * Key Management Service for User Encryption Keys
 * Tasks: T055-T059, Feature 032 (T007)
 *
 * Manages user encryption key lifecycle:
 * - Password-derived keys (Argon2id + ECDH P-256)
 * - In-memory keys (extractable) for the active session
 * - Persisted private key (non-extractable CryptoKey) in IndexedDB so that
 *   page reloads + offline use don't require re-derivation; XSS reading
 *   the row gets a handle but cannot exportKey() the raw material
 * - Key derivation on login, clear on logout (memory + IndexedDB)
 * - Migration support for legacy random keys
 *
 * Flow:
 * - New user: initializeKeys(password) → generate salt, derive keys, store salt+publicKey
 * - Existing user: deriveKeys(password) → fetch salt, derive keys, verify match
 * - Legacy user: needsMigration() returns true → migration flow (Phase 6)
 */

import { createClient } from '@/lib/supabase/client';
import {
  createMessagingClient,
  type UserEncryptionKeyRow,
} from '@/lib/supabase/messaging-client';
import { encryptionService } from '@/lib/messaging/encryption';
import { db } from '@/lib/messaging/database';
import { KeyDerivationService } from '@/lib/messaging/key-derivation';
import { createLogger } from '@/lib/logger';
import type { DerivedKeyPair } from '@/types/messaging';
import {
  AuthenticationError,
  EncryptionError,
  ConnectionError,
  KeyDerivationError,
  KeyMismatchError,
} from '@/types/messaging';

const logger = createLogger('messaging:keys');

/**
 * Re-import an extractable ECDH CryptoKey as a non-extractable copy suitable
 * for IndexedDB storage. XSS reading the row gets a handle but cannot export
 * raw key material.
 */
async function asNonExtractablePrivate(
  extractable: CryptoKey
): Promise<CryptoKey> {
  const jwk = await crypto.subtle.exportKey('jwk', extractable);
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits', 'deriveKey']
  );
}

export class KeyManagementService {
  /** In-memory storage for derived keys (cleared on logout) */
  private derivedKeys: DerivedKeyPair | null = null;

  /** Cache for other users' public keys (keyed by userId).
   * Populated on first fetch, enables offline message encryption. */
  private publicKeyCache = new Map<string, JsonWebKey>();

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
   * 4. Hold keys in memory; persist non-extractable private key in IndexedDB
   *
   * @param password - User's plaintext password
   * @returns Promise<DerivedKeyPair> - Derived key pair
   * @throws AuthenticationError if not authenticated
   * @throws KeyDerivationError if derivation fails
   * @throws ConnectionError if Supabase upload fails
   */
  async initializeKeys(password: string): Promise<DerivedKeyPair> {
    const supabase = createClient();
    const msgClient = createMessagingClient(supabase);

    // Use getSession() — getUser() makes a server call that can fail with
    // "Auth session missing!" on static exports before session hydration.
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    const user = session?.user;

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
      // Cast JsonWebKey to Json for database compatibility
      const { error: uploadError } = await msgClient
        .from('user_encryption_keys')
        .insert({
          user_id: user.id,
          public_key:
            keyPair.publicKeyJwk as unknown as import('@/lib/supabase/types').Json,
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

      // Step 4: Store keypair in memory + IndexedDB.
      // The IndexedDB copy is a NON-EXTRACTABLE re-import — XSS reading the
      // row cannot exportKey() the raw material. The in-memory copy stays
      // extractable so the public half can still be exported on demand
      // (e.g. for verification fingerprints).
      this.derivedKeys = keyPair;
      try {
        const nonExtractablePrivate = await asNonExtractablePrivate(
          keyPair.privateKey
        );
        await encryptionService.storePrivateKey(user.id, nonExtractablePrivate);
      } catch (err) {
        logger.warn('Could not populate IndexedDB after initializeKeys()', {
          error: err,
        });
      }

      logger.info('Keys initialized for user', { userId: user.id });
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
   * 4. Hold keys in memory; persist non-extractable private key in IndexedDB
   *
   * @param password - User's plaintext password
   * @returns Promise<DerivedKeyPair> - Derived key pair
   * @throws AuthenticationError if not authenticated
   * @throws KeyDerivationError if derivation fails
   * @throws KeyMismatchError if password is wrong (public keys don't match)
   */
  async deriveKeys(password: string): Promise<DerivedKeyPair> {
    const supabase = createClient();
    const msgClient = createMessagingClient(supabase);

    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to derive encryption keys'
      );
    }

    try {
      // Step 1: Fetch salt and public key from Supabase
      // Use maybeSingle() instead of single() to handle case where user has no keys yet
      const { data, error } = await msgClient
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
      // Cast Json to JsonWebKey for verification
      const storedKey = data.public_key as unknown as JsonWebKey;
      const derivedFingerprint = keyPair.publicKeyJwk?.x?.slice(0, 8) ?? 'null';
      const storedFingerprint = storedKey?.x?.slice(0, 8) ?? 'null';
      console.log(
        `[deriveKeys] userId=${user.id.slice(0, 8)} derived=${derivedFingerprint} stored=${storedFingerprint} match=${derivedFingerprint === storedFingerprint}`
      );

      const isMatch = this.keyDerivationService.verifyPublicKey(
        keyPair.publicKeyJwk,
        storedKey
      );

      if (!isMatch) {
        throw new KeyMismatchError();
      }

      // Step 4: Store keypair in memory + IndexedDB (non-extractable copy).
      this.derivedKeys = keyPair;
      try {
        const nonExtractablePrivate = await asNonExtractablePrivate(
          keyPair.privateKey
        );
        await encryptionService.storePrivateKey(user.id, nonExtractablePrivate);
      } catch (err) {
        logger.warn('Could not populate IndexedDB after deriveKeys()', {
          error: err,
        });
      }

      logger.info('Keys derived for user', { userId: user.id });
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
   * Get current derived keys from memory (synchronous).
   * For async restore from localStorage, use restoreKeysFromCache().
   * @returns DerivedKeyPair or null if not in memory
   */
  getCurrentKeys(): DerivedKeyPair | null {
    return this.derivedKeys;
  }

  /**
   * Restore the user's encryption key from IndexedDB into in-memory state.
   * Replaces the prior localStorage cache: IndexedDB now holds a
   * non-extractable CryptoKey for the private half, plus we re-fetch the
   * public key + salt from Supabase to rebuild the full DerivedKeyPair.
   *
   * @returns true if keys were restored, false if no IndexedDB key exists
   *          (caller should fall back to ReAuthModal in that case)
   */
  async restoreKeysFromCache(currentUserId?: string): Promise<boolean> {
    const isE2E =
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('playwright_e2e') === 'true';
    if (isE2E) {
      console.warn(
        '[AUTH-DIAG] restoreKeysFromCache entry',
        JSON.stringify({
          userId: currentUserId?.slice(0, 8),
          hasInMemory: !!this.derivedKeys,
        })
      );
    }
    if (this.derivedKeys) return true;
    if (!currentUserId) return false;

    const stored = await encryptionService.getPrivateKey(currentUserId);
    if (isE2E) {
      console.warn(
        '[AUTH-DIAG] restoreKeysFromCache after-getPrivateKey',
        JSON.stringify({
          userId: currentUserId.slice(0, 8),
          hasStored: !!stored,
        })
      );
    }
    if (!stored) return false;

    // We have the private CryptoKey but need the public half + salt to fully
    // populate DerivedKeyPair. Both live on user_encryption_keys in Supabase.
    const supabase = createClient();
    const msgClient = createMessagingClient(supabase);
    const { data, error } = await msgClient
      .from('user_encryption_keys')
      .select('encryption_salt, public_key')
      .eq('user_id', currentUserId)
      .eq('revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (isE2E) {
      console.warn(
        '[AUTH-DIAG] restoreKeysFromCache supabase-result',
        JSON.stringify({
          userId: currentUserId.slice(0, 8),
          errCode: error?.code,
          errMsg: error?.message?.slice(0, 200),
          hasData: !!data,
          hasSalt: !!data?.encryption_salt,
          hasPubKey: !!data?.public_key,
        })
      );
    }

    if (error || !data?.encryption_salt || !data.public_key) {
      logger.warn(
        'restoreKeysFromCache: have private key in IndexedDB but no public key/salt in Supabase',
        { userId: currentUserId, errorCode: error?.code }
      );
      return false;
    }

    const publicKeyJwk = data.public_key as unknown as JsonWebKey;
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      publicKeyJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );

    this.derivedKeys = {
      privateKey: stored,
      publicKey,
      publicKeyJwk,
      salt: data.encryption_salt,
    };
    const fingerprint = publicKeyJwk?.x?.slice(0, 8) ?? 'null';
    console.log(
      `[restoreKeysFromCache] userId=${currentUserId.slice(0, 8)} pubKey=${fingerprint} source=IndexedDB`
    );
    logger.info('Restored keys from IndexedDB', { userId: currentUserId });
    return true;
  }

  /**
   * Clear keys from memory and IndexedDB (call on logout). Also wipes the
   * persisted private key so the device can no longer decrypt without the
   * user re-deriving from password.
   */
  clearKeys(): void {
    if (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('playwright_e2e') === 'true'
    ) {
      const stack =
        new Error().stack?.split('\n').slice(1, 6).join(' | ') ?? 'no-stack';
      console.warn(
        '[AUTH-DIAG] clearKeys called',
        JSON.stringify({ stack: stack.slice(0, 500) })
      );
    }
    this.derivedKeys = null;
    // Fire-and-forget — caller doesn't need to await IDB clear.
    void db.messaging_private_keys.clear().catch((err) => {
      logger.warn('Failed to clear messaging_private_keys on logout', {
        error: err,
      });
    });
    this.publicKeyCache.clear();
    logger.debug('Keys cleared from memory and IndexedDB');
  }

  /**
   * Check if user needs migration (has legacy random keys)
   * Feature 033: Fixed to check for ANY valid key, not just most recent
   *
   * @returns true only if user has keys but NONE have valid encryption_salt
   */
  async needsMigration(): Promise<boolean> {
    const supabase = createClient();
    const msgClient = createMessagingClient(supabase);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return false; // Not authenticated, can't check
    }

    try {
      // Check if ANY active key has a valid salt
      const { data: validKeys, error: validError } = await msgClient
        .from('user_encryption_keys')
        .select('id')
        .eq('user_id', user.id)
        .eq('revoked', false)
        .not('encryption_salt', 'is', null)
        .limit(1);

      if (validError) {
        logger.error('needsMigration: Error checking valid keys', {
          error: validError,
        });
        return false; // Safe default - don't block users on error
      }

      // If user has at least one valid key, no migration needed
      if (validKeys && validKeys.length > 0) {
        return false;
      }

      // Check if user has ANY keys at all (to distinguish new user from legacy user)
      const { data: anyKeys, error: anyError } = await msgClient
        .from('user_encryption_keys')
        .select('id')
        .eq('user_id', user.id)
        .eq('revoked', false)
        .limit(1);

      if (anyError) {
        logger.error('needsMigration: Error checking any keys', {
          error: anyError,
        });
        return false;
      }

      // Needs migration only if has keys but none have salt
      // (New users with no keys don't need migration - they need initialization)
      return anyKeys && anyKeys.length > 0;
    } catch (error) {
      logger.error('needsMigration: Unexpected error', { error });
      return false;
    }
  }

  /**
   * Check if a specific user has valid (non-revoked) encryption keys.
   * Skips auth — caller provides the user ID (e.g. from useAuth context).
   * This avoids the getSession()/getUser() race on static exports.
   */
  async hasKeysForUser(userId: string): Promise<boolean> {
    const supabase = createClient();
    const msgClient = createMessagingClient(supabase);

    try {
      const { data, error } = await msgClient
        .from('user_encryption_keys')
        .select('id')
        .eq('user_id', userId)
        .eq('revoked', false)
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        logger.error('hasKeysForUser: Database error', {
          error: error.message,
        });
        throw new ConnectionError(
          'Failed to check encryption keys: ' + error.message
        );
      }

      return data !== null;
    } catch (error) {
      if (error instanceof ConnectionError) {
        throw error;
      }
      logger.error('hasKeysForUser: Unexpected error', { error });
      return false;
    }
  }

  /**
   * Check if user has any valid (non-revoked) encryption keys
   * Feature 006: Fixed to use .maybeSingle() instead of .single() to handle 0 rows without throwing
   * @returns true if user has valid keys in Supabase (where revoked=false)
   */
  async hasKeys(): Promise<boolean> {
    const supabase = createClient();
    const msgClient = createMessagingClient(supabase);

    // Use getSession() instead of getUser() to avoid a server round-trip.
    // getUser() validates the JWT against the Supabase server, which fails
    // with "Auth session missing!" on static exports when the session hasn't
    // been restored from localStorage yet. getSession() reads from local
    // storage synchronously and is sufficient for the DB query that follows
    // (the JWT in the session is sent with the query for RLS).
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (authError || !user) {
      logger.warn('hasKeys: auth failed', {
        authError: authError?.message,
        hasUser: !!user,
      });
      console.warn(
        `[hasKeys] auth failed: error=${authError?.message || 'none'}, user=${!!user}`
      );
      return false;
    }

    try {
      // Use maybeSingle() to handle 0 rows without throwing PGRST116
      // Only count valid keys where revoked=false (per FR-007)
      const { data, error } = await msgClient
        .from('user_encryption_keys')
        .select('id')
        .eq('user_id', user.id)
        .eq('revoked', false)
        .limit(1)
        .maybeSingle();

      // Only return false for no rows, throw on actual errors
      if (error && error.code !== 'PGRST116') {
        logger.error('hasKeys: Database error', { error: error.message });
        throw new ConnectionError(
          'Failed to check encryption keys: ' + error.message
        );
      }

      logger.info('hasKeys result', {
        userId: user.id,
        hasData: data !== null,
        errorCode: error?.code,
      });
      console.warn(
        `[hasKeys] query: userId=${user.id.slice(0, 8)}, hasData=${data !== null}, err=${error?.code || 'none'}`
      );
      return data !== null;
    } catch (error) {
      if (error instanceof ConnectionError) {
        throw error;
      }
      logger.error('hasKeys: Unexpected error', { error });
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
    logger.debug('hasValidKeys: Checking for valid encryption keys');

    // First check in-memory keys
    if (this.derivedKeys !== null) {
      logger.debug('hasValidKeys: FOUND in-memory keys');
      return true;
    }

    // Fall back to IndexedDB check for legacy support
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.error('hasValidKeys: Not authenticated');
      throw new AuthenticationError(
        'You must be signed in to check encryption keys'
      );
    }

    try {
      const privateKey = await encryptionService.getPrivateKey(user.id);
      const hasKeys = privateKey !== null;
      logger.debug('hasValidKeys result', {
        status: hasKeys ? 'FOUND (IndexedDB)' : 'MISSING',
        userId: user.id,
      });
      return hasKeys;
    } catch (error) {
      logger.error('hasValidKeys: Error checking keys', { error });
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
    const msgClient = createMessagingClient(supabase);

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
      const { error: revokeError } = await msgClient
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
      // Cast JsonWebKey to Json for database compatibility
      const { error: uploadError } = await msgClient
        .from('user_encryption_keys')
        .insert({
          user_id: user.id,
          public_key:
            keyPair.publicKeyJwk as unknown as import('@/lib/supabase/types').Json,
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

      // Update in-memory keys + IndexedDB (non-extractable copy).
      this.derivedKeys = keyPair;
      try {
        const nonExtractablePrivate = await asNonExtractablePrivate(
          keyPair.privateKey
        );
        await encryptionService.storePrivateKey(user.id, nonExtractablePrivate);
      } catch (err) {
        logger.warn('Could not populate IndexedDB after rotateKeys()', {
          error: err,
        });
      }

      logger.info('Keys rotated for user', { userId: user.id });
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
    const msgClient = createMessagingClient(supabase);

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
      const { error: revokeError } = await msgClient
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
    logger.debug('getUserPublicKey: Fetching public key', { userId });

    // If offline, fall back to cached key (populated by prior online fetch)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = this.publicKeyCache.get(userId);
      if (cached) {
        const fingerprint = cached?.x?.slice(0, 8) ?? 'null';
        console.log(
          `[getUserPublicKey] userId=${userId.slice(0, 8)} key=${fingerprint} source=offline-cache`
        );
        return cached;
      }
    }
    const supabase = createClient();
    const msgClient = createMessagingClient(supabase);

    try {
      const { data, error } = await msgClient
        .from('user_encryption_keys')
        .select('public_key')
        .eq('user_id', userId)
        .eq('revoked', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          logger.debug('getUserPublicKey: NO KEY FOUND', { userId });
          return null;
        }
        logger.error('getUserPublicKey: Query error', {
          error: error.message,
          userId,
        });
        throw new ConnectionError(
          'Failed to get user public key: ' + error.message
        );
      }

      const publicKey = (data?.public_key as unknown as JsonWebKey) ?? null;
      // Log key fingerprint for E2E debugging (x-coordinate of ECDH public key)
      const fingerprint = publicKey?.x?.slice(0, 8) ?? 'null';
      const source =
        typeof navigator !== 'undefined' && !navigator.onLine
          ? 'offline-cache'
          : 'db-fresh';
      console.log(
        `[getUserPublicKey] userId=${userId.slice(0, 8)} key=${fingerprint} source=${source}`
      );
      if (publicKey) {
        this.publicKeyCache.set(userId, publicKey);
      }
      return publicKey;
    } catch (error) {
      if (error instanceof ConnectionError) {
        throw error;
      }
      logger.error('getUserPublicKey: Unexpected error', { error, userId });
      throw new ConnectionError('Failed to get user public key', error);
    }
  }

  /** Clear the public key cache (call after key reset) */
  clearPublicKeyCache(): void {
    this.publicKeyCache.clear();
  }
}

// Export singleton instance
export const keyManagementService = new KeyManagementService();
