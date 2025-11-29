/**
 * Welcome Service Contract
 * Feature: 003-feature-004-welcome
 *
 * Defines the interface for the redesigned welcome message service.
 * Uses admin's pre-stored public key instead of password derivation.
 *
 * Requirements:
 * - FR-003: Derive shared secret using user's private key + admin's public key
 * - FR-011: Use ECDH P-256 curve for all key generation and derivation
 *
 * JWK Format (admin public key):
 * {
 *   kty: "EC",
 *   crv: "P-256",
 *   x: "<base64url-encoded>",
 *   y: "<base64url-encoded>"
 * }
 */

/**
 * Result of sending a welcome message
 */
export interface SendWelcomeResult {
  success: boolean;
  conversationId?: string;
  messageId?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Admin configuration (no password needed)
 */
export interface AdminConfig {
  /** Fixed admin user UUID */
  userId: string; // '00000000-0000-0000-0000-000000000001'
}

/**
 * Welcome Service Interface
 *
 * Simplified service that uses admin's pre-stored public key
 * instead of deriving keys from password at runtime.
 */
export interface IWelcomeService {
  /**
   * Send welcome message to a new user
   *
   * Flow:
   * 1. Check welcome_message_sent flag (idempotency)
   * 2. Fetch admin's public key from database
   * 3. Derive shared secret: ECDH(user_private, admin_public)
   * 4. Encrypt WELCOME_MESSAGE_CONTENT
   * 5. Create conversation (canonical ordering)
   * 6. Insert message with sender_id = admin
   * 7. Update welcome_message_sent = true
   *
   * @param userId - Target user's UUID
   * @param userPrivateKey - User's ECDH private key (CryptoKey)
   * @param userPublicKey - User's public key for conversation key storage
   * @returns Result of send operation
   */
  sendWelcomeMessage(
    userId: string,
    userPrivateKey: CryptoKey,
    userPublicKey: JsonWebKey
  ): Promise<SendWelcomeResult>;

  /**
   * Check if user has received welcome message
   *
   * @param userId - Target user's UUID
   * @returns true if already sent
   */
  hasReceivedWelcome(userId: string): Promise<boolean>;

  /**
   * Fetch admin's public key from database
   *
   * @returns Admin's ECDH public key in JWK format
   * @throws Error if admin key not found
   */
  getAdminPublicKey(): Promise<JsonWebKey>;
}

/**
 * Welcome message content constant
 * Explains E2E encryption to new users
 */
export const WELCOME_MESSAGE_CONTENT = `Welcome to ScriptHammer!

Your messages are protected by end-to-end encryption. Here's what that means:

**Your messages are private** - Only you and the person you're messaging can read them. Not even we can see your conversations.

**How it works** - Your password generates a unique "key" that locks and unlocks your messages. This key is created fresh each time you log in - we never store it.

**Works on any device** - Since your key comes from your password, you can read your messages on any device just by logging in.

**Why this matters** - Even if someone accessed our servers, your conversations would look like scrambled nonsense without your password.

Feel free to explore!
- The ScriptHammer Team`;

/**
 * Admin user constant
 */
export const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';
