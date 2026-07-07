/**
 * Auth Integration Contract
 * Feature: 032-fix-e2e-encryption
 *
 * Defines how key derivation integrates with auth flow
 */

export interface AuthWithEncryptionResult {
  user: {
    id: string;
    email: string;
  };
  encryptionState:
    | { status: 'ready'; keys: CryptoKeyPair }
    | { status: 'migration_required' }
    | { status: 'initialization_required' };
}

export interface PasswordChangeResult {
  success: boolean;
  messagesReEncrypted: number;
}

/**
 * Integration points with AuthContext
 */
export interface AuthEncryptionIntegration {
  /**
   * Called after successful Supabase sign-in
   * Password is available at this point for key derivation
   *
   * @param password - Plaintext password from sign-in form
   * @returns Auth result with encryption state
   */
  handleSignIn(password: string): Promise<AuthWithEncryptionResult>;

  /**
   * Called during password change flow
   * Must re-encrypt all messages with new key
   *
   * @param oldPassword - Current password (for deriving old key)
   * @param newPassword - New password (for deriving new key)
   * @param onProgress - Progress callback for re-encryption
   * @returns Result with count of re-encrypted messages
   */
  handlePasswordChange(
    oldPassword: string,
    newPassword: string,
    onProgress?: (progress: { current: number; total: number }) => void
  ): Promise<PasswordChangeResult>;

  /**
   * Called on sign-out
   * Must clear derived keys from memory
   */
  handleSignOut(): void;
}

/**
 * Password availability during auth flow
 *
 * IMPORTANT: Password is only available during sign-in form submission.
 * After that, Supabase handles session management and password is not
 * accessible. Key derivation MUST happen during sign-in.
 *
 * Flow:
 * 1. User enters email + password in sign-in form
 * 2. Form submits to Supabase auth
 * 3. IF auth succeeds: derive keys from password BEFORE clearing form
 * 4. Store derived keys in memory (React context or service singleton)
 * 5. Clear password from memory
 * 6. Keys persist in memory until sign-out or page refresh
 *
 * On page refresh:
 * - Session is restored from Supabase cookie
 * - BUT keys are lost (no password available)
 * - User must re-enter password to derive keys
 * - Show "Re-authenticate to decrypt messages" prompt
 */
