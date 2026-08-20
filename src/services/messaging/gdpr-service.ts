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
import { decryptGroupMessages } from './group-message-decrypt';
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
    // #248: is_group discriminates 1:1 from group conversations. `participant`
    // is the other party for 1:1; groups carry group_name + the member roster.
    // Additive — existing 1:1 consumers keep reading `participant`.
    is_group: boolean;
    participant?: string;
    group_name?: string | null;
    members?: Array<{ user_id: string; username: string | null }>;
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

    // Get authenticated user with retry (getUser makes server round-trip
    // that can fail during token refresh cycles)
    let user = null;
    let authError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await supabase.auth.getSession();
      user = result.data?.session?.user ?? null;
      authError = result.error;
      if (user) break;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500));
    }

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

      // 3a. Get all 1:1 conversations (participant columns are NULL for groups,
      // so this .or never matches a group — that was the #248 blind spot).
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

      // 3b. #248: Get all GROUP conversations the user is an active member of.
      // Groups are enumerated via conversation_members (NOT participant columns,
      // which are NULL for groups), matching the live conversation-list path.
      type GroupExportRow = {
        id: string;
        group_name: string | null;
        members: Array<{ user_id: string; username: string | null }>;
      };
      const groupConversations: GroupExportRow[] = [];
      const { data: memberships, error: membershipsError } = await msgClient
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)
        .is('left_at', null);

      if (membershipsError) {
        throw new ConnectionError(
          'Failed to fetch group memberships: ' + membershipsError.message
        );
      }

      const groupIds = (memberships || []).map(
        (m: { conversation_id: string }) => m.conversation_id
      );
      if (groupIds.length > 0) {
        const { data: groups, error: groupsError } = await msgClient
          .from('conversations')
          .select('id, group_name')
          .in('id', groupIds)
          .eq('is_group', true);

        if (groupsError) {
          throw new ConnectionError(
            'Failed to fetch group conversations: ' + groupsError.message
          );
        }

        for (const g of groups || []) {
          // Roster: active members + their usernames.
          const { data: memberRows } = await msgClient
            .from('conversation_members')
            .select(
              'user_id, member:user_profiles!conversation_members_user_id_fkey(username)'
            )
            .eq('conversation_id', g.id)
            .is('left_at', null);
          const members = (memberRows || []).map((row: any) => ({
            user_id: row.user_id,
            username: row.member?.username ?? null,
          }));
          groupConversations.push({
            id: g.id,
            group_name: g.group_name ?? null,
            members,
          });
        }
      }

      // #248 (verifier fix): the export page has no EncryptionKeyGate, so on a
      // cold load the in-memory group key material is absent and every group
      // message would export as a placeholder. Restore keys from cache before
      // decrypting groups — the same thing EncryptionKeyGate does for the live
      // messaging view. (The 1:1 path reads the private key from IndexedDB
      // directly, so it isn't affected.)
      if (groupConversations.length > 0) {
        await keyManagementService.restoreKeysFromCache(user.id);
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

        // Get encryption keys for decryption.
        // getPrivateKey() returns a non-extractable CryptoKey directly;
        // no JWK import step needed.
        const privateKey = await encryptionService.getPrivateKey(user.id);
        const otherPublicKey =
          await keyManagementService.getUserPublicKey(otherParticipantId);

        if (!privateKey || !otherPublicKey) {
          // Cannot decrypt messages without keys - skip this conversation
          exportConversations.push({
            conversation_id: conv.id,
            is_group: false,
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

        // Public key is still stored as JWK in Supabase — import it.
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
          is_group: false,
          participant: otherUsername,
          messages: decryptedMessages,
        });
      }

      // #248: decrypt + append GROUP conversations, reusing the exact group-key
      // path the live view uses (decryptGroupMessages resolves the group key per
      // message key_version). System messages surface their plaintext marker;
      // undecryptable messages degrade to a placeholder without aborting.
      for (const group of groupConversations) {
        const { data: groupMessages, error: groupMsgError } = await msgClient
          .from('messages')
          .select('*')
          .eq('conversation_id', group.id)
          .order('sequence_number', { ascending: true });

        if (groupMsgError) {
          throw new ConnectionError(
            'Failed to fetch group messages: ' + groupMsgError.message
          );
        }

        // Sender display names for the roster + per-message attribution.
        const senderIds = [
          ...new Set((groupMessages || []).map((m: any) => m.sender_id)),
        ];
        const nameById = new Map<string, string>();
        for (const m of group.members) {
          if (m.username) nameById.set(m.user_id, m.username);
        }
        const missing = senderIds.filter((id) => !nameById.has(id));
        if (missing.length > 0) {
          const { data: senderProfiles } = await msgClient
            .from('user_profiles')
            .select('id, username')
            .in('id', missing);
          senderProfiles?.forEach((p: any) =>
            nameById.set(p.id, p.username || 'Unknown')
          );
        }

        const decrypted = await decryptGroupMessages(
          group.id,
          (groupMessages || []) as any
        );

        const groupExportMessages = decrypted.map(({ row, content }) => {
          const isOwn = row.sender_id === user.id;
          if (isOwn) {
            totalMessagesSent++;
          } else {
            totalMessagesReceived++;
          }
          return {
            id: row.id,
            sender: isOwn
              ? ('you' as const)
              : nameById.get(row.sender_id) || 'Unknown',
            content,
            timestamp: row.created_at,
            edited: row.edited,
            deleted: row.deleted,
            edited_at: row.edited_at,
          };
        });

        exportConversations.push({
          conversation_id: group.id,
          is_group: true,
          group_name: group.group_name,
          members: group.members,
          messages: groupExportMessages,
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

    // Get authenticated user with retry (getUser makes server round-trip
    // that can fail during token refresh cycles)
    let user = null;
    let authError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await supabase.auth.getSession();
      user = result.data?.session?.user ?? null;
      authError = result.error;
      if (user) break;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500));
    }

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

      // Step 2: Delete the ACCOUNT, server-side (#859).
      //
      // This used to be `.from('user_profiles').delete().eq('id', user.id)` from the
      // browser, with a comment claiming it triggered "auth.users deletion (ON DELETE
      // CASCADE from user_profiles)". That was wrong in both directions and deleted
      // nothing at all:
      //
      //   - user_profiles has RLS with no DELETE policy, so the statement matched zero
      //     rows and returned NO error. The user was signed out and told their account
      //     had been permanently deleted while every record remained.
      //   - The cascade runs the other way. user_profiles_id_fkey has child
      //     user_profiles and parent auth.users, so removing a profile could never
      //     remove an account — and a browser client cannot delete an auth.users row,
      //     which is the whole point: that needs the service role.
      //
      // The edge function verifies the caller's JWT and deletes only that user, then
      // CASCADE removes the profile, messages, conversations and connections.
      const { data, error: deleteError } = await supabase.functions.invoke<{
        success?: boolean;
        error?: string;
      }>('delete-account', { method: 'POST' });

      if (deleteError) {
        throw new ConnectionError(
          'Failed to delete account: ' + deleteError.message
        );
      }

      // An invoke that returns 200 with an error payload is still a failure. Treating
      // "no transport error" as success is exactly how the original defect stayed
      // invisible, so the body is checked rather than assumed.
      if (!data?.success) {
        throw new ConnectionError(
          'Failed to delete account: ' + (data?.error ?? 'unknown error')
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
