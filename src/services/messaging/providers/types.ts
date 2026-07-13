/**
 * Messaging Provider Abstraction — Interface (#266)
 *
 * Defines the seam between the messaging domain's client-side orchestration
 * (encryption, caching, offline queue — all backend-agnostic) and its
 * data access (the `.from(...)` PostgREST calls today, a REST client for
 * .NET tomorrow). A `MessagingDataProvider` moves ciphertext rows and enforces
 * the authorization contract; it NEVER sees plaintext or private keys.
 *
 * ## Why an explicit AuthContext
 * Supabase enforces "you only see your own rows" INSIDE the database via RLS,
 * reading `auth.uid()` from the request JWT. A .NET/EF Core backend has no
 * in-database `auth.uid()`. So the abstraction makes "who is asking" EXPLICIT:
 * every method takes an {@link AuthContext}. The Supabase provider relies on
 * the ambient session (RLS still applies); the .NET provider carries the
 * bearer token and must re-express every RLS rule as server-side authorization.
 *
 * ## The authorization contract (C1–C29)
 * The messaging security model is 75 Postgres RLS policies + SECURITY DEFINER
 * helpers. Each is catalogued as a numbered rule (C1–C29) in the #266 plan and
 * the shared conformance suite (`tests/contract/messaging-provider.contract.ts`).
 * Method doc blocks below reference the C-rules each method is responsible for.
 * A provider that drops a rule fails the shared suite — that is the anti-drift
 * alarm across the Supabase↔.NET seam.
 *
 * ## Encryption stays ABOVE this seam
 * The provider is ciphertext-in / ciphertext-out. {@link SendMessagePayload}
 * carries `{ ciphertext, iv, keyVersion }`, never `content`. Keys are
 * non-extractable in-browser CryptoKeys derived from the user's password; a
 * server can never obtain them and must never need to.
 *
 * @module services/messaging/providers/types
 */

import type { BackendProvider } from '@/config/backend.config';
import type {
  ConversationRow,
  MessageRow,
} from '@/lib/supabase/messaging-client';
import type { UserProfile } from '@/types/messaging';

/** The active backend provider name (`'supabase' | 'dotnet'`). */
export type BackendProviderName = BackendProvider;

// ============================================================================
// Identity — the explicit replacement for auth.uid()
// ============================================================================

/**
 * Who is making the request. Replaces the implicit database `auth.uid()`.
 *
 * - `userId` — the caller's user id. The provider uses it for sender/branch
 *   logic and (on .NET) for every authorization check.
 * - `accessToken` — the caller's JWT / bearer token. The Supabase provider does
 *   NOT need to use this (its singleton client already carries the session, so
 *   RLS applies automatically); the .NET provider sends it as
 *   `Authorization: Bearer <token>`.
 */
export interface AuthContext {
  userId: string;
  accessToken: string;
}

// ============================================================================
// Data-op payloads / results (ciphertext only)
// ============================================================================

/**
 * A message to persist. Ciphertext-only — the domain service has already
 * encrypted `content` into `{ ciphertext, iv }` above this seam.
 */
export interface SendMessagePayload {
  conversationId: string;
  /** Base64-encoded ciphertext (stored as `messages.encrypted_content`). */
  ciphertext: string;
  /** Base64-encoded IV (stored as `messages.initialization_vector`). */
  iv: string;
  /** Key version this ciphertext was encrypted under. */
  keyVersion: number;
  /**
   * #245 idempotency key (`messages.client_generated_id`). NULL for live sends;
   * set to a stable UUID for offline-queue flushes so replays dedupe. The
   * unique index is NULL-tolerant so many live (NULL) sends coexist. (C14)
   */
  clientGeneratedId?: string | null;
}

export interface GetMessagesParams {
  conversationId: string;
  /** `sequence_number` to page before; null fetches the latest page. */
  cursor: number | null;
  limit: number;
}

export interface MessagesPage {
  /** Ciphertext rows, newest-first (matches today's query order). */
  rows: MessageRow[];
  hasMore: boolean;
}

/**
 * The conversation metadata both the send and history paths need. A subset of
 * {@link ConversationRow} to keep the provider contract tight.
 */
export type ConversationMeta = Pick<
  ConversationRow,
  | 'participant_1_id'
  | 'participant_2_id'
  | 'is_group'
  | 'current_key_version'
  | 'created_by'
>;

export interface EditMessagePayload {
  messageId: string;
  ciphertext: string;
  iv: string;
  keyVersion: number;
}

// ============================================================================
// Realtime sub-interface
// ============================================================================

/** Messaging tables that carry realtime change events. */
export type MessagingTable =
  | 'messages'
  | 'conversations'
  | 'conversation_members'
  | 'user_connections';

export interface ChangeEvent<T = Record<string, unknown>> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T | null;
  old: T | null;
}

export interface SubscribeOptions {
  table: MessagingTable;
  /** Stable channel identity, e.g. `unread-messages-${userId}`. */
  channelKey: string;
}

export interface Subscription {
  unsubscribe(): void;
}

/**
 * Abstracts the 3 `postgres_changes` subscription sites (`useConversationList`,
 * `useUnreadCount`, `useConnections`) plus the `ConversationView` poll.
 *
 * The consuming hooks treat every event as a REFETCH TRIGGER — they never trust
 * the payload, they refetch through the authorization-scoped data methods. That
 * is what makes a .NET polling fallback behavior-identical (fire a bare "changed"
 * tick; the hook refetches) AND makes C29 safe by construction: a change signal
 * carrying no row payload, followed by an authorized refetch, can never surface
 * a row the subscriber could not independently read.
 */
export interface MessagingRealtimeProvider {
  subscribe(
    ctx: AuthContext,
    opts: SubscribeOptions,
    onChange: (e: ChangeEvent) => void
  ): Subscription;
}

// ============================================================================
// The data provider
// ============================================================================

/**
 * The messaging backend behind the Supabase↔.NET seam. v1 wires only
 * `message-service.ts` through this; connections/groups/keys/GDPR keep calling
 * Supabase directly until a later slice.
 */
export interface MessagingDataProvider {
  readonly name: BackendProviderName;

  /**
   * Fetch the participant/group metadata for a conversation.
   * (C1/C2/C7) Only participants or active members may read it.
   */
  getConversationMeta(
    ctx: AuthContext,
    conversationId: string
  ): Promise<ConversationMeta | null>;

  /** Display-name/avatar lookup for a set of user ids. */
  getProfiles(ctx: AuthContext, userIds: string[]): Promise<UserProfile[]>;

  /**
   * Persist a ciphertext message and return the stored row (with its assigned
   * sequence_number).
   * (C8) Sender must be the caller AND an active participant/member.
   * (C13) The provider owns gap-free, per-conversation monotonic sequence
   *       assignment under concurrency — on Supabase this is a per-conversation
   *       advisory lock in `assign_sequence_number()`; a .NET port MUST
   *       replicate that lock (or a unique-constraint + retry). Naive
   *       `SELECT MAX+1 / INSERT` races and produces gaps/dupes.
   * (C14) `clientGeneratedId` gives NULL-tolerant idempotency for offline flush.
   */
  sendMessage(
    ctx: AuthContext,
    payload: SendMessagePayload
  ): Promise<MessageRow>;

  /**
   * Paginated ciphertext fetch (no decryption — that stays above the seam).
   * (C7) Membership/participant-scoped read.
   */
  getMessages(
    ctx: AuthContext,
    params: GetMessagesParams
  ): Promise<MessagesPage>;

  /**
   * Edit a message's ciphertext.
   * (C9) Sender-only.
   * (C10) Only within 15 minutes of `created_at`. NOTE the RLS split: ownership
   *       is a USING-style precondition; the 15-minute window is a WITH-CHECK-style
   *       post-condition. Both must be enforced — a stale-but-owned edit at
   *       T+20min must be rejected.
   */
  editMessage(ctx: AuthContext, payload: EditMessagePayload): Promise<void>;

  /**
   * Soft-delete a message (sets `deleted = true`).
   * (C12) Messages are NEVER physically removed — there is no hard-delete path.
   */
  deleteMessage(ctx: AuthContext, messageId: string): Promise<void>;

  /**
   * Mark messages read.
   * (C11) Only a non-sender participant may set read state; the sender cannot
   *       self-mark.
   */
  markAsRead(ctx: AuthContext, messageIds: string[]): Promise<void>;

  /** Mark messages delivered (recipient-side acknowledgement). */
  markAsDelivered(ctx: AuthContext, messageIds: string[]): Promise<void>;

  /** (C5) Per-user archive flag; participants only. */
  archiveConversation(ctx: AuthContext, conversationId: string): Promise<void>;
  unarchiveConversation(
    ctx: AuthContext,
    conversationId: string
  ): Promise<void>;

  /** Realtime change-event stream (or polling fallback). */
  readonly realtime: MessagingRealtimeProvider;
}
