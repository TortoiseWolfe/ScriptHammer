/**
 * DotnetMessagingProvider (#266)
 *
 * The .NET/EF Core implementation of {@link MessagingDataProvider} — a typed
 * REST client to an ASP.NET Core messaging API (KDG-style). Unlike Supabase, a
 * .NET backend has NO in-database `auth.uid()`, so THIS provider and the server
 * behind it must re-express every RLS rule (C1–C29) as EXPLICIT server-side
 * authorization. The bearer token from {@link AuthContext.accessToken}
 * identifies the caller.
 *
 * ## Status: typed skeleton (Step 4)
 * The REST endpoint shape and the per-method authorization contract are the
 * deliverable — the exact spec for whoever builds the EF Core controllers. The
 * .NET server itself is a separate follow-up; until `NEXT_PUBLIC_DOTNET_API_URL`
 * points at a live server, every method makes a real `fetch` that will fail
 * against a non-existent endpoint (or throws immediately if no base URL is
 * configured). The provider TYPE-checks and the shared conformance suite
 * (`tests/contract/messaging-provider.contract.ts`) can run against it the
 * moment a server exists — it is measured against the identical contract the
 * Supabase provider passes.
 *
 * ## Endpoint map (the contract for the ASP.NET side)
 *   GET    /api/messaging/conversations/{id}                    → getConversationMeta
 *   POST   /api/messaging/profiles                    { userIds } → getProfiles
 *   GET    /api/messaging/messages/{id}                          → getMessageById
 *   POST   /api/messaging/conversations/{id}/messages { payload } → sendMessage
 *   GET    /api/messaging/conversations/{id}/messages?cursor=&limit= → getMessages
 *   PATCH  /api/messaging/messages/{id}               { edit }    → editMessage
 *   POST   /api/messaging/messages/{id}/delete                   → deleteMessage
 *   POST   /api/messaging/messages/read               { ids }     → markAsRead
 *   POST   /api/messaging/messages/delivered          { ids }     → markAsDelivered
 *   POST   /api/messaging/conversations/{id}/archive  { value }   → archive/unarchive
 * All requests carry `Authorization: Bearer <accessToken>`. Realtime is a
 * polling fallback (no SignalR in v1).
 *
 * @module services/messaging/providers/dotnet-provider
 */

import { ConnectionError } from '@/types/messaging';
import type { MessageRow } from '@/lib/supabase/messaging-client';
import type { UserProfile } from '@/types/messaging';
import type {
  AuthContext,
  ChangeEvent,
  ConversationMeta,
  EditMessagePayload,
  GetMessagesParams,
  MessagesPage,
  MessagingDataProvider,
  MessagingRealtimeProvider,
  SendMessagePayload,
  SubscribeOptions,
  Subscription,
} from './types';

/**
 * Polling realtime fallback. Fires a bare "changed" tick on an interval; the
 * consuming hook refetches through the authorization-scoped data methods. Ships
 * NO row payload, so C29 (never surface an un-SELECTable row) holds by
 * construction — the refetch is the authorization boundary.
 *
 * The tick carries a synthetic INSERT-shaped {@link ChangeEvent} with null
 * new/old (payload-free) purely to satisfy the callback signature; consumers
 * ignore the payload and refetch.
 */
class DotnetRealtimeProvider implements MessagingRealtimeProvider {
  private readonly pollMs: number;

  constructor(pollMs = 5000) {
    this.pollMs = pollMs;
  }

  subscribe(
    _ctx: AuthContext,
    _opts: SubscribeOptions,
    onChange: (e: ChangeEvent) => void
  ): Subscription {
    const timer = setInterval(() => {
      onChange({ eventType: 'INSERT', new: null, old: null });
    }, this.pollMs);
    return { unsubscribe: () => clearInterval(timer) };
  }
}

export class DotnetMessagingProvider implements MessagingDataProvider {
  readonly name = 'dotnet' as const;
  readonly realtime: MessagingRealtimeProvider = new DotnetRealtimeProvider();

  private readonly baseUrl: string | undefined;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Issue an authenticated request to the .NET messaging API. Throws a clear
   * ConnectionError if no base URL is configured (the fork-safe default) or the
   * server rejects the call.
   */
  private async request<T>(
    ctx: AuthContext,
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    if (!this.baseUrl) {
      throw new ConnectionError(
        'DotnetMessagingProvider: NEXT_PUBLIC_DOTNET_API_URL is not configured. ' +
          'Set it to a live ASP.NET messaging server, or use the supabase provider.'
      );
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      // 403/401 map to the RLS-equivalent "not authorized" outcome; the caller
      // (message-service) already treats provider throws appropriately.
      throw new ConnectionError(
        `DotnetMessagingProvider ${method} ${path} failed: ${res.status} ${res.statusText}`
      );
    }
    // 204 No Content → undefined
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /** (C1/C2/C7) Server must scope to participant-or-active-member. */
  async getConversationMeta(
    ctx: AuthContext,
    conversationId: string
  ): Promise<ConversationMeta | null> {
    return this.request<ConversationMeta | null>(
      ctx,
      'GET',
      `/api/messaging/conversations/${encodeURIComponent(conversationId)}`
    );
  }

  async getProfiles(
    ctx: AuthContext,
    userIds: string[]
  ): Promise<UserProfile[]> {
    if (userIds.length === 0) return [];
    return this.request<UserProfile[]>(ctx, 'POST', '/api/messaging/profiles', {
      userIds,
    });
  }

  /** (C7) Server must scope the read to conversations the caller may see. */
  async getMessageById(
    ctx: AuthContext,
    messageId: string
  ): Promise<MessageRow | null> {
    return this.request<MessageRow | null>(
      ctx,
      'GET',
      `/api/messaging/messages/${encodeURIComponent(messageId)}`
    );
  }

  /**
   * (C8) Server MUST verify the caller is an active participant/member and that
   *      `sender_id` equals the caller — never trust a client-supplied sender.
   * (C13) Server MUST assign the sequence number under a per-conversation lock
   *       (or a unique constraint + retry). A naive `SELECT MAX+1 / INSERT`
   *       races and produces gaps/dupes under concurrency — this is the single
   *       most likely place the .NET backend silently diverges from Supabase.
   * (C14) `clientGeneratedId` must be a NULL-tolerant idempotency key: a replay
   *       with the same id is a no-op; many NULL live sends coexist.
   */
  async sendMessage(
    ctx: AuthContext,
    payload: SendMessagePayload
  ): Promise<MessageRow> {
    return this.request<MessageRow>(
      ctx,
      'POST',
      `/api/messaging/conversations/${encodeURIComponent(
        payload.conversationId
      )}/messages`,
      {
        ciphertext: payload.ciphertext,
        iv: payload.iv,
        keyVersion: payload.keyVersion,
        clientGeneratedId: payload.clientGeneratedId ?? null,
      }
    );
  }

  /** (C7) Server must return only messages the caller may SELECT (membership). */
  async getMessages(
    ctx: AuthContext,
    params: GetMessagesParams
  ): Promise<MessagesPage> {
    const q = new URLSearchParams();
    if (params.cursor !== null) q.set('cursor', String(params.cursor));
    q.set('limit', String(params.limit));
    return this.request<MessagesPage>(
      ctx,
      'GET',
      `/api/messaging/conversations/${encodeURIComponent(
        params.conversationId
      )}/messages?${q.toString()}`
    );
  }

  /**
   * (C9) Server MUST enforce sender-only: reject if the caller is not the
   *      message's sender. (The Supabase gap #281 — a recipient rewriting
   *      ciphertext — must NOT be reproduced here: the .NET server has no
   *      column-blind policy, so scope the edit to the sender explicitly.)
   * (C10) Server MUST re-check the 15-minute window on the POST-image: reject if
   *       `created_at <= now - 15min`. This is the WITH CHECK half — enforcing
   *       ownership (USING half) alone lets a stale-but-owned edit through.
   */
  async editMessage(
    ctx: AuthContext,
    payload: EditMessagePayload
  ): Promise<void> {
    await this.request<void>(
      ctx,
      'PATCH',
      `/api/messaging/messages/${encodeURIComponent(payload.messageId)}`,
      {
        ciphertext: payload.ciphertext,
        iv: payload.iv,
        keyVersion: payload.keyVersion,
      }
    );
  }

  /**
   * (C12) Soft-delete only — the server MUST set `deleted = true`, never
   *       physically remove the row. There is no hard-delete endpoint.
   */
  async deleteMessage(ctx: AuthContext, messageId: string): Promise<void> {
    await this.request<void>(
      ctx,
      'POST',
      `/api/messaging/messages/${encodeURIComponent(messageId)}/delete`
    );
  }

  /**
   * (C11) Server MUST restrict to non-sender participants and to the `read_at`
   *       column only (never let mark-read mutate ciphertext — the #281 class of
   *       bug). Idempotent: already-read ids are ignored.
   */
  async markAsRead(ctx: AuthContext, messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    await this.request<void>(ctx, 'POST', '/api/messaging/messages/read', {
      messageIds,
    });
  }

  async markAsDelivered(ctx: AuthContext, messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    await this.request<void>(ctx, 'POST', '/api/messaging/messages/delivered', {
      messageIds,
    });
  }

  /** (C5) Per-user archive; server scopes to the caller's participant/member row. */
  async archiveConversation(
    ctx: AuthContext,
    conversationId: string
  ): Promise<void> {
    await this.request<void>(
      ctx,
      'POST',
      `/api/messaging/conversations/${encodeURIComponent(
        conversationId
      )}/archive`,
      { value: true }
    );
  }

  async unarchiveConversation(
    ctx: AuthContext,
    conversationId: string
  ): Promise<void> {
    await this.request<void>(
      ctx,
      'POST',
      `/api/messaging/conversations/${encodeURIComponent(
        conversationId
      )}/archive`,
      { value: false }
    );
  }
}
