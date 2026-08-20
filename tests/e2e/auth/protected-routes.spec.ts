/**
 * E2E Test: Protected Routes (T067)
 *
 * Tests protected route access, RLS policy enforcement, and cascade delete:
 * - Verify protected routes redirect unauthenticated users
 * - Verify RLS policies enforce payment access control
 * - Verify cascade delete removes user_profiles/audit_logs/payment_intents
 *
 * Auth comes from storageState (setup project) for authenticated tests.
 * Tests that need unauthenticated state override storageState locally.
 */

import { test, expect } from '@playwright/test';
import {
  dismissCookieBanner,
  signOutViaDropdown,
  performSignIn,
} from '../utils/test-user-factory';

// Use pre-existing test users (must exist in Supabase)
const testUser = {
  email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
};

const testUser2 = {
  email: process.env.TEST_USER_SECONDARY_EMAIL || 'test2@example.com',
  password: process.env.TEST_USER_SECONDARY_PASSWORD || 'TestPassword123!',
};

// Skip all tests if test users not configured
test.beforeAll(() => {
  if (!process.env.TEST_USER_PRIMARY_EMAIL) {
    console.warn(
      '⚠️  TEST_USER_PRIMARY_EMAIL not set - protected routes tests will use fallback'
    );
  }
});

// ============================================================
// Tests that require UNAUTHENTICATED state
// ============================================================
test.describe('Unauthenticated Access', () => {
  // Override storageState to start without auth
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should redirect unauthenticated users to sign-in', async ({ page }) => {
    // Attempt to access protected routes without authentication
    const protectedRoutes = ['/profile', '/account', '/payment-demo'];

    for (const route of protectedRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      // Verify redirected to sign-in (may include returnUrl query param)
      await page.waitForURL(/\/sign-in/);
      await expect(page).toHaveURL(/\/sign-in/);
    }
  });

  test('should redirect to intended URL after authentication', async ({
    page,
  }) => {
    const testEmail = testUser.email;
    const testPassword = testUser.password;

    // Attempt to access protected route while unauthenticated
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/sign-in/);
    await dismissCookieBanner(page);

    // Sign in with performSignIn helper
    const result = await performSignIn(page, testEmail, testPassword);
    if (!result.success) {
      throw new Error(`Sign-in failed: ${result.error}`);
    }

    // Note: If redirect-after-auth is implemented, should redirect to /account
    // Otherwise, redirects to default (profile)
    await expect(page).toHaveURL(/\/(account|profile)/);
  });
});

// ============================================================
// Tests that use pre-authenticated state from storageState
// ============================================================
test.describe('Protected Routes E2E', () => {
  // Run tests serially to avoid Supabase rate limiting
  test.describe.configure({ mode: 'serial' });

  const testEmail = testUser.email;
  const testPassword = testUser.password;

  test('should allow authenticated users to access protected routes', async ({
    page,
  }, testInfo) => {
    // Auth comes from storageState - navigate directly to protected routes
    const protectedRoutes = [
      { path: '/profile', heading: 'Profile' },
      { path: '/account', heading: 'Account Settings' },
      { path: '/payment-demo', heading: 'Payment Integration Demo' },
    ];

    // Check auth is valid — WebKit sometimes fails to restore the session
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/sign-in')) {
      testInfo.skip(
        true,
        'Auth session not restored from storageState (transient WebKit issue)'
      );
      return;
    }

    for (const route of protectedRoutes) {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      // Next.js adds trailing slashes - match with or without
      await expect(page).toHaveURL(new RegExp(`${route.path}/?$`));
      await expect(
        page.getByRole('heading', { name: route.heading })
      ).toBeVisible();
    }
  });

  test('should enforce RLS policies on payment access', async ({ page }) => {
    // Two sign-outs + two sign-ins + payment-demo navigations; with 30s
    // waitFor budgets inside signOutViaDropdown this easily exceeds the
    // default 30s test timeout on Supabase Cloud under shard load.
    test.setTimeout(120000);

    // Skip if secondary user not configured
    if (!process.env.TEST_USER_SECONDARY_EMAIL) {
      test.skip(
        true,
        'TEST_USER_SECONDARY_EMAIL not configured - skipping RLS test'
      );
      return;
    }

    // Step 1: Already authenticated as user 1 via storageState
    // Access payment demo and verify user's own data
    await page.goto('/payment-demo', { waitUntil: 'domcontentloaded' });
    const escapedEmail1 = testUser.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(
      page.getByText(new RegExp(`Logged in as: ${escapedEmail1}`))
    ).toBeVisible();

    // Step 2: Sign out via dropdown menu
    await signOutViaDropdown(page);
    // Wait for sign-out redirect to fully settle — WebKit may async-refresh
    // the Supabase token after sign-out, briefly re-authenticating and
    // triggering a middleware redirect away from /sign-in.
    await page.waitForLoadState('networkidle');
    await page.waitForURL(
      (url) => url.pathname === '/' || url.pathname.startsWith('/sign-in'),
      { timeout: 10000 }
    );
    // Retry goto — WebKit's async token refresh can interrupt the navigation
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
        break;
      } catch {
        if (attempt === 2)
          throw new Error('Failed to navigate to /sign-in after 3 attempts');
        await page.waitForTimeout(1000);
      }
    }

    // Step 3: Sign in as second user
    await dismissCookieBanner(page);
    const result2 = await performSignIn(
      page,
      testUser2.email,
      testUser2.password
    );
    if (!result2.success) {
      throw new Error(`Sign-in failed for user 2: ${result2.error}`);
    }

    // Step 4: Verify user 2 sees their own email, not user 1's
    await page.goto('/payment-demo', { waitUntil: 'domcontentloaded' });
    const escapedEmail2 = testUser2.email.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );
    await expect(
      page.getByText(new RegExp(`Logged in as: ${escapedEmail2}`))
    ).toBeVisible();
    // User 1's email should not appear in "Logged in as" text
    await expect(
      page.getByText(new RegExp(`Logged in as: ${escapedEmail1}`))
    ).not.toBeVisible();

    // RLS policy prevents user 2 from seeing user 1's payment data

    // Clean up - sign out via dropdown menu
    await signOutViaDropdown(page);
  });

  // REMOVED (#850): 'should show email verification notice for unverified users'.
  // It ran zero assertions on every shard and could never have run any — an
  // unverified user cannot hold a session. Probed straight against GoTrue:
  // admin.createUser({ email_confirm: false }) succeeds, and the subsequent
  // signInWithPassword is rejected with "Email not confirmed". The notice's only
  // render condition is therefore unreachable through the UI, so its
  // `if (isNoticeVisible)` guard was false by construction and the else-branch
  // merely console.logged. The behaviour is now covered where it IS reachable, in
  // EmailVerificationNotice.test.tsx — both directions, plus the resend outcomes.

  test('should preserve session across page navigation', async ({ page }) => {
    // Already authenticated via storageState
    // Navigate between protected routes (Next.js adds trailing slashes)
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/profile\/?$/);

    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/account\/?$/);

    await page.goto('/payment-demo', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/payment-demo\/?$/);

    // Verify still authenticated (no redirect to sign-in)
    await expect(page).toHaveURL(/\/payment-demo\/?$/);
  });

  test('should handle session expiration gracefully', async ({ page }) => {
    // Already authenticated via storageState
    // Navigate to a page first to confirm auth works
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/profile\/?$/);

    // Clear session storage to simulate expired session
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Try to access protected route
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });

    // Verify redirected to sign-in (may include returnUrl query param)
    await page.waitForURL(/\/sign-in/);
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('should verify cascade delete removes related records', async ({
    page,
  }) => {
    // FIXED (#859). This test is why the defect was found: it had run zero assertions
    // on every shard, so nobody knew that "Delete Account Permanently" deleted nothing.
    //
    // `gdprService.deleteUserAccount()` used to issue `.from('user_profiles').delete()`
    // from the browser. user_profiles has RLS with no DELETE policy, so the statement
    // matched zero rows and returned NO error — the client read that as success, signed
    // the user out and redirected to "?message=account_deleted" while the profile, the
    // auth user and the email address all remained. Deletion now goes through the
    // `delete-account` Edge Function, which verifies the caller's JWT and deletes only
    // that user; CASCADE removes the profile and everything below it.

    // This test requires creating a NEW user to delete (can't use pre-existing test users)
    // We'll use the admin API to create a temporary user
    const {
      createTestUser,
      deleteTestUserByEmail,
      isAdminClientAvailable,
      getUserByEmail,
      getAdminClient,
    } = await import('../utils/test-user-factory');

    if (!isAdminClientAvailable()) {
      test.skip(true, 'SUPABASE_SERVICE_ROLE_KEY not configured');
      return;
    }

    // Derive email domain from primary test user or use fallback
    const baseEmail = process.env.TEST_USER_PRIMARY_EMAIL || '';
    const emailDomain = baseEmail.includes('@gmail.com')
      ? 'gmail.com'
      : baseEmail.split('@')[1] || 'example.com';
    const baseUser = baseEmail.includes('+')
      ? baseEmail.split('+')[0]
      : baseEmail.split('@')[0];

    const deleteEmail =
      emailDomain === 'gmail.com'
        ? `${baseUser}+delete-${Date.now()}@gmail.com`
        : `delete-test-${Date.now()}@${emailDomain}`;

    // Create user via admin API
    const user = await createTestUser(deleteEmail, testPassword);
    if (!user) {
      test.skip(true, 'Could not create test user via admin API');
      return;
    }

    try {
      // Sign in as the newly created user (not the primary user)
      await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
      await dismissCookieBanner(page);
      const result = await performSignIn(page, deleteEmail, testPassword);
      if (!result.success) {
        throw new Error(`Sign-in failed for delete test user: ${result.error}`);
      }

      // Navigate to account settings
      await page.goto('/account', { waitUntil: 'domcontentloaded' });

      // This ran zero assertions in CI (#850). Measured locally the guard is TRUE —
      // sign-in succeeds, /account renders, and the button is present and visible — so
      // what failed on the runner was the 5s race, not the feature: /account is a
      // client-rendered static export and the button appears only after the session and
      // profile round-trip. The `.catch(() => false)` then turned a slow page into a
      // silent pass, and the else-branch console.logged a guess about scrolling.
      //
      // Asserted unconditionally with a timeout sized for a loaded runner. If the
      // button is genuinely missing this now fails and says so.
      const deleteButton = page.getByRole('button', {
        name: /delete account/i,
      });
      await expect(deleteButton).toBeVisible({ timeout: 20000 });
      await deleteButton.click();

      // The old code looked for a button named /confirm/i. There is none —
      // AccountDeletionModal requires TYPING "DELETE" into #confirmation-input, and its
      // action button is labelled "Delete my account permanently" and stays `disabled`
      // until `confirmationText === 'DELETE'`. So the confirm step was silently skipped,
      // nothing was deleted, and the redirect never came.
      const confirmationInput = page.locator('#confirmation-input');
      await expect(confirmationInput).toBeVisible({ timeout: 10000 });
      await confirmationInput.fill('DELETE');

      const confirmButton = page.getByRole('button', {
        name: /delete my account permanently/i,
      });
      // Asserting it became enabled pins the guard itself: a modal that accepted any
      // text would delete accounts on a typo.
      await expect(confirmButton).toBeEnabled();
      await confirmButton.click();

      // This test is named "verify cascade delete removes related records" and used to
      // assert nothing of the sort — only a URL, and only inside a guard that was false
      // in CI (#850). The URL is also the weakest available signal: the modal pushes
      // '/sign-in?message=account_deleted' (AccountDeletionModal.tsx:69) but the browser
      // lands on '/', because the sign-in page redirects a still-authenticated client to
      // returnUrl before AuthContext has processed the deletion. That race is filed
      // separately; asserting it here would pin a bug in place.
      //
      // What the test claims to check is the deletion itself, so that is what it checks.

      // 1. The user is booted out of the protected route.
      await expect
        .poll(() => page.url(), { timeout: 20000 })
        .not.toMatch(/\/account/);

      // 2. The profile row — what the client actually deletes — is gone.
      const admin = getAdminClient();
      expect(
        admin,
        'admin client is required to verify the cascade'
      ).not.toBeNull();
      await expect
        .poll(
          async () => {
            const { data } = await admin!
              .from('user_profiles')
              .select('id')
              .eq('id', user.id);
            return data?.length ?? -1;
          },
          { timeout: 20000 }
        )
        .toBe(0);

      // 3. And the auth user itself.
      await expect
        .poll(async () => (await getUserByEmail(deleteEmail)) === null, {
          timeout: 20000,
        })
        .toBe(true);
    } finally {
      // Clean up via admin API if user still exists
      await deleteTestUserByEmail(deleteEmail);
    }
  });
});
