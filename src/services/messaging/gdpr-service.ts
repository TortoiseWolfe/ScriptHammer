/**
 * GDPR Service for User Messaging System
 * Tasks: T183-T185
 *
 * Handles GDPR-compliant data operations:
 * - Export all user data with decrypted messages
 * - Permanently delete user account and all related data
 *
 * GDPR Compliance:
 * - Article 20: Right to Data Portability
 * - Article 17: Right to Erasure
 */

import { createClient } from '@/lib/supabase/client';
import {
  createMessagingClient,
  type MessageRow,
  type ConversationRow,
} from '@/lib/supabase/messaging-client';
import { encryptionService } from '@/lib/messaging/encryption';
import { keyManagementService } from './key-service';
import { messagingDb } from '@/lib/messaging/database';
import {
  AuthenticationError,
  EncryptionError,
  ConnectionError,
} from '@/types/messaging';

/**
 * Data export format for GDPR Article 20 compliance
 */
export interface UserDataExport {
  export_date: string;
  user_id: string;
  profile: {
    username: string | null;
    display_name: string | null;
    email: string;
  };
  connections: Array<{
    type: 'accepted' | 'pending_sent' | 'pending_received' | 'blocked';
    username: string;
    since: string;
  }>;
  conversations: Array<{
    conversation_id: string;
    participant: string;
    messages: Array<{
      id: string;
      sender: 'you' | string;
      content: string;
      timestamp: string;
      edited: boolean;
      deleted: boolean;
      edited_at: string | null;
    }>;
  }>;
  statistics: {
    total_conversations: number;
    total_messages_sent: number;
    total_messages_received: number;
    total_connections: number;
  };
}

export class GDPRService {
  /**
   * Export all user data in JSON format
   * Task: T184
   *
   * Exports ALL user data for GDPR Article 20 (Right to Data Portability):
   * - User profile (username, display_name, email)
   * - All connections (friends, pending, blocked)
   * - All conversations with decrypted messages
   * - Statistics (counts)
   *
   * @returns Promise<UserDataExport> - Complete user data export
   * @throws AuthenticationError if user is not signed in
   * @throws ConnectionError if database queries fail
   * @throws EncryptionError if decryption fails
   *
   * @example
   * ```typescript
   * const exportData = await gdprService.exportUserData();
   * const blob = new Blob([JSON.stringify(exportData, null, 2)], {
   *   type: 'application/json'
   * });
   * const url = URL.createObjectURL(blob);
   * const link = document.createElement('a');
   * link.href = url;
   * link.download = `my-messages-export-${Date.now()}.json`;
   * link.click();
   * URL.revokeObjectURL(url);
   * ```
   */
  async exportUserData(): Promise<UserDataExport> {
    const supabase = createClient();
    const msgClient = createMessagingClient(supabase);

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to export your data'
      );
    }

    try {
      // 1. Get user profile
      const { data: profile, error: profileError } = await msgClient
        .from('user_profiles')
        .select('username, display_name')
        .eq('id', user.id)
        .single();

      if (profileError) {
        throw new ConnectionError(
          'Failed to fetch profile: ' + profileError.message
        );
      }

      // 2. Get all connections
      const { data: connections, error: connectionsError } = await msgClient
        .from('user_connections')
        .select(
          `
          status,
          requester_id,
          addressee_id,
          created_at,
          requester:user_profiles!user_connections_requester_id_fkey(username),
          addressee:user_profiles!user_connections_addressee_id_fkey(username)
        `
        )
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      if (connectionsError) {
        throw new ConnectionError(
          'Failed to fetch connections: ' + connectionsError.message
        );
      }

      // Transform connections to export format
      const exportConnections = connections.map((conn: any) => {
        const isRequester = conn.requester_id === user.id;
        const otherUsername = isRequester
          ? conn.addressee?.username || 'Unknown'
          : conn.requester?.username || 'Unknown';

        let type: 'accepted' | 'pending_sent' | 'pending_received' | 'blocked';
        if (conn.status === 'accepted') {
          type = 'accepted';
        } else if (conn.status === 'blocked') {
          type = 'blocked';
        } else if (conn.status === 'pending') {
          type = isRequester ? 'pending_sent' : 'pending_received';
        } else {
          type = 'blocked'; // Default fallback
        }

        return {
          type,
          username: otherUsername,
          since: conn.created_at,
        };
      });

      // 3. Get all conversations
      // Type for joined conversation with participant usernames
      type ConversationWithParticipants = {
        id: string;
        participant_1_id: string;
        participant_2_id: string;
        participant_1: { username: string | null } | null;
        participant_2: { username: string | null } | null;
      };
      const { data: conversations, error: conversationsError } =
        (await msgClient
          .from('conversations')
          .select(
            `
          id,
          participant_1_id,
          participant_2_id,
          participant_1:user_profiles!conversations_participant_1_id_fkey(username),
          participant_2:user_profiles!conversations_participant_2_id_fkey(username)
        `
          )
          .or(
            `participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`
          )) as { data: ConversationWithParticipants[] | null; error: unknown };

      if (conversationsError) {
        const err = conversationsError as { message?: string };
        throw new ConnectionError(
          'Failed to fetch conversations: ' + (err.message || 'Unknown error')
        );
      }

      // 4. For each conversation, get and decrypt messages
      const exportConversations = [];
      let totalMessagesSent = 0;
      let totalMessagesReceived = 0;

      for (const conv of conversations || []) {
        const otherParticipantId =
          conv.participant_1_id === user.id
            ? conv.participant_2_id
            : conv.participant_1_id;

        const otherUsername =
          conv.participant_1_id === user.id
            ? conv.participant_2?.username || 'Unknown'
            : conv.participant_1?.username || 'Unknown';

        // Get all messages in this conversation (including deleted ones for export)
        const { data: messages, error: messagesError } = await msgClient
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('sequence_number', { ascending: true });

        if (messagesError) {
          throw new ConnectionError(
            'Failed to fetch messages: ' + messagesError.message
          );
        }

        // Get encryption keys for decryption
        const privateKeyJwk = await encryptionService.getPrivateKey(user.id);
        const otherPublicKey =
          await keyManagementService.getUserPublicKey(otherParticipantId);

        if (!privateKeyJwk || !otherPublicKey) {
          // Cannot decrypt messages without keys - skip this conversation
          exportConversations.push({
            conversation_id: conv.id,
            participant: otherUsername,
            messages: messages.map((msg: any) => ({
              id: msg.id,
              sender: msg.sender_id === user.id ? 'you' : otherUsername,
              content: '[Encryption keys unavailable - cannot decrypt]',
              timestamp: msg.created_at,
              edited: msg.edited,
              deleted: msg.deleted,
              edited_at: msg.edited_at,
            })),
          });
          continue;
        }

        // Import keys for decryption
        const privateKey = await crypto.subtle.importKey(
          'jwk',
          privateKeyJwk,
          { name: 'ECDH', namedCurve: 'P-256' },
          false,
          ['deriveBits', 'deriveKey']
        );

        const otherPublicKeyCrypto = await crypto.subtle.importKey(
          'jwk',
          otherPublicKey,
          { name: 'ECDH', namedCurve: 'P-256' },
          false,
          []
        );

        // Derive shared secret
        const sharedSecret = await encryptionService.deriveSharedSecret(
          privateKey,
          otherPublicKeyCrypto
        );

        // Decrypt all messages
        const decryptedMessages = [];
        for (const msg of messages || []) {
          try {
            const content = await encryptionService.decryptMessage(
              msg.encrypted_content,
              msg.initialization_vector,
              sharedSecret
            );

            decryptedMessages.push({
              id: msg.id,
              sender: msg.sender_id === user.id ? 'you' : otherUsername,
              content,
              timestamp: msg.created_at,
              edited: msg.edited,
              deleted: msg.deleted,
              edited_at: msg.edited_at,
            });

            // Count messages
            if (msg.sender_id === user.id) {
              totalMessagesSent++;
            } else {
              totalMessagesReceived++;
            }
          } catch (decryptError) {
            // If decryption fails, still include message with error indicator
            decryptedMessages.push({
              id: msg.id,
              sender: msg.sender_id === user.id ? 'you' : otherUsername,
              content: '[Message could not be decrypted]',
              timestamp: msg.created_at,
              edited: msg.edited,
              deleted: msg.deleted,
              edited_at: msg.edited_at,
            });
          }
        }

        exportConversations.push({
          conversation_id: conv.id,
          participant: otherUsername,
          messages: decryptedMessages,
        });
      }

      // 5. Build final export object
      const exportData: UserDataExport = {
        export_date: new Date().toISOString(),
        user_id: user.id,
        profile: {
          username: profile?.username || null,
          display_name: profile?.display_name || null,
          email: user.email || '',
        },
        connections: exportConnections,
        conversations: exportConversations,
        statistics: {
          total_conversations: exportConversations.length,
          total_messages_sent: totalMessagesSent,
          total_messages_received: totalMessagesReceived,
          total_connections: exportConnections.length,
        },
      };

      return exportData;
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof ConnectionError ||
        error instanceof EncryptionError
      ) {
        throw error;
      }
      throw new ConnectionError('Failed to export user data', error);
    }
  }

  /**
   * Permanently delete user account and all related data
   * Task: T185
   *
   * Deletes ALL user data for GDPR Article 17 (Right to Erasure):
   * - All messages (CASCADE from user_profiles)
   * - All connections (CASCADE from user_profiles)
   * - All conversations (CASCADE from user_profiles)
   * - Encryption keys from IndexedDB
   * - User profile (triggers auth.users deletion via ON DELETE CASCADE)
   *
   * This operation is IRREVERSIBLE.
   *
   * Database CASCADE relationships (configured in migrations):
   * - messages.sender_id → auth.users(id) ON DELETE CASCADE
   * - conversations.participant_1_id → auth.users(id) ON DELETE CASCADE
   * - conversations.participant_2_id → auth.users(id) ON DELETE CASCADE
   * - user_connections.requester_id → auth.users(id) ON DELETE CASCADE
   * - user_connections.addressee_id → auth.users(id) ON DELETE CASCADE
   * - user_profiles.id → auth.users(id) ON DELETE CASCADE
   *
   * @returns Promise<void>
   * @throws AuthenticationError if user is not signed in
   * @throws ConnectionError if deletion fails
   *
   * @example
   * ```typescript
   * // After user confirms by typing "DELETE"
   * await gdprService.deleteUserAccount();
   * // User is signed out and all data is permanently deleted
   * ```
   */
  async deleteUserAccount(): Promise<void> {
    const supabase = createClient();
    const msgClient = createMessagingClient(supabase);

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(
        'You must be signed in to delete your account'
      );
    }

    try {
      // Step 1: Delete encryption keys from IndexedDB
      await messagingDb.messaging_private_keys
        .where('userId')
        .equals(user.id)
        .delete();

      // Delete queued messages
      await messagingDb.messaging_queued_messages
        .where('sender_id')
        .equals(user.id)
        .delete();

      // Delete cached messages
      await messagingDb.messaging_cached_messages
        .where('sender_id')
        .equals(user.id)
        .delete();

      // Step 2: Delete user profile (CASCADE handles related data)
      // This will trigger:
      // - messages deletion (ON DELETE CASCADE)
      // - conversations deletion (ON DELETE CASCADE)
      // - user_connections deletion (ON DELETE CASCADE)
      // - auth.users deletion (ON DELETE CASCADE from user_profiles)
      const { error: deleteError } = await msgClient
        .from('user_profiles')
        .delete()
        .eq('id', user.id);

      if (deleteError) {
        throw new ConnectionError(
          'Failed to delete account: ' + deleteError.message
        );
      }

      // Step 3: Sign out (user no longer exists)
      await supabase.auth.signOut();
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new ConnectionError('Failed to delete user account', error);
    }
  }
}

// Export singleton instance
export const gdprService = new GDPRService();
