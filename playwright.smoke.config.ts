import { defineConfig, devices } from '@playwright/test';

/**
 * Dedicated Playwright config for the post-deploy production @smoke suite (#288).
 *
 * Runs against the LIVE deployed origin — `BASE_URL` (e.g. https://scripthammer.com)
 * and `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` (the prod project).
 * It has **no `globalSetup`** (the main config's globalSetup hard-requires a
 * service-role key + shared test users and would abort — and we never want that
 * firing against prod) and **no `webServer`** (the site is already deployed).
 * All checks are read-only. Driven by `.github/workflows/smoke.yml`.
 */
require('dotenv').config();

export default defineConfig({
  testDir: './tests/e2e/smoke',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    process.env.CI ? ['github'] : ['line'],
    ['json', { outputFile: 'test-results/smoke-results.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://scripthammer.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
    navigationTimeout: 60000,
    actionTimeout: 15000,
    contextOptions: { ignoreHTTPSErrors: true },
  },
  projects: [{ name: 'smoke', use: { ...devices['Desktop Chrome'] } }],
  outputDir: 'test-results/',
});
