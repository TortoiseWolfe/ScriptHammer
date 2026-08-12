import { test, expect } from '@playwright/test';
import { readFile } from 'fs/promises';
import { join } from 'path';
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

  test('the origin resolves: github.io redirects to the custom domain and it serves the app', async ({
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
   * The canonical/OG TAGS carry the canonical ORIGIN (#665).
   *
   * The test above was previously named "canonical origin serves the app" and
   * was the only thing anyone would look for when asking "is our canonical
   * covered?". It asserts a redirect and a 200 — it never reads a <link
   * rel="canonical"> or a single og: tag. Underneath that green check, every
   * blog post shipped 274 URLs pointing at the retired github.io project URL,
   * telling Google to credit the wrong domain and making every unfurled card
   * resolve to the wrong site.
   *
   * #479 fixed the same class of bug for sitemap.xml three months earlier and
   * concluded, in its own commit message, that "the canonical tags were never
   * wrong — measured on live prod, the home page emits scripthammer.com". The
   * home page reads NEXT_PUBLIC_DEPLOY_URL; the blog route read a different
   * variable. It was verified where it could not fail.
   *
   * So: enumerate posts from blog-data.json — the same source
   * `generateStaticParams` builds from — and assert every origin-bearing tag on
   * every post. Never a hand-written route list; that is #411.
   */
  test('every blog post stamps canonical/og/JSON-LD on the canonical origin', async ({
    request,
    baseURL,
  }) => {
    const origin = new URL(baseURL!).origin;

    // Enumerate from the SAME source `generateStaticParams` builds from, not
    // from a URL shape. A `/blog/<slug>/` regex looks authoritative and is not:
    // `/blog/seo/` matches it but is a separate route (src/app/blog/seo/) with
    // no Article JSON-LD, and `/blog/tags/` is a listing page. Asserting
    // Article metadata on either produces a permanent red for the wrong reason.
    const blogData = JSON.parse(
      await readFile(
        join(process.cwd(), 'src/lib/blog/blog-data.json'),
        'utf-8'
      )
    ) as { posts?: Array<{ slug: string }> };

    const postUrls = (blogData.posts ?? []).map(
      (p) => `${origin}/blog/${p.slug}/`
    );

    // Coverage floor. A selector or route change that silently stops matching
    // must fail loudly rather than pass by measuring nothing (#396). Never
    // lower this to make a run go green.
    const FLOOR = 10;
    console.log(`[canonical] checking ${postUrls.length} blog posts`);
    expect(
      postUrls.length,
      `only ${postUrls.length} posts found in blog-data.json — below the floor of ${FLOOR}. ` +
        `Either the data file changed shape or this probe stopped looking. Do not lower the floor.`
    ).toBeGreaterThanOrEqual(FLOOR);

    const failures: string[] = [];

    for (const postUrl of postUrls) {
      const res = await request.get(postUrl);
      if (!res.ok()) {
        failures.push(`${postUrl} → HTTP ${res.status()}`);
        continue;
      }
      const html = await res.text();

      const pick = (re: RegExp) => html.match(re)?.[1];
      const canonical = pick(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
      const ogUrl = pick(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i);
      const ogImage = pick(
        /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i
      );
      // The Article block's @id — the field that carried the mixed-case
      // github.io fingerprint, because JSON-LD is not URL-normalized.
      const jsonLdId = pick(/"@id"\s*:\s*"([^"]*\/blog\/[^"]*)"/);

      const tags: Array<[string, string | undefined]> = [
        ['canonical', canonical],
        ['og:url', ogUrl],
        ['og:image', ogImage],
        ['JSON-LD @id', jsonLdId],
      ];

      for (const [name, value] of tags) {
        if (!value) {
          failures.push(`${postUrl} — ${name} is MISSING`);
          continue;
        }
        // Case-insensitive: hosts are case-insensitive, and we want a
        // mixed-case github.io to fail on the ORIGIN check, not slip past.
        if (!value.toLowerCase().startsWith(origin.toLowerCase())) {
          failures.push(
            `${postUrl} — ${name} = ${value} (expected ${origin}…)`
          );
        }
      }

      // og:url must be the URL that actually serves this page, byte for byte.
      // `trailingSlash: true` means the slash-less form 301s, so a mismatch
      // here is a scraper following a redirect to where it already was.
      if (ogUrl && ogUrl !== postUrl) {
        failures.push(
          `${postUrl} — og:url is "${ogUrl}", which is not the URL serving it`
        );
      }
    }

    expect(
      failures,
      `wrong-origin or mismatched metadata on ${failures.length} check(s):\n${failures.join('\n')}`
    ).toEqual([]);
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

  /**
   * THE 3D ROUTE ACTUALLY RENDERS.
   *
   * `/chatt/?diorama` served a "Page Error" card in production for a day and a
   * half (from 7c3d95e1) and nothing noticed. `twin-walk-visible.spec.ts` and
   * `landmarks.spec.ts` do load /chatt — but E2E has been quota-blocked (#567,
   * #575), so neither has run. This suite is the only gate that executes against
   * the live origin, and it did not cover the route at all.
   *
   * The failure was an ASSET 404 that useGLTF threw during render straight into
   * the error boundary — a page that returns HTTP 200 and shows a stack-trace
   * card. Status-code checks cannot see it; this asserts what a visitor sees.
   */
  test('the 3D route renders instead of erroring (@smoke)', async ({
    page,
  }) => {
    const uncaught: string[] = [];
    page.on('pageerror', (e) => uncaught.push(String(e).slice(0, 200)));

    // Relative: playwright.smoke.config.ts sets baseURL to the live origin,
    // exactly as the other tests in this file do.
    const res = await page.goto('/chatt/?diorama', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(res?.status(), 'the route itself must serve').toBeLessThan(400);

    // The canvas mounts and models stream in; an error boundary replaces the
    // whole subtree, so give it long enough to have actually failed.
    await page.waitForTimeout(15_000);

    const body =
      (await page
        .locator('body')
        .innerText()
        .catch(() => '')) || '';
    expect(
      /Page Error|encountered an error and cannot be displayed/i.test(body),
      `The 3D route rendered an error boundary. Most likely an asset URL: check ` +
        `for a trailing slash on a file path (getInternalUrl vs getAssetUrl).`
    ).toBe(false);

    expect(
      uncaught,
      `Uncaught exception(s) on /chatt/?diorama: ${uncaught.join(' | ')}`
    ).toEqual([]);
  });
});
