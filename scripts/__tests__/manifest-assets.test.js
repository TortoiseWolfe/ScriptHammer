/**
 * Every asset a web-app manifest promises must exist, at the size it claims.
 *
 * WHY THIS EXISTS (#659). Nothing checked, and three separate bugs were living
 * in the two manifest emitters at once:
 *
 *   1. `src/config/project.config.ts` pointed at `/screenshot-wide.png` and
 *      `/screenshot-narrow.png`. Neither file has ever existed. Verified 404 on
 *      production while writing this.
 *   2. `scripts/generate-manifest.js` declared `screenshots/mobile.png` as
 *      `390x844` — a CSS viewport, not the file, which is 750x1334. Chrome
 *      drops a screenshot whose declared size disagrees with the image, so the
 *      install sheet silently lost it.
 *   3. The two emitters named DIFFERENT icon sets, so which mark a fork
 *      installed with depended on which emitter won.
 *
 * All three are invisible from the app: a manifest with a broken `src` does not
 * throw, it just quietly degrades the install experience. The only way to see
 * it is to check the files.
 *
 * THE TWO EMITTERS ARE READ AS TEXT, deliberately. `project.config.ts` is
 * TypeScript and `generate-manifest.js` is CommonJS that runs at prebuild; both
 * build their `src` values by template-interpolating a basePath, so there is no
 * single importable value to assert on. Scanning the source for the literal
 * paths is what catches a hand-edit in either file, which is exactly how all
 * three bugs above got in.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');

/** The two files that independently emit a manifest. */
const EMITTERS = [
  'scripts/generate-manifest.js',
  'src/config/project.config.ts',
];

/**
 * Pull every `src: \`${…}/some/path\`` out of an emitter.
 *
 * Anchored on the `src:` key rather than "anything that looks like a path" so
 * that a comment mentioning a filename cannot create a phantom requirement.
 */
function declaredAssets(file) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const out = [];
  // Split at each `src:` so every chunk holds exactly one entry, and read its
  // `sizes:` from within that chunk.
  //
  // NOT one regex spanning `src: … sizes:` with a bounded gap. The first
  // version of this did exactly that, capped at 200 characters, and adding a
  // three-line comment between the two keys pushed one entry out of range — so
  // `screenshots/mobile.png` was silently not parsed and its wrong dimensions
  // sailed through the mutation test that was supposed to catch them. A gate
  // whose coverage depends on how much prose sits inside the object is not a
  // gate. The count assertion below now makes any future parse miss fail.
  for (const part of source.split(/(?=src:\s*`)/)) {
    const src = part.match(/^src:\s*`\$\{[^}]*\}(\/[^`]+)`/);
    if (!src) continue;
    const sizes = part.match(/sizes:\s*'(\d+)x(\d+)'/);
    // `sizes: 'any'` is the correct declaration for a vector icon — an SVG has
    // no pixel dimensions to check against. Recorded as intentional so the
    // coverage assertion can tell it apart from an entry with no sizes at all.
    const anySize = /sizes:\s*'any'/.test(part);
    out.push({
      file,
      src: src[1],
      anySize,
      width: sizes ? Number(sizes[1]) : null,
      height: sizes ? Number(sizes[2]) : null,
    });
  }
  return out;
}

/** Raw count of `src:` template literals, independent of the parse above. */
function rawSrcCount(file) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  return [...source.matchAll(/src:\s*`\$\{[^}]*\}\/[^`]+`/g)].length;
}

const ALL = EMITTERS.flatMap(declaredAssets);
const RAW_TOTAL = EMITTERS.reduce((n, f) => n + rawSrcCount(f), 0);

describe('manifest assets', () => {
  test('every declared src was parsed — no silent coverage loss', () => {
    // Counted two independent ways. A `src:` the parser skips is not a smaller
    // pass, it is an unchecked asset — which is precisely what happened while
    // writing this file: one entry fell out of range and its wrong dimensions
    // went unnoticed by the very mutation meant to prove the check worked.
    // #396 is the standing lesson: a drop in the MEASURED count means things
    // stopped being looked at, not that they got better.
    assert.strictEqual(
      ALL.length,
      RAW_TOTAL,
      `${RAW_TOTAL} \`src:\` entries exist across ${EMITTERS.join(' + ')} but ` +
        `only ${ALL.length} were parsed. The unparsed ones are being checked ` +
        `by nothing below.`
    );

    // And a floor, so a rewrite that makes BOTH counts zero still fails.
    assert.ok(
      ALL.length >= 14,
      `Only ${ALL.length} manifest assets found at all. Both counts agreeing ` +
        `on zero is still a vacuous pass.`
    );

    const sizeless = ALL.filter((a) => a.width === null && !a.anySize).map(
      (a) => a.src
    );
    assert.deepStrictEqual(
      sizeless,
      [],
      `These declare a src with neither WxH nor 'any', so their dimensions ` +
        `cannot be verified:\n  ${sizeless.join('\n  ')}`
    );
  });

  test('every declared asset exists on disk', () => {
    const missing = ALL.filter(
      (a) => !fs.existsSync(path.join(PUBLIC, a.src))
    ).map((a) => `${a.src} (declared in ${a.file})`);

    assert.deepStrictEqual(
      missing,
      [],
      `The manifest promises files that are not in public/. These 404 for real ` +
        `users and degrade the PWA install sheet silently:\n  ` +
        missing.join('\n  ')
    );
  });

  test('every PNG matches the dimensions it declares', () => {
    // PNG header: 8-byte signature, then an IHDR chunk whose width and height
    // are big-endian uint32 at byte offsets 16 and 20. Read directly rather
    // than pulling in an image library — this must not depend on sharp being
    // installed, since it runs in `pnpm test:scripts` on a plain node.
    const wrong = [];
    for (const a of ALL) {
      if (!a.src.endsWith('.png')) continue;
      const file = path.join(PUBLIC, a.src);
      if (!fs.existsSync(file)) continue; // reported by the test above
      const head = Buffer.alloc(24);
      const fd = fs.openSync(file, 'r');
      try {
        fs.readSync(fd, head, 0, 24, 0);
      } finally {
        fs.closeSync(fd);
      }
      const width = head.readUInt32BE(16);
      const height = head.readUInt32BE(20);
      if (width !== a.width || height !== a.height) {
        wrong.push(
          `${a.src}: declares ${a.width}x${a.height}, file is ${width}x${height} (${a.file})`
        );
      }
    }

    assert.deepStrictEqual(
      wrong,
      [],
      `Declared sizes disagree with the actual images. Chrome drops a manifest ` +
        `screenshot whose size does not match:\n  ` +
        wrong.join('\n  ')
    );
  });

  test('no shipped icon carries a text monogram', () => {
    // The #659 failure itself: `CK` (CRUDkit) and `C` were drawn as <text> in 13
    // committed SVGs, and `000` in two placeholders. A brand mark is artwork;
    // a letter rendered by the icon generator is a monogram inherited from
    // whoever the template was forked from.
    const offenders = [];
    for (const name of fs.readdirSync(PUBLIC)) {
      if (!name.startsWith('icon') || !name.endsWith('.svg')) continue;
      const svg = fs.readFileSync(path.join(PUBLIC, name), 'utf8');
      const text = svg.match(/<text[\s\S]*?<\/text>/);
      if (text) offenders.push(`${name}: ${text[0].slice(0, 60)}…`);
    }

    assert.deepStrictEqual(
      offenders,
      [],
      `These icons draw text. Generate them from the brand mark instead ` +
        `(\`pnpm run generate:icons\`):\n  ` +
        offenders.join('\n  ')
    );
  });
});
