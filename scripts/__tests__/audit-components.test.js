/**
 * Unit tests for audit-components module
 * These tests MUST fail initially (TDD approach)
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

// This will fail initially - module doesn't exist yet
let auditComponents;
try {
  auditComponents = require('../audit-components');
} catch (e) {
  // Expected to fail in TDD
  auditComponents = null;
}

describe('audit-components', () => {
  describe('module structure', () => {
    it('should export a function', () => {
      assert.strictEqual(
        typeof auditComponents,
        'function',
        'audit-components should export a function'
      );
    });

    it('should accept options parameter', () => {
      assert.doesNotThrow(() => {
        if (auditComponents) auditComponents({ path: 'src/components' });
      });
    });
  });

  describe('component detection', () => {
    const testDir = path.join(__dirname, 'test-components');

    beforeEach(() => {
      // Create test directory structure
      fs.mkdirSync(testDir, { recursive: true });

      // Create compliant component
      const compliantDir = path.join(testDir, 'CompliantButton');
      fs.mkdirSync(compliantDir, { recursive: true });
      fs.writeFileSync(
        path.join(compliantDir, 'index.tsx'),
        'export { default } from "./CompliantButton";'
      );
      fs.writeFileSync(
        path.join(compliantDir, 'CompliantButton.tsx'),
        'export default function CompliantButton() {}'
      );
      fs.writeFileSync(
        path.join(compliantDir, 'CompliantButton.test.tsx'),
        'test("renders", () => {});'
      );
      fs.writeFileSync(
        path.join(compliantDir, 'CompliantButton.stories.tsx'),
        'export default { title: "CompliantButton" };'
      );

      // Create non-compliant component (missing files)
      const nonCompliantDir = path.join(testDir, 'NonCompliantCard');
      fs.mkdirSync(nonCompliantDir, { recursive: true });
      fs.writeFileSync(
        path.join(nonCompliantDir, 'NonCompliantCard.tsx'),
        'export default function NonCompliantCard() {}'
      );
    });

    afterEach(() => {
      // Clean up test directory
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('should detect compliant components', () => {
      if (!auditComponents) {
        assert.fail('audit-components module not found');
      }

      const result = auditComponents({ path: testDir });
      assert.ok(
        result.compliant.includes('CompliantButton'),
        'Should detect CompliantButton as compliant'
      );
      assert.strictEqual(
        result.compliant.length,
        1,
        'Should have exactly 1 compliant component'
      );
    });

    it('should detect non-compliant components', () => {
      if (!auditComponents) {
        assert.fail('audit-components module not found');
      }

      const result = auditComponents({ path: testDir });
      assert.ok(
        result.nonCompliant.some((c) => c.name === 'NonCompliantCard'),
        'Should detect NonCompliantCard as non-compliant'
      );
    });

    it('should identify missing files', () => {
      if (!auditComponents) {
        assert.fail('audit-components module not found');
      }

      const result = auditComponents({ path: testDir });
      const nonCompliant = result.nonCompliant.find(
        (c) => c.name === 'NonCompliantCard'
      );

      assert.ok(nonCompliant, 'Should find NonCompliantCard');
      assert.ok(
        nonCompliant.missing.includes('index.tsx'),
        'Should identify missing index.tsx'
      );
      assert.ok(
        nonCompliant.missing.includes('NonCompliantCard.test.tsx'),
        'Should identify missing test file'
      );
      assert.ok(
        nonCompliant.missing.includes('NonCompliantCard.stories.tsx'),
        'Should identify missing stories file'
      );
    });
  });

  describe('reporting', () => {
    it('should generate summary statistics', () => {
      if (!auditComponents) {
        assert.fail('audit-components module not found');
      }

      const result = auditComponents({ path: 'src/components' });

      assert.ok(result.summary, 'Should have summary object');
      assert.ok(
        typeof result.summary.total === 'number',
        'Should have total count'
      );
      assert.ok(
        typeof result.summary.compliant === 'number',
        'Should have compliant count'
      );
      assert.ok(
        typeof result.summary.nonCompliant === 'number',
        'Should have non-compliant count'
      );
      assert.ok(
        typeof result.summary.complianceRate === 'number',
        'Should have compliance rate'
      );
    });

    it('should support JSON format output', () => {
      if (!auditComponents) {
        assert.fail('audit-components module not found');
      }

      const result = auditComponents({
        path: 'src/components',
        format: 'json',
      });

      assert.ok(typeof result === 'object', 'JSON format should return object');
      assert.ok(result.timestamp, 'Should include timestamp');
      assert.ok(
        Array.isArray(result.components),
        'Should have components array'
      );
    });

    it('should support console format output', () => {
      if (!auditComponents) {
        assert.fail('audit-components module not found');
      }

      // Capture console output
      const originalLog = console.log;
      let consoleOutput = '';
      console.log = (msg) => {
        consoleOutput += msg + '\n';
      };

      try {
        auditComponents({ path: 'src/components', format: 'console' });
        assert.ok(
          consoleOutput.includes('Component Structure Audit Report'),
          'Should output report header'
        );
        assert.ok(
          consoleOutput.includes('Compliant:'),
          'Should show compliant count'
        );
        assert.ok(
          consoleOutput.includes('Non-compliant:'),
          'Should show non-compliant count'
        );
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('error handling', () => {
    it('should handle invalid path gracefully', () => {
      if (!auditComponents) {
        assert.fail('audit-components module not found');
      }

      assert.doesNotThrow(() => {
        const result = auditComponents({ path: '/non/existent/path' });
        assert.ok(
          result.error || result.components.length === 0,
          'Should handle non-existent path'
        );
      });
    });

    it('should handle permission errors', () => {
      if (!auditComponents) {
        assert.fail('audit-components module not found');
      }

      // This might not fail on all systems, but should be handled gracefully
      assert.doesNotThrow(() => {
        auditComponents({ path: '/root' });
      });
    });
  });

  describe('file validation', () => {
    it('should validate index.tsx exports', () => {
      if (!auditComponents) {
        assert.fail('audit-components module not found');
      }

      const validation = auditComponents.validateIndexFile || (() => false);
      const validContent = 'export { default } from "./Component";';
      const invalidContent = '// empty file';

      assert.ok(
        validation(validContent),
        'Should validate correct index export'
      );
      assert.ok(
        !validation(invalidContent),
        'Should reject invalid index content'
      );
    });

    it('should validate test file structure', () => {
      if (!auditComponents) {
        assert.fail('audit-components module not found');
      }

      const validation = auditComponents.validateTestFile || (() => false);
      const validContent =
        'describe("Component", () => { it("renders", () => {}); });';
      const invalidContent = '// no tests';

      assert.ok(validation(validContent), 'Should validate test structure');
      assert.ok(
        !validation(invalidContent),
        'Should reject file without tests'
      );
    });

    it('should validate story file structure', () => {
      if (!auditComponents) {
        assert.fail('audit-components module not found');
      }

      const validation = auditComponents.validateStoryFile || (() => false);
      const validContent =
        'export default { title: "Component" }; export const Default = {};';
      const invalidContent = '// no story';

      assert.ok(validation(validContent), 'Should validate story structure');
      assert.ok(
        !validation(invalidContent),
        'Should reject file without story'
      );
    });
  });
});
