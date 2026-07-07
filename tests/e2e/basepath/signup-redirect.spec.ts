/**
 * E2E Test: basePath-aware signup redirect (issue #157 / #154)
 *
 * This spec runs ONLY under the `basepath` Playwright project, which serves a
 * dedicated `NEXT_PUBLIC_BASE_PATH=/ScriptHammer` build under a `/ScriptHammer`
 * prefix (see .github/workflows/e2e.yml + scripts/serve-basepath.sh). The rest
 * of the suite builds+serves at the ROOT, so this whole class of bug — auth
 * redirect URLs that must carry the GitHub Pages project-site basePath — is
 * structurally invisible to it.
 *
 * The signup flow builds `emailRedirectTo` via getRedirectUrl('/auth/callback')
 * (src/contexts/AuthContext.tsx). The Supabase JS client turns that into a
 * `redirect_to` query param on POST {SUPABASE_URL}/auth/v1/signup. On a
 * project-site build the correct value is the PREFIXED, trailing-slash callback
 * (`.../ScriptHammer/auth/callback/`). #154 fixed the construction; this pins it
 * under a real basePath build without needing an email inbox or a real user:
 * the signup POST is intercepted and fulfilled with a stub response.
 */

import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

const BASE_PATH = '/ScriptHammer';

test.describe('basePath-aware signup redirect (#157)', () => {
  test('the signup POST carries the prefixed, trailing-slash redirect_to', async ({
    page,
  }) => {
    // Fail loudly if any prefixed asset 404s — that means the dedicated prefix
    // build + symlink-serve is broken (the mechanism this project depends on).
    const assetFailures: string[] = [];
    page.on('response', (res) => {
      const url = res.url();
      if (url.includes('/_next/') && res.status() >= 400) {
        assetFailures.push(`${res.status()} ${url}`);
      }
    });

    // Intercept the Supabase signup POST and fulfill it with a stub so no real
    // user is created and no confirmation email is sent. We only care about the
    // request URL the client built.
    let signupRequestUrl: string | null = null;
    await page.route('**/auth/v1/signup**', async (route) => {
      signupRequestUrl = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-0000-0000-000000000000',
          email: 'basepath-smoke@example.com',
          aud: 'authenticated',
          role: 'authenticated',
        }),
      });
    });

    // Navigate with the FULL prefixed path. A relative 'sign-up/' would resolve
    // against baseURL (http://localhost:3000/ScriptHammer, no trailing slash)
    // and drop the last segment → /sign-up/. An absolute path that includes the
    // prefix is unambiguous — baseURL supplies only the origin.
    await page.goto(`${BASE_PATH}/sign-up/`);
    expect(page.url()).toContain(`${BASE_PATH}/sign-up`);

    await dismissCookieBanner(page);

    // Drive the sign-up form (fields: #email, #password, #confirm-password).
    const email = `basepath-smoke-${Date.now()}@example.com`;
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('TestPassword123!');
    await page.locator('#confirm-password').fill('TestPassword123!');
    await page.getByRole('button', { name: /sign up/i }).click();

    // Wait for the intercepted POST to have fired.
    await expect.poll(() => signupRequestUrl).not.toBeNull();

    const redirectTo = new URL(signupRequestUrl!).searchParams.get(
      'redirect_to'
    );
    const origin = new URL(page.url()).origin;
    expect(redirectTo).toBe(`${origin}${BASE_PATH}/auth/callback/`);

    // The build's own assets must have loaded under the prefix.
    expect(assetFailures, assetFailures.join('\n')).toHaveLength(0);
  });
});
