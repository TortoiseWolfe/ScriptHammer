/**
 * ESLint configuration for scripts directory
 * Node.js environment with CommonJS modules
 */

module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'script',
  },
  rules: {
    // Enforce consistent indentation
    indent: ['error', 2],

    // Require semicolons
    semi: ['error', 'always'],

    // Enforce single quotes
    quotes: ['error', 'single', { avoidEscape: true }],

    // Require trailing commas in multiline objects
    'comma-dangle': ['error', 'always-multiline'],

    // Disallow unused variables
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

    // Require const for never reassigned variables
    'prefer-const': 'error',

    // Disallow console in production
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',

    // Require strict mode
    strict: ['error', 'global'],

    // Max line length
    'max-len': ['error', { code: 120, ignoreComments: true }],

    // Require JSDoc comments
    'require-jsdoc': [
      'warn',
      {
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
          ClassDeclaration: true,
        },
      },
    ],
  },
};
