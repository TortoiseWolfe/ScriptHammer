import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
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
      'e2e/**', // Exclude Playwright E2E tests
      '**/.component-backup-*/**', // Exclude backup directories
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
        'src/test/**',
        'e2e/**',
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
    },
  },
});
