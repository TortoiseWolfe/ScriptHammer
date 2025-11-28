/**
 * Welcome Service for Admin Welcome Messages
 * Feature: 002-feature-002-admin
 * Tasks: T016-T020
 *
 * Sends encrypted welcome messages from the admin user (ScriptHammer)
 * to new users on their first key initialization.
 *
 * Key features:
 * - Lazy key derivation (FR-011): Admin keys derived on first send attempt
 * - Self-healing (FR-012): Re-derives keys if corruption detected
 * - Non-blocking: Errors logged but don't interrupt user flow
 * - Idempotent: Uses welcome_message_sent flag to prevent duplicates
 */

import { createClient } from '@/lib/supabase/client';
import {
  createMessagingClient,
  type ConversationInsert,
} from '@/lib/supabase/messaging-client';
import { KeyDerivationService } from '@/lib/messaging/key-derivation';
import { encryptionService } from '@/lib/messaging/encryption';
import { createLogger } from '@/lib/logger';
import type { DerivedKeyPair } from '@/types/messaging';

const logger = createLogger('messaging:welcome');

/**
 * Admin user configuration from environment
 */
const ADMIN_CONFIG = {
  get userId(): string {
    return (
      process.env.NEXT_PUBLIC_ADMIN_USER_ID ||
      '00000000-0000-0000-0000-000000000001'
    );
  },
  get password(): string | undefined {
    return process.env.TEST_USER_ADMIN_PASSWORD;
  },
};

/**
 * Welcome message content (FR-010)
 * Explains E2E encryption in layman's terms including:
 * - Message privacy
 * - Password-derived keys
 * - Cross-device access
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
 * Welcome Service
 *
 * Manages sending encrypted welcome messages from admin to new users.
 * Admin keys are derived lazily and cached in memory.
 */
export class WelcomeService {
  /** Cached admin keys (derived lazily) */
  private adminKeys: DerivedKeyPair | null = null;

  /** Key derivation service */
  private keyDerivationService = new KeyDerivationService();

  /**
   * Send welcome message to a new user (FR-007)
   *
   * Flow:
   * 1. Check welcome_message_sent flag
   * 2. Initialize admin keys if needed (lazy derivation, FR-011)
   * 3. Get/create conversation between admin and user
   * 4. Encrypt message with user's public key
   * 5. Insert message into database
   * 6. Set welcome_message_sent = TRUE
   *
   * @param userId - Target user's UUID
   * @param userPublicKey - Target user's public key (JWK format)
   * @returns Result of send operation
   *
   * @remarks
   * - Non-blocking: Errors logged but don't interrupt flow
   * - Idempotent: Checks welcome_message_sent before sending
   */
  async sendWelcomeMessage(
    userId: string,
    userPublicKey: JsonWebKey
  ): Promise<SendWelcomeResult> {
    logger.debug('sendWelcomeMessage called', { userId });

    try {
      // Step 1: Check if admin password is configured
      if (!ADMIN_CONFIG.password) {
        logger.warn('Admin password not configured, skipping welcome message');
        return {
          success: false,
          skipped: true,
          reason: 'Admin password not configured',
        };
      }

      const supabase = createClient();
      const msgClient = createMessagingClient(supabase);

      // Step 2: Check if user already received welcome message (FR-006)
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('welcome_message_sent')
        .eq('id', userId)
        .single();

      if (profileError) {
        logger.error('Failed to check welcome status', {
          error: profileError.message,
        });
        return {
          success: false,
          error: 'Failed to check welcome status: ' + profileError.message,
        };
      }

      if (profile?.welcome_message_sent) {
        logger.debug('Welcome message already sent', { userId });
        return {
          success: true,
          skipped: true,
          reason: 'Welcome message already sent',
        };
      }

      // Step 3: Initialize admin keys if needed (FR-011 lazy derivation)
      await this.ensureAdminKeys();

      if (!this.adminKeys) {
        logger.error('Failed to initialize admin keys');
        return {
          success: false,
          error: 'Failed to initialize admin keys',
        };
      }

      // Step 4: Get or create conversation between admin and user
      const conversationId = await this.getOrCreateAdminConversation(
        userId,
        msgClient
      );

      if (!conversationId) {
        logger.error('Failed to create conversation');
        return {
          success: false,
          error: 'Failed to create conversation',
        };
      }

      // Step 5: Import user's public key and derive shared secret
      const userPublicKeyCrypto = await crypto.subtle.importKey(
        'jwk',
        userPublicKey,
        {
          name: 'ECDH',
          namedCurve: 'P-256',
        },
        false,
        []
      );

      const sharedSecret = await encryptionService.deriveSharedSecret(
        this.adminKeys.privateKey,
        userPublicKeyCrypto
      );

      // Step 6: Encrypt welcome message
      const encrypted = await encryptionService.encryptMessage(
        WELCOME_MESSAGE_CONTENT,
        sharedSecret
      );

      // Step 7: Get next sequence number
      const { data: lastMessage } = await msgClient
        .from('messages')
        .select('sequence_number')
        .eq('conversation_id', conversationId)
        .order('sequence_number', { ascending: false })
        .limit(1)
        .single();

      const nextSequenceNumber = lastMessage
        ? lastMessage.sequence_number + 1
        : 1;

      // Step 8: Insert encrypted message
      const { data: message, error: insertError } = await msgClient
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: ADMIN_CONFIG.userId,
          encrypted_content: encrypted.ciphertext,
          initialization_vector: encrypted.iv,
          sequence_number: nextSequenceNumber,
          deleted: false,
          edited: false,
          delivered_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError) {
        logger.error('Failed to insert welcome message', {
          error: insertError.message,
        });
        return {
          success: false,
          error: 'Failed to insert message: ' + insertError.message,
        };
      }

      // Step 9: Update conversation's last_message_at
      await msgClient
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      // Step 10: Mark welcome message as sent
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ welcome_message_sent: true })
        .eq('id', userId);

      if (updateError) {
        logger.warn('Failed to update welcome_message_sent flag', {
          error: updateError.message,
        });
        // Don't fail - message was sent successfully
      }

      logger.info('Welcome message sent successfully', {
        userId,
        conversationId,
        messageId: message?.id,
      });

      return {
        success: true,
        conversationId,
        messageId: message?.id,
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Welcome message failed', {
        userId,
        errorName: err.name,
        errorMessage: err.message,
      });
      return {
        success: false,
        error: err.message || 'Unknown error',
      };
    }
  }

  /**
   * Check if user has received welcome message
   *
   * @param userId - Target user's UUID
   * @returns true if already sent
   */
  async hasReceivedWelcome(userId: string): Promise<boolean> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('user_profiles')
      .select('welcome_message_sent')
      .eq('id', userId)
      .single();

    if (error) {
      logger.warn('Failed to check welcome status', { error: error.message });
      return false;
    }

    return data?.welcome_message_sent === true;
  }

  /**
   * Initialize admin encryption keys from password (FR-011)
   *
   * Derives keys lazily on first send attempt.
   * If keys exist but are corrupted, re-derives them (FR-012 self-healing).
   *
   * @returns Admin's public key in JWK format
   * @throws If admin password not configured
   */
  async initializeAdminKeys(): Promise<JsonWebKey> {
    const password = ADMIN_CONFIG.password;
    if (!password) {
      throw new Error('Admin password not configured in environment');
    }

    const supabase = createClient();
    const msgClient = createMessagingClient(supabase);

    // Check if admin already has keys stored
    const { data: existingKey, error: keyError } = await msgClient
      .from('user_encryption_keys')
      .select('public_key, encryption_salt')
      .eq('user_id', ADMIN_CONFIG.userId)
      .eq('revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingKey?.encryption_salt) {
      // Admin has keys - verify they match derived keys (self-healing check)
      const saltBytes = Uint8Array.from(
        atob(existingKey.encryption_salt),
        (c) => c.charCodeAt(0)
      );

      const derivedKeys = await this.keyDerivationService.deriveKeyPair({
        password,
        salt: saltBytes,
      });

      const storedPublicKey = existingKey.public_key as unknown as JsonWebKey;
      const isMatch = this.keyDerivationService.verifyPublicKey(
        derivedKeys.publicKeyJwk,
        storedPublicKey
      );

      if (isMatch) {
        // Keys match - cache and return
        this.adminKeys = derivedKeys;
        logger.debug('Admin keys verified and cached');
        return derivedKeys.publicKeyJwk;
      }

      // Keys don't match - self-heal by replacing (FR-012)
      logger.warn('Admin keys corrupted, re-deriving (self-healing)');

      // Revoke old key
      await msgClient
        .from('user_encryption_keys')
        .update({ revoked: true })
        .eq('user_id', ADMIN_CONFIG.userId)
        .eq('revoked', false);
    }

    // Generate new salt and derive keys
    const salt = this.keyDerivationService.generateSalt();
    const keyPair = await this.keyDerivationService.deriveKeyPair({
      password,
      salt,
    });

    // Store public key and salt
    const { error: insertError } = await msgClient
      .from('user_encryption_keys')
      .insert({
        user_id: ADMIN_CONFIG.userId,
        public_key:
          keyPair.publicKeyJwk as unknown as import('@/lib/supabase/types').Json,
        encryption_salt: keyPair.salt,
        device_id: null,
        expires_at: null,
        revoked: false,
      });

    if (insertError) {
      logger.error('Failed to store admin public key', {
        error: insertError.message,
      });
      throw new Error(
        'Failed to store admin public key: ' + insertError.message
      );
    }

    this.adminKeys = keyPair;
    logger.info('Admin keys initialized and stored');

    return keyPair.publicKeyJwk;
  }

  /**
   * Ensure admin keys are available (lazy initialization)
   * @private
   */
  private async ensureAdminKeys(): Promise<void> {
    if (this.adminKeys) {
      return; // Already cached
    }
    await this.initializeAdminKeys();
  }

  /**
   * Get or create conversation between admin and user
   *
   * Admin bypasses normal connection requirement via RLS policy.
   * Uses canonical ordering (smaller UUID = participant_1_id).
   *
   * @param userId - Target user's UUID
   * @param msgClient - Messaging client
   * @returns Conversation ID
   * @private
   */
  private async getOrCreateAdminConversation(
    userId: string,
    msgClient: ReturnType<typeof createMessagingClient>
  ): Promise<string | null> {
    const adminId = ADMIN_CONFIG.userId;

    // Apply canonical ordering
    const [participant_1, participant_2] =
      adminId < userId ? [adminId, userId] : [userId, adminId];

    // Check for existing conversation
    const { data: existing } = await msgClient
      .from('conversations')
      .select('id')
      .eq('participant_1_id', participant_1)
      .eq('participant_2_id', participant_2)
      .single();

    if (existing) {
      return existing.id;
    }

    // Create new conversation (admin RLS policy allows this)
    const insertData: ConversationInsert = {
      participant_1_id: participant_1,
      participant_2_id: participant_2,
    };

    const { data: created, error: createError } = await (msgClient as any)
      .from('conversations')
      .insert(insertData)
      .select('id')
      .single();

    if (createError) {
      // Handle race condition
      if (createError.code === '23505') {
        const { data: retry } = await msgClient
          .from('conversations')
          .select('id')
          .eq('participant_1_id', participant_1)
          .eq('participant_2_id', participant_2)
          .single();
        if (retry) return retry.id;
      }
      logger.error('Failed to create admin conversation', {
        error: createError.message,
      });
      return null;
    }

    return created.id;
  }

  /**
   * Clear cached admin keys (for testing)
   */
  clearCache(): void {
    this.adminKeys = null;
    logger.debug('Admin keys cache cleared');
  }
}

// Export singleton instance
export const welcomeService = new WelcomeService();
