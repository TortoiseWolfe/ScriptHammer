/**
 * Unit tests for migrate-components module
 * These tests MUST fail initially (TDD approach)
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

// This will fail initially - module doesn't exist yet
let migrateComponents;
try {
  migrateComponents = require('../migrate-components');
} catch (e) {
  // Expected to fail in TDD
  migrateComponents = null;
}

describe('migrate-components', () => {
  describe('module structure', () => {
    it('should export a function', () => {
      assert.strictEqual(
        typeof migrateComponents,
        'function',
        'migrate-components should export a function'
      );
    });

    it('should accept options parameter', () => {
      assert.doesNotThrow(() => {
        if (migrateComponents)
          migrateComponents({ path: 'src/components', dryRun: true });
      });
    });
  });

  describe('migration process', () => {
    const testDir = path.join(__dirname, 'test-migration');

    beforeEach(() => {
      // Create test directory structure with non-compliant components
      fs.mkdirSync(testDir, { recursive: true });

      // Component missing index.tsx
      const missingIndexDir = path.join(testDir, 'MissingIndex');
      fs.mkdirSync(missingIndexDir, { recursive: true });
      fs.writeFileSync(
        path.join(missingIndexDir, 'MissingIndex.tsx'),
        'export default function MissingIndex() {}'
      );
      fs.writeFileSync(
        path.join(missingIndexDir, 'MissingIndex.test.tsx'),
        'test("renders", () => {});'
      );
      fs.writeFileSync(
        path.join(missingIndexDir, 'MissingIndex.stories.tsx'),
        'export default { title: "MissingIndex" };'
      );

      // Component missing test file
      const missingTestDir = path.join(testDir, 'MissingTest');
      fs.mkdirSync(missingTestDir, { recursive: true });
      fs.writeFileSync(
        path.join(missingTestDir, 'index.tsx'),
        'export { default } from "./MissingTest";'
      );
      fs.writeFileSync(
        path.join(missingTestDir, 'MissingTest.tsx'),
        'export default function MissingTest() {}'
      );
      fs.writeFileSync(
        path.join(missingTestDir, 'MissingTest.stories.tsx'),
        'export default { title: "MissingTest" };'
      );

      // Component missing multiple files
      const minimalDir = path.join(testDir, 'MinimalComponent');
      fs.mkdirSync(minimalDir, { recursive: true });
      fs.writeFileSync(
        path.join(minimalDir, 'MinimalComponent.tsx'),
        'export default function MinimalComponent() {}'
      );
    });

    afterEach(() => {
      // Clean up test directory
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('should identify components needing migration', () => {
      if (!migrateComponents) {
        assert.fail('migrate-components module not found');
      }

      const result = migrateComponents({ path: testDir, dryRun: true });
      assert.ok(result.toMigrate, 'Should have toMigrate list');
      assert.strictEqual(
        result.toMigrate.length,
        3,
        'Should identify 3 components needing migration'
      );
    });

    it('should create missing index.tsx files', () => {
      if (!migrateComponents) {
        assert.fail('migrate-components module not found');
      }

      migrateComponents({ path: testDir, dryRun: false });

      const indexPath = path.join(testDir, 'MissingIndex', 'index.tsx');
      assert.ok(fs.existsSync(indexPath), 'Should create missing index.tsx');

      const content = fs.readFileSync(indexPath, 'utf8');
      assert.ok(
        content.includes('export { default } from'),
        'Index should have correct export'
      );
      assert.ok(
        content.includes('MissingIndex'),
        'Index should reference component name'
      );
    });

    it('should create missing test files', () => {
      if (!migrateComponents) {
        assert.fail('migrate-components module not found');
      }

      migrateComponents({ path: testDir, dryRun: false });

      const testPath = path.join(
        testDir,
        'MissingTest',
        'MissingTest.test.tsx'
      );
      assert.ok(fs.existsSync(testPath), 'Should create missing test file');

      const content = fs.readFileSync(testPath, 'utf8');
      assert.ok(
        content.includes('describe'),
        'Test should have describe block'
      );
      assert.ok(
        content.includes('MissingTest'),
        'Test should reference component name'
      );
      assert.ok(
        content.includes('renders'),
        'Test should have basic render test'
      );
    });

    it('should create missing story files', () => {
      if (!migrateComponents) {
        assert.fail('migrate-components module not found');
      }

      migrateComponents({ path: testDir, dryRun: false });

      const storyPath = path.join(
        testDir,
        'MinimalComponent',
        'MinimalComponent.stories.tsx'
      );
      assert.ok(fs.existsSync(storyPath), 'Should create missing story file');

      const content = fs.readFileSync(storyPath, 'utf8');
      assert.ok(
        content.includes('export default'),
        'Story should have default export'
      );
      assert.ok(content.includes('title:'), 'Story should have title');
      assert.ok(
        content.includes('MinimalComponent'),
        'Story should reference component name'
      );
    });

    it('should respect dry-run mode', () => {
      if (!migrateComponents) {
        assert.fail('migrate-components module not found');
      }

      const result = migrateComponents({ path: testDir, dryRun: true });

      // Check that files were NOT created
      const indexPath = path.join(testDir, 'MissingIndex', 'index.tsx');
      assert.ok(
        !fs.existsSync(indexPath),
        'Should NOT create files in dry-run mode'
      );

      // But should report what would be done
      assert.ok(result.planned, 'Should have planned actions');
      assert.ok(result.planned.length > 0, 'Should have planned migrations');
    });
  });

  describe('backup functionality', () => {
    const testDir = path.join(__dirname, 'test-backup');

    beforeEach(() => {
      fs.mkdirSync(testDir, { recursive: true });
      const componentDir = path.join(testDir, 'TestComponent');
      fs.mkdirSync(componentDir, { recursive: true });
      fs.writeFileSync(
        path.join(componentDir, 'TestComponent.tsx'),
        'export default function TestComponent() {}'
      );
    });

    afterEach(() => {
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('should create backup before migration', () => {
      if (!migrateComponents) {
        assert.fail('migrate-components module not found');
      }

      const result = migrateComponents({ path: testDir, backup: true });
      assert.ok(result.backupPath, 'Should return backup path');
      assert.ok(
        fs.existsSync(result.backupPath),
        'Backup directory should exist'
      );
    });

    it('should skip backup when disabled', () => {
      if (!migrateComponents) {
        assert.fail('migrate-components module not found');
      }

      const result = migrateComponents({ path: testDir, backup: false });
      assert.ok(!result.backupPath, 'Should not create backup when disabled');
    });
  });

  describe('error handling', () => {
    it('should handle write permission errors', () => {
      if (!migrateComponents) {
        assert.fail('migrate-components module not found');
      }

      assert.doesNotThrow(() => {
        const result = migrateComponents({
          path: '/root/protected',
          dryRun: true,
        });
        assert.ok(
          result.error || result.toMigrate.length === 0,
          'Should handle permission errors'
        );
      });
    });

    it('should handle invalid component names', () => {
      if (!migrateComponents) {
        assert.fail('migrate-components module not found');
      }

      const testDir = path.join(__dirname, 'test-invalid');
      fs.mkdirSync(testDir, { recursive: true });

      // Create component with invalid name
      const invalidDir = path.join(testDir, '123-invalid');
      fs.mkdirSync(invalidDir, { recursive: true });
      fs.writeFileSync(
        path.join(invalidDir, 'component.tsx'),
        'export default function Component() {}'
      );

      try {
        const result = migrateComponents({ path: testDir });
        assert.ok(
          result.skipped && result.skipped.length > 0,
          'Should skip invalid components'
        );
      } finally {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });
  });

  describe('reporting', () => {
    it('should generate migration report', () => {
      if (!migrateComponents) {
        assert.fail('migrate-components module not found');
      }

      const result = migrateComponents({
        path: 'src/components',
        dryRun: true,
      });

      assert.ok(result.report, 'Should generate report');
      assert.ok(
        typeof result.report.migrated === 'number',
        'Should count migrated components'
      );
      assert.ok(
        typeof result.report.failed === 'number',
        'Should count failed migrations'
      );
      assert.ok(
        typeof result.report.skipped === 'number',
        'Should count skipped components'
      );
    });

    it('should log progress during migration', () => {
      if (!migrateComponents) {
        assert.fail('migrate-components module not found');
      }

      const originalLog = console.log;
      let logs = [];
      console.log = (msg) => logs.push(msg);

      try {
        migrateComponents({ path: 'src/components', verbose: true });
        assert.ok(
          logs.some((log) => log.includes('Migrating')),
          'Should log migration progress'
        );
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('template generation', () => {
    it('should use correct template for index files', () => {
      if (!migrateComponents) {
        assert.fail('migrate-components module not found');
      }

      const template = migrateComponents.getIndexTemplate || (() => '');
      const result = template('ButtonComponent');

      assert.ok(result.includes('export { default }'), 'Should export default');
      assert.ok(
        result.includes('ButtonComponent'),
        'Should include component name'
      );
      assert.ok(result.includes('Props'), 'Should export props type');
    });

    it('should use correct template for test files', () => {
      if (!migrateComponents) {
        assert.fail('migrate-components module not found');
      }

      const template = migrateComponents.getTestTemplate || (() => '');
      const result = template('CardComponent');

      assert.ok(result.includes('describe'), 'Should have describe block');
      assert.ok(
        result.includes('CardComponent'),
        'Should include component name'
      );
      assert.ok(result.includes('it('), 'Should have test case');
      assert.ok(result.includes('render'), 'Should test rendering');
    });

    it('should use correct template for story files', () => {
      if (!migrateComponents) {
        assert.fail('migrate-components module not found');
      }

      const template = migrateComponents.getStoryTemplate || (() => '');
      const result = template('ModalComponent', 'atomic');

      assert.ok(result.includes('Meta'), 'Should have Meta type');
      assert.ok(
        result.includes('ModalComponent'),
        'Should include component name'
      );
      assert.ok(result.includes('atomic'), 'Should include category');
      assert.ok(result.includes('Default'), 'Should have default story');
    });
  });
});
