/**
 * DotnetMessagingProvider (#266)
 *
 * The .NET/EF Core implementation of {@link MessagingDataProvider} — a typed
 * REST client to an ASP.NET Core messaging API (KDG-style). Unlike Supabase,
 * a .NET backend has NO in-database `auth.uid()`, so THIS provider (and the
 * server behind it) must re-express every RLS rule as explicit authorization.
 * The bearer token from {@link AuthContext.accessToken} identifies the caller.
 *
 * NOTE: This is the Step-1 scaffold. Step 4 fills in the typed `fetch` calls,
 * the per-method C-rule doc blocks, and a polling realtime fallback. The .NET
 * server endpoints themselves are a separate follow-up build; until they exist,
 * every method throws so no unbuilt path silently returns bad data.
 *
 * @module services/messaging/providers/dotnet-provider
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
    `DotnetMessagingProvider.${method} has no live .NET server yet (#266 Step 4).`
  );
}

class DotnetRealtimeProvider implements MessagingRealtimeProvider {
  subscribe(): never {
    notImplemented('realtime.subscribe');
  }
}

export class DotnetMessagingProvider implements MessagingDataProvider {
  readonly name = 'dotnet' as const;
  readonly realtime: MessagingRealtimeProvider = new DotnetRealtimeProvider();

  private readonly baseUrl: string | undefined;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl;
  }

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
