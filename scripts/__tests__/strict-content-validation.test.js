/**
 * The content validators, now that `--strict` actually runs them.
 *
 * These four functions existed for a long time and were DEAD: `validateComponent`
 * only turns a content failure into an error under `--strict`, and nothing passed
 * that flag. So a file could satisfy the 5-file pattern while asserting nothing,
 * and one did — an accessibility test whose whole body was `expect(true).toBe(true)`
 * counted as fully compliant.
 *
 * Turning the flag on immediately failed 59 of 139 components. 57 of those were
 * FALSE POSITIVES from the index rule, which demanded `export { default }` and so
 * rejected every named-only barrel — the same wrong assumption #1017 removed from
 * the migration templates. The rules are fixed here and pinned by these tests, so
 * the next person can tell a real failure from a bad rule.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const audit = require('../audit-components');

const {
  validateIndexFile,
  validateAccessibilityFile,
  validateTestFile,
  validateStoryFile,
} = audit;

describe('validateIndexFile — a barrel must re-export something', () => {
  it('accepts a default re-export', () => {
    assert.ok(validateIndexFile("export { default } from './Foo';\n"));
  });

  it('accepts a NAMED-only re-export', () => {
    // 57 of this repo's components are this shape. The old rule failed all of
    // them, which is the single reason --strict could never be switched on.
    assert.ok(validateIndexFile("export { Foo } from './Foo';\n"));
  });

  it('accepts a star re-export', () => {
    assert.ok(validateIndexFile("export * from './Foo';\n"));
  });

  it('accepts a real barrel from this repo, verbatim', () => {
    assert.ok(
      validateIndexFile(
        "export { FormField, getFormFieldInputProps } from './FormField';\n" +
          "export type { FormFieldProps } from './FormField';\n"
      )
    );
  });

  it('REJECTS a barrel that re-exports nothing', () => {
    assert.ok(!validateIndexFile("import './Foo';\n"));
  });

  it('REJECTS an export that exists only in a comment', () => {
    // Comment-stripping. Without it the guard reads its own prose — the failure
    // this repo has filed repeatedly, most recently #1022.
    assert.ok(!validateIndexFile("// export { default } from './Foo';\n"));
    assert.ok(!validateIndexFile("/* export * from './Foo'; */\n"));
  });
});

describe('validateAccessibilityFile — it must actually run axe', () => {
  const withAxe =
    "import { axe } from 'jest-axe';\n" +
    "describe('X', () => { it('a', async () => { expect(await axe(c)).toHaveNoViolations(); }); });\n";

  it('accepts a file that calls axe', () => {
    assert.ok(validateAccessibilityFile(withAxe));
  });

  it('REJECTS the placeholder that started all this', () => {
    // The literal former contents of ChatWindow.accessibility.test.tsx.
    assert.ok(
      !validateAccessibilityFile(
        "import { describe, it, expect } from 'vitest';\n" +
          "describe('Accessibility', () => {\n" +
          "  it('placeholder test', () => {\n" +
          '    expect(true).toBe(true);\n' +
          '  });\n' +
          '});\n'
      )
    );
  });

  it('REJECTS a file that only MENTIONS axe in prose', () => {
    // The old rule used `content.includes('axe')`, so this passed. It is the
    // single most likely way for someone to "fix" a strict failure without
    // writing a test.
    assert.ok(
      !validateAccessibilityFile(
        '// covered by axe elsewhere, see toHaveNoViolations in the suite\n' +
          "describe('Accessibility', () => { it('ok', () => {}); });\n"
      )
    );
  });

  it('REJECTS an axe call with no test cases around it', () => {
    assert.ok(!validateAccessibilityFile('const x = await axe(container);\n'));
  });

  it('accepts it.each and describe.each', () => {
    // Real files in this repo use them; a naive `it(` match would reject them.
    assert.ok(
      validateAccessibilityFile(
        "import { axe } from 'jest-axe';\n" +
          "it.each(PLATFORMS)('no violations %s', async () => { await axe(c); });\n"
      )
    );
  });
});

describe('the other two validators still hold', () => {
  it('a test file needs a real case, not the word "test"', () => {
    assert.ok(validateTestFile("it('works', () => {});"));
    assert.ok(!validateTestFile('// no tests here yet\n'));
  });

  it('a story file needs a default export and a title', () => {
    assert.ok(validateStoryFile("export default { title: 'X' };"));
    assert.ok(!validateStoryFile("const meta = { title: 'X' };"));
  });
});

describe('the whole repo passes the rules these tests describe', () => {
  it('has zero content failures under strict', () => {
    // The end-to-end check. Without it these unit assertions could all be right
    // about rules that no longer match how the repo is actually written.
    const report = audit({ path: 'src/components', format: 'json' });
    const invalid = (report.components || []).filter((c) =>
      Object.values(c.files || {}).some((f) => f.exists && !f.valid)
    );
    assert.deepStrictEqual(
      invalid.map((c) => c.name),
      [],
      'components with invalid file content'
    );
  });
});
