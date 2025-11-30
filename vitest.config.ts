import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    exclude: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'scripts/**/*.test.js', // Exclude Node.js test runner tests
      'scripts/__tests__/**', // Exclude all script tests
      'tests/e2e/**', // Exclude Playwright E2E tests
      '**/.component-backup-*/**', // Exclude backup directories
      // Exclude intentional TDD placeholder tests (not yet implemented)
      'tests/contract/email-notifications.test.ts', // 17 TDD failures
      'tests/contract/stripe-webhook.test.ts', // 14 TDD failures
      'tests/contract/paypal-webhook.test.ts', // 15 TDD failures
      // Exclude contract/integration tests requiring dedicated test Supabase instance
      // These tests require specific configuration and will hit rate limits on shared instances
      // Run with: pnpm test tests/contract --run or pnpm test tests/integration when test DB is properly configured
      'tests/contract/auth/oauth.contract.test.ts', // 1 test - config mismatch
      'tests/contract/auth/password-reset.contract.test.ts', // 2 tests - rate limit
      'tests/contract/auth/sign-up.contract.test.ts', // 4 tests - rate limit + config
      'tests/contract/profile/delete-account.contract.test.ts', // 4 tests - requires test data
      'tests/integration/auth/oauth-flow.test.ts', // 6 tests - rate limit
      'tests/integration/auth/password-reset-flow.test.ts', // 2 tests - rate limit
      'tests/integration/auth/protected-routes.test.ts', // 10 tests - flaky/rate limit
      'tests/integration/auth/sign-in-flow.test.ts', // 7 tests - rate limit
      'tests/integration/auth/sign-up-flow.test.ts', // 5 tests - rate limit + config
      // Exclude avatar integration tests requiring real browser Canvas API
      // These are covered by E2E tests in /e2e/avatar/upload.spec.ts
      'src/lib/avatar/__tests__/image-processing.test.ts', // 6 tests - requires real Canvas
      'src/lib/avatar/__tests__/validation.test.ts', // 7 tests - createImageBitmap dimension checks need real browser
      'tests/integration/avatar/upload-flow.integration.test.ts', // 4 tests - requires real browser
      // Exclude messaging schema verification - hits real Supabase, rate limit / transient failures
      'tests/integration/messaging/database-setup.test.ts', // DB schema verification - run manually after migrations
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        '**/*.stories.tsx',
        '**/*.config.*',
        '.next/**',
        'out/**',
        'public/**',
        '.storybook/**',
        'storybook-static/**',
        '**/*.bundle.js',
        '**/mockServiceWorker.js',
        '**/sw.js',
        '**/__mocks__/**',
        '**/test/**',
        '**/*.test.*',
        '**/*.accessibility.test.*',
        'tests/**',
        'scripts/**',
      ],
      thresholds: {
        statements: 25,
        branches: 25,
        functions: 25,
        lines: 25,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});
