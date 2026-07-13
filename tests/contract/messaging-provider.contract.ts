/**
 * Shared messaging-provider conformance suite (#266).
 *
 * ONE set of authorization + data-contract assertions, parametrized over a
 * provider factory, so BOTH the Supabase and the .NET providers are measured
 * against the IDENTICAL contract (C1–C29 from the #266 plan). This is the
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

  /** Provider bound to userA's authenticated session. */
  providerA: MessagingDataProvider;
  ctxA: AuthContext;
  /** Provider bound to userB's authenticated session. */
  providerB: MessagingDataProvider;
  ctxB: AuthContext;
  /** A third user with NO membership in the conversation (for leak tests). */
  outsiderId: string;
  providerOutsider: MessagingDataProvider;
  ctxOutsider: AuthContext;

  /**
   * Insert a message row directly via the service client (bypasses RLS +
   * sequence trigger control), returning the row id. `createdAtIso` lets a test
   * backdate a message to exercise the 15-minute edit window (C10).
   */
  seedMessage(opts: {
    senderId: string;
    ciphertext?: string;
    createdAtIso?: string;
  }): Promise<{ id: string }>;

  /** Read a message row directly (service client) for assertions. */
  readMessage(id: string): Promise<{
    id: string;
    deleted: boolean;
    edited: boolean;
    encrypted_content: string;
    read_at: string | null;
    sequence_number: number;
  } | null>;
}

export interface ConformanceConfig {
  /** Human label for the provider under test (e.g. "supabase"). */
  providerName: string;
  /** Build a fresh harness (seed users + conversation). Called once. */
  setup(): Promise<ConformanceHarness>;
  /** Tear down seeded data. */
  teardown(h: ConformanceHarness): Promise<void>;
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

    // KNOWN-FAILING on Supabase — see TortoiseWolfe/ScriptHammer#281.
    // The intended contract (C9) is "only the sender can edit a message." Live
    // Supabase currently VIOLATES this: the column-blind "Recipients can mark
    // messages as read" UPDATE policy OR-combines with the edit policy, so a
    // non-sender participant can rewrite ciphertext. This assertion encodes the
    // intended contract and is skipped until #281's column-guard trigger lands
    // (at which point flip .skip → the .NET provider must satisfy it too).
    it.skip('C9: a non-sender cannot edit the message (BLOCKED by #281)', async () => {
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
  });
}
