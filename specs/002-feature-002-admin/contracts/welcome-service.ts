/**
 * WelcomeService Contract
 *
 * Service responsible for sending encrypted welcome messages
 * from admin to new users on first login.
 */

export interface WelcomeServiceConfig {
  /** Admin user UUID (from env) */
  adminUserId: string;
  /** Admin password for key derivation (from env, NEVER logged) */
  adminPassword: string;
}

export interface SendWelcomeResult {
  /** Whether message was sent successfully */
  success: boolean;
  /** Conversation ID if created */
  conversationId?: string;
  /** Message ID if sent */
  messageId?: string;
  /** Error message if failed */
  error?: string;
}

export interface WelcomeService {
  /**
   * Send welcome message to a new user
   *
   * @param userId - Target user's UUID
   * @param userPublicKey - Target user's public key (JWK format)
   * @returns Result of send operation
   *
   * @remarks
   * - Derives admin keys lazily on first call (FR-011)
   * - Self-heals if admin keys corrupted (FR-012)
   * - Checks welcome_message_sent before sending (FR-006)
   * - Non-blocking - errors logged but don't interrupt flow
   */
  sendWelcomeMessage(
    userId: string,
    userPublicKey: JsonWebKey
  ): Promise<SendWelcomeResult>;

  /**
   * Check if welcome message has been sent to user
   *
   * @param userId - Target user's UUID
   * @returns true if already sent
   */
  hasReceivedWelcome(userId: string): Promise<boolean>;

  /**
   * Initialize admin encryption keys from password
   *
   * @returns Admin's public key in JWK format
   * @throws If admin password not configured
   *
   * @remarks
   * - Called lazily on first sendWelcomeMessage
   * - Stores public key in user_encryption_keys
   * - Caches private key in memory (singleton)
   */
  initializeAdminKeys(): Promise<JsonWebKey>;
}

/**
 * Welcome message content (plain text, will be encrypted)
 */
export const WELCOME_MESSAGE_CONTENT = `Welcome to ScriptHammer!

Your messages are protected by end-to-end encryption. Here's what that means:

**Your messages are private** - Only you and the person you're messaging can read them. Not even we can see your conversations.

**How it works** - Your password generates a unique "key" that locks and unlocks your messages. This key is created fresh each time you log in - we never store it.

**Works on any device** - Since your key comes from your password, you can read your messages on any device just by logging in.

**Why this matters** - Even if someone accessed our servers, your conversations would look like scrambled nonsense without your password.

Feel free to explore!
- The ScriptHammer Team`;
