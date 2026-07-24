import { defineConfig, devices } from '@playwright/test';

/**
 * Dedicated Playwright config for the real-form signup + mail-catcher E2E (#288).
 *
 * Runs against the LOCAL Supabase stack (Mailpit), NOT the shared cloud project —
 * the cloud project has no readable inbox. It deliberately has **no globalSetup**:
 * the main `playwright.config.ts` globalSetup requires cloud creds + the shared
 * PRIMARY/TERTIARY users, which the ephemeral local stack does not have.
 *
 * The CI job (`.github/workflows/signup-mailer.yml`) builds a ROOT-anchored app
 * (`DISABLE_BASE_PATH=true`) pointed at local Supabase and lets `webServer` serve
 * it; it sets `MAILPIT_URL`. Locally, set `SKIP_WEBSERVER=1` + `BASE_URL` to run
 * against an already-running dev server.
 */
require('dotenv').config();

export default defineConfig({
  testDir: './tests/e2e/signup-mailer',
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
  projects: [{ name: 'signup-mailer', use: { ...devices['Desktop Chrome'] } }],
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
