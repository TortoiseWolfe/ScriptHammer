# E2E Fix Loop — Priming Prompt

> **When to use this**: paste into `/loop 20m` (or `/loop 15m` for faster cycles) when the E2E
> test suite is flaky or broken across shards. This prompt encapsulates the debugging methodology,
> architecture context, previously-fixed root causes, and key files that took multiple sessions to
> discover. Starting from scratch without this context tends to rediscover the same dead ends.
>
> **Current baseline (2026-04-08)**: 24/24 shards green on `main` (run 24113858375). When the loop
> is needed, it means something regressed that needs debugging against this baseline.
>
> **Historical session**: commits `73cb860..a22a6d6` document the debugging chain that produced
> the priming content below. Six iterations on three root causes — the methodology below was
> forged during that session.

---

```
Fix ScriptHammer E2E tests until ALL 24 shards pass on every push.
Cross-browser: chromium → firefox → webkit, sequential, 8 shards each.

ARCHITECTURE:
- Sequential job chain: e2e (chromium) → e2e-firefox → e2e-webkit
  Each job has its own 8-shard matrix. needs: dependency serializes them.
  Result: Supabase free tier only ever sees 8 concurrent shards (proven stable).
- Each browser has 2 Playwright projects: {browser}-msg (12 messaging files
  in 2 shards) and {browser}-gen (47 general files in 6 shards) = 8 shards.
- CI auth-setup job runs ONCE with chromium → uploads storageState artifact.
  Shard runs use --no-deps to skip the 'setup' Playwright project (would
  re-launch chromium on firefox/webkit shards and fail).
- AUTH_SETUP_JOB env var distinguishes the cleanup job from per-shard sign-ins.
- All messaging tests navigate via ?conversation=<id> URL (sidebar query
  takes 3+ min on Supabase free tier under concurrent load).

CURRENT STATUS (2026-04-07):
- chromium 8/8 ✅ stable
- firefox 8/8 ✅ stable as of latest fixes (PKCS#8→JWK, isMobile destructure)
- webkit 6-8/8 — gen all 6 pass; msg shards intermittent on
  cross-page-navigation, real-time-delivery, T148/T149
- Target: 24/24 GREEN consistently

METHODOLOGY (follow strictly, NO guessing):

1. PULL LOGS:
   gh run list --limit 1 --workflow e2e.yml
   If in_progress → report which shards are done and which are running, wait.
   If completed → gh run view <ID> 2>&1 | grep -E "^(✓|X)" | grep "E2E "
   Report tally: chromium X/8, firefox X/8, webkit X/8 = N/24
   If 24/24 green → DONE, celebrate, cancel loop with CronDelete.

2. GET FAILURE DETAILS (for each failing shard):
   gh api repos/TortoiseWolfe/ScriptHammer/actions/jobs/<JOB_ID>/logs 2>&1 | grep -P "  \d+\) \[" | head -8
   gh api repos/TortoiseWolfe/ScriptHammer/actions/jobs/<JOB_ID>/logs 2>&1 | grep -E "(passed|failed|flaky)" | tail -3
   gh api repos/TortoiseWolfe/ScriptHammer/actions/jobs/<JOB_ID>/logs 2>&1 | grep -B 1 -A 12 "<TEST_FILE>:<LINE>" | head -25

3. CHECK BROWSER CONSOLE on send failures:
   gh api repos/TortoiseWolfe/ScriptHammer/actions/jobs/<JOB_ID>/logs 2>&1 | grep -E "ConversationView|sendMessage|deriveKeys|deriveKey"
   "message sent, appending optimistic" = success
   "Failed to initialize/derive encryption keys" = browser-specific crypto issue
   "Failed to fetch" / "Load failed" = network failure (need retry in message-service)
   "must be signed in" = auth context not hydrated (needs getSession() retry, not getUser())

4. ROOT CAUSES ALREADY FIXED (do NOT re-investigate):
   a. Concurrent nuclear cleanup → AUTH_SETUP_JOB guard
   b. Shared refresh token → per-shard sign-in
   c. signOut scope:'global' → scope:'local'
   d. EncryptionKeyGate deadlock → setCheckingKeys(false) on null user
   e. Sidebar query timeout → ?conversation=<id> URL navigation
   f. ECDH key mismatch → resetEncryptionKeys() after sign-in
   g. Service workers intercepting → serviceWorkers:'block'
   h. Auto-refresh session wipe → autoRefreshToken:false + E2E storage adapter
   i. Stale shared secret cache → invalidate on CryptoKey ref change
   j. T148 GET intercept → POST-only route filter
   k. PKCS#8 import in firefox/webkit → always use JWK with noble-curves
   l. .single() returning 406 on 0 rows → .maybeSingle() across messaging code
   m. getUser() server round-trip during refresh → getSession() with 3-retry pattern
   n. Argon2id WebCrypto starvation → ReAuth modal timeout 30s→90s
   o. Cross-browser load saturation → 3 sequential jobs (chromium/firefox/webkit)
   p. devices['iPhone 12'] isMobile not in Firefox → destructure isMobile
   q. Hand-rolled PKCS#8 missing public key → switch to JWK + p256.getPublicKey
   r. Supabase JS doesn't throw on Failed to fetch → check insertError.message too
   s. WebKit fetch error msg "Load failed" not detected → expanded regex
   t. Test password mismatch (USER_B with USER_A password) → param per call site
   u. Docker URL hardcoded in CI → SUPABASE_URL CI/local switch
   v. Firefox screenshot 32767px limit → fullPage:false on long blog pages
   w. Hand-rolled `host` reconstruction in page.evaluate → pass SUPABASE_URL via context
   x. waitForFunction(()=>true) is a no-op → real setTimeout-based poll loops

5. FIX (only after diagnosis):
   - Docker must be running: docker compose exec scripthammer echo alive
   - Type check: docker compose exec scripthammer pnpm run type-check
   - Unit test: docker compose exec scripthammer pnpm test -- --run
   - Commit via Docker with descriptive message explaining the ROOT CAUSE
   - Push and verify new CI run starts

6. KEY FILES:
   - .github/workflows/e2e.yml — 3 sequential jobs (e2e/e2e-firefox/e2e-webkit),
     8 shards each, --no-deps, AUTH_SETUP_JOB=true on auth step
   - playwright.config.ts — 6 projects (chromium-msg/gen, firefox-msg/gen,
     webkit-msg/gen), dependencies:['setup'], serviceWorkers:'block'
   - tests/e2e/auth.setup.ts — shouldDoFullSetup guard, key injection
   - tests/e2e/utils/test-user-factory.ts — handleReAuthModal (90s modal timeout),
     resetEncryptionKeys, performSignIn
   - src/lib/messaging/key-derivation.ts — JWK-only path with noble-curves
     (do NOT add PKCS#8 back, breaks firefox/webkit)
   - src/services/messaging/connection-service.ts — getAuthenticatedUser helper
     using getSession() with 3 retries
   - src/services/messaging/message-service.ts — sendMessage with network retry
     on Failed to fetch / Load failed / NetworkError / cancelled / aborted
   - src/services/messaging/offline-queue-service.ts — getSession retry pattern
   - src/services/messaging/gdpr-service.ts — getSession retry pattern
   - src/components/organisms/ConversationView/ConversationView.tsx — getSession retry
   - src/hooks/useTypingIndicator.ts — getSession retry
   - src/hooks/useGroupMembers.ts — getSession retry
   - src/hooks/useConversationRealtime.ts — getSession retry, .maybeSingle
   - src/contexts/AuthContext.tsx — signOut({ scope: 'local' })
   - src/lib/supabase/client.ts — autoRefreshToken:false + E2E storage adapter
   - tests/e2e/payment/04-gdpr-consent.spec.ts — auth retry loop on /payment-demo
   - tests/e2e/payment/01-stripe-onetime.spec.ts — same retry loop
   - tests/e2e/auth/session-persistence.spec.ts — 60s describe-level timeout
   - tests/e2e/messaging/offline-queue.spec.ts — auth two-step navigation,
     T148 regex route filter, T149 real setTimeout poll loop
   - tests/e2e/messaging/message-delete-placeholder.spec.ts — per-user password,
     SUPABASE_URL passed into page.evaluate
   - tests/e2e/messaging/friend-requests.spec.ts — 30s timeout + reload fallback
     on connection-request hidden check (webkit Realtime is slow)
   - tests/e2e/messaging/encrypted-messaging.spec.ts — 30s message visibility
   - tests/e2e/tests/blog-mobile-ux-iphone.spec.ts — destructure isMobile + dbt,
     fullPage:false screenshot
   - tests/e2e/tests/blog-mobile-ux-pixel.spec.ts — destructure isMobile + dbt
   - tests/e2e/tests/blog-touch-targets.spec.ts — destructure isMobile + dbt
   - tests/e2e/mobile-check.spec.ts — destructure isMobile + dbt

RULES:
- NEVER skip or ignore tests — skipping is not passing
- NEVER guess — read logs and code first
- NEVER increase timeouts without fixing the underlying issue (only when load is the actual issue)
- If the same fix doesn't work twice, the diagnosis is WRONG — stop and re-investigate
- Track: what failed, what the actual error was, what you changed, whether it helped
- Every multi-user test MUST call resetEncryptionKeys() after performSignIn() for non-primary users
- Every browser.newContext() for fresh-sign-in MUST use { storageState: { cookies: [], origins: [] } }
- ZERO REGRESSIONS — if a fix breaks previously-passing shards, revert immediately
- Do NOT add realtime subscriptions — they triple 406 errors and accelerate session wipe
- Do NOT add PKCS#8 back to key-derivation.ts — JWK with noble-curves is the only cross-browser path
- Compare shard pass/fail across runs. Any new failures = regression = revert
- Webkit Realtime is genuinely slower than chromium — bumping its timeouts is legitimate
- Always destructure both `defaultBrowserType` AND `isMobile` from device specs (Firefox rejects isMobile)
```
