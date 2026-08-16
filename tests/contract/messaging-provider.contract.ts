/**
 * Shared messaging-provider conformance suite (#266).
 *
 * ONE set of authorization + data-contract assertions, parametrized over a
 * provider factory, so BOTH the Supabase and the .NET providers are measured
 * against the IDENTICAL contract (the 14 named clauses catalogued in
 * `docs/messaging/AUTHORIZATION-CONTRACT.md`). This is the
 * anti-drift alarm across the Supabase↔.NET seam: if the .NET server ever drops
 * a rule (e.g. the 15-minute edit window), the same test that passes on Supabase
 * goes red on .NET.
 *
 * Every assertion is a REAL authenticated round-trip against a live backend —
 * RLS gaps only surface on a live round-trip, never against mocks (the repo's
 * hard-won lesson). The Supabase runner seeds via the service client and drives
 * the provider as per-user authenticated clients.
 *
 * Encryption stays ABOVE the provider, so these tests move ciphertext strings
 * only (never plaintext) — matching the production seam.
 *
 * @module tests/contract/messaging-provider.contract
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type {
  AuthContext,
  ChangeEvent,
  MessagingDataProvider,
} from '@/services/messaging/providers';

/**
 * A seeded 1:1 conversation between two users, plus a provider + AuthContext for
 * each, and a helper to seed a message directly (bypassing the provider) so
 * read/edit/delete rules can be exercised against known rows.
 */
export interface ConformanceHarness {
  /** userA is participant_1 (canonical ordering: A.id < B.id). */
  userAId: string;
  userBId: string;
  conversationId: string;

  /**
   * A GROUP conversation (is_group=true) with userA + userB as active members;
   * the outsider is NOT a member. For C1/C2 group-scoping cases.
   */
  groupConversationId: string;

  /** Provider bound to userA's authenticated session. */
  providerA: MessagingDataProvider;
  ctxA: AuthContext;
  /** Provider bound to userB's authenticated session. */
  providerB: MessagingDataProvider;
  ctxB: AuthContext;
  /**
   * A third user with NO membership in the conversation (for leak tests).
   * For C3 they double as the "connected but no conversation yet" partner:
   * the runners seed an ACCEPTED userB↔outsider connection with no conversation,
   * while userA↔outsider share NO connection row at all.
   */
  outsiderId: string;
  providerOutsider: MessagingDataProvider;
  ctxOutsider: AuthContext;

  /**
   * A fourth user holding a PENDING (never accepted) connection with userA, and
   * nothing else. Exists so C3 can prove that a connection merely EXISTING is
   * not enough — only `status = 'accepted'` unlocks creation.
   */
  pendingUserId: string;

  /**
   * Insert a message row directly via the service client (bypasses RLS +
   * sequence trigger control), returning the row id. `createdAtIso` lets a test
   * backdate a message to exercise the 15-minute edit window (C10).
   * `conversationId` defaults to the 1:1 conversation; pass the group id for
   * group cases.
   */
  seedMessage(opts: {
    senderId: string;
    ciphertext?: string;
    createdAtIso?: string;
    conversationId?: string;
  }): Promise<{ id: string }>;

  /** Read a message row directly (service client) for assertions. */
  readMessage(id: string): Promise<{
    id: string;
    deleted: boolean;
    edited: boolean;
    encrypted_content: string;
    read_at: string | null;
    delivered_at: string | null;
    sequence_number: number;
  } | null>;

  /** Read a conversation row directly (service client) for archive/meta asserts. */
  readConversation(id: string): Promise<{
    id: string;
    is_group: boolean;
    participant_1_id: string | null;
    archived_by_participant_1: boolean;
    archived_by_participant_2: boolean;
  } | null>;

  /**
   * The 1:1 conversation id for a pair, read directly via the service client and
   * order-agnostic. This is the AUTHORITATIVE "was a row actually created?"
   * check for the C3 negatives: a blocked create surfaces differently per
   * backend (Supabase RLS rejects the INSERT, .NET returns 403 → a thrown
   * ConnectionError), so only the database state is provider-agnostic.
   */
  readConversationBetween(userX: string, userY: string): Promise<string | null>;

  /**
   * Rewrite the userA↔userB connection to exactly one row in the given direction
   * and status (service client). C30 uses it to place a block as
   * (participant_1 → participant_2) and then as (participant_2 → participant_1),
   * because `unique_connection` is not symmetric and only one of those rows will
   * exist in real data.
   *
   * Every C30 case restores `accepted` in a `finally`, so later clauses still see
   * the shared fixture graph they were written against.
   */
  setAbConnection(opts: {
    requesterId: string;
    addresseeId: string;
    status: 'accepted' | 'blocked';
  }): Promise<void>;
}

/** Which authorization rule a refused write was supposed to trip. */
export type RefusalKind =
  | 'not-connected'
  | 'pending-connection'
  | 'self'
  | 'blocked';

export interface ConformanceConfig {
  /** Human label for the provider under test (e.g. "supabase"). */
  providerName: string;
  /** Build a fresh harness (seed users + conversation). Called once. */
  setup(): Promise<ConformanceHarness>;
  /** Tear down seeded data. */
  teardown(h: ConformanceHarness): Promise<void>;

  /**
   * Per-backend assertion on HOW a write was refused.
   *
   * The shared cases below assert the provider-agnostic security property — no
   * row was created. That property holds even if a backend blocks by accident,
   * which is a real blind spot for #265: the .NET server currently sits on the
   * same RLS-protected Postgres, so deleting its explicit C3 check changes
   * nothing observable (RLS rejects the INSERT, the request 500s, the provider
   * still throws, the row still doesn't exist — every assertion stays green).
   * Verified by mutation test: stubbing `HasAcceptedConnection` to `true` left
   * all 25 cases passing.
   *
   * Every runner must classify its refusal. A missing callback silently turns
   * an unmeasured failure into a pass — exactly the masking this contract is
   * meant to catch. .NET pins its explicit 4xx check; Supabase pins its
   * deterministic domain errors from the client-side preflight before RLS can
   * obscure their cause.
   */
  assertRefusal(error: unknown, kind: RefusalKind): void;
}

/**
 * Run the shared conformance suite against a provider. Call this from a thin
 * per-backend runner that supplies `setup`/`teardown`.
 */
export function runMessagingProviderContract(config: ConformanceConfig): void {
  describe(`MessagingDataProvider contract [${config.providerName}]`, () => {
    let h: ConformanceHarness;

    beforeAll(async () => {
      h = await config.setup();
    }, 60_000);

    afterAll(async () => {
      if (h) await config.teardown(h);
    });

    // ── C7/C8 — membership scoping ───────────────────────────────────────
    it('C8: a participant can send and the row round-trips (ciphertext-only)', async () => {
      const sent = await h.providerA.sendMessage(h.ctxA, {
        conversationId: h.conversationId,
        ciphertext: 'Y2lwaGVydGV4dC1B', // base64("ciphertext-A")
        iv: 'aXYtQQ==',
        keyVersion: 1,
        clientGeneratedId: null,
      });
      expect(sent.sender_id).toBe(h.userAId);
      expect(sent.encrypted_content).toBe('Y2lwaGVydGV4dC1B');
      expect(sent.sequence_number).toBeGreaterThan(0);
    });

    it('C7: both participants can read the conversation; an outsider cannot', async () => {
      await h.seedMessage({ senderId: h.userAId, ciphertext: 'c2Vjcg==' });

      const pageA = await h.providerA.getMessages(h.ctxA, {
        conversationId: h.conversationId,
        cursor: null,
        limit: 50,
      });
      const pageB = await h.providerB.getMessages(h.ctxB, {
        conversationId: h.conversationId,
        cursor: null,
        limit: 50,
      });
      expect(pageA.rows.length).toBeGreaterThan(0);
      expect(pageB.rows.length).toBeGreaterThan(0);

      // C7/C29: the outsider is not a participant — RLS must return zero rows,
      // never leak. (The provider surfaces exactly what the caller may SELECT.)
      const pageOutsider = await h.providerOutsider.getMessages(h.ctxOutsider, {
        conversationId: h.conversationId,
        cursor: null,
        limit: 50,
      });
      expect(pageOutsider.rows).toEqual([]);
    });

    it('C7: an outsider cannot read the conversation metadata', async () => {
      const metaA = await h.providerA.getConversationMeta(
        h.ctxA,
        h.conversationId
      );
      expect(metaA).not.toBeNull();

      const metaOutsider = await h.providerOutsider.getConversationMeta(
        h.ctxOutsider,
        h.conversationId
      );
      expect(metaOutsider).toBeNull();
    });

    // ── C9/C10 — edit: sender-only AND within 15 minutes ─────────────────
    it('C9: the sender can edit their own recent message', async () => {
      const { id } = await h.seedMessage({ senderId: h.userAId });
      await h.providerA.editMessage(h.ctxA, {
        messageId: id,
        ciphertext: 'ZWRpdGVk', // base64("edited")
        iv: 'aXY=',
        keyVersion: 1,
      });
      const row = await h.readMessage(id);
      expect(row?.edited).toBe(true);
      expect(row?.encrypted_content).toBe('ZWRpdGVk');
    });

    // C9: "only the sender can edit a message." Enforced on Supabase by the
    // #281 column-guard trigger (enforce_message_update_columns) — the two
    // permissive UPDATE policies OR-combine and RLS can't scope columns, so the
    // trigger is what blocks a non-sender rewriting ciphertext. The .NET provider
    // must satisfy this same assertion server-side (it has no RLS/trigger).
    it('C9: a non-sender cannot edit the message', async () => {
      const { id } = await h.seedMessage({
        senderId: h.userAId,
        ciphertext: 'b3JpZ2luYWw=', // base64("original")
      });
      // userB is a participant but NOT the sender — the edit must not apply.
      await h.providerB
        .editMessage(h.ctxB, {
          messageId: id,
          ciphertext: 'aGlqYWNr', // base64("hijack")
          iv: 'aXY=',
          keyVersion: 1,
        })
        .catch(() => {
          /* provider may or may not throw; the row check is authoritative */
        });
      const row = await h.readMessage(id);
      expect(row?.encrypted_content).toBe('b3JpZ2luYWw=');
      expect(row?.edited).toBe(false);
    });

    it('C10: an edit outside the 15-minute window is rejected (row unchanged)', async () => {
      // Backdate 16 minutes so the WITH CHECK window (created_at > now-15m) fails.
      const sixteenMinAgo = new Date(Date.now() - 16 * 60_000).toISOString();
      const { id } = await h.seedMessage({
        senderId: h.userAId,
        ciphertext: 'c3RhbGU=', // base64("stale")
        createdAtIso: sixteenMinAgo,
      });
      await h.providerA
        .editMessage(h.ctxA, {
          messageId: id,
          ciphertext: 'dG9vTGF0ZQ==', // base64("tooLate")
          iv: 'aXY=',
          keyVersion: 1,
        })
        .catch(() => {
          /* the row check below is authoritative */
        });
      const row = await h.readMessage(id);
      expect(row?.encrypted_content).toBe('c3RhbGU=');
      expect(row?.edited).toBe(false);
    });

    // ── C11 — mark-read: non-sender participant only ─────────────────────
    it('C11: the recipient (non-sender) can mark a message read', async () => {
      const { id } = await h.seedMessage({ senderId: h.userAId });
      await h.providerB.markAsRead(h.ctxB, [id]);
      const row = await h.readMessage(id);
      expect(row?.read_at).not.toBeNull();
    });

    it('C11: a non-participant outsider cannot mark a message read', async () => {
      const { id } = await h.seedMessage({ senderId: h.userAId });
      // The outsider is not in the conversation — the mark-read policy's
      // participant predicate excludes them, so read_at stays null.
      await h.providerOutsider.markAsRead(h.ctxOutsider, [id]).catch(() => {});
      const row = await h.readMessage(id);
      expect(row?.read_at).toBeNull();
    });

    // Documents ACTUAL live behavior (not a bug): a sender setting read_at on
    // their own message succeeds via the edit policy's broad UPDATE. Benign, but
    // it's the same column-blindness tracked in #281 — a column-guard trigger
    // there would also scope this. Kept as a truthful pin, not an aspiration.
    it('C11: a sender self-marking read currently succeeds (benign; see #281)', async () => {
      const { id } = await h.seedMessage({ senderId: h.userAId });
      await h.providerA.markAsRead(h.ctxA, [id]).catch(() => {});
      const row = await h.readMessage(id);
      expect(row?.read_at).not.toBeNull();
    });

    // ── C12 — messages are never physically deleted ──────────────────────
    it('C12: delete is a soft-delete — the row survives with deleted=true', async () => {
      const { id } = await h.seedMessage({
        senderId: h.userAId,
        ciphertext: 'a2VlcA==', // base64("keep")
      });
      await h.providerA.deleteMessage(h.ctxA, id);
      const row = await h.readMessage(id);
      expect(row).not.toBeNull(); // still fetchable
      expect(row?.deleted).toBe(true);
      expect(row?.encrypted_content).toBe('a2VlcA=='); // ciphertext preserved
    });

    // ── C13 — gap-free monotonic sequence under concurrency ──────────────
    it('C13: N concurrent sends get distinct, gap-free sequence numbers', async () => {
      const N = 12;
      const before = await h.providerA.getMessages(h.ctxA, {
        conversationId: h.conversationId,
        cursor: null,
        limit: 1,
      });
      const baseSeq = before.rows[0]?.sequence_number ?? 0;

      const sent = await Promise.all(
        Array.from({ length: N }, (_, i) =>
          h.providerA.sendMessage(h.ctxA, {
            conversationId: h.conversationId,
            ciphertext: `Y29uYy0${i}`, // distinct-ish ciphertext per send
            iv: 'aXY=',
            keyVersion: 1,
            clientGeneratedId: null,
          })
        )
      );
      const seqs = sent.map((r) => r.sequence_number).sort((a, b) => a - b);
      // All distinct (no collision) and strictly increasing past the baseline.
      expect(new Set(seqs).size).toBe(N);
      expect(seqs[0]).toBeGreaterThan(baseSeq);
      // Contiguous: max - min == N-1 (no gaps introduced by the assignment).
      expect(seqs[seqs.length - 1] - seqs[0]).toBe(N - 1);
    });

    // ── C14 — NULL-tolerant idempotency ──────────────────────────────────
    it('C14: replaying a send with the same clientGeneratedId yields one row', async () => {
      const cgid = crypto.randomUUID();
      const payload = {
        conversationId: h.conversationId,
        ciphertext: 'aWRlbXBvdGVudA==', // base64("idempotent")
        iv: 'aXY=',
        keyVersion: 1,
        clientGeneratedId: cgid,
      };
      await h.providerA.sendMessage(h.ctxA, payload);
      // A replay (same cgid) must not create a second row. The provider's
      // insert races the unique index; either way the end state is one row.
      await h.providerA.sendMessage(h.ctxA, payload).catch(() => {});

      const all = await h.providerA.getMessages(h.ctxA, {
        conversationId: h.conversationId,
        cursor: null,
        limit: 200,
      });
      const withCgid = all.rows.filter((r) => r.client_generated_id === cgid);
      expect(withCgid.length).toBe(1);
    });

    // ── C7 — getMessageById is membership-scoped ─────────────────────────
    it('C7: getMessageById returns the row for a participant, null for an outsider', async () => {
      const { id } = await h.seedMessage({
        senderId: h.userAId,
        ciphertext: 'YnlJZA==', // base64("byId")
      });
      const asParticipant = await h.providerA.getMessageById(h.ctxA, id);
      expect(asParticipant?.id).toBe(id);
      const asOutsider = await h.providerOutsider.getMessageById(
        h.ctxOutsider,
        id
      );
      expect(asOutsider).toBeNull();
    });

    // ── getProfiles — batch display-name/avatar lookup ───────────────────
    it('getProfiles returns the requested users profiles', async () => {
      const profiles = await h.providerA.getProfiles(h.ctxA, [
        h.userAId,
        h.userBId,
      ]);
      const ids = profiles.map((p) => p.id).sort();
      expect(ids).toEqual([h.userAId, h.userBId].sort());
    });

    // ── markAsDelivered — participant-scoped receipt (delivered_at only) ──
    it('markAsDelivered sets delivered_at for a participant', async () => {
      const { id } = await h.seedMessage({ senderId: h.userAId });
      await h.providerB.markAsDelivered(h.ctxB, [id]);
      const row = await h.readMessage(id);
      expect(row?.delivered_at).not.toBeNull();
    });

    it('markAsDelivered by a non-participant outsider does not set delivered_at', async () => {
      const { id } = await h.seedMessage({ senderId: h.userAId });
      await h.providerOutsider
        .markAsDelivered(h.ctxOutsider, [id])
        .catch(() => {
          /* the row check is authoritative */
        });
      const row = await h.readMessage(id);
      expect(row?.delivered_at).toBeNull();
    });

    // ── C7 — pagination: newest-first, cursor + hasMore ──────────────────
    it('C7: getMessages paginates newest-first with a cursor and hasMore', async () => {
      // The shared conversation already carries several messages from prior
      // cases; add a few more so a small page definitely reports hasMore.
      for (let i = 0; i < 3; i++) await h.seedMessage({ senderId: h.userAId });

      const page1 = await h.providerA.getMessages(h.ctxA, {
        conversationId: h.conversationId,
        cursor: null,
        limit: 2,
      });
      expect(page1.rows.length).toBe(2);
      expect(page1.hasMore).toBe(true);
      // newest-first: descending by sequence_number.
      expect(page1.rows[0].sequence_number).toBeGreaterThan(
        page1.rows[1].sequence_number
      );

      const cursor = page1.rows[page1.rows.length - 1].sequence_number;
      const page2 = await h.providerA.getMessages(h.ctxA, {
        conversationId: h.conversationId,
        cursor,
        limit: 2,
      });
      // The next page is strictly older than the cursor (no overlap, no gap-skip).
      expect(page2.rows.every((r) => r.sequence_number < cursor)).toBe(true);
    });

    // ── C5 — archive is a per-participant view flag ──────────────────────
    it('C5: a participant can archive then unarchive their own view', async () => {
      await h.providerA.archiveConversation(h.ctxA, h.conversationId);
      let conv = await h.readConversation(h.conversationId);
      const aIsP1 = conv?.participant_1_id === h.userAId;
      const aFlag = () =>
        aIsP1
          ? conv?.archived_by_participant_1
          : conv?.archived_by_participant_2;
      const otherFlag = () =>
        aIsP1
          ? conv?.archived_by_participant_2
          : conv?.archived_by_participant_1;
      expect(aFlag()).toBe(true);
      // The other participant's view is untouched.
      expect(otherFlag()).toBe(false);

      await h.providerA.unarchiveConversation(h.ctxA, h.conversationId);
      conv = await h.readConversation(h.conversationId);
      expect(aFlag()).toBe(false);
    });

    // ── C1/C2 — group membership scoping ─────────────────────────────────
    it('C1/C2: a group member can read the group; a non-member cannot', async () => {
      await h.seedMessage({
        senderId: h.userAId,
        conversationId: h.groupConversationId,
        ciphertext: 'Z3JvdXA=', // base64("group")
      });

      const metaMember = await h.providerA.getConversationMeta(
        h.ctxA,
        h.groupConversationId
      );
      expect(metaMember).not.toBeNull();
      expect(metaMember?.is_group).toBe(true);
      const pageMember = await h.providerA.getMessages(h.ctxA, {
        conversationId: h.groupConversationId,
        cursor: null,
        limit: 50,
      });
      expect(pageMember.rows.length).toBeGreaterThan(0);

      // The outsider is not a member — no metadata, no rows leaked.
      const metaOutsider = await h.providerOutsider.getConversationMeta(
        h.ctxOutsider,
        h.groupConversationId
      );
      expect(metaOutsider).toBeNull();
      const pageOutsider = await h.providerOutsider.getMessages(h.ctxOutsider, {
        conversationId: h.groupConversationId,
        cursor: null,
        limit: 50,
      });
      expect(pageOutsider.rows).toEqual([]);
    });

    // ── C29 — realtime is a refetch trigger; the read is the authz boundary ──
    // The two providers reach C29 differently: Supabase fires RLS-filtered
    // `postgres_changes` events that DO carry a row payload; the .NET fallback
    // fires payload-free polling ticks. Neither can be asserted by a single
    // "payload shape" check, and a live-delivery wait would be flaky AND would
    // hang the conformance stack (which omits the realtime container). So this
    // case asserts the guarantee that holds regardless of what realtime delivers:
    // an outsider's AUTHORIZED refetch surfaces nothing, and any event that did
    // arrive carries no readable row. See docs/messaging/AUTHORIZATION-CONTRACT.md.
    it('C29: an outsider subscription never yields a readable row (no-leak by construction)', async () => {
      const events: ChangeEvent[] = [];
      const sub = h.providerOutsider.realtime.subscribe(
        h.ctxOutsider,
        { table: 'messages', channelKey: `c29-${h.conversationId}` },
        (e) => events.push(e)
      );
      try {
        expect(typeof sub.unsubscribe).toBe('function');

        // A change the outsider must never obtain via realtime.
        await h.seedMessage({
          senderId: h.userAId,
          ciphertext: 'cmVhbHRpbWU=', // base64("realtime")
        });

        // The guarantee: the change signal is only a trigger; the scoped read is
        // the authorization boundary (already proven for participant-vs-outsider
        // above). Whatever the realtime layer delivered, the outsider's authorized
        // refetch surfaces nothing.
        const page = await h.providerOutsider.getMessages(h.ctxOutsider, {
          conversationId: h.conversationId,
          cursor: null,
          limit: 50,
        });
        expect(page.rows).toEqual([]);

        // Any event that did arrive must not carry a readable row: the .NET poll
        // fires payload-free ticks (new === null); Supabase's channel is
        // RLS-filtered, so an outsider receives no message event at all. Either
        // way, no ciphertext leaks through the realtime seam.
        for (const e of events) expect(e.new).toBeNull();
      } finally {
        // Safe/idempotent on both providers; needs no realtime container.
        sub.unsubscribe();
      }
    });

    // ── C3 — creating a 1:1 conversation is connection-gated ────────────────
    // These run LAST on purpose. The suite has no `beforeEach`; cases share one
    // conversation and execute in declaration order, so appending guarantees the
    // extra fixtures (a second conversation, two more connections) cannot
    // perturb any earlier assertion.
    //
    // A blocked create surfaces differently per backend — Supabase's RLS
    // WITH CHECK rejects the INSERT, the .NET server returns 403 — so the
    // negatives use the suite's established idiom: swallow the throw, then let
    // the DATABASE ROW be the authoritative assertion.

    it('C3: getOrCreateConversation returns the EXISTING conversation for a connected pair', async () => {
      const fromA = await h.providerA.getOrCreateConversation(
        h.ctxA,
        h.userBId
      );
      expect(fromA).toBe(h.conversationId);

      // Idempotent from either side: canonical ordering collapses (A,B) and
      // (B,A) onto the one `unique_conversation` row.
      const fromB = await h.providerB.getOrCreateConversation(
        h.ctxB,
        h.userAId
      );
      expect(fromB).toBe(h.conversationId);
    });

    it('C3: an accepted connection permits creating a NEW 1:1 conversation', async () => {
      // userB ↔ outsider hold an ACCEPTED connection but have no conversation.
      expect(
        await h.readConversationBetween(h.userBId, h.outsiderId)
      ).toBeNull();

      const created = await h.providerB.getOrCreateConversation(
        h.ctxB,
        h.outsiderId
      );
      expect(created).toBeTruthy();

      // The row really landed, as a 1:1, with canonical ordering applied.
      const row = await h.readConversation(created);
      expect(row).not.toBeNull();
      expect(row?.is_group).toBe(false);
      const [expectedP1] = [h.userBId, h.outsiderId].sort();
      expect(row?.participant_1_id).toBe(expectedP1);

      // Idempotent: a second call returns the same row rather than duplicating
      // or throwing on `unique_conversation`.
      const again = await h.providerB.getOrCreateConversation(
        h.ctxB,
        h.outsiderId
      );
      expect(again).toBe(created);
    });

    it('C3: a PENDING connection does not permit creating a conversation', async () => {
      // The connection EXISTS but is not accepted — status is the whole rule.
      let refusal: unknown;
      const created = await h.providerA
        .getOrCreateConversation(h.ctxA, h.pendingUserId)
        // The row check proves the provider did not create a conversation; the
        // required callback below also proves it surfaced the expected refusal.
        .catch((e) => {
          refusal = e;
          return null;
        });
      expect(created).toBeNull();
      expect(
        await h.readConversationBetween(h.userAId, h.pendingUserId)
      ).toBeNull();
      config.assertRefusal(refusal, 'pending-connection');
    });

    it('C3: with NO connection at all, creating a conversation is refused', async () => {
      // userA ↔ outsider share no `user_connections` row in either direction.
      let refusal: unknown;
      const created = await h.providerA
        .getOrCreateConversation(h.ctxA, h.outsiderId)
        .catch((e) => {
          refusal = e;
          return null;
        });
      expect(created).toBeNull();
      expect(
        await h.readConversationBetween(h.userAId, h.outsiderId)
      ).toBeNull();
      config.assertRefusal(refusal, 'not-connected');
    });

    it('C3: a self-conversation is refused (no_self_conversation)', async () => {
      let refusal: unknown;
      const created = await h.providerA
        .getOrCreateConversation(h.ctxA, h.userAId)
        .catch((e) => {
          refusal = e;
          return null;
        });
      expect(created).toBeNull();
      expect(await h.readConversationBetween(h.userAId, h.userAId)).toBeNull();
      config.assertRefusal(refusal, 'self');
    });

    // ── C30 — a block stops future contact in an EXISTING conversation (#352) ──
    //
    // C3 gates CREATING a conversation on connection status. Nothing gated SENDING,
    // which was gated on participation alone — so a user who was blocked after the
    // conversation already existed kept messaging the person who blocked them. All
    // nine `messages` policies were connection-blind.
    //
    // C30 takes the next genuinely unused number. C4, C6 and C15–C28 are gaps that
    // never existed; reusing one would imply a history it does not have.
    describe('C30: blocking stops sending into an existing conversation', () => {
      const PAYLOAD = {
        ciphertext: 'YmxvY2tlZC1zZW5k', // base64("blocked-send")
        iv: 'aXYtYmxrPQ==',
        keyVersion: 1,
        clientGeneratedId: null,
      };

      /** Message count read by a participant — reads stay open (decision 2). */
      async function messageCount(): Promise<number> {
        const page = await h.providerA.getMessages(h.ctxA, {
          conversationId: h.conversationId,
          cursor: null,
          limit: 200,
        });
        return page.rows.length;
      }

      /**
       * Place the block in a SPECIFIC direction, run the case, and always restore
       * `accepted` — later clauses share this fixture graph.
       */
      async function withBlock(
        requesterId: string,
        addresseeId: string,
        fn: () => Promise<void>
      ): Promise<void> {
        await h.setAbConnection({
          requesterId,
          addresseeId,
          status: 'blocked',
        });
        try {
          await fn();
        } finally {
          await h.setAbConnection({
            requesterId: h.userAId,
            addresseeId: h.userBId,
            status: 'accepted',
          });
        }
      }

      /**
       * The shared property: the send is refused, no row appears, and the refusal
       * does not say WHY. Decision 1 — a message naming the block turns any
       * conversation into an oracle for "did this person block me?".
       */
      async function expectSendRefused(
        provider: MessagingDataProvider,
        ctx: AuthContext
      ): Promise<void> {
        const before = await messageCount();

        let refusal: unknown;
        const sent = await provider
          .sendMessage(ctx, { conversationId: h.conversationId, ...PAYLOAD })
          .catch((e) => {
            refusal = e;
            return null;
          });

        expect(sent).toBeNull();
        // Row state is the provider-agnostic half: a backend that refuses by
        // accident still must not have written anything.
        expect(await messageCount()).toBe(before);

        expect(
          refusal,
          'the send resolved without a row — that is a silent drop, not a refusal'
        ).toBeDefined();

        const text = String((refusal as Error).message ?? '').toLowerCase();
        expect(
          text.includes('block'),
          `refusal names the block ("${(refusal as Error).message}"). Decision 1: ` +
            'the message must not distinguish "you are blocked" from any other ' +
            'refusal, or it becomes an oracle.'
        ).toBe(false);

        config.assertRefusal(refusal, 'blocked');
      }

      it('C30: the blocked user cannot send — block stored (participant_1 → participant_2)', async () => {
        // userA is participant_1 by the canonical ordering, so this is "the person
        // listed first blocked the person listed second".
        await withBlock(h.userAId, h.userBId, () =>
          expectSendRefused(h.providerB, h.ctxB)
        );
      });

      it('C30: the blocked user cannot send — block stored (participant_2 → participant_1)', async () => {
        // THIS IS THE CASE THAT CATCHES A ONE-SIDED RULE. `unique_connection` is
        // UNIQUE (requester_id, addressee_id) and is NOT symmetric: exactly one row
        // exists and which way round it points depends on who pressed the button,
        // not on the conversation's participant ordering. A check written against
        // only (participant_1 = requester) passes the case above and fails here —
        // enforcing the block for roughly half of real blocks, silently.
        await withBlock(h.userBId, h.userAId, () =>
          expectSendRefused(h.providerA, h.ctxA)
        );
      });

      it('C30: the blocker cannot send either, so silence is symmetric', async () => {
        // Not politeness — it closes the oracle. If the blocker could still send
        // while the blocked user could not, the asymmetry itself reveals the block
        // to anyone comparing the two directions, which is what decision 1 forbids.
        await withBlock(h.userAId, h.userBId, () =>
          expectSendRefused(h.providerA, h.ctxA)
        );
      });

      it('C30: existing history stays readable to both sides (decision 2)', async () => {
        // Blocking severs future contact; it does not retract what was already
        // said. Deleting or hiding history would also be a louder signal than the
        // refusal we just made deliberately quiet.
        await h.seedMessage({
          senderId: h.userAId,
          ciphertext: 'aGlzdG9yeQ==',
        });

        await withBlock(h.userAId, h.userBId, async () => {
          const asA = await h.providerA.getMessages(h.ctxA, {
            conversationId: h.conversationId,
            cursor: null,
            limit: 200,
          });
          const asB = await h.providerB.getMessages(h.ctxB, {
            conversationId: h.conversationId,
            cursor: null,
            limit: 200,
          });
          expect(asA.rows.length).toBeGreaterThan(0);
          expect(asB.rows.length).toBe(asA.rows.length);
        });
      });

      it('C30: a group conversation is unaffected by a 1:1 block (decision 5)', async () => {
        // Explicitly out of scope, and pinned so it cannot drift in by accident.
        // Dropping a blocked member's messages from a group leaves holes in every
        // OTHER member's view of the thread — it leaks the block to bystanders.
        // Group moderation is a separate authority.
        await withBlock(h.userAId, h.userBId, async () => {
          const sent = await h.providerB.sendMessage(h.ctxB, {
            conversationId: h.groupConversationId,
            ...PAYLOAD,
          });
          expect(sent.sender_id).toBe(h.userBId);
        });
      });
    });
  });
}
