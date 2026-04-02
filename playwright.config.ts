import { defineConfig, devices } from '@playwright/test';
import { TEST_VIEWPORTS } from './src/config/test-viewports';
import type { TestViewport } from './src/types/mobile-first';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
require('dotenv').config();

/**
 * Convert TestViewport to Playwright device config
 */
function createDeviceConfig(viewport: TestViewport) {
  return {
    viewport: {
      width: viewport.width,
      height: viewport.height,
    },
    deviceScaleFactor: viewport.deviceScaleFactor,
    hasTouch: viewport.hasTouch,
    isMobile: viewport.isMobile,
    ...(viewport.userAgent && { userAgent: viewport.userAgent }),
  };
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Global setup runs once before all tests - validates prerequisites */
  globalSetup: './tests/e2e/global-setup.ts',
  /* Run test files sequentially on CI to avoid parallel database contention.
   * Shard 2 messaging tests share test users in Supabase — parallel execution
   * causes page.goto timeouts, missing conversations, and Realtime failures.
   * Locally, parallel is fine (single user, no contention). */
  fullyParallel: !process.env.CI,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* 1 worker on CI: with 6 shards × 3 browsers = 18 parallel jobs,
   * intra-shard parallelism causes cross-file interference (e.g.
   * friend-requests deletes connections while encrypted-messaging
   * verifies they exist). Sequential execution within each shard
   * is fast enough since load is spread across 18 jobs. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    process.env.CI ? ['github'] : ['line'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Take screenshot on every failure */
    screenshot: 'on',
    /* Retain video on failure */
    video: 'retain-on-failure',
    /* Maximum time each action can take. 15s accounts for Supabase free tier
     * query latency after conversation selection in messaging tests. */
    actionTimeout: 15000,
    /* Navigation timeout — 60s to account for Argon2id key derivation
     * during handleReAuthModal after each page.goto('/messages') */
    navigationTimeout: 60000,
    /* Emulate mobile device capabilities */
    isMobile: false,
    /* Block service workers — they intercept navigations and cause
     * ERR_ABORTED / "frame was detached" errors during page.goto()
     * and page.reload() across all browsers, not just WebKit. */
    serviceWorkers: 'block',
    /* Context options */
    contextOptions: {
      ignoreHTTPSErrors: true,
    },
  },

  /* Configure projects with ordered execution for rate-limiting isolation */
  /* Note: storageState is set per-project (setup uses base, others use authenticated) */
  projects: [
    // ============================================================
    // AUTH SETUP: Runs once, saves authenticated browser state
    // All parallel projects depend on this and reuse the cached state.
    // ============================================================
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: {
        storageState: './tests/e2e/fixtures/storage-state.json',
      },
    },

    // ============================================================
    // ORDERED PROJECTS: Rate-limiting tests run FIRST (unauthenticated)
    // This prevents sign-up tests from exhausting Supabase's
    // IP-based rate limits before rate-limiting tests can run.
    // ============================================================

    // Rate-limiting tests - run FIRST with clean IP quota
    {
      name: 'rate-limiting',
      testDir: './tests/e2e/auth',
      testMatch: /rate-limiting\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: './tests/e2e/fixtures/storage-state.json',
      },
    },

    // Brute-force tests - run after rate-limiting
    {
      name: 'brute-force',
      testDir: './tests/e2e/security',
      testMatch: /brute-force\.spec\.ts/,
      dependencies: ['rate-limiting'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: './tests/e2e/fixtures/storage-state.json',
      },
    },

    // Sign-up tests - run LAST (consumes rate limit quota)
    {
      name: 'signup',
      testDir: './tests/e2e/auth',
      testMatch: /sign-up\.spec\.ts/,
      dependencies: ['brute-force'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: './tests/e2e/fixtures/storage-state.json',
      },
    },

    // ============================================================
    // PARALLEL PROJECTS: Pre-authenticated via storageState
    // These exclude rate-limiting, brute-force, and sign-up tests
    // ============================================================

    {
      name: 'chromium',
      testIgnore: [
        '**/examples/**', // POM tutorial, not production tests
        '**/rate-limiting.spec.ts',
        '**/brute-force.spec.ts',
        '**/sign-up.spec.ts',
        // auth.setup.ts runs via the 'setup' project dependency, not directly
        '**/auth.setup.ts',
        // These use devices['iPhone 12'] which has defaultBrowserType: 'webkit'
        // Running them in the chromium project triggers a missing webkit binary error
        '**/tests/blog-mobile-ux-iphone.spec.ts',
        '**/tests/blog-touch-targets.spec.ts',
        '**/tests/mobile-horizontal-scroll.spec.ts',
        '**/tests/mobile-navigation.spec.ts',
        '**/tests/mobile-orientation.spec.ts',
      ],
      // On CI, the auth-setup job creates storage-state-auth.json and uploads
      // it as an artifact. Each shard downloads it. Running the setup project
      // AGAIN inside each shard causes 6 concurrent nuclear cleanups that race
      // and delete each other's encryption keys/connections/conversations.
      dependencies: process.env.CI ? [] : ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: './tests/e2e/fixtures/storage-state-auth.json',
      },
    },

    {
      name: 'firefox',
      testIgnore: [
        '**/examples/**',
        '**/rate-limiting.spec.ts',
        '**/brute-force.spec.ts',
        '**/sign-up.spec.ts',
        '**/auth.setup.ts',
        '**/tests/blog-mobile-ux-iphone.spec.ts',
        '**/tests/blog-touch-targets.spec.ts',
        '**/tests/mobile-horizontal-scroll.spec.ts',
        '**/tests/mobile-navigation.spec.ts',
        '**/tests/mobile-orientation.spec.ts',
      ],
      dependencies: process.env.CI ? [] : ['setup'],
      use: {
        ...devices['Desktop Firefox'],
        storageState: './tests/e2e/fixtures/storage-state-auth.json',
      },
    },

    {
      name: 'webkit',
      testIgnore: [
        '**/examples/**',
        '**/rate-limiting.spec.ts',
        '**/brute-force.spec.ts',
        '**/sign-up.spec.ts',
        '**/auth.setup.ts',
      ],
      dependencies: process.env.CI ? [] : ['setup'],
      use: {
        ...devices['Desktop Safari'],
        storageState: './tests/e2e/fixtures/storage-state-auth.json',
      },
    },

    /* Mobile-first test viewports (PRP-017) */
    ...TEST_VIEWPORTS.filter((v) => v.category === 'mobile').map(
      (viewport) => ({
        name: `Mobile - ${viewport.name}`,
        testIgnore: [
          '**/examples/**',
          '**/rate-limiting.spec.ts',
          '**/brute-force.spec.ts',
          '**/sign-up.spec.ts',
          '**/auth.setup.ts',
        ],
        dependencies: process.env.CI ? [] : ['setup'],
        use: {
          ...createDeviceConfig(viewport),
          storageState: './tests/e2e/fixtures/storage-state-auth.json',
        },
      })
    ),

    /* Tablet viewports */
    ...TEST_VIEWPORTS.filter((v) => v.category === 'tablet').map(
      (viewport) => ({
        name: `Tablet - ${viewport.name}`,
        testIgnore: [
          '**/examples/**',
          '**/rate-limiting.spec.ts',
          '**/brute-force.spec.ts',
          '**/sign-up.spec.ts',
          '**/auth.setup.ts',
        ],
        dependencies: process.env.CI ? [] : ['setup'],
        use: {
          ...createDeviceConfig(viewport),
          storageState: './tests/e2e/fixtures/storage-state-auth.json',
        },
      })
    ),

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : process.env.CI
      ? {
          command: 'npx serve out -l 3000',
          url: 'http://localhost:3000',
          reuseExistingServer: false,
          timeout: 60 * 1000,
          stdout: 'pipe',
          stderr: 'pipe',
        }
      : {
          command: 'pnpm run dev',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
          timeout: 120 * 1000,
          stdout: 'pipe',
          stderr: 'pipe',
        },

  /* Output folders */
  outputDir: 'test-results/',
});
