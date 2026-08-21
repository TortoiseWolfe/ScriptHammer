# Messaging Authorization Contract

The canonical catalogue of the messaging authorization rules the two backends must
both enforce (#266 / #265 / #280). This is the document that the provider code and
the conformance suite reference as "the contract"; earlier docblocks pointed at a
"#266 plan" that was never actually written down. This file is that plan.

## Read this first: the contract is 14 named clauses, not 30

The code historically referred to the contract as **"C1–C29."** That was an
**aspirational banner, not a populated 29-item list.** Only **14 clause numbers have
ever had canonical rule text**:

> **C1, C2, C3, C5, C7, C8, C9, C10, C11, C12, C13, C14, C29, C30.**

**C30 is new (#352)** and deliberately took the next unused number above the highest
one in use rather than filling the C4/C6 gaps. Those gaps may look like free slots,
but a number that never carried rule text still reads to a future maintainer as one
that used to — reusing it would invent a history the clause does not have.

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

| Clause      | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Enforced at                                                                                                                                                                                                                                                                                                                                                                                                                     | Provider method / .NET endpoint                                        | Asserted?    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------ |
| **C1**      | Only participants (1:1) or **active members** (group) may read a conversation's metadata.                                                                                                                                                                                                                                                                                                                                                                                                                                            | RLS `conversations` SELECT — 1:1 `"Users can view own conversations" ON conversations`, group `"Members can view group conversations" ON conversations`                                                                                                                                                                                                                                                                         | `getConversationMeta` / `GET /conversations/{id}`                      | ✅           |
| **C2**      | The C1 membership rule applied specifically to **group** conversations (member vs. outsider).                                                                                                                                                                                                                                                                                                                                                                                                                                        | RLS group policies `"Members can view group conversations" ON conversations`, `"Users can create group conversations" ON conversations`                                                                                                                                                                                                                                                                                         | via `getConversationMeta` + `getMessages`                              | ✅           |
| **C3**      | An **accepted `user_connections` row is required to create a 1:1 conversation** — in EITHER direction (`unique_connection` is `(requester_id, addressee_id)` and is not symmetric). Finding an EXISTING conversation is participant-scoped and connection-independent (C1).                                                                                                                                                                                                                                                          | RLS `conversations` INSERT `"Users can create conversations with connections" ON conversations`; .NET `MessagingQueries.HasAcceptedConnection` + `ConversationsController.Create`                                                                                                                                                                                                                                               | `getOrCreateConversation` / `POST /api/messaging/conversations`        | ✅           |
| **C4**      | _Undefined — no canonical rule text._                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | —                                                                                                                                                                                                                                                                                                                                                                                                                               | —                                                                      | —            |
| **C5**      | Per-user **archive** flag; participants only; flips only the caller's `archived_by_participant_N`, leaves the other view untouched.                                                                                                                                                                                                                                                                                                                                                                                                  | RLS `conversations` UPDATE `"Users can update own conversation archive status" ON conversations`                                                                                                                                                                                                                                                                                                                                | `archive`/`unarchiveConversation` / `POST /conversations/{id}/archive` | ✅           |
| **C6**      | _Undefined — no canonical rule text._                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | —                                                                                                                                                                                                                                                                                                                                                                                                                               | —                                                                      | —            |
| **C7**      | Membership/participant-scoped **read** of messages (list, by-id, pagination). Outsider gets zero rows / null.                                                                                                                                                                                                                                                                                                                                                                                                                        | RLS `messages` SELECT `"Users can view messages in own conversations" ON messages` — the LATER, group-aware definition; the migration creates a 1:1-only one first and drops it                                                                                                                                                                                                                                                 | `getMessages` / `getMessageById` / GET endpoints                       | ✅           |
| **C8**      | On send, **sender must be the caller AND an active participant/member.**                                                                                                                                                                                                                                                                                                                                                                                                                                                             | RLS `messages` INSERT `"Users can send messages to own conversations" ON messages` — likewise the LATER definition; the earlier 1:1-only one never survives the migration                                                                                                                                                                                                                                                       | `sendMessage` / `POST /conversations/{id}/messages`                    | ✅           |
| **C9**      | Edit is **sender-only** (`USING sender_id = auth.uid()`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | RLS `messages` UPDATE `"Users can edit own messages" ON messages` (its `USING`)                                                                                                                                                                                                                                                                                                                                                 | `editMessage` / `PATCH /messages/{id}`                                 | ✅           |
| **C10**     | Edit allowed **only within 15 minutes** of `created_at` (a WITH-CHECK post-condition — a stale-but-owned edit at T+20 must be rejected).                                                                                                                                                                                                                                                                                                                                                                                             | `"Users can edit own messages" ON messages` — its `WITH CHECK`, carrying `created_at > now() - INTERVAL '15 minutes'`. Same policy as C9, not a second one                                                                                                                                                                                                                                                                      | `editMessage` (.NET re-checks the window)                              | ✅           |
| **C11**     | Mark-read: any conversation participant may set read state; **only `read_at` is mutated** (never ciphertext — the #281 column-guard class); non-participants cannot; a sender self-mark is allowed (benign); idempotent.                                                                                                                                                                                                                                                                                                             | `"Recipients can mark messages as read" ON messages` + `trigger before_message_update_column_guard`, which runs `enforce_message_update_columns()`                                                                                                                                                                                                                                                                              | `markAsRead` / `POST /messages/read`                                   | ✅           |
| **C12**     | **Soft-delete only** — messages are never physically removed (`FOR DELETE USING (false)`); delete sets `deleted = true`.                                                                                                                                                                                                                                                                                                                                                                                                             | `"Users cannot delete messages" ON messages`                                                                                                                                                                                                                                                                                                                                                                                    | `deleteMessage` / `POST /messages/{id}/delete`                         | ✅           |
| **C13**     | **Gap-free, per-conversation monotonic `sequence_number` under concurrency** (`pg_advisory_xact_lock` in `assign_sequence_number()`, so a second insert into the same conversation BLOCKS rather than colliding — the #244 fix). No longer Supabase-only: the .NET side ships its own copy for the clean-room database, and a drift test pins the two together.                                                                                                                                                                      | `assign_sequence_number()` + `trigger before_message_insert`, and `dotnet-messaging/db/c13-sequence-assignment.sql` for a database Supabase did not provision. Applied by whoever provisions it, NOT at app startup — that would need rights #321 deliberately took away from `dotnet_app`. Proven on a schema with no trigger by `tests/rls/dotnet-sequence-assignment.test.ts`, which demonstrates the 23505 collision first. | `sendMessage`                                                          | ✅           |
| **C14**     | **NULL-tolerant idempotency** via `clientGeneratedId` for offline-queue replay (unique index; NULLs stay distinct so many live sends coexist).                                                                                                                                                                                                                                                                                                                                                                                       | `index uniq_messages_client_generated_id`                                                                                                                                                                                                                                                                                                                                                                                       | `sendMessage` (both providers pass the key)                            | ✅           |
| **C15–C28** | _Undefined — no canonical rule text for any of these 14 numbers._                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | —                                                                                                                                                                                                                                                                                                                                                                                                                               | —                                                                      | —            |
| **C29**     | Realtime never surfaces an **un-SELECTable row**: the change signal is only a refetch trigger; consumers re-read through the authorization-scoped methods, so a notification can never leak a row the subscriber couldn't independently read.                                                                                                                                                                                                                                                                                        | `MessagingRealtimeProvider` in `src/services/messaging/providers/types.ts`                                                                                                                                                                                                                                                                                                                                                      | `realtime.subscribe` (both providers)                                  | ✅ (this PR) |
| **C30**     | A **block** stops future contact in an **existing** conversation. Creating a conversation requires an accepted connection (C3); sending used to require only participation, so a user blocked _after_ the thread existed kept messaging the person who blocked them. Refusal is **generic** (never names the block), **symmetric** (both participants are refused, so the two directions look alike), and checks **both orderings** of `unique_connection`, which is not symmetric. History stays readable; groups are out of scope. | RLS `messages` INSERT `WITH_CHECK` (1:1 branch) + `MessagingQueries.IsBlockedBetween` called from `ConversationsController.Send`                                                                                                                                                                                                                                                                                                | `sendMessage` / `POST /api/messaging/conversations/{id}/messages`      | ✅ (#352)    |

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

## C3 and the two things a conformance case must prove

C3 was the first clause moved into the seam (#265), and doing it surfaced two things worth
recording, because they generalise to every remaining backlog item.

**1. The seam method is `getOrCreateConversation`, not `createConversation`.** The backlog
bullet used to say `createConversation`. That name predated anyone reading the call site:
the real production operation — `connectionService.getOrCreateConversation()`, driving the
"message this user" button in `MessagesSidebar` — is find-or-create. The seam is named for
what the app actually does, for two reasons. An interface method with no production caller
is a test-only method in production clothing. And the `unique_conversation` race (two users
tapping "message" at once) has to be resolved atomically INSIDE each backend; split lookup
from create and every caller re-implements a 23505 retry, with the two backends' retries
free to drift — the exact failure this suite exists to catch.

**Ordering note:** the providers look up an existing conversation BEFORE checking the
connection, which is a deliberate change from the pre-seam code. It mirrors RLS: the INSERT
policy (`:1847`) is connection-gated, the SELECT policy (`:1843`) is not. A pair who
connected, talked, then disconnected keeps reaching their existing thread — which their
conversation list already shows them — while creating a NEW one still requires a live
accepted connection.

**2. A row-state assertion alone cannot prove the .NET server enforces anything.** The
negative cases follow the suite's usual idiom (swallow the throw, assert the database row).
That proves the security property — no conversation was created — but it is blind to WHO
blocked it. The .NET server currently talks to the same RLS-protected Postgres as Supabase,
so **a mutation test that stubbed `HasAcceptedConnection` to always return `true` left all
25 .NET cases green**: RLS rejected the INSERT with 42501, the `RlsActorMiddleware`
transaction aborted, the request 500'd, the provider threw anyway, and no row appeared.
Every assertion held while the explicit rule was gone.

That masking defeats the premise of the migration — the whole reason for a .NET provider is
that each rule is re-expressed EXPLICITLY, because the next backend may have no RLS beneath
it. So `ConformanceConfig` grew an optional `assertRefusal(error, kind)` hook: the shared
cases assert the provider-agnostic property, and a backend may additionally pin the SHAPE of
its refusal. The .NET runner requires a 403 (authorization) or 400 (invalid input) from its
own check and **never a 5xx**; re-running the same mutation now fails with
`Expected "403" / Received "…failed: 500 Internal Server Error"`. Supabase supplies no hook —
there, RLS _is_ the enforcement mechanism.

**Apply this to every remaining backlog item:** when porting a rule into the seam, ask
whether the conformance case would still pass if the .NET implementation of the rule were
deleted. If yes, the case is measuring Postgres, not the server.

## C30 and the three things a block has to get right

C30 (#352) is the newest clause and the one most likely to be re-broken, because each of
its three properties is easy to drop without any test noticing.

**1. It is checked on the INSERT, not on conversation creation.** C3 already gates
_creating_ a 1:1 conversation on an accepted connection, and that made the send path look
covered. It was not: sending was gated on participation alone, so the ordinary sequence —
talk to someone, then block them — left the block completely inert. Across all nine
`messages` policies the word `blocked` appeared nowhere; it existed only in the `status`
CHECK constraint and an admin count. **A block is not a disconnect.** Sending into an
existing thread is deliberately connection-_independent_ (an ordinary disconnect leaves
the thread usable), so `IsBlockedBetween` is asked as its own question rather than being
derived from `HasAcceptedConnection`.

**2. Both orderings, because `unique_connection` is not symmetric.** The constraint is
`UNIQUE (requester_id, addressee_id)`, so a block between two people is exactly **one**
row, and which way it points depends on who pressed the button — not on the conversation's
participant ordering. A rule that checks only `(participant_1 = requester)` enforces
roughly half of real blocks and reports nothing about the other half. This is verified by
mutation: with the one-sided form installed, the
`(participant_2 → participant_1)` case in `tests/rls/blocked-cannot-send.test.ts` is the
**only** test that fails.

**3. The refusal is generic and symmetric.** It never names blocking, and the blocker is
refused too. The second half is not courtesy — it closes an oracle. If the blocked user
were refused while the blocker could still send, that difference is itself the disclosure
to anyone able to compare the two directions. Both backends refuse with **403**; the
conformance case asserts provider-agnostically that the message does not contain the word.

**A note on where the RLS rule can silently die.** The check is a subquery over
`user_connections` inside a `messages` policy, and policy expressions run as the calling
user — so `user_connections`' own RLS applies to it. Today its SELECT policy is
`auth.uid() = requester_id OR auth.uid() = addressee_id`, which covers both participants,
so the row is visible and the rule bites. Narrow that policy and `NOT EXISTS` finds
nothing, evaluates true, and blocking stops being enforced with **no error anywhere**.
That dependency is asserted directly, as its own case, rather than assumed.

Per the C3 note above, the .NET check is verified the same way: with the RLS block rule
removed, the .NET conformance run must **still** return 403.

## Deferred backlog — the real seam-expansion work

Everything below is authorization that **exists and is enforced today for the
direct-to-Supabase path**, but is **not yet behind the `MessagingDataProvider` seam and not
implemented on the .NET server** (`types.ts` — "group management, key rotation and GDPR keep
calling Supabase directly until their own slices land"). This — not inventing C15–C28 — is how
conformance coverage genuinely broadens for #280. Each is its own increment (interface
method + both providers + .NET endpoint + conformance case):

- **Group management.** `createGroup`, `addMembers`, `removeMember`, `leaveGroup`,
  `transferOwnership`, `renameGroup` live only in `src/services/messaging/group-service.ts`.
  Backing RLS: `conversation_members` INSERT `:2649` (creator-or-member — the #34
  self-insert-escalation fix), UPDATE `:2657`, DELETE blocked (`:2665`, soft-leave via
  `left_at`), owner-reassign trigger `reassign_group_owner_on_member_removal` `:2438`.
- **Key rotation.** Conversation key-version lifecycle — direct Supabase.
- **GDPR export / delete.** Account data export and erasure paths — direct Supabase.

When one of these is ported into the seam, add its clause row above (with real rule text
and a conformance case) — that is the only sanctioned way this contract grows.

## The Source column cites names, not line numbers (#892)

**Do not "helpfully" add `:NNNN` line references back.** They were removed because every
single one had rotted: on 2026-08-21 all twelve clause citations pointed at the wrong line
and two pointed at blank lines, including C13's, whose target was 537 lines away.

That was structural rather than careless. The migration is deliberately monolithic and
append-only (CLAUDE.md: _"NEVER create separate migration files"_), so it only grows — any
insertion shifts every citation below it, and nothing ever compared a citation to its
target. Names cannot rot that way, and `scripts/__tests__/contract-citations.test.js`
resolves every cited name against the migration on each run of the required `Test (20.x)`
check, so a rename fails CI instead of quietly misleading the next reader.

Write citations in the forms that test understands: `` `"Policy name" ON table` ``,
`` `function_name()` ``, `` `trigger trigger_name` ``, `` `index index_name` ``.

**One trap worth knowing while reading the migration itself.** Two policies on `messages` —
`"Users can view messages in own conversations"` and `"Users can send messages to own
conversations"` — are each defined **twice**: first 1:1-only, then dropped and recreated
several hundred lines later with group support. Only the later definition ever exists at
runtime. The earlier one reads as authoritative and is not.

## Maintenance

- The conformance suite is the executable form of this table. If you change a rule, change
  the suite **and** this doc in the same PR.
- Never add a clause number without canonical rule text and (where seam-testable) a
  conformance case. No placeholder numbers.
