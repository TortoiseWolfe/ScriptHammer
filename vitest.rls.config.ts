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
    include: ['tests/rls/**/*.test.ts'],
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
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
