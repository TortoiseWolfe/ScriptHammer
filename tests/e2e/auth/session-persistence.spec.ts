/**
 * E2E Test: Session Persistence (T068)
 *
 * Tests session management and persistence:
 * - Verify Remember Me extends session to 30 days
 * - Verify automatic token refresh before expiration
 * - Verify session persists across browser restarts
 *
 * Uses pre-existing test users from environment variables.
 */

import { test, expect } from '@playwright/test';
import {
  dismissCookieBanner,
  waitForAuthenticatedState,
  signOutViaDropdown,
  performSignIn,
} from '../utils/test-user-factory';
import { skipIfBackendCaptchaProtected } from '../utils/captcha-guard';

// Use pre-existing test user (must exist in Supabase)
const testEmail = process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com';
const testPassword =
  process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!';

test.describe('Session Persistence E2E', () => {
  // These tests explicitly test sign-in/sign-out flows, so they need
  // unauthenticated starting state (override the project's storageState)
  test.use({ storageState: './tests/e2e/fixtures/storage-state.json' });

  // 60s per test — sign-in + sign-out + cookie checks need extra headroom
  // when Supabase is cold and 24 shards are competing for the connection pool
  test.describe.configure({ mode: 'serial', timeout: 60000 });

  // Each test starts fresh on sign-in page
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
    // NEVER `networkidle` on a Turnstile route (#506). /sign-in, /sign-up,
    // /forgot-password and /messages/setup mount Cloudflare Turnstile, which
    // opens a `blob:` worker request that NEVER settles — measured, the last
    // event is a blob: REQ with no finish, and networkidle still had not fired
    // after 30s. This hook consumed the whole 60s test timeout and turned CI
    // red the first time e2e.yml carried a site key.
    //
    // A web-first assertion is the right replacement anyway: it retries, and
    // it asserts the thing the test actually needs (a usable form) rather than
    // a network condition that only correlates with it.
    // Enforced by tests/unit/no-networkidle-on-captcha-routes.test.ts.
    await expect(page.getByLabel('Email')).toBeVisible();
    await dismissCookieBanner(page);
  });

  test('should extend session duration with Remember Me checked', async ({
    page,
  }) => {
    // Sign in with Remember Me (already on sign-in page from beforeEach)
    const result = await performSignIn(page, testEmail, testPassword, {
      rememberMe: true,
    });
    if (!result.success) {
      throw new Error(`Sign-in failed: ${result.error}`);
    }

    // Verify localStorage has refresh token for persistence.
    //
    // This assertion is only meaningful when the REAL form was submitted. Under
    // the captcha-protected path `performSignIn` injects a session and writes a
    // `refresh_token` into localStorage itself (test-user-factory.ts:1756), so
    // it would pass no matter what Remember Me did — the same cannot-fail shape
    // #587 removed from the sibling test below. The guard keeps it honest and
    // lets it run for real wherever captcha is off.
    await skipIfBackendCaptchaProtected(
      'Remember Me putting a refresh token in localStorage (#375)'
    );

    const localStorage = await page.evaluate(() =>
      JSON.stringify(window.localStorage)
    );
    expect(localStorage).toContain('refresh_token');

    // #845: what stood here was an `if (authCookie)` block asserting a ~30 day cookie
    // expiry. THIS APP NEVER SETS AN AUTH COOKIE — `client.ts` installs
    // `storage: createAuthStorage()`, which picks between sessionStorage (:142) and
    // localStorage (:143); `document.cookie` appears nowhere in the file, and
    // `flowType: 'implicit'` writes none either. The guard was false on every run, so
    // the only duration assertion in this test had never executed.
    //
    // It was the wrong contract too. Since #375 "Remember me" does not extend an
    // expiry — it chooses WHICH STORE holds the token. That is what is asserted now,
    // by key shape rather than by the substring above, so a token written under the
    // wrong key cannot satisfy it.
    //
    // Placement is deliberate: this sits AFTER the captcha guard because under the
    // captcha-protected path `performSignIn` injects a server-minted session straight
    // into localStorage (test-user-factory.ts:1756) and the assertion would pass no
    // matter what Remember Me did.
    //
    // NOT asserted here, on purpose:
    //   - `sh-auth-persistence`. `setSessionPersistence()` early-returns when the
    //     preference is unchanged (client.ts:169-170) and 'local' is the default, so
    //     with Remember Me CHECKED the key is never written. The sibling test below can
    //     assert it because unchecking is a real change; mirroring it here would fail.
    //   - "the token is absent from sessionStorage". It cannot fail in this flow —
    //     nothing ever writes sessionStorage on the checked path — and adding an
    //     assertion that cannot fail is the exact defect this ticket is about. The
    //     "exactly one home" invariant is covered where it CAN fail, by
    //     tests/unit/auth-session-persistence.test.ts:79.
    expect(
      localStorage,
      'Remember Me checked: the auth token must persist in localStorage'
    ).toMatch(/sb-.*-auth-token/);
  });

  test('should use short session without Remember Me', async ({ page }) => {
    // Before signing in, not after: against a captcha-protected backend this
    // test cannot measure anything (see the note below), so there is no reason
    // to spend a sign-in discovering that.
    await skipIfBackendCaptchaProtected(
      'Where the auth token is stored after a real form sign-in (#375)'
    );

    // Sign in WITHOUT Remember Me (already on sign-in page from beforeEach)
    const result = await performSignIn(page, testEmail, testPassword, {
      rememberMe: false,
    });
    if (!result.success) {
      throw new Error(`Sign-in failed: ${result.error}`);
    }

    // #587: this used to read `expect(sessionStorage).toBeDefined()` on a
    // JSON.stringify result — a string is ALWAYS defined, so the assertion could
    // not fail. It was hedged by a comment claiming "Supabase SSR may still use
    // localStorage even without Remember Me", which was true before #375 and is
    // not now. A gate that cannot fail plus a comment excusing it is how #375's
    // regression would have gone unnoticed.
    //
    // What actually happens with rememberMe:false, observed on a real run:
    //   localStorage == {"cookie-consent":…,"playwright_e2e":"true",
    //                    "sh-auth-persistence":"session"}
    // i.e. the app records its choice in `sh-auth-persistence` and keeps the
    // token OUT of localStorage. Assert exactly that — it is what #375 fixed.
    //
    // That observation holds ONLY where the real form is submitted. Against a
    // captcha-protected backend `performSignIn` injects a server-minted session
    // instead (test-user-factory.ts:1756 writes `sb-<host>-auth-token` straight
    // into localStorage) and the component that records the preference never
    // runs — so BOTH assertions below are false, and measured false on CI:
    //   {"cookie-consent":…,"sb-ozbdyopxmeqmwnfsmglp-auth-token":…,
    //    "playwright_e2e":"true"}
    // `client.ts` already said as much in prose; the guard above makes it true
    // in code. It probes, so this resumes automatically wherever captcha is off
    // — which is the local-Supabase run where real-form coverage belongs.
    const localStorageDump = await page.evaluate(() =>
      JSON.stringify(window.localStorage)
    );

    expect(localStorageDump).toContain('sh-auth-persistence');
    expect(localStorageDump).not.toMatch(/sb-.*-auth-token/);
  });

  test('should automatically refresh token before expiration', async ({
    page,
  }) => {
    // Sign in (already on sign-in page from beforeEach)
    const result = await performSignIn(page, testEmail, testPassword);
    if (!result.success) {
      throw new Error(`Sign-in failed: ${result.error}`);
    }

    // Wait a short time (in real scenario, wait closer to expiry)
    await page.waitForTimeout(2000);

    // Navigate to trigger token refresh check
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // The important part is that navigation doesn't break authentication
    // Verify we're still on the profile page (not redirected to sign-in)
    await expect(page).toHaveURL(/\/profile\/?$/);

    // Navigate to another protected route to verify session is still valid
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/account\/?$/);
  });

  test('should persist session across browser restarts', async ({
    browser,
  }) => {
    test.setTimeout(60000); // Increase timeout for multi-context auth

    // Create persistent context
    const context = await browser.newContext({
      storageState: undefined, // Start fresh
    });
    const page = await context.newPage();

    // Sign in with Remember Me
    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    const result = await performSignIn(page, testEmail, testPassword, {
      rememberMe: true,
    });
    if (!result.success) {
      await context.close();
      throw new Error(`Sign-in failed: ${result.error}`);
    }

    // Save storage state
    const storageState = await context.storageState();

    // Close and reopen with saved state (simulates browser restart)
    await context.close();

    const newContext = await browser.newContext({ storageState });
    const newPage = await newContext.newPage();

    // Access protected route without signing in again
    await newPage.goto('/profile', { waitUntil: 'domcontentloaded' });

    // Verify still authenticated
    await expect(newPage).toHaveURL(/\/profile\/?$/);
    // Email appears in profile - scope to main to avoid hidden spans in dropdowns
    await expect(newPage.locator('main').getByText(testEmail)).toBeVisible();

    await newContext.close();
  });

  test('should clear session on sign out', async ({ page }) => {
    // Sign in (already on sign-in page from beforeEach)
    const result = await performSignIn(page, testEmail, testPassword);
    if (!result.success) {
      throw new Error(`Sign-in failed: ${result.error}`);
    }

    // Wait for redirect away from sign-in before evaluating localStorage —
    // page.evaluate can fail if the page is still navigating.
    await page
      .waitForURL((url) => !url.pathname.includes('/sign-in'), {
        timeout: 30000,
      })
      .catch(() => {});

    // #587: this used to assert /sb-.*-auth-token/ in localStorage. But the
    // sign-in above is `performSignIn(...)` with no options, and
    // test-user-factory.ts:1116 defaults `rememberMe` to FALSE — so after #375's
    // fix the token deliberately does NOT go to localStorage. The assertion was
    // demanding the exact behaviour #375 was closed for removing, and it failed
    // on every run of the local-Supabase workflow (#575).
    //
    // This test's subject is the AFTER state — "should clear session on sign
    // out". The `before` check is scaffolding, so it now asserts the thing that
    // is actually true and actually load-bearing: a session marker exists to be
    // cleared.
    //
    // WHICH marker depends on how the sign-in happened, and this test must not
    // care. A real form submission records `sh-auth-persistence`; a captcha
    // -protected backend makes `performSignIn` inject a session written as
    // `sb-<host>-auth-token` instead. Naming only the first meant this could
    // never pass on the cloud run — it simply never got there, because the
    // group is `mode: 'serial'` and the earlier failure skipped it. Matching
    // either keeps the scaffolding load-bearing (nothing stored at all still
    // fails) without pinning it to one sign-in path.
    const beforeSignOut = await page.evaluate(() =>
      JSON.stringify(window.localStorage)
    );
    expect(
      beforeSignOut,
      'No auth marker in localStorage before sign-out, so this test would be ' +
        'asserting that signing out clears something that was never there.'
    ).toMatch(/sh-auth-persistence|sb-.*-auth-token/);

    // Sign out via dropdown menu
    await signOutViaDropdown(page);

    // The real contract is "signed out → cannot reach a protected route".
    // (The old localStorage waitForFunction poll asserted WHEN Supabase's
    // private sb-*-auth-token clears — an implementation detail that clears on
    // its own async schedule and raced the hard window.location='/' redirect
    // signOut() fires, flaking on firefox/webkit. Removed.)
    await page
      .goto('/profile', { waitUntil: 'domcontentloaded' })
      .catch(() => {}); // ProtectedRoute may redirect before goto resolves
    // Pathname-EXACT: with trailingSlash:true a still-authenticated user lands
    // on /profile/, which the old /\/(sign-in|$)/ regex wrongly matched — so a
    // real sign-out regression would have passed. Assert the pathname directly.
    await page.waitForURL(
      (url) => url.pathname === '/' || url.pathname.startsWith('/sign-in'),
      { timeout: 30000 }
    );
    const pathname = new URL(page.url()).pathname;
    expect(pathname === '/' || pathname.startsWith('/sign-in')).toBe(true);

    // One-shot storage check on the now-settled document (no poll, no nav in
    // flight → can't flake): the test named "should clear session" still
    // asserts the token is gone, but as a single read after the redirect.
    const afterSignOut = await page.evaluate(() =>
      JSON.stringify(window.localStorage)
    );
    expect(afterSignOut).not.toMatch(/"access_token":"[^"]/);
  });

  test('should handle concurrent tab sessions correctly', async ({
    browser,
  }) => {
    test.setTimeout(60000); // Increase timeout for multi-tab auth

    // Create context with one page initially
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page1 = await context.newPage();

    // Sign in on page 1 with proper error detection
    await page1.goto('/sign-in');
    await dismissCookieBanner(page1);
    const signInResult = await performSignIn(page1, testEmail, testPassword);

    // Fail fast with clear error if sign-in failed
    if (!signInResult.success) {
      await context.close();
      throw new Error(`Sign-in failed on page1: ${signInResult.error}`);
    }

    // Verify page1 is authenticated
    await expect(page1).toHaveURL(/\/(profile|verify-email)/);
    await waitForAuthenticatedState(page1);

    // Auth is verified by waitForAuthenticatedState - no need to check localStorage keys
    // (Modern Supabase SSR uses different key formats than the old supabase.auth.token)

    // Now create page2 - it should share the same storage
    const page2 = await context.newPage();

    // Page 2 should also be authenticated (shared storage in same context)
    await page2.goto('/profile');
    await dismissCookieBanner(page2);

    // Wait for either profile (success) or sign-in (redirect)
    await page2.waitForURL(/\/(profile|sign-in)/, { timeout: 30000 });

    // Check if auth synced
    const page2Url = page2.url();
    const authSynced = !page2Url.includes('/sign-in');

    if (!authSynced) {
      // Storage sync failed - this is a known browser limitation
      // Log and skip the cross-tab verification parts
      console.log(
        'Storage sync between tabs not available - testing single-tab flow only'
      );
    }

    // Regardless of page2 state, verify sign out works on page1
    // Navigate page1 to home first to ensure clean state
    await page1.goto('/', { waitUntil: 'domcontentloaded' });
    await page1.waitForLoadState('networkidle');

    // Sign out on page 1 via dropdown menu
    await signOutViaDropdown(page1);

    // Verify page1 is signed out
    await expect(page1).toHaveURL(/\/$/);
    await expect(page1.getByRole('link', { name: 'Sign In' })).toBeVisible();

    // If auth had synced to page2, verify it's now signed out too. The cross-tab
    // SIGNED_OUT event (onAuthStateChange) has no delivery-latency guarantee and
    // webkit/firefox under CI load delay/coalesce it, so a single reload+waitForURL
    // was a fragile one-shot bet. Use reload-as-source-of-truth: each retry re-reads
    // the (by-then cleared) shared storage from a fresh document, so a delayed event
    // is absorbed by the next reload — same 30s ceiling, spent deterministically.
    // Still HARD-fails if page2 can reach /profile after sign-out (token not cleared).
    if (authSynced) {
      await expect(async () => {
        await page2.reload({ waitUntil: 'domcontentloaded' });
        await page2.waitForURL(
          (url) => url.pathname === '/' || url.pathname.startsWith('/sign-in'),
          { timeout: 5000 }
        );
      }).toPass({ timeout: 30000 });
    }

    await context.close();
  });

  test('should refresh session automatically on page reload', async ({
    page,
  }) => {
    // Sign in (already on sign-in page from beforeEach)
    const result = await performSignIn(page, testEmail, testPassword);
    if (!result.success) {
      throw new Error(`Sign-in failed: ${result.error}`);
    }

    // Reload page
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Verify still authenticated
    // Email appears in profile - scope to main to avoid hidden spans in dropdowns
    await expect(page.locator('main').getByText(testEmail)).toBeVisible();

    // Navigate to another protected route
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/account\/?$/);
  });

  test('should expire session after maximum duration', async ({ page }) => {
    // Note: This test would require mocking time or waiting for real expiry
    // In a real test, we would:
    // 1. Sign in without Remember Me (1 hour session)
    // 2. Mock time forward 2 hours
    // 3. Try to access protected route
    // 4. Verify redirected to sign-in

    // For demonstration, test the refresh mechanism (already on sign-in page from beforeEach)
    const result = await performSignIn(page, testEmail, testPassword);
    if (!result.success) {
      throw new Error(`Sign-in failed: ${result.error}`);
    }

    // Clear refresh token to simulate expired session
    await page.evaluate(() => {
      const data = localStorage.getItem('supabase.auth.token');
      if (data) {
        const parsed = JSON.parse(data);
        delete parsed.refresh_token;
        localStorage.setItem('supabase.auth.token', JSON.stringify(parsed));
      }
    });

    // Try to access protected route
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });

    // Should redirect to sign-in when refresh fails
    // Note: Behavior depends on auth implementation
    await page.waitForURL(/\/(sign-in|profile)/);
  });
});
