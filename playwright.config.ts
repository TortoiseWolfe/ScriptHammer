import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E test configuration
 * Constitution: Chromium, Firefox, WebKit browsers required
 */
export default defineConfig({
  // Test directory
  testDir: './e2e',
  testMatch: '**/*.spec.ts',

  // Parallel execution
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,

  // Fail fast in CI
  forbidOnly: !!process.env.CI,

  // Retries for flaky tests
  retries: process.env.CI ? 2 : 0,

  // Reporter
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['list'],
  ],

  // Shared settings
  use: {
    // Base URL for static export (GitHub Pages)
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',

    // Collect trace on failure
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure (for debugging)
    video: 'on-first-retry',

    // Accessibility testing support
    bypassCSP: true,
  },

  // Timeouts
  timeout: 30000,
  expect: {
    timeout: 5000,
  },

  // Output directory for test artifacts
  outputDir: 'test-results',

  // Projects (Constitution: Chromium, Firefox, WebKit)
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile browsers (Constitution: mobile-first, 44px touch targets)
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Web server configuration
  webServer: {
    command: 'pnpm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
