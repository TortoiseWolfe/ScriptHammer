# Messaging Authorization Contract

The canonical catalogue of the messaging authorization rules the two backends must
both enforce (#266 / #265 / #280). This is the document that the provider code and
the conformance suite reference as "the contract"; earlier docblocks pointed at a
"#266 plan" that was never actually written down. This file is that plan.

## Read this first: the contract is 13 named clauses, not 29

The code historically referred to the contract as **"C1–C29."** That was an
**aspirational banner, not a populated 29-item list.** Only **13 clause numbers have
ever had canonical rule text**:

> **C1, C2, C3, C5, C7, C8, C9, C10, C11, C12, C13, C14, C29.**

**C4, C6, and C15 through C28 (16 numbers) were never authored** — no rule text exists
for them in source, tests, SQL, or docs. They are **not** a coverage gap to be filled by
inventing rules; manufacturing clauses to reach a round number would be the exact
"green tests that don't reflect reality" anti-pattern this project forbids. If the
contract genuinely needs to grow, it grows by cataloguing _real_ behaviour (see
[Deferred backlog](#deferred-backlog--the-real-seam-expansion-work)), not by numbering to 29.

The "29" was a loose gesture at "the messaging model is ~75 RLS policies + SECURITY
DEFINER helpers." The numbering was simply never completed, and there is no plan to
complete it for its own sake.

## Why a contract at all

`SupabaseMessagingProvider` enforces authorization **inside Postgres via RLS** (it reads
`auth.uid()` from the request JWT). `DotnetMessagingProvider` talks to an ASP.NET server
that has **no in-database `auth.uid()`**, so it must **re-express every rule as explicit
server-side authorization**. The shared conformance suite
(`tests/contract/messaging-provider.contract.ts`) drives **both** providers through the
**identical** assertions against a live backend — so if the .NET server ever drops a rule,
the same test that passes on Supabase goes red on .NET. That is the anti-drift alarm
across the seam.

Encryption stays **above** the provider seam: every assertion moves ciphertext only.

## The clauses

Legend — **Asserted?** = has a dedicated `it()` in the conformance suite.
Line numbers are in `supabase/migrations/20251006_complete_monolithic_setup.sql` unless noted.

| Clause      | Rule                                                                                                                                                                                                                                          | Enforced at                                                                                                                | Provider method / .NET endpoint                                        | Asserted?       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------- |
| **C1**      | Only participants (1:1) or **active members** (group) may read a conversation's metadata.                                                                                                                                                     | RLS `conversations` SELECT — 1:1 `:1843`, group `:2608`                                                                    | `getConversationMeta` / `GET /conversations/{id}`                      | ✅              |
| **C2**      | The C1 membership rule applied specifically to **group** conversations (member vs. outsider).                                                                                                                                                 | RLS group policies `:2608`, `:2627`                                                                                        | via `getConversationMeta` + `getMessages`                              | ✅              |
| **C3**      | An **accepted `user_connections` row is required to create a 1:1 conversation.**                                                                                                                                                              | RLS `conversations` INSERT `:1847`                                                                                         | _none_ — no `createConversation` in the seam; RLS-only (see backlog)   | ❌ (setup-only) |
| **C4**      | _Undefined — no canonical rule text._                                                                                                                                                                                                         | —                                                                                                                          | —                                                                      | —               |
| **C5**      | Per-user **archive** flag; participants only; flips only the caller's `archived_by_participant_N`, leaves the other view untouched.                                                                                                           | RLS `conversations` UPDATE `:1882`                                                                                         | `archive`/`unarchiveConversation` / `POST /conversations/{id}/archive` | ✅              |
| **C6**      | _Undefined — no canonical rule text._                                                                                                                                                                                                         | —                                                                                                                          | —                                                                      | —               |
| **C7**      | Membership/participant-scoped **read** of messages (list, by-id, pagination). Outsider gets zero rows / null.                                                                                                                                 | RLS `messages` SELECT — 1:1 `:1933`, group `:2699`                                                                         | `getMessages` / `getMessageById` / GET endpoints                       | ✅              |
| **C8**      | On send, **sender must be the caller AND an active participant/member.**                                                                                                                                                                      | RLS `messages` INSERT — 1:1 `:1945`, group `:2715`                                                                         | `sendMessage` / `POST /conversations/{id}/messages`                    | ✅              |
| **C9**      | Edit is **sender-only** (`USING sender_id = auth.uid()`).                                                                                                                                                                                     | RLS `messages` UPDATE `:1976`                                                                                              | `editMessage` / `PATCH /messages/{id}`                                 | ✅              |
| **C10**     | Edit allowed **only within 15 minutes** of `created_at` (a WITH-CHECK post-condition — a stale-but-owned edit at T+20 must be rejected).                                                                                                      | RLS WITH CHECK `created_at > now() - INTERVAL '15 minutes'` `:1977`                                                        | `editMessage` (.NET re-checks the window)                              | ✅              |
| **C11**     | Mark-read: any conversation participant may set read state; **only `read_at` is mutated** (never ciphertext — the #281 column-guard class); non-participants cannot; a sender self-mark is allowed (benign); idempotent.                      | RLS `:1983` + trigger `enforce_message_update_columns` `:2237`                                                             | `markAsRead` / `POST /messages/read`                                   | ✅              |
| **C12**     | **Soft-delete only** — messages are never physically removed (`FOR DELETE USING (false)`); delete sets `deleted = true`.                                                                                                                      | RLS `:2006`                                                                                                                | `deleteMessage` / `POST /messages/{id}/delete`                         | ✅              |
| **C13**     | **Gap-free, per-conversation monotonic `sequence_number` under concurrency** (Supabase: `pg_advisory_xact_lock` in `assign_sequence_number()`; a .NET port must replicate the lock or a unique-constraint + retry).                           | `assign_sequence_number()` + `before_message_insert` trigger `:2172` (fires for both backends — they write the same table) | `sendMessage`                                                          | ✅              |
| **C14**     | **NULL-tolerant idempotency** via `clientGeneratedId` for offline-queue replay (unique index; NULLs stay distinct so many live sends coexist).                                                                                                | `uniq_messages_client_generated_id` index `:1925`                                                                          | `sendMessage` (both providers pass the key)                            | ✅              |
| **C15–C28** | _Undefined — no canonical rule text for any of these 14 numbers._                                                                                                                                                                             | —                                                                                                                          | —                                                                      | —               |
| **C29**     | Realtime never surfaces an **un-SELECTable row**: the change signal is only a refetch trigger; consumers re-read through the authorization-scoped methods, so a notification can never leak a row the subscriber couldn't independently read. | `types.ts:150-157` (`MessagingRealtimeProvider`)                                                                           | `realtime.subscribe` (both providers)                                  | ✅ (this PR)    |

**Un-numbered provider operations that are also asserted:** `getProfiles` (batch
display-name/avatar lookup) and `markAsDelivered` (participant-scoped receipt, `delivered_at`
only — outsider blocked). These have conformance cases but were never assigned C-numbers;
they are part of the tested contract regardless.

## C29 and realtime — a note on the two mechanisms

The two providers satisfy C29 by **different mechanisms**, and that difference is a
deliberate design choice, not a drift:

- **Supabase** — `SupabaseRealtimeProvider` (`supabase-provider.ts:49`) opens a
  `postgres_changes` channel. Those events **do carry a row payload**, but the channel is
  **RLS-filtered**: a subscriber never receives a change for a row they couldn't SELECT.
- **.NET** — `DotnetRealtimeProvider` (`dotnet-provider.ts:66`) fires **payload-free**
  polling ticks (`setInterval`, no server push, no SignalR in v1). The consuming hook
  refetches through the authorization-scoped data methods.

Because there is no single "payload shape" both satisfy, the **conformance case asserts
the invariant that holds regardless of what realtime delivers**: subscribe as an outsider,
trigger a change, and confirm the outsider's _authorized refetch_ still returns nothing
(and any event that did arrive carries no readable row). See the `C29` case in
`tests/contract/messaging-provider.contract.ts`.

**Live realtime _delivery_ is intentionally not conformance-tested.** The conformance
stack (`.github/workflows/conformance.yml`) deliberately omits the `supabase-realtime`
container, and wall-clock waits on websocket delivery are a known flake source
(see the #300 flaky-gate work). End-to-end delivery is exercised by the Supabase **E2E**
suite, which does run the realtime container.

## Deferred backlog — the real seam-expansion work

Everything below is authorization that **exists and is enforced today for the
direct-to-Supabase path**, but is **not yet behind the `MessagingDataProvider` seam and not
implemented on the .NET server** (`types.ts:172` — "connections/groups/keys/GDPR keep
calling Supabase directly until a later slice"). This — not inventing C15–C28 — is how
conformance coverage genuinely broadens for #280. Each is its own increment (interface
method + both providers + .NET endpoint + conformance case):

- **C3 in the seam — `createConversation` (connection-gated).** The rule is defined and
  RLS-enforced (`:1847`) but there is no provider method to drive it, so it can't be
  asserted through the seam yet.
- **Group management.** `createGroup`, `addMembers`, `removeMember`, `leaveGroup`,
  `transferOwnership`, `renameGroup` live only in `src/services/messaging/group-service.ts`.
  Backing RLS: `conversation_members` INSERT `:2649` (creator-or-member — the #34
  self-insert-escalation fix), UPDATE `:2657`, DELETE blocked (`:2665`, soft-leave via
  `left_at`), owner-reassign trigger `reassign_group_owner_on_member_removal` `:2438`.
- **Key rotation.** Conversation key-version lifecycle — direct Supabase.
- **GDPR export / delete.** Account data export and erasure paths — direct Supabase.

When one of these is ported into the seam, add its clause row above (with real rule text
and a conformance case) — that is the only sanctioned way this contract grows.

## Maintenance

- The conformance suite is the executable form of this table. If you change a rule, change
  the suite **and** this doc in the same PR.
- Never add a clause number without canonical rule text and (where seam-testable) a
  conformance case. No placeholder numbers.
