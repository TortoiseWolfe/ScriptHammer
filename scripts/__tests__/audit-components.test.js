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
      fs.writeFileSync(
        path.join(compliantDir, 'CompliantButton.accessibility.test.tsx'),
        'test("has no a11y violations", () => {});'
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

/**
 * Bare `<Name>.tsx` discovery (#538).
 *
 * The blind spot these cover: `findComponentDirectories` filters its glob to
 * `isDirectory()`, so a component that is a single file was never enumerated —
 * and a component that is never enumerated cannot be reported as failing. The
 * validator printed 100% compliance over seventeen components outside the
 * pattern. Not being looked at is not the same as passing, but it reads
 * identically in the summary (#396).
 */
describe('bare component discovery (#538)', () => {
  const testDir = path.join(__dirname, 'test-bare-components');

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });

    // A bare component: no directory of its own.
    fs.writeFileSync(
      path.join(testDir, 'BareThing.tsx'),
      'export default function BareThing() {}'
    );

    // A fully compliant directory component, WITH a private internal file.
    // The internal must not be mistaken for a second, non-compliant component.
    const okDir = path.join(testDir, 'Widget');
    fs.mkdirSync(okDir, { recursive: true });
    for (const [name, body] of [
      ['index.tsx', 'export { default } from "./Widget";'],
      ['Widget.tsx', 'export default function Widget() {}'],
      ['Widget.test.tsx', 'test("renders", () => {});'],
      ['Widget.stories.tsx', 'export default { title: "Widget" };'],
      ['Widget.accessibility.test.tsx', 'test("a11y", () => {});'],
      [
        'WidgetInternalBit.tsx',
        'export default function WidgetInternalBit() {}',
      ],
    ]) {
      fs.writeFileSync(path.join(okDir, name), body);
    }
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('reports a bare <Name>.tsx that directory-only discovery could not see', () => {
    const result = auditComponents({ path: testDir });
    const names = result.nonCompliant.map((c) => c.name);
    assert.ok(
      names.includes('BareThing'),
      `BareThing should be reported non-compliant, got: ${names.join(', ')}`
    );
  });

  it('does NOT report a private internal of a compliant component', () => {
    // WidgetInternalBit lives inside Widget/, which is already counted. The
    // 5-file pattern has never required a suite per internal file, so reporting
    // it would be a different wrong number rather than the right one.
    const result = auditComponents({ path: testDir });
    const names = result.nonCompliant.map((c) => c.name);
    assert.ok(
      !names.includes('WidgetInternalBit'),
      'An internal of a compliant component must not count as its own component'
    );
    assert.ok(
      result.compliant.includes('Widget'),
      'Widget itself must still be compliant'
    );
  });

  it('does not mistake index.tsx or a component satellite for a component', () => {
    const result = auditComponents({ path: testDir });
    const names = result.components.map((c) => c.name);
    for (const notAComponent of [
      'index',
      'Widget.test',
      'Widget.stories',
      'Widget.accessibility.test',
    ]) {
      assert.ok(
        !names.includes(notAComponent),
        `${notAComponent} must not be treated as a component`
      );
    }
  });

  it('flags an unrecorded bare component as NEW so it fails the build', () => {
    // The ratchet. KNOWN_BARE_COMPONENTS is keyed by repo-relative path, so a
    // component in a temp dir is never in it — exactly the shape of a newly
    // added bare component.
    const result = auditComponents({ path: testDir });
    assert.strictEqual(
      result.summary.newBare,
      1,
      'BareThing must count as NEW'
    );
    assert.strictEqual(
      result.newBare[0].name,
      'BareThing',
      'the NEW entry must name the component'
    );
  });
});

describe('the recorded bare-component baseline (#538)', () => {
  it('names only paths that still exist', () => {
    // A stale entry pardons a file that has moved or gone. The list is only
    // trustworthy while every line of it is real.
    const missing = Object.keys(auditComponents.KNOWN_BARE_COMPONENTS).filter(
      (p) => !fs.existsSync(path.join(process.cwd(), p))
    );
    assert.deepStrictEqual(
      missing,
      [],
      `KNOWN_BARE_COMPONENTS names paths that no longer exist:\n  ${missing.join('\n  ')}`
    );
  });

  it('has not grown: src/components introduces no unrecorded bare component', () => {
    const result = auditComponents({ path: 'src/components' });
    assert.strictEqual(
      result.summary.newBare,
      0,
      `New bare component(s) added without the 5-file pattern:\n  ` +
        result.newBare.map((c) => c.path).join('\n  ') +
        `\nGive them the pattern. Do NOT add them to KNOWN_BARE_COMPONENTS (#396).`
    );
  });

  it('keeps the reported rate below 100, because it is not 100', () => {
    // THE REGRESSION GUARD FOR #538 ITSELF. If the bare-file discovery is ever
    // removed or the baseline is excluded from the denominator, the rate springs
    // back to a false 100% — which is the original bug, restored silently. This
    // is the assertion that would have caught it the first time.
    const result = auditComponents({ path: 'src/components' });
    assert.ok(
      result.summary.knownBare > 0,
      'bare-file discovery found nothing — it has regressed to directories only'
    );
    assert.ok(
      result.summary.complianceRate < 100,
      `compliance rate is ${result.summary.complianceRate}% while ${result.summary.knownBare} ` +
        `bare components are recorded — the baseline is being excluded from the denominator`
    );
  });

  it('matches the baseline from any working directory, not just the repo root', () => {
    // KNOWN_BARE_COMPONENTS keys are repo-relative strings. Deriving them with
    // process.cwd() meant they only matched when the validator ran from the repo
    // root: from scripts/ every key came out as '../src/components/Footer.tsx',
    // missed, and all 17 recorded components reported as NEW.
    //
    // That fails closed, so the build goes red rather than silently green — but
    // it goes red for a false reason, and nothing in the message points at the
    // working directory that caused it. A gate whose job is telling the truth
    // should not lie about which components are new.
    const repoRoot = path.resolve(__dirname, '../..');
    const cwdBefore = process.cwd();

    const fromRoot = auditComponents({ path: 'src/components' });
    let fromElsewhere;
    try {
      process.chdir(path.join(repoRoot, 'scripts'));
      fromElsewhere = auditComponents({
        path: path.join(repoRoot, 'src/components'),
      });
    } finally {
      process.chdir(cwdBefore);
    }

    assert.strictEqual(
      fromElsewhere.summary.newBare,
      fromRoot.summary.newBare,
      `newBare changed with the working directory (${fromRoot.summary.newBare} from the ` +
        `repo root, ${fromElsewhere.summary.newBare} from scripts/) — the baseline keys ` +
        `are resolving against process.cwd() instead of the repo root`
    );
    assert.strictEqual(
      fromElsewhere.summary.knownBare,
      fromRoot.summary.knownBare,
      'knownBare changed with the working directory'
    );
  });
});
