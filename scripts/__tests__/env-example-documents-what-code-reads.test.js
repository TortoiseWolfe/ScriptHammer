/**
 * `.env.example` is the fork's config contract, so every variable the CODE reads
 * must appear in it (#771).
 *
 * WHAT WENT WRONG. Nine names lived in the maintainer's untracked `.env` and
 * nowhere in `.env.example`. A forker doing the documented thing —
 * `cp .env.example .env` — silently got none of them, with no error. Three were
 * load-bearing:
 *
 *   PAYPAL_CLIENT_ID              read by two Edge Functions via Deno.env.get.
 *                                 Setting only the NEXT_PUBLIC_ variant has
 *                                 already caused a production 500.
 *   NEXT_PUBLIC_CAPTCHA_SITE_KEY  sign-up bot protection is INERT without it,
 *                                 and that form was abused to email
 *                                 non-consenting third parties (#353).
 *   TURNSTILE_SECRET              the verification script degrades to a warning.
 *
 * THE DIRECTION MATTERS. This asserts code → docs, not docs → code. A variable
 * documented but unused is harmless clutter; a variable USED but undocumented is
 * a fork that cannot work and cannot find out why. Only the second is a defect,
 * so only the second fails here.
 *
 * NOT ASSERTED, DELIBERATELY: that every name in `.env.example` is read by code.
 * Four `SUPABASE_AUTH_EXTERNAL_*` entries are a RECORD of credentials configured
 * in the hosted Supabase dashboard — referenced by no code on purpose. Supabase
 * config here has already been destroyed once while the data was safely backed
 * up, unrecoverably. A test demanding "documented implies used" would order
 * someone to delete exactly those.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const EXAMPLE = path.join(ROOT, '.env.example');

/**
 * Directories whose env reads are real APPLICATION config — the things a fork
 * must supply to run the product.
 *
 * `scripts/` is deliberately excluded. It is CI and maintenance tooling whose
 * knobs (`RETAIN_DAYS`, `FLAKY_GATE_MODE`, `E2E_BUDGET_MODE`, `GITHUB_OUTPUT`…)
 * are workflow inputs set in `.github/workflows`, not values a forker puts in
 * `.env`. Including it produced 20+ demands to document CI internals, which is
 * how a guard trains people to add exceptions instead of reading it.
 */
const SCANNED = ['src', 'supabase/functions'];

/**
 * Names that appear as `process.env.X` / `Deno.env.get('X')` but are supplied by
 * the platform or the shell rather than by `.env`. Each needs a reason.
 */
const NOT_FROM_ENV_FILE = new Set([
  'NODE_ENV', // set by the toolchain
  'CI', // set by the CI runner
  'VITEST', // set by vitest
  'npm_package_version', // npm/pnpm injects it
  'PWD', // shell
  'HOME', // shell
  'PATH', // shell
  'SUPABASE_URL', // Supabase auto-injects into Edge Functions
  'SUPABASE_ANON_KEY', // ditto
  'SUPABASE_SERVICE_ROLE_KEY', // ditto (also documented, harmlessly)
  'SUPABASE_DB_URL', // ditto
  'GITHUB_ACTIONS', // set by the CI runner, read for env detection
]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__tests__') return [];
      return walk(full);
    }
    return /\.(ts|tsx|js|mjs|cjs)$/.test(e.name) ? [full] : [];
  });
}

/** `process.env.FOO`, `process.env['FOO']`, `Deno.env.get('FOO')`. */
const READS = [
  /process\.env\.([A-Z][A-Z0-9_]*)/g,
  /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
  /Deno\.env\.get\(\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\)/g,
];

/**
 * Strip comments before matching.
 *
 * Without this the sweep reads prose as code: `src/config/backend.config.ts`
 * contains the phrase "cast `process.env.X` to a string-literal" in a docblock,
 * and the guard duly demanded that a variable named `X` be documented. A checker
 * that cannot tell an instruction from a description of one is the same failure
 * that made a sibling guard flag its own documentation.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments and docblocks
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments, sparing "https://"
}

function namesReadByCode() {
  const found = new Map(); // name -> first file that reads it
  for (const dir of SCANNED) {
    for (const file of walk(path.join(ROOT, dir))) {
      const src = stripComments(fs.readFileSync(file, 'utf8'));
      for (const re of READS) {
        for (const m of src.matchAll(re)) {
          const name = m[1];
          if (!found.has(name)) {
            found.set(name, path.relative(ROOT, file));
          }
        }
      }
    }
  }
  return found;
}

/** Every `NAME=` in .env.example, commented or not. */
function namesDocumented() {
  const src = fs.readFileSync(EXAMPLE, 'utf8');
  return new Set(
    [...src.matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]*)\s*=/gm)].map((m) => m[1])
  );
}

test('the scan finds real files, so the assertion below is not vacuous', () => {
  // Without this the sweep passes by inspecting nothing — the shape that let a
  // coverage gate report 100% while looking at an empty list (#396, #411).
  const files = SCANNED.flatMap((d) => walk(path.join(ROOT, d)));
  assert.ok(
    files.length > 100,
    `expected to scan a hundred+ files, saw ${files.length}`
  );
  const read = namesReadByCode();
  assert.ok(
    read.size > 15,
    `expected to find many env reads, saw ${read.size}`
  );
  // A name we know is read, as a canary that the regexes still match.
  assert.ok(
    read.has('NEXT_PUBLIC_SUPABASE_URL'),
    'the read-detection regexes matched nothing recognisable'
  );
});

test('.env.example itself parses into names', () => {
  const documented = namesDocumented();
  assert.ok(
    documented.size > 40,
    `expected .env.example to document many names, parsed ${documented.size}`
  );
  assert.ok(documented.has('NEXT_PUBLIC_SUPABASE_URL'));
});

test('every env var the code reads is documented in .env.example', () => {
  const documented = namesDocumented();
  const missing = [];
  for (const [name, file] of namesReadByCode()) {
    if (NOT_FROM_ENV_FILE.has(name)) continue;
    if (!documented.has(name)) missing.push(`${name}  (read in ${file})`);
  }

  assert.deepStrictEqual(
    missing.sort(),
    [],
    'These are read by code but absent from .env.example, so a fork that copies ' +
      'the example silently runs without them and gets no error saying so. ' +
      'Document each (name + comment, no value), or stop reading it.'
  );
});
