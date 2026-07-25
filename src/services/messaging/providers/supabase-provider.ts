/**
 * SupabaseMessagingProvider (#266)
 *
 * The Supabase implementation of {@link MessagingDataProvider}. Holds the
 * PostgREST `.from(...)` data-access calls that used to live inline in
 * `message-service.ts`. Uses the session-bound `createClient()` singleton, so
 * Postgres RLS still enforces the authorization contract automatically — this
 * provider must NEVER use a service-role client (that would bypass RLS, the
 * exact hack the project forbids). The queries here are byte-identical to what
 * `message-service.ts` issued before the extraction.
 *
 * Encryption stays ABOVE this seam: the provider moves ciphertext rows only.
 *
 * @module services/messaging/providers/supabase-provider
 */

import { createClient } from '@/lib/supabase/client';
import {
  createMessagingClient,
  type MessageRow,
  type MessagingClient,
} from '@/lib/supabase/messaging-client';
import type { Database } from '@/lib/supabase/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ConnectionError,
  ValidationError,
  type UserProfile,
} from '@/types/messaging';
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
 * Realtime provider backed by Supabase `postgres_changes`. Fires the raw change
 * event to the caller, who refetches through the authorization-scoped data
 * methods (the 3 hooks already work this way, so C29 holds by construction).
 */
class SupabaseRealtimeProvider implements MessagingRealtimeProvider {
  constructor(private readonly injectedClient?: SupabaseClient<Database>) {}

  subscribe(
    _ctx: AuthContext,
    opts: SubscribeOptions,
    onChange: (e: ChangeEvent) => void
  ): Subscription {
    const supabase = this.injectedClient ?? createClient();
    const channel = supabase
      .channel(opts.channelKey)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: opts.table },
        (payload) => {
          onChange({
            eventType: payload.eventType as ChangeEvent['eventType'],
            new: (payload.new as Record<string, unknown>) ?? null,
            old: (payload.old as Record<string, unknown>) ?? null,
          });
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        // Teardown must NEVER throw. When the realtime socket never actually
        // connected — offline, or a backend/stack without the realtime service
        // (e.g. the conformance stack) — realtime-js rejects from
        // removeChannel → disconnect ("this.conn.close is not a function").
        // That reject is async and, unhandled, hard-fails the whole vitest run.
        // Unsubscribing a never-connected channel is a no-op, not an error, so
        // swallow both the sync-throw and async-reject paths.
        try {
          void Promise.resolve(channel.unsubscribe()).catch(() => {});
          void Promise.resolve(supabase.removeChannel(channel)).catch(() => {});
        } catch {
          /* no-op: unsubscribe is best-effort teardown */
        }
      },
    };
  }
}

export class SupabaseMessagingProvider implements MessagingDataProvider {
  readonly name = 'supabase' as const;
  readonly realtime: MessagingRealtimeProvider;

  /**
   * @param injectedClient - Optional Supabase client. Defaults to the app's
   *   session-bound `createClient()` singleton (so RLS applies to the signed-in
   *   user in the browser). Tests inject a per-user authenticated client to
   *   drive the provider as different users — matching the AdminPaymentService
   *   constructor-injection precedent. NEVER inject a service-role client in
   *   production paths: that bypasses RLS.
   */
  constructor(private readonly injectedClient?: SupabaseClient<Database>) {
    this.realtime = new SupabaseRealtimeProvider(injectedClient);
  }

  /** The messaging-typed client this provider issues queries through. */
  private client(): MessagingClient {
    return createMessagingClient(this.injectedClient ?? createClient());
  }

  /**
   * (C3) Connection-gated 1:1 conversation creation; (C1) participant-scoped
   * lookup. RLS enforces both independently — the checks here produce the
   * domain errors the UI needs, they are not the security boundary.
   */
  async getOrCreateConversation(
    ctx: AuthContext,
    otherUserId: string
  ): Promise<string> {
    if (otherUserId === ctx.userId) {
      throw new ValidationError(
        'You cannot start a conversation with yourself',
        'otherUserId'
      );
    }

    const msgClient = this.client();

    // Canonical ordering: participant_1_id < participant_2_id. The DB's
    // `canonical_ordering` CHECK rejects an unsorted pair, and it is what makes
    // `unique_conversation` collapse both directions onto one row.
    const [participant1, participant2] =
      ctx.userId < otherUserId
        ? [ctx.userId, otherUserId]
        : [otherUserId, ctx.userId];

    // (C1) The lookup is participant-scoped by RLS and connection-INdependent,
    // so it runs BEFORE the C3 gate: a pair who connected, talked, then
    // disconnected can still reach their existing thread (their conversation
    // list already shows it) while creating a NEW one still needs a live
    // accepted connection.
    const existingId = await this.findConversationId(
      msgClient,
      participant1,
      participant2
    );
    if (existingId) return existingId;

    // (C3) Creating requires an ACCEPTED connection in EITHER direction —
    // `unique_connection` is (requester_id, addressee_id) and is not symmetric,
    // so the single accepted row may point either way.
    const { data: connection } = await msgClient
      .from('user_connections')
      .select('status')
      .or(
        `and(requester_id.eq.${participant1},addressee_id.eq.${participant2}),` +
          `and(requester_id.eq.${participant2},addressee_id.eq.${participant1})`
      )
      .eq('status', 'accepted')
      .maybeSingle();

    if (!connection) {
      throw new ConnectionError(
        'You must be connected with this user to start a conversation'
      );
    }

    const { data: created, error } = await msgClient
      .from('conversations')
      .insert({
        participant_1_id: participant1,
        participant_2_id: participant2,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      // 23505 (unique_violation): the other participant created the same pair
      // between our lookup and our insert. The idempotency contract says return
      // the winning row rather than surfacing the race to the caller.
      if (error.code === '23505') {
        const raced = await this.findConversationId(
          msgClient,
          participant1,
          participant2
        );
        if (raced) return raced;
      }
      throw new ConnectionError(
        'Failed to create conversation: ' + error.message
      );
    }

    if (!created) {
      // The INSERT returned no row — RLS's WITH CHECK rejected it. Surface the
      // authorization failure rather than an undefined id.
      throw new ConnectionError(
        'You must be connected with this user to start a conversation'
      );
    }

    return created.id;
  }

  /**
   * Participant-scoped lookup of the 1:1 conversation for an already
   * canonically-ordered pair. Returns null when there is none the caller may
   * see — RLS makes "does not exist" and "not yours" indistinguishable here,
   * which is the intended behaviour.
   */
  private async findConversationId(
    msgClient: MessagingClient,
    participant1: string,
    participant2: string
  ): Promise<string | null> {
    const { data } = await msgClient
      .from('conversations')
      .select('id')
      .eq('participant_1_id', participant1)
      .eq('participant_2_id', participant2)
      .maybeSingle();
    return data?.id ?? null;
  }

  async getConversationMeta(
    _ctx: AuthContext,
    conversationId: string
  ): Promise<ConversationMeta | null> {
    const msgClient = this.client();
    const { data } = await msgClient
      .from('conversations')
      .select(
        'participant_1_id, participant_2_id, is_group, current_key_version, created_by'
      )
      .eq('id', conversationId)
      .maybeSingle();
    return data ?? null;
  }

  async getProfiles(
    _ctx: AuthContext,
    userIds: string[]
  ): Promise<UserProfile[]> {
    if (userIds.length === 0) return [];
    const msgClient = this.client();
    const { data } = await msgClient
      .from('user_profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', userIds);
    return (data ?? []) as UserProfile[];
  }

  async getMessageById(
    _ctx: AuthContext,
    messageId: string
  ): Promise<MessageRow | null> {
    const msgClient = this.client();
    const { data, error } = await msgClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
    if (error || !data) return null;
    return data;
  }

  /**
   * Persist a ciphertext message with the atomic sequence-assignment retry loop
   * moved verbatim from `message-service.ts`. This IS the C13 behavior — on a
   * .NET backend it must be reproduced with a per-conversation advisory lock (or
   * unique-constraint + retry), NOT a naive SELECT MAX+1.
   *
   * Throws on non-recoverable failure so the caller can fall through to the
   * offline queue (the service owns that fallback).
   */
  async sendMessage(
    ctx: AuthContext,
    payload: SendMessagePayload
  ): Promise<MessageRow> {
    const msgClient = this.client();

    // Atomic sequence number assignment with separate retry budgets:
    //   - 23505 unique-constraint conflicts: 3 attempts (race with
    //     another tab inserting at the same sequence_number)
    //   - Network failures: 3 attempts with exponential backoff
    //     (1s, 2s, 4s) before propagating so the caller can queue offline
    //
    // The two counters must not bleed into each other — reset networkAttempt on
    // every non-network outcome so each new sequence-number attempt gets its own
    // budget.
    let conflictRetries = 3;
    let networkAttempt = 0;
    const NETWORK_ATTEMPT_LIMIT = 3;
    const networkDelays = [1000, 2000, 4000];
    const isNetworkErrorMessage = (errMsg: string): boolean =>
      errMsg.includes('Failed to fetch') ||
      errMsg.includes('NetworkError') ||
      errMsg.includes('fetch failed') ||
      errMsg.includes('Load failed') ||
      errMsg.includes('cancelled') ||
      errMsg.includes('aborted');
    let message: MessageRow | null = null;
    let lastFailureReason: 'conflict' | 'network' | 'unknown' = 'unknown';
    while (conflictRetries > 0) {
      const { data: lastMessage } = await msgClient
        .from('messages')
        .select('sequence_number')
        .eq('conversation_id', payload.conversationId)
        .order('sequence_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextSequenceNumber = lastMessage
        ? lastMessage.sequence_number + 1
        : 1;

      // delivered_at is NOT set here. It stays NULL until the recipient's
      // ConversationView fetches the row and calls markAsDelivered.
      let inserted: MessageRow | null = null;
      let insertError: { code?: string; message: string } | null = null;
      try {
        const result = await msgClient
          .from('messages')
          .insert({
            conversation_id: payload.conversationId,
            sender_id: ctx.userId,
            encrypted_content: payload.ciphertext,
            initialization_vector: payload.iv,
            sequence_number: nextSequenceNumber,
            key_version: payload.keyVersion,
            deleted: false,
            edited: false,
            // #245: NULL for live sends; a stable UUID for offline flushes so
            // replays dedupe against uniq_messages_client_generated_id.
            client_generated_id: payload.clientGeneratedId ?? null,
          })
          .select()
          .single();
        inserted = result.data;
        insertError = result.error;
      } catch (fetchErr) {
        // Network-level failure. Retry with backoff; never spends conflictRetries.
        lastFailureReason = 'network';
        networkAttempt++;
        if (networkAttempt < NETWORK_ATTEMPT_LIMIT) {
          await new Promise((r) =>
            setTimeout(r, networkDelays[networkAttempt - 1] || 4000)
          );
          continue;
        }
        // Out of network retries — propagate so the caller queues offline.
        throw fetchErr;
      }

      if (!insertError) {
        message = inserted;
        break;
      }

      // Unique-constraint violation — retry with a fresh sequence number.
      // Reset network budget: a 23505 means we DID reach the server.
      if (insertError.code === '23505') {
        lastFailureReason = 'conflict';
        networkAttempt = 0;
        conflictRetries--;
        continue;
      }

      // Network/fetch failures may arrive as insertError rather than a throw.
      const errMsg = insertError.message || '';
      if (isNetworkErrorMessage(errMsg)) {
        lastFailureReason = 'network';
        networkAttempt++;
        if (networkAttempt < NETWORK_ATTEMPT_LIMIT) {
          await new Promise((r) =>
            setTimeout(r, networkDelays[networkAttempt - 1] || 4000)
          );
          continue;
        }
        throw new ConnectionError(
          'Failed to send message after network retries: ' + errMsg
        );
      }

      // Other errors — throw.
      throw new ConnectionError(
        'Failed to send message: ' + insertError.message
      );
    }

    if (!message) {
      const reasonText =
        lastFailureReason === 'network'
          ? 'network failures'
          : lastFailureReason === 'conflict'
            ? 'sequence number conflict'
            : 'unknown error';
      throw new ConnectionError(
        'Failed to send message after retries: ' + reasonText
      );
    }

    // Update conversation's last_message_at
    await msgClient
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', payload.conversationId);

    return message;
  }

  /**
   * Paginated ciphertext fetch (newest-first, one extra row to compute
   * hasMore). Throws on DB error so the caller can attempt its cache fallback.
   * Decryption stays above this seam.
   */
  async getMessages(
    _ctx: AuthContext,
    params: GetMessagesParams
  ): Promise<MessagesPage> {
    const msgClient = this.client();
    const { conversationId, cursor, limit } = params;

    // Note: deleted messages are NOT filtered out — they render as placeholders
    // so sequence numbers and threading stay intact.
    let query = msgClient
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sequence_number', { ascending: false })
      .limit(limit + 1); // one extra to check hasMore

    if (cursor !== null) {
      query = query.lt('sequence_number', cursor);
    }

    const { data, error } = await query;
    if (error) {
      throw new ConnectionError('Failed to fetch messages: ' + error.message);
    }

    const rows = data ?? [];
    const hasMore = rows.length > limit;
    return { rows: hasMore ? rows.slice(0, limit) : rows, hasMore };
  }

  /**
   * Apply an edited ciphertext to a message row. The sender-only (C9) and
   * 15-minute-window (C10) pre-conditions are checked by the caller against the
   * row from {@link getMessageById}; on Supabase, RLS re-enforces both on this
   * UPDATE (USING sender_id = auth.uid(); WITH CHECK the 15-min window).
   */
  async editMessage(
    _ctx: AuthContext,
    payload: EditMessagePayload
  ): Promise<void> {
    const msgClient = this.client();
    const { error } = await msgClient
      .from('messages')
      .update({
        encrypted_content: payload.ciphertext,
        initialization_vector: payload.iv,
        key_version: payload.keyVersion,
        edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq('id', payload.messageId);

    if (error) {
      throw new ConnectionError('Failed to update message: ' + error.message);
    }
  }

  /**
   * Soft-delete a message (C12 — never physically removed). The sender-only +
   * window pre-conditions are checked by the caller; RLS re-enforces on UPDATE.
   */
  async deleteMessage(_ctx: AuthContext, messageId: string): Promise<void> {
    const msgClient = this.client();
    const { error } = await msgClient
      .from('messages')
      .update({ deleted: true })
      .eq('id', messageId);

    if (error) {
      throw new ConnectionError('Failed to delete message: ' + error.message);
    }
  }

  /**
   * (C11) Only marks messages that are not already read. RLS + the #281
   * column-guard restrict this to conversation participants and to the `read_at`
   * column only; a sender self-marking their own message is allowed (benign — a
   * read receipt carries no security consequence).
   */
  async markAsRead(_ctx: AuthContext, messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    const msgClient = this.client();
    const { error } = await msgClient
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', messageIds)
      .is('read_at', null); // Only update if not already read

    if (error) {
      throw new ConnectionError(
        'Failed to mark messages as read: ' + error.message
      );
    }
  }

  async markAsDelivered(
    _ctx: AuthContext,
    messageIds: string[]
  ): Promise<void> {
    if (messageIds.length === 0) return;
    const msgClient = this.client();
    const { error } = await msgClient
      .from('messages')
      .update({ delivered_at: new Date().toISOString() })
      .in('id', messageIds)
      .is('delivered_at', null); // Only update if not already delivered

    // Delivery receipts are best-effort — surface the error to the caller,
    // which logs it silently (delivery must never break the UI).
    if (error) {
      throw new ConnectionError(
        'Failed to mark messages as delivered: ' + error.message
      );
    }
  }

  /**
   * (C5) Per-user archive. 1:1 flips the conversation-level
   * archived_by_participant_N column; groups flip the per-member
   * conversation_members.archived flag. Fetches the conversation shape to pick
   * the path, matching the original message-service logic byte-for-byte.
   */
  private async setArchived(
    conversationId: string,
    userId: string,
    value: boolean
  ): Promise<void> {
    const msgClient = this.client();
    const verb = value ? 'archive' : 'unarchive';

    const { data: conversation, error: fetchError } = await msgClient
      .from('conversations')
      .select('participant_1_id, participant_2_id, is_group')
      .eq('id', conversationId)
      .single();

    if (fetchError || !conversation) {
      throw new ValidationError('Conversation not found', 'conversationId');
    }

    // Groups archive per-member via conversation_members.archived.
    if (conversation.is_group) {
      const { error: memberError, data: memberData } = await msgClient
        .from('conversation_members')
        .update({ archived: value })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .is('left_at', null)
        .select();

      if (memberError) {
        throw new ConnectionError(
          `Failed to ${verb} group conversation: ` + memberError.message
        );
      }
      if (!memberData || memberData.length === 0) {
        throw new ValidationError(
          'You are not a member of this conversation',
          'conversationId'
        );
      }
      return;
    }

    // 1:1 — pick the participant column for this user.
    let updateColumn: string;
    if (conversation.participant_1_id === userId) {
      updateColumn = 'archived_by_participant_1';
    } else if (conversation.participant_2_id === userId) {
      updateColumn = 'archived_by_participant_2';
    } else {
      throw new ValidationError(
        'You are not a participant in this conversation',
        'conversationId'
      );
    }

    const { error: updateError } = await msgClient
      .from('conversations')
      .update({ [updateColumn]: value })
      .eq('id', conversationId)
      .select();

    if (updateError) {
      throw new ConnectionError(
        `Failed to ${verb} conversation: ` + updateError.message
      );
    }
  }

  async archiveConversation(
    ctx: AuthContext,
    conversationId: string
  ): Promise<void> {
    await this.setArchived(conversationId, ctx.userId, true);
  }

  async unarchiveConversation(
    ctx: AuthContext,
    conversationId: string
  ): Promise<void> {
    await this.setArchived(conversationId, ctx.userId, false);
  }
}
