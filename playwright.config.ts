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
 * #116 Phase 2 — messaging specs converted to per-test fixture isolation
 * (seedIsolatedConversation / openAsViewer). These own their data, so they run
 * in a parallel `*-msg-iso` project at workers>1 instead of the serial
 * `*-msg` shard. Add a spec here as it is converted; the serial `*-msg` project
 * `testIgnore`s this same list so nothing runs twice.
 *
 * NOTE: this is the SINGLE source of truth — `MSG_ISO_GLOBS` is used as the iso
 * projects' `testMatch` AND the serial projects' `testIgnore`.
 */
const MSG_ISO_GLOBS = [
  '**/messaging/encrypted-messaging.spec.ts',
  '**/messaging/real-time-delivery.spec.ts',
  '**/messaging/offline-queue.spec.ts',
  '**/messaging/offline-queue-sync.spec.ts',
  '**/messaging/cross-window-delivery.spec.ts',
  '**/messaging/complete-user-workflow.spec.ts',
  '**/messaging/message-delete-placeholder.spec.ts',
  '**/messaging/message-editing.spec.ts',
  '**/messaging/performance.spec.ts',
  '**/messaging/oauth-setup-modal.spec.ts',
  '**/messaging/gdpr-compliance.spec.ts',
  '**/messaging/friend-requests.spec.ts',
  '**/messaging/group-chat-multiuser.spec.ts',
  // The local-only spike still lives in the iso project so it stays parallel;
  // it self-skips in CI. Removed once it's deleted at the end of Phase 2.
  '**/messaging/fixture-isolation.spike.spec.ts',
];

/* Parallelism for the iso projects is driven by Playwright's `--workers` CLI
 * flag passed per CI job (so only the iso shard runs workers>1; gen/serial msg
 * stay at the global `workers:1`). Locally, `fullyParallel` on the iso project
 * + the default worker pool gives parallelism for free. */

/* Per-test budget for the iso messaging projects. A bidirectional test opens
 * TWO browser contexts, each paying a gate-load (~11s) + Argon2id unlock (~3s,
 * TIME_COST=3 — never lowered) before the first send. The Playwright default
 * (30s) is exhausted by the two opens alone, so the test would time out and its
 * afterEach would cascade-delete the partner's key mid-send → a spurious 406
 * "needs to sign in". Size the budget to the work this slice actually does.
 * Scoped to the iso projects so real hangs elsewhere still fail fast. */
const MSG_ISO_TIMEOUT = 180_000;

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

    // Messaging tests isolated into their own project — sharded separately
    // in CI to prevent state contention (friend-requests deletes connections
    // that encrypted-messaging/group-chat/offline-queue need).
    // Serial (workers:1): the UNconverted specs that still share PRIMARY/TERTIARY.
    {
      name: 'chromium-msg',
      testMatch: '**/messaging/**',
      testIgnore: ['**/examples/**', ...MSG_ISO_GLOBS],
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: './tests/e2e/fixtures/storage-state-auth.json',
      },
    },

    // #116 Phase 2: messaging specs converted to per-test fixture isolation.
    // These own their data, so they run fully parallel (workers>1 via the CI
    // job's `--workers` flag). storageState is irrelevant — each test injects
    // its own throwaway viewer session — but kept for parity.
    {
      name: 'chromium-msg-iso',
      testMatch: MSG_ISO_GLOBS,
      fullyParallel: true,
      timeout: MSG_ISO_TIMEOUT,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: './tests/e2e/fixtures/storage-state-auth.json',
      },
    },

    // General (non-messaging) tests
    {
      name: 'chromium-gen',
      testIgnore: [
        '**/messaging/**', // handled by chromium-msg
        '**/examples/**', // POM tutorial, not production tests
        '**/rate-limiting.spec.ts',
        '**/brute-force.spec.ts',
        '**/sign-up.spec.ts',
      ],
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: './tests/e2e/fixtures/storage-state-auth.json',
      },
    },

    // Firefox: split into msg/gen the same way as chromium
    {
      name: 'firefox-msg',
      testMatch: '**/messaging/**',
      testIgnore: ['**/examples/**', ...MSG_ISO_GLOBS],
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Firefox'],
        storageState: './tests/e2e/fixtures/storage-state-auth.json',
      },
    },
    {
      name: 'firefox-msg-iso',
      testMatch: MSG_ISO_GLOBS,
      fullyParallel: true,
      timeout: MSG_ISO_TIMEOUT,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Firefox'],
        storageState: './tests/e2e/fixtures/storage-state-auth.json',
      },
    },
    {
      name: 'firefox-gen',
      testIgnore: [
        '**/messaging/**',
        '**/examples/**',
        '**/rate-limiting.spec.ts',
        '**/brute-force.spec.ts',
        '**/sign-up.spec.ts',
      ],
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Firefox'],
        storageState: './tests/e2e/fixtures/storage-state-auth.json',
      },
    },

    // WebKit: split into msg/gen the same way as chromium
    {
      name: 'webkit-msg',
      testMatch: '**/messaging/**',
      testIgnore: ['**/examples/**', ...MSG_ISO_GLOBS],
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Safari'],
        storageState: './tests/e2e/fixtures/storage-state-auth.json',
      },
    },
    {
      name: 'webkit-msg-iso',
      testMatch: MSG_ISO_GLOBS,
      fullyParallel: true,
      timeout: MSG_ISO_TIMEOUT,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Safari'],
        storageState: './tests/e2e/fixtures/storage-state-auth.json',
      },
    },
    {
      name: 'webkit-gen',
      testIgnore: [
        '**/messaging/**',
        '**/examples/**',
        '**/rate-limiting.spec.ts',
        '**/brute-force.spec.ts',
        '**/sign-up.spec.ts',
      ],
      dependencies: ['setup'],
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
        ],
        dependencies: ['setup'],
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
        ],
        dependencies: ['setup'],
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
