/**
 * Test configuration for component structure scripts
 * Uses Node.js built-in test runner for simplicity
 */

const path = require('path');

module.exports = {
  // Test file patterns
  testPatterns: ['**/__tests__/**/*.test.js', '**/__tests__/**/*.spec.js'],

  // Test directories
  testDirs: {
    unit: path.join(__dirname, '__tests__'),
    integration: path.join(__dirname, '__tests__', 'integration'),
    contract: path.join(__dirname, '__tests__', 'contract'),
    fixtures: path.join(__dirname, '__tests__', 'fixtures'),
  },

  // Test helpers
  helpers: {
    /**
     * Create a mock file system structure for testing
     */
    createMockFS: (structure) => {
      const mockFS = {};
      Object.entries(structure).forEach(([path, content]) => {
        mockFS[path] = content;
      });
      return mockFS;
    },

    /**
     * Assert component structure is valid
     */
    assertComponentStructure: (component) => {
      const requiredFiles = [
        'index.tsx',
        `${component.name}.tsx`,
        `${component.name}.test.tsx`,
        `${component.name}.stories.tsx`,
      ];
      return requiredFiles.every((file) => component.files.includes(file));
    },

    /**
     * Create a test component directory structure
     */
    createTestComponent: (name, category = 'atomic', isCompliant = true) => {
      const base = `src/components/${category}/${name}`;
      const structure = {};

      if (isCompliant) {
        structure[`${base}/index.tsx`] = `export { default } from './${name}';`;
        structure[`${base}/${name}.tsx`] =
          `export default function ${name}() { return <div>${name}</div>; }`;
        structure[`${base}/${name}.test.tsx`] =
          `describe('${name}', () => { it('renders', () => {}); });`;
        structure[`${base}/${name}.stories.tsx`] =
          `export default { title: '${category}/${name}' };`;
      } else {
        // Non-compliant: missing some files
        structure[`${base}/${name}.tsx`] =
          `export default function ${name}() { return <div>${name}</div>; }`;
        if (Math.random() > 0.5) {
          structure[`${base}/${name}.stories.tsx`] =
            `export default { title: '${category}/${name}' };`;
        }
      }

      return structure;
    },
  },

  // Test runner configuration
  runner: {
    // Use Node.js test runner
    command: 'node',
    args: ['--test'],

    // Test timeout
    timeout: 5000,

    // Enable colors in output
    colors: true,

    // Verbose output
    verbose: process.env.VERBOSE === 'true',
  },
};
