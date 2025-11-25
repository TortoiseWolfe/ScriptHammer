/**
 * Updated Key Management Service Contract
 * Feature: 032-fix-e2e-encryption
 *
 * Changes from current implementation:
 * - initializeKeys now takes password parameter
 * - New deriveAndVerifyKeys method for login
 * - New migrateKeys method for legacy user migration
 * - Keys are derived, not generated randomly
 */

import type { DerivedKeyPair } from './key-derivation';

export interface KeyInitResult {
  success: boolean;
  isNewUser: boolean; // true if salt was generated (first login)
  requiresMigration: boolean; // true if user has legacy random keys
}

export interface MigrationProgress {
  phase: 'fetching' | 'deriving' | 'reencrypting' | 'uploading' | 'complete';
  current: number; // Current conversation being processed
  total: number; // Total conversations to migrate
}

export interface KeyManagementServiceUpdated {
  /**
   * Check if user needs key migration (has legacy random keys)
   *
   * @returns true if encryption_salt is NULL in database
   */
  needsMigration(): Promise<boolean>;

  /**
   * Derive keys from password for authenticated user
   * Called on every login (keys are never persisted)
   *
   * @param password - User's plaintext password
   * @returns Derived key pair ready for encryption/decryption
   * @throws AuthenticationError if not signed in
   * @throws KeyDerivationError if derivation fails
   */
  deriveKeys(password: string): Promise<DerivedKeyPair>;

  /**
   * Initialize keys for new user (first login after registration)
   *
   * @param password - User's plaintext password
   * @returns Derived key pair, salt stored to Supabase
   * @throws AuthenticationError if not signed in
   * @throws KeyDerivationError if derivation fails
   * @throws ConnectionError if Supabase upload fails
   */
  initializeKeys(password: string): Promise<DerivedKeyPair>;

  /**
   * Migrate legacy user from random keys to password-derived keys
   *
   * Blocking operation that:
   * 1. Derives new key pair from password
   * 2. Re-encrypts all conversation shared secrets
   * 3. Updates public key and stores salt
   * 4. Deletes old private key from IndexedDB
   *
   * @param password - User's plaintext password
   * @param onProgress - Callback for migration progress updates
   * @returns Derived key pair after successful migration
   * @throws MigrationError if any step fails (atomic, rollback on failure)
   */
  migrateKeys(
    password: string,
    onProgress?: (progress: MigrationProgress) => void
  ): Promise<DerivedKeyPair>;

  /**
   * Get user's derived key pair from current session
   * Returns null if keys haven't been derived yet
   *
   * NOTE: Keys are held in memory only during session
   */
  getCurrentKeys(): DerivedKeyPair | null;

  /**
   * Clear keys from memory (call on logout)
   */
  clearKeys(): void;
}

/**
 * Custom error for migration failures
 */
export class MigrationError extends Error {
  constructor(
    message: string,
    public phase: MigrationProgress['phase'],
    public override cause?: unknown
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}
