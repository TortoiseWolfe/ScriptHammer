# Code review — 2026-09-23

Systematic review of the whole repository: six read-only agents (crypto/secrets, XSS/injection, auth/RLS/rate-limits, performance, code quality, test coverage), every load-bearing claim re-verified by reading the lines before it was filed or fixed, every fix mutation-tested before it was pushed. The full test suite ran before anything changed: **522 files, 5,984 tests, 0 failures** (Vitest) and **1,060 / 0** (`test:scripts`).

**Where things live.** Each finding that outlives this document is an issue, because the body is the finding (CLAUDE.md). This file is the index: what was looked at, what was found, what happened to it. It is not the place a reader should look for the current state of any one finding — the issue is.

## Fixed (each its own PR, each with a red test first and mutations after)

| #                 | what                                                                                                                                                                                         | PR                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| #1241             | JSON-LD script blocks stringified without escaping `<`; one `jsonForScript()` for all three inline-script sinks                                                                              | #1244 merged                                      |
| #1242             | `addMembers` / `upgradeToGroup` reached a PostgREST `.or()` filter with un-validated ids that `createGroup` guards                                                                           | #1266 merged                                      |
| #1243             | Private keys a March build wrote to `localStorage` were never swept; the cleanup was deleted with the writer                                                                                 | #1267 merged                                      |
| #1246 (code half) | Seeded admin password literal removed; seeder stops printing passwords; salt no longer logged                                                                                                | #1268 — **rotation is yours**                     |
| #1259             | Deleted the one service-role script with no target gate, which hard-deleted a real user's key history                                                                                        | #1269                                             |
| #1257             | Remote / cross-tab sign-out never cleared the device private key                                                                                                                             | #1270                                             |
| #1258             | `useOfflineStatus` leaked a `navigator.connection` listener per mount                                                                                                                        | #1271                                             |
| #1256             | Offline-queued message plaintext stayed in IndexedDB after send and past logout                                                                                                              | #1272                                             |
| #1248             | Moved the drop-everything script out of `supabase/migrations/`, deleted the deprecated seed, added a guard that keeps the directory to the one monolith                                      | #1273                                             |
| #1264 (partial)   | Deleted 3,101 lines of tests that imported no production code, a duplicate suite, and six placeholder tests; suite 5,984 → 5,827, all green                                                  | #1274 — two merges and two weak assertions remain |
| #1265 (partial)   | Deleted 20 modules and folders nothing imports, three dead exports, and a stale comment — 37 files, −7,329 lines, `tsc` clean; the Storybook-only components and the script sweep stay yours | #1275                                             |

## Filed for the owner — need a migration apply, an Edge Function deploy, a live config change, or a decision

| #                  | area                      | severity     | one line                                                                                                                                    |
| ------------------ | ------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| #1237              | rate limiter              | high         | `check_rate_limit` fails open under concurrency and keys on a caller-controlled header (found before this review)                           |
| #1245              | SECURITY DEFINER grants   | high         | anon can execute the limiter (lock any email out of sign-in), `log_auth_event`, `cleanup_old_audit_logs`, and the membership/admin oracles  |
| #1247              | group authorization       | medium       | any member can self-promote to owner; rotation after removal updates 0 rows; key rows can be planted for others; creators cannot be removed |
| #1246 (owner half) | credentials               | high if live | check `last_sign_in_at` on `admin@scripthammer.com`; rotate regardless                                                                      |
| #1250              | production auth config    | low–medium   | localhost in the redirect allow-list; OTP verify limit 100; no re-auth for password change; server min password 6                           |
| #1255              | login CSRF                | medium       | implicit-flow client consumes a session fragment on every page, not just `/auth/callback` — app-side fix proposed                           |
| #1252              | avatar_url                | low          | any URL accepted → tracking beacon; the obvious fix breaks OAuth avatars                                                                    |
| #1251              | key lifecycle             | medium       | session mode still persists the private key; group keys extractable; pair not verified; no HKDF/AAD                                         |
| #1254              | abuse limits              | low          | no cap on message size, send rate, uploads, payment intents; admin-DM forgery is by design and now documented                               |
| #1249              | migration hygiene         | low          | three tables skip REVOKE-first; definers omit `pg_temp`; schema seeds a confirmed test account                                              |
| #1253              | messaging performance     | medium       | 10 s poll instead of realtime; N+1 conversation list; unread-count query storms                                                             |
| #1262              | offline / PWA             | low–medium   | two components fight over the install prompt; SW re-installs every load; failed message loops sync                                          |
| #1260              | Edge Function duplication | low          | five `getPayPalAccessToken`, two divergent `timingSafeEqual`                                                                                |
| #1261              | shipped TODOs             | medium       | subscription retry moves no money; webhook-retry script retries nothing                                                                     |
| #1263              | test infrastructure       | —            | Deno tests nothing runs; two tests disabled by rename; a global mock where every write succeeds; coverage excludes hide tested code         |

## Refuted or downgraded on verification

- `sweep-intake-orphans` "has no auth check" — false; it compares a shared secret before any side effect.
- `create-order`, `verify-stripe-session`, and "verify_jwt=false everywhere" as exposures — all 401 before doing anything.
- F19 "default ALL grants on payment tables" — RLS with explicit deny policies covers all three; downgraded to hygiene (#1249).
- F21 "migration seeds a known account" — it is CLAUDE.md's documented E2E user; downgraded to template hygiene (#1249).
- The avatar-URL fix as first proposed ("Storage origin only") — would have broken OAuth sign-in; `MIG:4293` copies provider avatar URLs. Corrected in #1252 before filing.
- Two of my own mutation tests passed against the unchanged code (the retry test in #1240, the salt matcher in #1246 — twice). Both rewritten; both now CONTROL-tested.

## Summary

| Category      | Found | Fixed | Filed |
| ------------- | ----- | ----- | ----- |
| Security      | 31    | 5     | 10    |
| Performance   | 24    | 1     | 2     |
| Code Quality  | ~60   | 3     | 1     |
| Test Coverage | ~40   | 1     | 1     |
