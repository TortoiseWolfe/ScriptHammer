/**
 * Welcome Service for Admin Welcome Messages
 * Feature: 003-feature-004-welcome
 *
 * Sends encrypted welcome messages from the admin user (ScriptHammer)
 * to new users on their first key initialization.
 *
 * REDESIGNED: Uses admin's pre-stored public key instead of password derivation.
 * This works on GitHub Pages static hosting where server-side env vars are unavailable.
 *
 * Key features:
 * - No admin password required at runtime (FR-002)
 * - Fetches admin public key from database (FR-001)
 * - Non-blocking: Errors logged but don't interrupt user flow (FR-008)
 * - Idempotent: Uses welcome_message_sent flag to prevent duplicates (FR-005)
 */

import { createClient } from '@/lib/supabase/client';
import {
  createMessagingClient,
  type ConversationInsert,
} from '@/lib/supabase/messaging-client';
import { encryptionService } from '@/lib/messaging/encryption';
import { createLogger } from '@/lib/logger';

const logger = createLogger('messaging:welcome');

/**
 * Admin user ID constant (FR-010)
 * Fixed UUID for consistent welcome message sender
 */
export const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';

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
 * Uses admin's pre-stored public key from database instead of password derivation.
 */
export class WelcomeService {
  /**
   * Fetch admin's public key from database (FR-001, FR-010)
   *
   * @returns Admin's ECDH public key in JWK format
   * @throws Error if admin key not found
   */
  async getAdminPublicKey(): Promise<JsonWebKey> {
    const supabase = createClient();
    const msgClient = createMessagingClient(supabase);

    const { data, error } = await msgClient
      .from('user_encryption_keys')
      .select('public_key')
      .eq('user_id', ADMIN_USER_ID)
      .eq('revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      throw new Error('Admin public key not found');
    }

    return data.public_key as unknown as JsonWebKey;
  }

  /**
   * Send welcome message to a new user
   *
   * Flow (per contract):
   * 1. Check welcome_message_sent flag (idempotency, FR-005)
   * 2. Fetch admin's public key from database (FR-001)
   * 3. Derive shared secret: ECDH(user_private, admin_public) (FR-003)
   * 4. Encrypt WELCOME_MESSAGE_CONTENT (FR-004)
   * 5. Create conversation (canonical ordering, FR-006)
   * 6. Insert message with sender_id = admin
   * 7. Update welcome_message_sent = true (FR-007)
   *
   * @param userId - Target user's UUID
   * @param userPrivateKey - User's ECDH private key (CryptoKey)
   * @param userPublicKey - Target user's public key (JWK format)
   * @returns Result of send operation
   *
   * @remarks
   * - Non-blocking: Errors logged but don't interrupt flow (FR-008)
   * - Idempotent: Checks welcome_message_sent before sending (FR-005)
   * - No retries, 10 second timeout max (FR-008)
   */
  async sendWelcomeMessage(
    userId: string,
    userPrivateKey: CryptoKey,
    userPublicKey: JsonWebKey
  ): Promise<SendWelcomeResult> {
    logger.info('sendWelcomeMessage called', { userId });

    try {
      const supabase = createClient();
      const msgClient = createMessagingClient(supabase);

      // Step 1: Check if user already received welcome message (FR-005)
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

      // Step 2: Fetch admin's public key (FR-001) - with error handling (US3)
      let adminPublicKeyJwk: JsonWebKey;
      try {
        adminPublicKeyJwk = await this.getAdminPublicKey();
      } catch (error) {
        logger.error('Failed to fetch admin public key', { error });
        return {
          success: false,
          skipped: true,
          reason: 'Admin public key not found',
        };
      }

      // Step 3: Import admin public key and derive shared secret (FR-003)
      const adminPublicKeyCrypto = await crypto.subtle.importKey(
        'jwk',
        adminPublicKeyJwk,
        {
          name: 'ECDH',
          namedCurve: 'P-256',
        },
        false,
        []
      );

      const sharedSecret = await encryptionService.deriveSharedSecret(
        userPrivateKey,
        adminPublicKeyCrypto
      );

      // Step 4: Encrypt welcome message (FR-004)
      const encrypted = await encryptionService.encryptMessage(
        WELCOME_MESSAGE_CONTENT,
        sharedSecret
      );

      // Step 5: Get or create conversation with canonical ordering (FR-006)
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

      // Step 6: Get next sequence number
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

      // Step 7: Insert encrypted message with sender_id = admin
      const { data: message, error: insertError } = await msgClient
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: ADMIN_USER_ID,
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

      // Step 8: Update conversation's last_message_at
      await msgClient
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      // Step 9: Mark welcome message as sent (FR-007)
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
   * Get or create conversation between admin and user
   *
   * Admin bypasses normal connection requirement via RLS policy.
   * Uses canonical ordering (smaller UUID = participant_1_id) (FR-006).
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
    const adminId = ADMIN_USER_ID;

    // Apply canonical ordering (FR-006): participant_1 = min, participant_2 = max
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

    logger.info('Attempting to create conversation', {
      participant_1,
      participant_2,
    });

    const { data: created, error: createError } = await (msgClient as any)
      .from('conversations')
      .insert(insertData)
      .select('id')
      .single();

    if (createError) {
      logger.error('Conversation insert failed', {
        code: createError.code,
        message: createError.message,
        details: createError.details,
        hint: createError.hint,
      });
      // Handle race condition with upsert pattern (US2)
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
}

// Export singleton instance
export const welcomeService = new WelcomeService();
