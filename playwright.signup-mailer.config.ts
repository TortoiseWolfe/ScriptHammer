import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for E2E that CANNOT run against the shared cloud project.
 *
 * Runs against the LOCAL Supabase stack (Mailpit), and hosts two families:
 *
 * 1. **signup-mailer** (#288) — the real sign-up form plus mail assertions. The
 *    cloud project has no readable inbox, and submitting there sent real mail to
 *    a non-existent address that hard-bounced (#361).
 *
 * 2. **captcha-blocked** (#353) — specs that submit the real sign-in form. The
 *    cloud project has `SECURITY_CAPTCHA_ENABLED`, which is global to auth, and
 *    Cloudflare withholds Turnstile tokens from automation by design, so those
 *    specs can never pass there. Locally captcha is off, so they run for real
 *    rather than sitting skipped.
 *
 * The same principle covers both: neither family is testable against production
 * config, and skipping them on cloud without a home here would be silent
 * coverage loss.
 *
 * Deliberately **no globalSetup**: the main `playwright.config.ts` globalSetup
 * requires cloud creds + the shared PRIMARY/TERTIARY users, which the ephemeral
 * local stack does not have. The captcha-blocked specs are chosen to need no
 * seeded users — they generate fresh addresses and sign in with deliberately
 * wrong passwords, so failed-attempt lockout is all they exercise.
 *
 * The CI job (`.github/workflows/signup-mailer.yml`) builds a ROOT-anchored app
 * (`DISABLE_BASE_PATH=true`) pointed at local Supabase and lets `webServer` serve
 * it; it sets `MAILPIT_URL`. Locally, set `SKIP_WEBSERVER=1` + `BASE_URL` to run
 * against an already-running dev server.
 */
require('dotenv').config();

export default defineConfig({
  // Broadened from ./tests/e2e/signup-mailer so the captcha-blocked specs can be
  // reached from their existing locations. Each project pins its own testMatch,
  // so nothing else under tests/e2e is picked up.
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    process.env.CI ? ['github'] : ['line'],
    ['json', { outputFile: 'test-results/signup-mailer-results.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 60000,
    serviceWorkers: 'block',
    contextOptions: { ignoreHTTPSErrors: true },
  },
  projects: [
    {
      name: 'signup-mailer',
      testMatch: '**/signup-mailer/**',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Specs whose subject IS the sign-in form, recovered from the cloud run
      // where CAPTCHA makes them unrunnable (#353). `captcha-guard` probes the
      // backend, so here — captcha off — they execute instead of skipping.
      //
      // These need no seeded users: they generate fresh addresses and sign in
      // with wrong passwords, exercising failed-attempt lockout. That is why
      // they fit a config with no globalSetup.
      name: 'captcha-blocked',
      testMatch: [
        '**/security/brute-force.spec.ts',
        '**/auth/rate-limiting.spec.ts',
        // Recovers the admin-confirmation case, which seeds through the admin
        // API and then signs in through the form. The other cases in that file
        // skip unconditionally (#361) and are covered by the signup-mailer
        // specs, so including the file adds exactly the one runnable test.
        '**/auth/sign-up.spec.ts',
      ],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npx serve out -l 3000',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 60 * 1000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
  outputDir: 'test-results/',
});
