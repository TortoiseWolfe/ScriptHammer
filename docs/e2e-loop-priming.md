# E2E Fix Loop — Priming Prompt

> **When to use this**: paste into `/loop 20m` (or `/loop 15m` for faster cycles) when the E2E
> test suite is broken on CI. This prompt encapsulates the current architectural state, the
> real open issues, what has been tried and why it failed, and the rules for not regressing.
>
> **Current state (2026-04-19)**: NOT green. Latest run `24624967629` on commit `4b003d5`
> finished with conclusion=failure. Zero rate-limit / lockout errors (big win from
> commit `1477816` pre-auth User B refactor), but 3 hard-fail categories remain. This doc
> is honest about what's still broken — do not treat anything below as "stable baseline."

---

```
Fix ScriptHammer E2E tests. The goal is every shard passing with 0 hard-failures and 0 flakies.
"Flaky" means the test failed once then passed on retry; it counts as failing.

================================================================================
CURRENT OPEN ISSUES (run 24624967629, commit 4b003d5)
================================================================================

ISSUE 1 — payment-isolation.spec.ts storageState hydration unreliable
  Shards: chromium-gen 4/6, firefox-gen 4/6, webkit-gen 4/6
  Failing tests: :44 "User A and User B have isolated payment sessions"
                 :113 "Payment history shows only own payments"
                 :184 "Payment buttons require GDPR consent" (webkit only)
                 :216 "Payment intent includes correct user association" (webkit only)
  Symptom: "Logged in as: - User ID:" empty, Sign In link in nav. AuthContext
           never populates `user` from storageState. On chromium/firefox the
           initial hydration wait passes briefly, then user becomes null by
           the time Step 4 assertion runs. On webkit the wait never passes
           at all (30s timeout).
  What was tried: commit 4b003d5 added
    await expect(page.locator('text=/Logged in as.*User ID:\\s*[a-f0-9-]{36}/i'))
      .toBeVisible({ timeout: 30000 });
  before handlePaymentConsent. Did NOT fix it. Pattern suggests the async
  getSession() hydration is racing with consent flow, or the manually-created
  browser.newContext({ storageState: '...auth.json' }) doesn't reliably
  hydrate the way { page } fixture with project-level storageState does.
  Next steps to try:
    - Revert just these 5 tests back to live performSignIn (they worked that
      way before; would increase lockout pressure but once the Supabase
      dashboard exemption is in place it doesn't matter)
    - Or: after the goto, explicitly page.reload() and wait for user to
      hydrate — so the Supabase JS client runs its getSession() twice
    - Or: call page.evaluate to manually trigger a session refresh before
      consent. The E2E storage adapter in src/lib/supabase/client.ts may
      be relevant.

ISSUE 2 — firefox-msg 1/1 Cloudflare Bot Management on realtime WebSocket
  Shard: firefox-msg 1/1
  Symptom: repeated "Cookie __cf_bm has been rejected for invalid domain"
           console errors on the /realtime/v1/websocket URL, causing
           the messaging tests to never receive realtime events.
  This is INFRASTRUCTURE, not code. __cf_bm is Cloudflare's bot cookie.
  Firefox rejects it because the Supabase realtime endpoint sets it with a
  domain scope Firefox considers invalid. Not reproducible on chromium or
  webkit. Options:
    - Disable Cloudflare Bot Management for the Supabase project's realtime
      endpoint (Supabase dashboard, if possible)
    - Route firefox realtime through the reload-fallback path and skip the
      websocket assertions
    - Accept firefox-msg as occasionally flaky on this one test

ISSUE 3 — webkit cascade failures when one webkit shard fails
  When webkit-gen 4/6 hard-fails (usually from ISSUE 1), later webkit
  shards can get cancelled with "No files were found with the provided
  path: blob-report/". This is workflow-level, not test-level. The
  cancelled shards didn't actually run, so we have no data on what
  would have happened. Once ISSUE 1 is resolved, this should disappear.

ISSUE 4 — ACTION REQUIRED ON USER'S END: Supabase rate-limit exemption
  docs/testing/CI-SETUP.md documents the step. Supabase Dashboard →
  Project Settings → Authentication → Rate Limits → add the 3 test
  user emails to the allowlist (or raise sign-in threshold to ≥100).
  Without this, the ~15 remaining legitimate performSignIn calls in
  auth/ tests can still trigger GoTrue's 5-per-4-min lockout on repeat
  CI runs. No code fix can cover this.

================================================================================
ARCHITECTURE (as of commit 4b003d5)
================================================================================

CI matrix — 21 shards total:
- Chromium (7): 1 msg (shard 1/1, was 1/2+2/2), 6 gen
- Firefox  (7): 1 msg, 6 gen
- WebKit   (7): 1 msg, 6 gen
- max-parallel: 3 per browser job (prevents Supabase rate limits)
- Browsers serialized via needs: chain (e2e → e2e-firefox → e2e-webkit)

Auth fixtures (produced by auth.setup.ts):
- storage-state-auth.json   — TEST_USER_PRIMARY (User A, USER_A)
- storage-state-auth-b.json — TEST_USER_TERTIARY (User B)
Both uploaded as the `auth-state` artifact, downloaded per shard into
tests/e2e/fixtures/.

Tests that do live performSignIn (down from ~30 to 15):
- tests/e2e/auth/session-persistence.spec.ts — 8 sites (tests Remember Me,
  expiry, refresh — MUST be live, verifies sign-in behavior itself)
- tests/e2e/auth/protected-routes.spec.ts — 3 sites (tests redirect flows)
- tests/e2e/security/payment-isolation.spec.ts — 1 site (":154" test
  verifies UNauthenticated flow, needs to start empty)
- tests/e2e/messaging/message-editing.spec.ts — 1 site (fallback re-sign-in
  only fires on auth-lost detection, not per-test)
- Others removed in commit 1477816 — those tests now load storageState directly

Tests that use storageState via browser.newContext (refactored in 1477816):
- encrypted-messaging.spec.ts (2 sites)
- friend-requests.spec.ts (6 sites)
- real-time-delivery.spec.ts (signIn helper removed)
- payment-isolation.spec.ts (4 sites) — CURRENTLY FAILING, see ISSUE 1

================================================================================
ROUND HISTORY — DO NOT RE-TRY THESE DEAD ENDS
================================================================================

Round 1-2: retry loops, cache route intercepts, SW registration blocks,
           cross-shard created_at filters — legit fixes for specific flakes,
           still in place and valuable
Round 3-5: describe timeout bumps (some to 900s), retry budget expansions —
           band-aids over the real issue (auth lockouts)
Round 6-7: ProtectedRoute reload fallback, msg sharding 2→1 — good
Round 8-9: more timeout bumps, more retry expansions — still band-aids
Round 10:  max-parallel: 3 — helped chromium, didn't help webkit
Round 11:  pre-auth User B, halve live performSignIn — FIXED lockouts
           definitively, commit 1477816
Round 12:  hydration wait for payment-isolation refactor — did NOT work,
           commit 4b003d5 — this is where we stopped

What we have NOT tried:
- Reverting just the payment-isolation.spec.ts refactor (keep User B fixture
  + other spec refactors, revert that one file)
- Digging into why storageState context hydration differs from project-
  level storageState. The { page } fixture path works; browser.newContext()
  with explicit storageState does not reliably hydrate on webkit.
- Adding an explicit page.reload() after the first goto to give Supabase
  JS client a second chance to read localStorage and hydrate.

================================================================================
METHODOLOGY (follow strictly, NO guessing)
================================================================================

1. PULL LATEST RUN:
   gh run list --limit 1 --workflow "E2E Tests" --json databaseId,status,conclusion,headSha
   If in_progress → ScheduleWakeup for 20-30 min. NEVER poll tighter than 5 min.
   If completed → fetch per-shard logs.

2. COLLECT LOGS:
   mkdir -p /tmp/run-logs
   for id in $(gh run view <RUN_ID> --json jobs -q '.jobs[] | select(.name|startswith("E2E")) | .databaseId'); do
     curl -sS -L -H "Authorization: token $(gh auth token)" \
       "https://api.github.com/repos/TortoiseWolfe/ScriptHammer/actions/jobs/$id/logs" \
       -o /tmp/run-logs/job-$id.log
   done

3. CATEGORIZE FAILURES BY PATTERN, NOT BY TEST NAME:
   - "Too many failed attempts" → ISSUE 4, need dashboard exemption
   - "Cookie __cf_bm rejected" → ISSUE 2, firefox Cloudflare, infra
   - "Logged in as: - User ID:" empty + "Sign In" link visible → ISSUE 1,
     storageState hydration race
   - page.goto timeout on webkit-gen after another webkit failure → ISSUE 3,
     cascade, ignore until upstream is fixed

4. IF ALL FAILURES ARE KNOWN ISSUES AND NOTHING NEW:
   Don't patch. Report status to user. Stop.

5. IF NEW PATTERN APPEARS:
   Dig in — fetch the error-context markdown from the blob-report, inspect
   the page state at failure, identify root cause. Then patch.

6. VERIFY BEFORE COMMITTING:
   docker compose exec scripthammer pnpm run type-check
   docker compose exec scripthammer pnpm run lint
   Commit via Docker. Push from host.

================================================================================
RULES (non-negotiable)
================================================================================

- NEVER skip or ignore tests. Flaky counts as failing.
- NEVER bump timeouts to cover a real bug. Only when infrastructure latency
  is actually the bottleneck (e.g. Supabase free-tier realtime tail latency
  on ResponsiveMessaging tests is real — see round 4-5 commits).
- NEVER guess. Read the error-context.md from the blob-report. If user is
  showing as null, check storageState contents by downloading the auth-state
  artifact and decoding the JWT.
- If the same fix doesn't work twice, DIAGNOSIS IS WRONG. Stop and
  re-investigate.
- ZERO REGRESSIONS. If a commit breaks previously-passing shards, revert
  before iterating further.
- Do NOT re-add PKCS#8 key derivation. Firefox and webkit reject it. JWK
  via noble-curves is the only cross-browser path.
- Do NOT attempt max-parallel: 1 or serializing all shards — the problem
  isn't raw concurrency, it's cumulative per-account sign-in attempts.
  The fix for that was pre-auth + dashboard exemption, not serialization.
- Every manual browser.newContext() for multi-user tests takes explicit
  storageState. NEVER pass { cookies: [], origins: [] } for a user that
  has a pre-auth fixture available.

================================================================================
KEY FILES
================================================================================

CI:
- .github/workflows/e2e.yml — 3-browser matrix, max-parallel: 3, uploads both
  storage-state-auth*.json as the auth-state artifact

Auth setup:
- tests/e2e/auth.setup.ts — primary + User B pre-auth, produces 2 JSON fixtures

Helpers:
- tests/e2e/utils/test-user-factory.ts — performSignIn, handleReAuthModal
  (90s modal timeout), signOutViaDropdown (reload fallback for post-sign-out
  hydration), dismissCookieBanner

Test fixtures:
- tests/e2e/fixtures/storage-state-auth.json   — USER_A
- tests/e2e/fixtures/storage-state-auth-b.json — USER_B / TERTIARY

Refactored multi-user specs (using storageState contexts):
- tests/e2e/messaging/encrypted-messaging.spec.ts
- tests/e2e/messaging/friend-requests.spec.ts
- tests/e2e/messaging/real-time-delivery.spec.ts
- tests/e2e/security/payment-isolation.spec.ts — BROKEN, see ISSUE 1

Still-live-sign-in specs (correct, don't touch):
- tests/e2e/auth/session-persistence.spec.ts
- tests/e2e/auth/protected-routes.spec.ts

Product files that can matter:
- src/lib/supabase/client.ts — autoRefreshToken:false + E2E storage adapter
- src/contexts/AuthContext.tsx — signOut({scope:'local'}), onAuthStateChange
- src/components/auth/ProtectedRoute/ProtectedRoute.tsx — 500ms debounce
  on auth-flip redirects, reload fallback
- src/hooks/usePaymentButton.ts — useEffect with proper cleanup (not
  useState initializer leak)
- src/hooks/usePaymentConsent.ts — ready flag so consent warning doesn't
  flash before SSR hydration

Documentation:
- docs/testing/CI-SETUP.md — Supabase dashboard rate-limit exemption step
  (required one-time user action)
- docs/testing/KNOWN-TEST-ISSUES.md — list of flaky tests and status
```
