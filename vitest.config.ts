import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // Environment
    environment: 'jsdom',
    globals: true,

    // Test file patterns (5-file pattern compliance)
    include: [
      'src/**/*.test.{ts,tsx}',
      'src/**/*.accessibility.test.{ts,tsx}',
    ],
    exclude: ['node_modules', 'dist', '.next', 'e2e'],

    // Setup files
    setupFiles: ['./src/test/setup.ts'],

    // Coverage (Constitution: 25% minimum)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.stories.{ts,tsx}',
        'src/**/*.accessibility.test.{ts,tsx}',
        'src/**/index.{ts,tsx}',
        'src/test/**',
        'src/types/**',
      ],
      thresholds: {
        statements: 25,
        branches: 25,
        functions: 25,
        lines: 25,
      },
    },

    // Reporter
    reporters: ['default', 'html'],

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,

    // Watch mode
    watch: false,

    // MSW support for API mocking
    server: {
      deps: {
        inline: ['msw'],
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
