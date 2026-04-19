# CI E2E Setup — Supabase Rate-Limit Exemption

## Why this is needed

The E2E matrix runs 21 shards across 3 browsers. Several tests in
`tests/e2e/auth/` verify the **sign-in flow itself** (session persistence,
Remember Me, token refresh, session expiration, cross-tab sign-out, protected
route redirects). These tests legitimately call `performSignIn(page, ...)`
against `TEST_USER_PRIMARY` (and sometimes `TEST_USER_SECONDARY` /
`TEST_USER_TERTIARY`) multiple times.

Supabase GoTrue applies **per-account brute-force protection**: after 5 failed
sign-in attempts within 4 minutes, the account is locked and further sign-ins
fail with:

```
Error: Sign-in failed: Too many failed attempts. Your account has been
temporarily locked. Please try again in 4 minutes.
```

In concurrent CI, even legitimate test sign-ins (which succeed individually)
can accumulate past the threshold — GoTrue counts consecutive attempts, not
failures. This manifests as hard-failures that cascade to downstream tests.

## The fix — one-time Supabase dashboard config

Add the three test users to GoTrue's rate-limit allowlist so they're exempt
from per-account lockout. In the Supabase dashboard for the ScriptHammer
project:

1. **Project Settings → Authentication → Rate Limits**
2. Under **Sign-in attempts**, either:
   - Raise the threshold significantly (e.g. 100 attempts per 4 minutes), OR
   - Add the following test user emails to the allowlist:
     - `TEST_USER_PRIMARY_EMAIL` (from GitHub secrets)
     - `TEST_USER_SECONDARY_EMAIL`
     - `TEST_USER_TERTIARY_EMAIL`

3. Save. Rate-limit exemption is effective immediately.

## What this does NOT exempt

- HTTP-level rate limits (Cloudflare `__cf_bm` Bot Management) — separate
  issue, only affects Firefox's realtime WebSocket
- Concurrent request limits at the PostgREST layer — not auth-specific

## Verification

After applying the dashboard change, trigger a full E2E run:

```bash
gh workflow run "E2E Tests" --ref main
```

Watch for these strings in the run logs — they should appear zero times:

```
grep -c "Too many failed attempts" logs/  # should be 0
grep -c "Request rate limit reached" logs/ # should be 0
```

## What the code side of this plan did

The code-side refactor (auth.setup.ts + multi-user test specs) reduces the
total live `performSignIn` count from ~30 to ~13 by pre-authenticating a
second test user (User B / TERTIARY) into `storage-state-auth-b.json`.
Multi-user messaging and security specs now load both fixtures into separate
browser contexts instead of signing in live.

The remaining ~13 live sign-ins are in `auth/session-persistence.spec.ts`
and `auth/protected-routes.spec.ts` — these tests verify sign-in behavior
itself and cannot reuse storageState. The dashboard exemption above is what
keeps them from triggering the lockout when CI runs them.

## History

This setup step was discovered after 10 rounds of test-level flake patches
failed to eliminate flakiness. Run `24621408387` (commit `f4f080d`) hard-
failed 4 webkit-gen shards with "Too many failed attempts", revealing that
the real constraint was per-account lockout, not concurrency or test timing.
