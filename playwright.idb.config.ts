/**
 * Cross-browser IndexedDB capability probe (#1209).
 *
 * SEPARATE FROM `playwright.config.ts` ON PURPOSE. That config carries a `globalSetup`
 * which creates and sweeps Supabase users, a `webServer`, and a required-env preflight —
 * none of which this probe needs. It drives a synthetic intercepted origin and measures
 * the browser, so it must be runnable with no backend, no build and no credentials.
 *
 * DELIBERATELY ENV-FREE. `scripts/__tests__/playwright-env-forwarding.test.js` derives the
 * forwarded-variable list by walking every root `playwright*.config.ts` for `process.env.X`
 * and fails when that list drifts from the runner's filter. Reading an env var here would
 * mean editing `scripts/ci/playwright-in-container.sh` too; there is nothing to configure,
 * so there is nothing to read.
 *
 * The spec lives in `tests/idb/`, not `tests/e2e/`, for the same reason — that guard walks
 * `tests/e2e/**` as well.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/idb',
  // All three engines is the entire point: the defect is one engine disagreeing with the
  // other two, and a single-browser run cannot see it.
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 3,
  reporter: [['list']],
  use: { trace: 'off', video: 'off', screenshot: 'off' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
