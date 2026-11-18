import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest config for RLS (Row Level Security) tests.
 *
 * Separate from the main vitest.config.ts because:
 * - RLS tests need a live Supabase instance (local or cloud)
 * - They don't need jsdom, React, or the mock setup
 * - The main config excludes them so CI doesn't fail on missing infra
 *
 * Run: pnpm test:rls
 */
export default defineConfig({
  test: {
    include: [
      'tests/rls/**/*.test.ts',
      // #266 provider-conformance runners are live cross-user round-trips —
      // same infra needs as the RLS suite (live Supabase + service role +
      // stale-user cleanup + sequential execution).
      'tests/contract/messaging-provider.*.test.ts',
      // Admin RPC shape contract: needs a live backend AND a seeded admin whose
      // password arrives as SEED_ADMIN_PASSWORD (#1246, #1379). Excluded from the
      // default config; conformance.yml seeds the admin and runs it here.
      'tests/contract/admin/admin-access.contract.test.ts',
      // Contract auth tests: need live Supabase + service role for user lifecycle.
      // Conformance lane brings up local stack and seeds test users.
      'tests/contract/auth/sign-out.contract.test.ts',
      'tests/contract/auth/sign-in.contract.test.ts',
      'tests/contract/auth/sign-up.contract.test.ts',
      'tests/contract/auth/password-reset.contract.test.ts',
      'tests/contract/profile/get-profile.contract.test.ts',
      'tests/contract/profile/update-profile.contract.test.ts',
      'tests/contract/profile/delete-account.contract.test.ts',
    ],
    globals: true,
    // conformance.yml sets VITEST_JSON_REPORT so assert-no-skipped.mjs can read a
    // machine report after the run (#1379). Unset, the run is the plain default.
    reporters: process.env.VITEST_JSON_REPORT
      ? ['default', ['json', { outputFile: process.env.VITEST_JSON_REPORT }]]
      : ['default'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Scrub stale *@scripthammer.test users + orphan FK rows before any
    // test file collects. Defends against killed prior runs leaving
    // payment_intents that block createTestUser's deleteUser. (#50)
    globalSetup: ['./tests/rls/__setup__/cleanup-stale.ts'],
    // Sequential execution: test files share test users on the same
    // Supabase instance, so parallel runs cause create/delete races.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
