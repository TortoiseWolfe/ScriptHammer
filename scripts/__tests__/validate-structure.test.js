/**
 * Unit tests for validate-structure module
 * These tests MUST fail initially (TDD approach)
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

// This will fail initially - module doesn't exist yet
let validateStructure;
try {
  validateStructure = require('../validate-structure');
} catch (e) {
  // Expected to fail in TDD
  validateStructure = null;
}

describe('validate-structure', () => {
  describe('module structure', () => {
    it('should export a function', () => {
      assert.strictEqual(
        typeof validateStructure,
        'function',
        'validate-structure should export a function'
      );
    });

    it('should accept options parameter', () => {
      assert.doesNotThrow(() => {
        if (validateStructure) validateStructure({ path: 'src/components' });
      });
    });
  });

  describe('validation process', () => {
    const testDir = path.join(__dirname, 'test-validation');

    beforeEach(() => {
      fs.mkdirSync(testDir, { recursive: true });

      // Create fully compliant component
      const compliantDir = path.join(testDir, 'CompliantComponent');
      fs.mkdirSync(compliantDir, { recursive: true });
      fs.writeFileSync(
        path.join(compliantDir, 'index.tsx'),
        'export { default } from "./CompliantComponent";'
      );
      fs.writeFileSync(
        path.join(compliantDir, 'CompliantComponent.tsx'),
        'export default function CompliantComponent() {}'
      );
      fs.writeFileSync(
        path.join(compliantDir, 'CompliantComponent.test.tsx'),
        'describe("CompliantComponent", () => {});'
      );
      fs.writeFileSync(
        path.join(compliantDir, 'CompliantComponent.stories.tsx'),
        'export default { title: "CompliantComponent" };'
      );

      // Create non-compliant component
      const nonCompliantDir = path.join(testDir, 'NonCompliant');
      fs.mkdirSync(nonCompliantDir, { recursive: true });
      fs.writeFileSync(
        path.join(nonCompliantDir, 'NonCompliant.tsx'),
        'export default function NonCompliant() {}'
      );
    });

    afterEach(() => {
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('should validate compliant components', () => {
      if (!validateStructure) {
        assert.fail('validate-structure module not found');
      }

      const result = validateStructure({ path: testDir });
      assert.ok(
        result.valid === false || result.valid === true,
        'Should return valid boolean'
      );

      // In a directory with both compliant and non-compliant, should be invalid
      const compliantOnlyDir = path.join(testDir, 'compliant-only');
      fs.mkdirSync(compliantOnlyDir, { recursive: true });

      // Move only compliant component
      const source = path.join(testDir, 'CompliantComponent');
      const dest = path.join(compliantOnlyDir, 'CompliantComponent');
      fs.cpSync(source, dest, { recursive: true });

      const compliantResult = validateStructure({ path: compliantOnlyDir });
      assert.strictEqual(
        compliantResult.valid,
        true,
        'Should validate compliant directory'
      );
    });

    it('should fail validation for non-compliant components', () => {
      if (!validateStructure) {
        assert.fail('validate-structure module not found');
      }

      const result = validateStructure({ path: testDir });
      assert.strictEqual(
        result.valid,
        false,
        'Should fail validation with non-compliant components'
      );
      assert.ok(
        result.errors && result.errors.length > 0,
        'Should report errors'
      );
    });

    it('should report specific validation errors', () => {
      if (!validateStructure) {
        assert.fail('validate-structure module not found');
      }

      const result = validateStructure({ path: testDir });
      const nonCompliantError = result.errors?.find(
        (e) => e.component === 'NonCompliant'
      );

      assert.ok(
        nonCompliantError,
        'Should have error for NonCompliant component'
      );
      assert.ok(nonCompliantError.missing, 'Should list missing files');
      assert.ok(
        nonCompliantError.missing.includes('index.tsx'),
        'Should identify missing index'
      );
      assert.ok(
        nonCompliantError.missing.includes('NonCompliant.test.tsx'),
        'Should identify missing test'
      );
      assert.ok(
        nonCompliantError.missing.includes('NonCompliant.stories.tsx'),
        'Should identify missing story'
      );
    });
  });

  describe('CI integration', () => {
    it('should return proper exit codes', () => {
      if (!validateStructure) {
        assert.fail('validate-structure module not found');
      }

      const validResult = validateStructure({ path: 'valid/path' });
      const invalidResult = validateStructure({ path: 'invalid/path' });

      assert.ok(
        validResult.exitCode === 0 || validResult.exitCode === 1,
        'Should have exit code'
      );
      assert.ok(
        invalidResult.exitCode === 0 || invalidResult.exitCode === 1,
        'Should have exit code'
      );
    });

    it('should support fail-fast mode', () => {
      if (!validateStructure) {
        assert.fail('validate-structure module not found');
      }

      const testDir = path.join(__dirname, 'test-failfast');
      fs.mkdirSync(testDir, { recursive: true });

      // Create multiple non-compliant components
      for (let i = 1; i <= 3; i++) {
        const dir = path.join(testDir, `Component${i}`);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
          path.join(dir, `Component${i}.tsx`),
          `export default function Component${i}() {}`
        );
      }

      try {
        const result = validateStructure({ path: testDir, failFast: true });
        assert.ok(result.errors, 'Should have errors');
        assert.strictEqual(
          result.errors.length,
          1,
          'Should stop at first error in fail-fast mode'
        );
      } finally {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should support strict mode', () => {
      if (!validateStructure) {
        assert.fail('validate-structure module not found');
      }

      const testDir = path.join(__dirname, 'test-strict');
      fs.mkdirSync(testDir, { recursive: true });

      // Create component with warnings (valid but not ideal)
      const warningDir = path.join(testDir, 'WarningComponent');
      fs.mkdirSync(warningDir, { recursive: true });
      fs.writeFileSync(
        path.join(warningDir, 'index.tsx'),
        '// TODO: add export'
      );
      fs.writeFileSync(
        path.join(warningDir, 'WarningComponent.tsx'),
        'export default function WarningComponent() {}'
      );
      fs.writeFileSync(
        path.join(warningDir, 'WarningComponent.test.tsx'),
        '// TODO: add tests'
      );
      fs.writeFileSync(
        path.join(warningDir, 'WarningComponent.stories.tsx'),
        'export default { title: "WarningComponent" };'
      );

      try {
        const normalResult = validateStructure({
          path: testDir,
          strict: false,
        });
        const strictResult = validateStructure({ path: testDir, strict: true });

        // In normal mode, might pass with warnings
        // In strict mode, should fail if there are any issues
        assert.ok(
          strictResult.valid === false || strictResult.warnings?.length > 0,
          'Strict mode should catch more issues'
        );
      } finally {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });
  });

  describe('reporting', () => {
    it('should generate validation report', () => {
      if (!validateStructure) {
        assert.fail('validate-structure module not found');
      }

      const result = validateStructure({ path: 'src/components' });

      assert.ok(result.report, 'Should have report');
      assert.ok(
        typeof result.report.total === 'number',
        'Should have total count'
      );
      assert.ok(
        typeof result.report.passed === 'number',
        'Should have passed count'
      );
      assert.ok(
        typeof result.report.failed === 'number',
        'Should have failed count'
      );
    });

    it('should output formatted console report', () => {
      if (!validateStructure) {
        assert.fail('validate-structure module not found');
      }

      const originalLog = console.log;
      const originalError = console.error;
      let output = '';
      console.log = (msg) => {
        output += msg + '\n';
      };
      console.error = (msg) => {
        output += msg + '\n';
      };

      try {
        validateStructure({ path: 'src/components', format: 'console' });
        assert.ok(
          output.includes('validation') || output.includes('Validation'),
          'Should output validation message'
        );
      } finally {
        console.log = originalLog;
        console.error = originalError;
      }
    });

    it('should output JSON report when requested', () => {
      if (!validateStructure) {
        assert.fail('validate-structure module not found');
      }

      const result = validateStructure({
        path: 'src/components',
        format: 'json',
      });
      assert.ok(
        typeof result === 'object',
        'Should return object for JSON format'
      );
      assert.ok(result.timestamp, 'Should include timestamp');
      assert.ok(
        result.components !== undefined,
        'Should include components data'
      );
    });
  });

  describe('validation rules', () => {
    it('should validate file naming conventions', () => {
      if (!validateStructure) {
        assert.fail('validate-structure module not found');
      }

      const testDir = path.join(__dirname, 'test-naming');
      fs.mkdirSync(testDir, { recursive: true });

      // Create component with wrong file names
      const wrongNamingDir = path.join(testDir, 'MyComponent');
      fs.mkdirSync(wrongNamingDir, { recursive: true });
      fs.writeFileSync(
        path.join(wrongNamingDir, 'index.tsx'),
        'export { default } from "./MyComponent";'
      );
      fs.writeFileSync(
        path.join(wrongNamingDir, 'mycomponent.tsx'),
        'export default function MyComponent() {}'
      ); // Wrong case
      fs.writeFileSync(
        path.join(wrongNamingDir, 'MyComponent.spec.tsx'),
        'test("", () => {});'
      ); // Should be .test.tsx
      fs.writeFileSync(
        path.join(wrongNamingDir, 'MyComponent.story.tsx'),
        'export default {};'
      ); // Should be .stories.tsx

      try {
        const result = validateStructure({ path: testDir });
        assert.strictEqual(
          result.valid,
          false,
          'Should fail with wrong file names'
        );
        assert.ok(
          result.errors?.some((e) => e.reason?.includes('naming')),
          'Should report naming convention errors'
        );
      } finally {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should validate file content requirements', () => {
      if (!validateStructure) {
        assert.fail('validate-structure module not found');
      }

      const validation = validateStructure.validateContent || (() => ({}));

      // Test index validation
      const validIndex = 'export { default } from "./Component";';
      const invalidIndex = '// empty';
      assert.ok(
        validation(validIndex, 'index').valid,
        'Should validate correct index'
      );
      assert.ok(
        !validation(invalidIndex, 'index').valid,
        'Should reject empty index'
      );

      // Test component validation
      const validComponent =
        'export default function Component() { return <div />; }';
      const invalidComponent = 'const Component = () => {};'; // No default export
      assert.ok(
        validation(validComponent, 'component').valid,
        'Should validate component with default export'
      );
      assert.ok(
        !validation(invalidComponent, 'component').valid,
        'Should reject component without default export'
      );

      // Test story validation
      const validStory =
        'export default { title: "Component" }; export const Default = {};';
      const invalidStory = 'export const Story = {};'; // No default export
      assert.ok(
        validation(validStory, 'story').valid,
        'Should validate story with meta'
      );
      assert.ok(
        !validation(invalidStory, 'story').valid,
        'Should reject story without meta'
      );
    });
  });

  describe('performance', () => {
    it('should handle large codebases efficiently', () => {
      if (!validateStructure) {
        assert.fail('validate-structure module not found');
      }

      const testDir = path.join(__dirname, 'test-performance');
      fs.mkdirSync(testDir, { recursive: true });

      // Create 100 components
      for (let i = 1; i <= 100; i++) {
        const dir = path.join(testDir, `Component${i}`);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
          path.join(dir, 'index.tsx'),
          `export { default } from "./Component${i}";`
        );
        fs.writeFileSync(
          path.join(dir, `Component${i}.tsx`),
          `export default function Component${i}() {}`
        );
        fs.writeFileSync(
          path.join(dir, `Component${i}.test.tsx`),
          `test("renders", () => {});`
        );
        fs.writeFileSync(
          path.join(dir, `Component${i}.stories.tsx`),
          `export default { title: "Component${i}" };`
        );
      }

      try {
        const startTime = Date.now();
        const result = validateStructure({ path: testDir });
        const duration = Date.now() - startTime;

        assert.ok(result, 'Should complete validation');
        assert.ok(
          duration < 1000,
          `Should validate 100 components in under 1 second (took ${duration}ms)`
        );
      } finally {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should support filtering components', () => {
      if (!validateStructure) {
        assert.fail('validate-structure module not found');
      }

      const result = validateStructure({
        path: 'src/components',
        filter: 'Button*', // Only validate components starting with Button
      });

      assert.ok(
        result.components === undefined ||
          result.components.every((c) => c.name.startsWith('Button')),
        'Should only validate filtered components'
      );
    });
  });
});
