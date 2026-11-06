/**
 * Tailwind may only read `src/` when it decides which utility classes to emit (#1279).
 *
 * WHAT WENT WRONG. `src/app/globals.css` used to start with a bare
 * `@import 'tailwindcss';`. Tailwind 4 then scans every file in the repository that git
 * does not ignore: tests, scripts, docs and specs included. Anything that parses as a
 * utility class became a rule in the production stylesheet. A test fixture containing
 * the text "[test:rls]" shipped as `.\[test\:rls\] { test: rls }`, and because the
 * stylesheet's file name is a hash of its contents, an edit to a test file renamed a
 * production stylesheet and cleared every visitor's cached copy.
 *
 * THE PROBE. This file is itself outside `src/` and carries the canary below. The
 * stylesheet is compiled twice from the real `globals.css`:
 *
 *   - as committed: the canary must NOT appear in the output
 *   - with the `source(...)` restriction removed: the canary MUST appear
 *
 * The second compile is the negative control. A probe that cannot report failure proves
 * nothing, and "the canary is absent" would also be true if the canary were never
 * parseable as a class at all, or if the compile broke and returned nothing.
 *
 * CANARY (do not edit; the strings below are what Tailwind finds in this file):
 *   [--tw-scope-canary:scripts]
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const APP_DIR = path.join(ROOT, 'src', 'app');
const GLOBALS = path.join(APP_DIR, 'globals.css');
const CANARY = 'tw-scope-canary';

// postcss is not a direct dependency (pnpm does not hoist it), so resolve it the way
// @tailwindcss/postcss does.
const tailwindPostcss = require('@tailwindcss/postcss');
const postcss = require(
  require.resolve('postcss', {
    paths: [path.dirname(require.resolve('@tailwindcss/postcss'))],
  })
);

const TAILWIND_IMPORT = /@import\s+'tailwindcss'[^;]*;/;

async function compile(css) {
  // The generated font file does not exist on a fresh checkout, and fonts have nothing
  // to do with which utilities get emitted.
  const withoutFonts = css.replace(
    /@import '\.\/fonts\.generated\.css';\n?/,
    ''
  );
  const result = await postcss([tailwindPostcss()]).process(withoutFonts, {
    from: path.join(APP_DIR, '__tailwind-scope-probe.css'),
  });
  return result.css;
}

test('globals.css scopes Tailwind to src/ with an explicit source()', () => {
  const css = fs.readFileSync(GLOBALS, 'utf8');
  const match = css.match(TAILWIND_IMPORT);
  assert.ok(match, 'globals.css must import tailwindcss');
  assert.match(
    match[0],
    /source\(\s*'\.\.\/?'\s*\)/,
    `the tailwindcss import must carry source('../') so only src/ is scanned, got: ${match[0]}`
  );
});

test('a class-shaped string outside src/ does not reach the stylesheet (#1279)', async () => {
  const css = fs.readFileSync(GLOBALS, 'utf8');

  const unscoped = css.replace(TAILWIND_IMPORT, "@import 'tailwindcss';");
  assert.notEqual(unscoped, css, 'the control must differ from the real file');

  const control = await compile(unscoped);
  assert.ok(
    control.includes(CANARY),
    'negative control failed: with no source() restriction the canary in this file should be emitted, so this probe cannot see the leak it exists to catch'
  );

  const real = await compile(css);
  assert.ok(real.length > 10000, 'the real compile returned almost nothing');
  assert.equal(
    real.includes(CANARY),
    false,
    'a string from outside src/ was emitted as production CSS: Tailwind is scanning more than src/'
  );
});
