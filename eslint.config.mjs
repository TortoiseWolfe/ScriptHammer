// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook';

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.next-basepath/**',
      'out/**',
      'out-basepath/**',
      'serve-root/**',
      'build/**',
      'next-env.d.ts',
      'coverage/**',
      'scripts/**',
      'storybook-static/**',
      'playwright-report/**',
      'test-results/**',
      '.pnpm-store/**',
      'dist/**',
      'public/mockServiceWorker.js',
      // Generated vendor output: scripts/sync-cesium.sh copies ~8MB of prebuilt
      // CesiumJS runtime assets here from node_modules. Its Workers/ bundles are
      // minified but not named *.min.js, so the patterns below miss them and
      // ESLint reports no-this-alias against Cesium's own compiled output.
      'public/cesium/**',
      '*.min.js',
      '**/*.min.js',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'react/no-children-prop': 'off',
    },
  },
  ...storybook.configs['flat/recommended'],
];

export default eslintConfig;
