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
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Use 4 workers on CI for faster execution (was 1, causing 30min timeouts) */
  workers: process.env.CI ? 4 : undefined,
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
    /* Maximum time each action can take */
    actionTimeout: 10000,
    /* Global timeout for each test */
    navigationTimeout: 30000,
    /* Emulate mobile device capabilities */
    isMobile: false,
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
        // These use devices['iPhone 12'] which has defaultBrowserType: 'webkit'
        // Running them in the chromium project triggers a missing webkit binary error
        '**/tests/blog-mobile-ux-iphone.spec.ts',
        '**/tests/blog-touch-targets.spec.ts',
        '**/tests/mobile-horizontal-scroll.spec.ts',
        '**/tests/mobile-navigation.spec.ts',
        '**/tests/mobile-orientation.spec.ts',
      ],
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: './tests/e2e/fixtures/storage-state-auth.json',
      },
    },

    {
      name: 'firefox',
      testIgnore: [
        '**/examples/**', // POM tutorial, not production tests
        '**/rate-limiting.spec.ts',
        '**/brute-force.spec.ts',
        '**/sign-up.spec.ts',
        // These use devices['iPhone 12'] which has defaultBrowserType: 'webkit'
        '**/tests/blog-mobile-ux-iphone.spec.ts',
        '**/tests/blog-touch-targets.spec.ts',
        '**/tests/mobile-horizontal-scroll.spec.ts',
        '**/tests/mobile-navigation.spec.ts',
        '**/tests/mobile-orientation.spec.ts',
      ],
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Firefox'],
        storageState: './tests/e2e/fixtures/storage-state-auth.json',
      },
    },

    {
      name: 'webkit',
      testIgnore: [
        '**/examples/**', // POM tutorial, not production tests
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
          '**/examples/**', // POM tutorial, not production tests
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
          '**/examples/**', // POM tutorial, not production tests
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
