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

/**
 * #906 — the guidance said marks "render down to 32px", and favicon.ico has always
 * carried a 16px frame as well.
 *
 * 16 is where marks actually fall apart: a mark can be clean at 32 and an indistinct
 * smudge at 16. Measured on a real fork's mark — a faceted die with a thin outline and
 * an interior numeral — 48 and 32 read, 16 recovers neither the shape nor the numeral.
 * No heuristic can decide that for a fork, so `--source-small` is an escape hatch, not
 * a detector: a simplified silhouette for the sizes that cannot carry detail.
 *
 * The assertions below decode the ICO's frames and read a pixel out of each, because
 * "the small mark was used" is a claim about the BYTES a browser gets. Asserting that
 * the flag was accepted, or that the file changed, would pass with the sizes wired up
 * backwards.
 */
describe('a second, simpler mark for the small sizes (#906)', () => {
  const SOLID = (hex) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${hex}"/></svg>`;

  /** Decode favicon.ico into [{ px, rgb }], centre pixel per frame. */
  async function icoFrames(file) {
    const sharp = require('sharp');
    const buf = fs.readFileSync(file);
    const count = buf.readUInt16LE(4);
    const frames = [];
    for (let i = 0; i < count; i++) {
      const o = 6 + i * 16;
      const px = buf.readUInt8(o) === 0 ? 256 : buf.readUInt8(o);
      const len = buf.readUInt32LE(o + 8);
      const off = buf.readUInt32LE(o + 12);
      const { data, info } = await sharp(buf.subarray(off, off + len))
        .raw()
        .toBuffer({ resolveWithObject: true });
      const p =
        (Math.floor(info.height / 2) * info.width +
          Math.floor(info.width / 2)) *
        info.channels;
      frames.push({
        px,
        rgb: [data[p], data[p + 1], data[p + 2]].join(','),
      });
    }
    return frames.sort((a, b) => a.px - b.px);
  }

  test('the small mark reaches 16 and 32; the full mark still owns 48', async () => {
    const dir = scratchRepo();
    try {
      const RED = '255,0,0';
      const BLUE = '0,0,255';
      fs.writeFileSync(path.join(dir, 'public', 'mark.svg'), SOLID('#0000ff'));
      fs.writeFileSync(path.join(dir, 'public', 'tiny.svg'), SOLID('#ff0000'));
      run(
        ['--source', 'public/mark.svg', '--source-small', 'public/tiny.svg'],
        dir
      );

      const frames = await icoFrames(path.join(dir, 'public', 'favicon.ico'));
      assert.deepStrictEqual(
        frames.map((f) => f.px),
        [16, 32, 48],
        'favicon.ico no longer packs the three frames this test reasons about'
      );
      assert.equal(
        frames[0].rgb,
        RED,
        '16px frame did not come from the small mark'
      );
      assert.equal(
        frames[1].rgb,
        RED,
        '32px frame did not come from the small mark'
      );
      assert.equal(
        frames[2].rgb,
        BLUE,
        '48px frame came from the small mark — the simplified silhouette is being ' +
          'used at a size that can carry the real one'
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('the small mark is committed where --check will find it', () => {
    // `pnpm check:icons` runs with no arguments. If the small source were only ever a
    // CLI flag, the check would regenerate the small frames from the FULL mark and
    // report drift against correctly-generated icons — a gate failing on the fix.
    const dir = scratchRepo();
    try {
      fs.writeFileSync(path.join(dir, 'public', 'mark.svg'), SOLID('#0000ff'));
      fs.writeFileSync(path.join(dir, 'public', 'tiny.svg'), SOLID('#ff0000'));
      run(
        ['--source', 'public/mark.svg', '--source-small', 'public/tiny.svg'],
        dir
      );

      assert.ok(
        fs.existsSync(path.join(dir, 'public', 'favicon-small.svg')),
        'favicon-small.svg was not written, so a later `check:icons` cannot see ' +
          'which mark the small frames came from'
      );
      // And the check passes against what generation produced, with no flags.
      const out = run(['--check', '--source', 'public/mark.svg'], dir);
      assert.match(out, /all \d+ icons match/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('without a small mark, every size still comes from the one mark', async () => {
    // The feature is opt-in, and this repo does not use it. If its absence changed
    // any output, the escape hatch would be a tax on everyone who does not need it.
    const dir = scratchRepo();
    try {
      fs.writeFileSync(path.join(dir, 'public', 'mark.svg'), SOLID('#0000ff'));
      run(['--source', 'public/mark.svg'], dir);
      const frames = await icoFrames(path.join(dir, 'public', 'favicon.ico'));
      assert.deepStrictEqual(
        [...new Set(frames.map((f) => f.rgb))],
        ['0,0,255'],
        'some frame came from somewhere other than the single source mark'
      );
      assert.ok(!fs.existsSync(path.join(dir, 'public', 'favicon-small.svg')));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a named small mark that does not exist fails loudly', () => {
    const dir = scratchRepo();
    try {
      fs.writeFileSync(path.join(dir, 'public', 'mark.svg'), SOLID('#0000ff'));
      assert.throws(
        () =>
          run(
            [
              '--source',
              'public/mark.svg',
              '--source-small',
              'public/nope.svg',
            ],
            dir
          ),
        /small mark not found/,
        'a typo in --source-small must not silently fall back to the full mark'
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
