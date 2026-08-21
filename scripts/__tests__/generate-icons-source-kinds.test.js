/**
 * `generate-icons.js` must classify its source mark correctly (#898).
 *
 * WHY THIS EXISTS. `scripts/generate-icons.js` had no test at all, and the one
 * defect that matters here is silent: if an SVG mark is mistaken for a raster,
 * the script still emits a complete, plausible-looking set of icons — built
 * from a rasterised copy of the mark instead of its vectors. Nothing throws,
 * nothing looks wrong in the log, and the only signal is a byte diff.
 *
 * That is not hypothetical. The first version of the #898 raster support
 * sniffed for the string `<svg` in the first 512 bytes. `public/favicon.svg`
 * opens with a ~1,300-byte comment, so the tag falls outside that window and
 * every icon in the repo was quietly regenerated from a rasterised copy of
 * itself. `--check` caught it; a narrower test would not have.
 *
 * So this asserts the CLASSIFICATION, at the boundary that actually broke:
 * a valid SVG whose `<svg` tag sits far past any plausible sniff window.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'generate-icons.js');

/** The real mark, which is the file that exposed the bug. */
const REAL_MARK = path.join(ROOT, 'public', 'favicon.svg');

/**
 * Runs the COPY inside the scratch repo, never `SCRIPT` itself. The script
 * resolves `public/` from its own `__dirname`, so invoking the real path would
 * write icons into the actual repository — which the first draft of this test
 * did, silently, while reading from the scratch directory and reporting ENOENT.
 */
function run(args, cwd) {
  return execFileSync(
    'node',
    [path.join(cwd, 'scripts', 'generate-icons.js'), ...args],
    {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
}

/**
 * A throwaway repo-shaped directory: `generate-icons.js` resolves `public/`
 * relative to its own location, so the script is copied in rather than run
 * against the real tree. Writing icons into the actual `public/` would be a
 * test that mutates the repo it is testing.
 */
function scratchRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'genicons-'));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'public'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(dir, 'scripts', 'generate-icons.js'));
  fs.symlinkSync(
    path.join(ROOT, 'node_modules'),
    path.join(dir, 'node_modules'),
    'dir'
  );
  return dir;
}

describe('generate-icons source classification (#898)', () => {
  test('the real mark is still recognised as SVG despite its long comment header', () => {
    const bytes = fs.readFileSync(REAL_MARK);
    const tagAt = bytes.indexOf(Buffer.from('<svg'));

    // The premise of this whole test. If the mark ever loses its comment
    // header this assertion goes green for the wrong reason, so it is stated
    // rather than assumed.
    assert.ok(
      tagAt > 512,
      `public/favicon.svg's <svg> tag is at byte ${tagAt}. This test guards a ` +
        `misclassification that only bites when the tag sits past a sniff ` +
        `window. If the header shrank, re-point this at a fixture that keeps ` +
        `the boundary meaningful rather than deleting the test.`
    );

    const dir = scratchRepo();
    try {
      fs.copyFileSync(REAL_MARK, path.join(dir, 'public', 'favicon.svg'));
      run(['--source', 'public/favicon.svg'], dir);

      const out = fs.readFileSync(
        path.join(dir, 'public', 'icon-192.svg'),
        'utf8'
      );
      assert.ok(
        !out.includes('data:image/png;base64'),
        'An SVG mark was rasterised into a data: URI, so it was classified as ' +
          'a raster. This is the #898 regression: the icons look right and are ' +
          'built from a bitmap copy of the vectors.'
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a PNG mark is accepted and produces the full set, including favicon.svg', () => {
    const dir = scratchRepo();
    try {
      // A 1x1 PNG is enough: classification and target selection are what is
      // under test, not image quality.
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      );
      fs.writeFileSync(path.join(dir, 'public', 'brand-mark.png'), png);
      const out = run(['--source', 'public/brand-mark.png'], dir);

      assert.match(
        out,
        /wrote \d+ assets from public\/brand-mark\.png/,
        'A PNG source must be accepted. Rejecting rasters is what stopped a ' +
          'fork with a PNG logo from using --icon at all, so it shipped ours.'
      );

      // favicon.svg is normally the SOURCE and therefore not a target. When the
      // source is something else it becomes an ordinary asset, and skipping it
      // would leave the single most visible icon on the previous brand.
      assert.ok(
        fs.existsSync(path.join(dir, 'public', 'favicon.svg')),
        'favicon.svg was not generated for a non-favicon source, so it would ' +
          'keep the template mark while every icon around it changed.'
      );

      const icon = fs.readFileSync(
        path.join(dir, 'public', 'icon-192.svg'),
        'utf8'
      );
      assert.ok(
        icon.includes('data:image/png;base64'),
        'A raster mark must be embedded as a data: URI.'
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a mis-named source is classified by its bytes, not its extension', () => {
    const dir = scratchRepo();
    try {
      // Real SVG bytes, deliberately named .png.
      fs.writeFileSync(
        path.join(dir, 'public', 'liar.png'),
        '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" ' +
          'viewBox="0 0 10 10"><rect width="10" height="10" fill="#123456"/></svg>'
      );
      run(['--source', 'public/liar.png'], dir);

      const out = fs.readFileSync(
        path.join(dir, 'public', 'icon-192.svg'),
        'utf8'
      );
      assert.ok(
        !out.includes('data:image/png;base64'),
        'A file named .png containing SVG was treated as a raster, so the ' +
          'extension was trusted over the bytes.'
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
