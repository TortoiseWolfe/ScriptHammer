import { test, expect } from '@playwright/test';
import { assertValidOAuthClientId } from '../utils/oauth-validity';

/**
 * Post-deploy production @smoke suite (#288, item 2).
 *
 * Runs against the LIVE deployed origin after each deploy (and daily). #287
 * proved the whole test suite can be green while the *deployed product* is
 * unusable — placeholder OAuth client_ids, `site_url=localhost`, dead SMTP.
 * These checks assert the thing a customer actually touches works. All are
 * READ-ONLY (no signup / no user creation), safe to run repeatedly.
 *
 * Runs only via `playwright.smoke.config.ts` (BASE_URL = the live origin +
 * NEXT_PUBLIC_SUPABASE_URL/ANON_KEY = the prod project); excluded from the main
 * suite's projects. Shares the #287 client_id validator with the pre-merge E2E
 * (`tests/e2e/utils/oauth-validity.ts`).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

test.describe('@smoke production deploy (#288)', () => {
  test('the auth providers we ship are enabled (/auth/v1/settings)', async ({
    request,
  }) => {
    expect(SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL must be set').toBeTruthy();
    const res = await request.get(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: ANON_KEY },
    });
    expect(res.ok(), `/auth/v1/settings → ${res.status()}`).toBeTruthy();
    const { external } = (await res.json()) as {
      external: Record<string, boolean>;
    };
    expect(external.github, 'GitHub provider must be enabled').toBe(true);
    expect(external.google, 'Google provider must be enabled').toBe(true);
    expect(external.email, 'Email provider must be enabled').toBe(true);
  });

  // The #287 detector against LIVE prod: a placeholder client_id would appear in
  // the real authorize redirect. Read it from the Location header — no flaky
  // navigation to the real provider.
  for (const provider of ['github', 'google'] as const) {
    test(`${provider} authorize redirect carries a real, non-placeholder client_id`, async ({
      request,
    }) => {
      expect(SUPABASE_URL).toBeTruthy();
      const res = await request.get(
        `${SUPABASE_URL}/auth/v1/authorize?provider=${provider}`,
        { maxRedirects: 0, headers: { apikey: ANON_KEY } }
      );
      expect(
        res.status(),
        `authorize should redirect to the provider, got ${res.status()}`
      ).toBeGreaterThanOrEqual(300);
      const location = res.headers()['location'] ?? '';
      expect(location, 'authorize must issue a Location redirect').toBeTruthy();
      assertValidOAuthClientId(location);
    });
  }

  test('the sign-in page loads with no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

    await page.goto('/sign-in');
    // The real app rendered (OAuth buttons are part of the sign-in page).
    await expect(
      page.getByRole('button', { name: /continue with github/i })
    ).toBeVisible();

    // Benign third-party noise (analytics, Cloudflare bot cookie, favicon).
    const IGNORE =
      /favicon|analytics|gtag|googletagmanager|chrome-extension|__cf_bm|cf_bm|cloudflare/i;
    const relevant = errors.filter((e) => !IGNORE.test(e));
    expect(
      relevant,
      `console errors on /sign-in:\n${relevant.join('\n')}`
    ).toEqual([]);
  });

  test('canonical origin serves the app + github.io redirects to it', async ({
    request,
  }) => {
    // GitHub Pages guarantee: the project github.io URL 301s to the custom domain.
    const gh = await request.get(
      'https://tortoisewolfe.github.io/ScriptHammer/',
      { maxRedirects: 0 }
    );
    expect(
      gh.status(),
      `github.io should redirect, got ${gh.status()}`
    ).toBeGreaterThanOrEqual(300);
    expect(
      gh.headers()['location'] ?? '',
      'github.io must redirect to the scripthammer.com custom domain'
    ).toContain('scripthammer.com');

    // The canonical origin (BASE_URL) serves the real app (follow redirects).
    const home = await request.get('/sign-in');
    expect(home.ok(), `BASE_URL/sign-in → ${home.status()}`).toBeTruthy();
  });

  /**
   * CAPTCHA protection is actually ENFORCED on live prod (#353).
   *
   * The auth-config drift gate already asserts the *config* says
   * `security_captcha_enabled: true`. This asserts the live endpoint actually
   * *refuses* — a different claim, and the one that matters. Config can be
   * right while the provider secret is wrong, the Turnstile widget is
   * misconfigured, or the setting silently stops taking effect.
   *
   * ## Why this probes sign-IN and not sign-UP
   * `SECURITY_CAPTCHA_ENABLED` is global to Supabase Auth — one flag gates
   * sign-in, sign-up and password recovery — so refusing a token-less sign-in
   * proves the same control.
   *
   * Probing sign-up would break this suite's read-only contract in the exact
   * case it is meant to catch: if protection regressed, a token-less sign-up
   * would SUCCEED, creating a real account and sending a real confirmation
   * email. That is #361's harm (hard bounces burning sender reputation)
   * reintroduced by the very test meant to guard against it.
   *
   * Side-effect-free in BOTH outcomes, which is what makes it safe to run on
   * every deploy and daily:
   *   protection ON  → `captcha_failed`      (no user touched)
   *   protection OFF → `invalid_credentials` (the address does not exist)
   */
  test('CAPTCHA is enforced on live auth (#353)', async ({ request }) => {
    expect(SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL must be set').toBeTruthy();

    const res = await request.post(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
        data: {
          // Deliberately non-existent: with protection OFF this returns
          // invalid_credentials rather than doing anything.
          email: 'captcha-smoke-probe@e2e.invalid',
          password: 'not-a-real-password',
        },
      }
    );

    const body = (await res.json().catch(() => ({}))) as {
      error_code?: string;
      msg?: string;
    };

    expect(
      body.error_code,
      `Token-less auth was NOT refused by CAPTCHA (got ${res.status()} ` +
        `${body.error_code ?? '?'}: ${body.msg ?? ''}). Sign-up protection has ` +
        `regressed — check security_captcha_enabled and the Turnstile secret.`
    ).toBe('captcha_failed');
  });
});
