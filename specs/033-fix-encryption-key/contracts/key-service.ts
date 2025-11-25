/**
 * Key Management Service API Contract
 * Feature 033: Fix Encryption Key Management
 *
 * Changes from current implementation:
 * 1. rotateKeys() now requires password parameter
 * 2. needsMigration() checks for ANY valid key, not just most recent
 */

import type { DerivedKeyPair } from '@/types/messaging';

export interface KeyManagementServiceContract {
  /**
   * Initialize encryption keys for NEW user
   * @param password - User's plaintext password
   * @returns Promise<DerivedKeyPair> - Derived key pair
   */
  initializeKeys(password: string): Promise<DerivedKeyPair>;

  /**
   * Derive keys for EXISTING user (on every login)
   * @param password - User's plaintext password
   * @returns Promise<DerivedKeyPair> - Derived key pair
   */
  deriveKeys(password: string): Promise<DerivedKeyPair>;

  /**
   * Get current derived keys from memory
   * @returns DerivedKeyPair or null if not derived
   */
  getCurrentKeys(): DerivedKeyPair | null;

  /**
   * Clear keys from memory (call on logout)
   */
  clearKeys(): void;

  /**
   * Check if user needs migration (has legacy random keys)
   *
   * FIXED: Now checks for ANY valid key with encryption_salt,
   * not just the most recent key.
   *
   * @returns true only if user has keys but NONE have valid encryption_salt
   */
  needsMigration(): Promise<boolean>;

  /**
   * Check if user has any encryption keys (new or legacy)
   * @returns true if user has keys in Supabase
   */
  hasKeys(): Promise<boolean>;

  /**
   * Rotate user's encryption keys (generate new pair, revoke old)
   *
   * CHANGED: Now requires password parameter for key derivation.
   * Previous signature: rotateKeys(): Promise<boolean>
   *
   * @param password - User's plaintext password (REQUIRED)
   * @returns Promise<boolean> - true if rotation successful
   * @throws KeyDerivationError if password is empty
   */
  rotateKeys(password: string): Promise<boolean>;

  /**
   * Revoke all user's encryption keys
   */
  revokeKeys(): Promise<void>;

  /**
   * Get user's public key from Supabase
   * @param userId - User ID to get public key for
   * @returns Promise<JsonWebKey | null>
   */
  getUserPublicKey(userId: string): Promise<JsonWebKey | null>;
}
