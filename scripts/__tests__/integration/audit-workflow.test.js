/**
 * Integration test for full audit workflow
 * Tests the complete audit process end-to-end
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

// This will fail initially - modules don't exist yet
let auditComponents;
try {
  auditComponents = require('../../audit-components');
} catch (e) {
  auditComponents = null;
}

describe('audit workflow integration', () => {
  const testProjectDir = path.join(__dirname, '../fixtures/test-project');

  beforeEach(() => {
    // Create a realistic project structure
    fs.mkdirSync(testProjectDir, { recursive: true });

    // Create src/components directory structure
    const componentsDir = path.join(testProjectDir, 'src/components');

    // Subatomic components
    const buttonDir = path.join(componentsDir, 'subatomic/Button');
    fs.mkdirSync(buttonDir, { recursive: true });
    fs.writeFileSync(
      path.join(buttonDir, 'index.tsx'),
      'export { default } from "./Button";'
    );
    fs.writeFileSync(
      path.join(buttonDir, 'Button.tsx'),
      'export default function Button() {}'
    );
    fs.writeFileSync(
      path.join(buttonDir, 'Button.test.tsx'),
      'describe("Button", () => {});'
    );
    fs.writeFileSync(
      path.join(buttonDir, 'Button.stories.tsx'),
      'export default { title: "Button" };'
    );

    // Atomic components (some non-compliant)
    const cardDir = path.join(componentsDir, 'atomic/Card');
    fs.mkdirSync(cardDir, { recursive: true });
    fs.writeFileSync(
      path.join(cardDir, 'Card.tsx'),
      'export default function Card() {}'
    );
    // Missing other files - non-compliant

    // Molecular components
    const formDir = path.join(componentsDir, 'molecular/Form');
    fs.mkdirSync(formDir, { recursive: true });
    fs.writeFileSync(
      path.join(formDir, 'Form.tsx'),
      'export default function Form() {}'
    );
    fs.writeFileSync(
      path.join(formDir, 'Form.stories.tsx'),
      'export default { title: "Form" };'
    );
    // Missing index and test - partially compliant
  });

  afterEach(() => {
    fs.rmSync(testProjectDir, { recursive: true, force: true });
  });

  it('should perform complete audit of project structure', () => {
    if (!auditComponents) {
      assert.fail('audit-components module not found');
    }

    const result = auditComponents({
      path: path.join(testProjectDir, 'src/components'),
    });

    assert.ok(result, 'Should return audit result');
    assert.ok(result.summary, 'Should have summary');
    assert.strictEqual(result.summary.total, 3, 'Should find 3 components');
    assert.strictEqual(
      result.summary.compliant,
      1,
      'Should find 1 compliant (Button)'
    );
    assert.strictEqual(
      result.summary.nonCompliant,
      2,
      'Should find 2 non-compliant'
    );
  });

  it('should generate detailed report with all findings', () => {
    if (!auditComponents) {
      assert.fail('audit-components module not found');
    }

    const result = auditComponents({
      path: path.join(testProjectDir, 'src/components'),
      format: 'json',
    });

    // Check Button is compliant
    const button = result.components.find((c) => c.name === 'Button');
    assert.ok(button, 'Should find Button component');
    assert.strictEqual(
      button.status,
      'compliant',
      'Button should be compliant'
    );

    // Check Card is non-compliant
    const card = result.components.find((c) => c.name === 'Card');
    assert.ok(card, 'Should find Card component');
    assert.strictEqual(
      card.status,
      'non_compliant',
      'Card should be non-compliant'
    );
    assert.ok(
      card.missing.includes('index.tsx'),
      'Card should be missing index'
    );
    assert.ok(
      card.missing.includes('Card.test.tsx'),
      'Card should be missing test'
    );

    // Check Form is non-compliant
    const form = result.components.find((c) => c.name === 'Form');
    assert.ok(form, 'Should find Form component');
    assert.strictEqual(
      form.status,
      'non_compliant',
      'Form should be non-compliant'
    );
  });

  it('should handle nested component structures', () => {
    if (!auditComponents) {
      assert.fail('audit-components module not found');
    }

    // Create nested component
    const nestedDir = path.join(
      testProjectDir,
      'src/components/organisms/Dashboard/widgets/Widget'
    );
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(
      path.join(nestedDir, 'Widget.tsx'),
      'export default function Widget() {}'
    );

    const result = auditComponents({
      path: path.join(testProjectDir, 'src/components'),
      includeNested: true,
    });

    const widget = result.components.find((c) => c.name === 'Widget');
    assert.ok(widget, 'Should find nested Widget component');
  });

  it('should export report to file when requested', () => {
    if (!auditComponents) {
      assert.fail('audit-components module not found');
    }

    const reportPath = path.join(testProjectDir, 'audit-report.json');

    auditComponents({
      path: path.join(testProjectDir, 'src/components'),
      output: reportPath,
    });

    assert.ok(fs.existsSync(reportPath), 'Should create report file');
    const reportContent = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.ok(reportContent.timestamp, 'Report should have timestamp');
    assert.ok(reportContent.summary, 'Report should have summary');
  });

  it('should respect ignore patterns', () => {
    if (!auditComponents) {
      assert.fail('audit-components module not found');
    }

    // Create __tests__ directory that should be ignored
    const testsDir = path.join(testProjectDir, 'src/components/__tests__');
    fs.mkdirSync(testsDir, { recursive: true });
    fs.writeFileSync(
      path.join(testsDir, 'utils.test.js'),
      'test("util", () => {});'
    );

    const result = auditComponents({
      path: path.join(testProjectDir, 'src/components'),
      ignore: ['__tests__', '*.test.js'],
    });

    const hasTestUtils = result.components.some((c) =>
      c.name.includes('utils')
    );
    assert.ok(!hasTestUtils, 'Should ignore __tests__ directory');
  });
});
