/**
 * SupabaseMessagingProvider (#266)
 *
 * The Supabase implementation of {@link MessagingDataProvider}. Wraps the
 * PostgREST `.from(...)` data-access calls that today live inline in
 * `message-service.ts`. Uses the session-bound `createClient()` singleton, so
 * Postgres RLS still enforces the authorization contract automatically — this
 * provider must NEVER use a service-role client (that would bypass RLS, the
 * exact hack the project forbids).
 *
 * NOTE: This is the Step-1 scaffold — method bodies are filled in Step 2 by
 * extracting the query blocks out of `message-service.ts` verbatim. Until then,
 * calling a data method throws so no half-migrated path can silently ship.
 *
 * @module services/messaging/providers/supabase-provider
 */

import type {
  AuthContext,
  ConversationMeta,
  EditMessagePayload,
  GetMessagesParams,
  MessagesPage,
  MessagingDataProvider,
  MessagingRealtimeProvider,
  SendMessagePayload,
} from './types';
import type { MessageRow } from '@/lib/supabase/messaging-client';
import type { UserProfile } from '@/types/messaging';

function notImplemented(method: string): never {
  throw new Error(
    `SupabaseMessagingProvider.${method} is not implemented yet (#266 Step 2).`
  );
}

/**
 * Realtime provider scaffold — Step 2/5 wires this to `supabase.channel(...)`.
 */
class SupabaseRealtimeProvider implements MessagingRealtimeProvider {
  subscribe(): never {
    notImplemented('realtime.subscribe');
  }
}

export class SupabaseMessagingProvider implements MessagingDataProvider {
  readonly name = 'supabase' as const;
  readonly realtime: MessagingRealtimeProvider = new SupabaseRealtimeProvider();

  async getConversationMeta(
    _ctx: AuthContext,
    _conversationId: string
  ): Promise<ConversationMeta | null> {
    return notImplemented('getConversationMeta');
  }

  async getProfiles(
    _ctx: AuthContext,
    _userIds: string[]
  ): Promise<UserProfile[]> {
    return notImplemented('getProfiles');
  }

  async sendMessage(
    _ctx: AuthContext,
    _payload: SendMessagePayload
  ): Promise<MessageRow> {
    return notImplemented('sendMessage');
  }

  async getMessages(
    _ctx: AuthContext,
    _params: GetMessagesParams
  ): Promise<MessagesPage> {
    return notImplemented('getMessages');
  }

  async editMessage(
    _ctx: AuthContext,
    _payload: EditMessagePayload
  ): Promise<void> {
    return notImplemented('editMessage');
  }

  async deleteMessage(_ctx: AuthContext, _messageId: string): Promise<void> {
    return notImplemented('deleteMessage');
  }

  async markAsRead(_ctx: AuthContext, _messageIds: string[]): Promise<void> {
    return notImplemented('markAsRead');
  }

  async markAsDelivered(
    _ctx: AuthContext,
    _messageIds: string[]
  ): Promise<void> {
    return notImplemented('markAsDelivered');
  }

  async archiveConversation(
    _ctx: AuthContext,
    _conversationId: string
  ): Promise<void> {
    return notImplemented('archiveConversation');
  }

  async unarchiveConversation(
    _ctx: AuthContext,
    _conversationId: string
  ): Promise<void> {
    return notImplemented('unarchiveConversation');
  }
}
