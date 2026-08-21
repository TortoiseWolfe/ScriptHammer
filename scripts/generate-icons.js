#!/usr/bin/env node
/**
 * Generate every PWA / favicon asset from ONE brand mark (#659).
 *
 * WHAT WENT WRONG BEFORE. This script used to contain the literal string `CK`
 * in three places and draw it as text. `CK` is CRUDkit — the project this
 * template was forked from — and because `rebrand.sh` had no icon handling at
 * all (zero matches for `icon`, `.svg` or `logo`), that monogram shipped in 13
 * committed files and installed onto users' home screens on every fork. It was
 * found on a live client site whose PWA install sheet showed a CRUDkit `C`.
 * Two more assets (`icon.svg`, `apple-touch-icon.png`) were a placeholder
 * reading `000`.
 *
 * A generated INITIAL is what caused this, so the fix is not a better initial.
 * The source here is a real mark, and a fork points `--source` at its own.
 *
 * RASTER SOURCES (#898). This accepted SVG only, and `rebrand.sh` enforced that
 * with `--icon must be an SVG`. That rejection is how #659 recurred: a
 * downstream fork's brand mark is a PNG, so it could not use `--icon` at all and
 * was funnelled into the no-icon path, shipping our printing mallet as its
 * favicon and home-screen icon on a live custom domain. The constraint created
 * the failure it warned about, and it was not even true — a raster works fine
 * here. The mark is trimmed once, then each target embeds a `data:` PNG sized to
 * that target, so a 32px icon carries a 64px image rather than a duplicated copy
 * of a 165KB source.
 *
 * WHY IT IS COMMITTED OUTPUT, NOT BUILD OUTPUT. #392 is the standing rule that
 * generated artifacts are build outputs and never inputs — but these are
 * genuinely source: they change only when the brand changes, a fork needs them
 * present without running a build, and `public/manifest.json` (also committed)
 * references them by name. Run this when the mark changes; `rebrand.sh` runs it
 * for you.
 *
 * Usage:
 *   node scripts/generate-icons.js                          # defaults below
 *   node scripts/generate-icons.js --source public/mark.svg --bg '#1a1a2e'
 *   node scripts/generate-icons.js --check                  # verify, write nothing
 *
 * `--check` is what CI runs: it regenerates into memory and fails if any
 * committed file differs, so an edited-by-hand icon or a stale one after a
 * brand change is caught instead of quietly shipping.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

/** Raw bytes of the chosen mark, set in main() before any rendering. */
let SOURCE_SVG = null;

/**
 * The default mark. `favicon.svg` is the printing mallet over angle brackets —
 * a symbol, not a wordmark, which is the only kind that survives 72px.
 * `scripthammer-logo.svg` is deliberately NOT used: it wraps "ScriptHammer.com"
 * around a saw blade, and that text is illegible below about 256px.
 */
const DEFAULT_SOURCE = 'public/favicon.svg';

/**
 * Matches `background_color` in both manifest emitters. Keep them in step — an
 * icon backdrop that differs from the splash colour shows as a flash of the
 * wrong colour on launch.
 */
const DEFAULT_BG = '#1a1a2e';

/** Plain `any` icons: the mark fills most of the tile, small breathing margin. */
const ANY_INSET = 0.12;

/**
 * Maskable icons get a much bigger margin. The platform may crop to a circle,
 * and the guaranteed-visible area is the middle 80% — so the mark sits inside
 * ~60% and survives every mask shape. Getting this wrong is how maskable icons
 * end up with their edges shaved off.
 */
const MASKABLE_INSET = 0.28;

/** Every asset this owns. Anything here is regenerated; nothing else is touched. */
const TARGETS = [
  // Plain SVG set, referenced by scripts/generate-manifest.js.
  ...[72, 96, 128, 144, 152, 192, 384, 512].map((s) => ({
    file: `icon-${s}.svg`,
    size: s,
    kind: 'svg',
    inset: ANY_INSET,
  })),
  // Maskable SVGs.
  ...[192, 512].map((s) => ({
    file: `icon-${s}-maskable.svg`,
    size: s,
    kind: 'svg',
    inset: MASKABLE_INSET,
  })),
  // The `WxH` spelling, referenced by src/config/project.config.ts. Two
  // emitters disagreeing about which set ships is its own bug (#659); until
  // they are collapsed, BOTH must be real, or whichever one a fork happens to
  // use is the CRUDkit one.
  { file: 'icon-192x192.svg', size: 192, kind: 'svg', inset: ANY_INSET },
  { file: 'icon-512x512.svg', size: 512, kind: 'svg', inset: ANY_INSET },
  { file: 'icon-maskable.svg', size: 512, kind: 'svg', inset: MASKABLE_INSET },
  // Raster. Android prefers the maskable PNGs for the install sheet — these are
  // the two the user actually sees when installing.
  {
    file: 'icon-192x192-maskable.png',
    size: 192,
    kind: 'png',
    inset: MASKABLE_INSET,
  },
  {
    file: 'icon-512x512-maskable.png',
    size: 512,
    kind: 'png',
    inset: MASKABLE_INSET,
  },
  // iOS "Add to Home Screen" (layout.tsx `icons.apple`). Never maskable — iOS
  // applies its own corner radius and does not crop.
  { file: 'apple-touch-icon.png', size: 180, kind: 'png', inset: ANY_INSET },
  // The SVG twin of the above. `src/config/project.config.ts:63` exports
  // `appleTouchIconPath` pointing here, so a fork can reference it even though
  // layout.tsx currently hardcodes the .png. It was NOT generated before, so it
  // kept the previous brand while every other asset moved — the #659 shape
  // exactly: the one file the generator does not own is the one that lies.
  { file: 'apple-touch-icon.svg', size: 180, kind: 'svg', inset: ANY_INSET },
  // The tab icon (layout.tsx `icons.icon`). Was the `000` placeholder.
  { file: 'icon.svg', size: 32, kind: 'svg', inset: ANY_INSET },
  // Browsers still request /favicon.ico by convention, with no <link> needed.
  // This shipped as an 11-byte file containing the literal text "placeholder",
  // so every one of those requests got garbage.
  { file: 'favicon.ico', size: 48, kind: 'ico', inset: ANY_INSET },
];

/**
 * `favicon.svg` is normally the SOURCE, so it is not in TARGETS — regenerating
 * it from itself would be circular. When `--source` points somewhere else (a
 * raster mark, say), it stops being the source and starts being an asset like
 * any other, and it must be regenerated or it keeps the previous brand while
 * everything around it moves. That is the #659 shape exactly: the one file the
 * generator does not own is the one that lies.
 */
const FAVICON_TARGET = {
  file: 'favicon.svg',
  size: 512,
  kind: 'svg',
  inset: ANY_INSET,
};

/** Sizes packed into favicon.ico. 16 and 32 are what browsers actually pick. */
const ICO_SIZES = [16, 32, 48];

/**
 * Split a source SVG into its viewBox and its drawable body.
 *
 * The body is nested as an inner `<svg>` rather than base64'd into an
 * `<image href="data:…">`: an SVG rendered AS AN IMAGE (which is exactly what a
 * favicon and a manifest icon are) does not reliably load data-URI references,
 * so the icon would come out blank in some browsers and fine in others.
 */
function parseSource(svg) {
  const viewBox = svg.match(/viewBox="([^"]+)"/i);
  if (!viewBox) {
    throw new Error(
      'Source SVG has no viewBox, so it cannot be scaled into an icon tile. ' +
        'Add one (e.g. viewBox="0 0 512 512") to the source mark.'
    );
  }
  const open = svg.match(/<svg[^>]*>/i);
  if (!open) throw new Error('Source is not an SVG (no <svg> element).');
  const body = svg
    .slice(svg.indexOf(open[0]) + open[0].length, svg.lastIndexOf('</svg>'))
    .trim();
  if (!body) throw new Error('Source SVG is empty.');
  return { viewBox: viewBox[1], body };
}

/**
 * Shrink the source viewBox to the mark's actual ink.
 *
 * WHY THIS IS NOT OPTIONAL. A hand-drawn mark usually floats in whitespace, and
 * nesting it verbatim multiplies that margin by the tile inset — the first
 * render of this script produced a maskable icon whose mallet was a speck in
 * the middle of a navy square. Trimming first means the inset percentages below
 * mean what they say, for this mark and for whatever a fork points `--source`
 * at.
 *
 * (This used to cite "45.6% x 46.7% of its own 512 viewBox" as the motivating
 * number. Both figures were fossils of the pre-v3 CRUDkit art — today's source
 * is a 400 viewBox filled to 98.54%. No code ever read them, but a stale number
 * in a docblock is read by people, which is worse.)
 *
 * Measured by rasterising and trimming transparent edges, because computing a
 * true bounding box from arbitrary SVG paths (with transforms, strokes and
 * markers) is a rendering problem, not a parsing one.
 */
async function tightViewBox(viewBox) {
  const [vx, vy, vw, vh] = viewBox.split(/[\s,]+/).map(Number);
  if (![vx, vy, vw, vh].every(Number.isFinite) || vw <= 0 || vh <= 0) {
    throw new Error(`Unparseable viewBox: "${viewBox}"`);
  }
  const sharp = require('sharp');
  // Enough resolution that a 1px trim error is negligible at any icon size.
  const W = 1024;
  const H = Math.max(1, Math.round((W * vh) / vw));
  const flat = await sharp(SOURCE_SVG)
    .resize(W, H, { fit: 'fill' })
    .png()
    .toBuffer();
  let info;
  try {
    ({ info } = await sharp(flat)
      .trim({ threshold: 1 })
      .toBuffer({ resolveWithObject: true }));
  } catch {
    return viewBox; // fully transparent or untrimmable — use it as-is
  }
  // sharp reports the crop as a NEGATIVE offset from the original origin.
  const left = Math.abs(info.trimOffsetLeft || 0);
  const top = Math.abs(info.trimOffsetTop || 0);
  if (!info.width || !info.height) return viewBox;
  const sx = vw / W;
  const sy = vh / H;
  return [vx + left * sx, vy + top * sy, info.width * sx, info.height * sy]
    .map((n) => Math.round(n * 100) / 100)
    .join(' ');
}

/** Compose one tile: solid brand backdrop, mark centred inside the inset. */
/**
 * Read a raster mark. Trimmed ONCE here rather than per target, because that is
 * what `tightViewBox` does for an SVG source and trimming per size would give
 * each icon a slightly different crop.
 */
async function parseRasterSource(buf) {
  const sharp = require('sharp');
  let img = sharp(buf);
  try {
    buf = await img.trim({ threshold: 1 }).png().toBuffer();
    img = sharp(buf);
  } catch {
    // Fully transparent or untrimmable: use the mark as-is.
  }
  const { width, height } = await img.metadata();
  if (!width || !height) throw new Error('Source raster has no dimensions.');
  return { viewBox: `0 0 ${width} ${height}`, raster: buf, width, height };
}

/**
 * Resolve the body for one target. An SVG source is size-independent and passes
 * through untouched; a raster is re-encoded to roughly twice the target's pixel
 * size — capped at the mark's own resolution, since upscaling only adds bytes —
 * and embedded as a `data:` URI. Declared width/height stay in the mark's own
 * coordinate space so `composeSvg`'s nested viewBox scales it as it would vectors.
 */
async function bodyForTarget(parsed, size) {
  if (!parsed.raster) return parsed;
  const sharp = require('sharp');
  const px = Math.max(32, Math.min(parsed.width, Math.round(size * 2)));
  const scaled = await sharp(parsed.raster)
    .resize(px, null, { fit: 'inside' })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  return {
    viewBox: parsed.viewBox,
    body: `    <image href="data:image/png;base64,${scaled.toString('base64')}" x="0" y="0" width="${parsed.width}" height="${parsed.height}"/>`,
  };
}

function composeSvg({ viewBox, body }, size, bg, inset) {
  const pad = Math.round(size * inset);
  const inner = size - pad * 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- GENERATED by scripts/generate-icons.js — do not edit by hand.
     Run \`pnpm run generate:icons\` after changing the brand mark. -->
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${bg}"/>
  <svg x="${pad}" y="${pad}" width="${inner}" height="${inner}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">
${body}
  </svg>
</svg>
`;
}

/**
 * Pack PNGs into an .ico container.
 *
 * Written here rather than pulled in as a dependency: the format is an 6-byte
 * ICONDIR, one 16-byte ICONDIRENTRY per image, then the image payloads. Modern
 * Windows and every browser accept PNG-compressed entries, so the payloads are
 * just the PNG bytes sharp already produces.
 */
function packIco(pngs) {
  const HEADER = 6;
  const ENTRY = 16;
  const dir = Buffer.alloc(HEADER);
  dir.writeUInt16LE(0, 0); // reserved
  dir.writeUInt16LE(1, 2); // type 1 = icon
  dir.writeUInt16LE(pngs.length, 4);

  let offset = HEADER + ENTRY * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(ENTRY);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette size
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });

  return Buffer.concat([dir, ...entries, ...pngs.map((p) => p.data)]);
}

async function render(target, parsed, bg) {
  const sharp = require('sharp');
  if (target.kind === 'ico') {
    const pngs = [];
    for (const size of ICO_SIZES) {
      const svg = composeSvg(
        await bodyForTarget(parsed, size),
        size,
        bg,
        target.inset
      );
      pngs.push({
        size,
        data: await sharp(Buffer.from(svg, 'utf8')).png().toBuffer(),
      });
    }
    return packIco(pngs);
  }
  const svg = composeSvg(
    await bodyForTarget(parsed, target.size),
    target.size,
    bg,
    target.inset
  );
  if (target.kind === 'svg') return Buffer.from(svg, 'utf8');
  return sharp(Buffer.from(svg, 'utf8')).png().toBuffer();
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (name, fallback) => {
    const i = argv.indexOf(name);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  const check = argv.includes('--check');
  const sourcePath = path.resolve(ROOT, arg('--source', DEFAULT_SOURCE));
  const bg = arg('--bg', DEFAULT_BG);

  if (!fs.existsSync(sourcePath)) {
    console.error(`generate-icons: source mark not found: ${sourcePath}`);
    process.exit(1);
  }
  const bytes = fs.readFileSync(sourcePath);
  SOURCE_SVG = bytes;
  // Detect a RASTER positively, by magic bytes, and treat everything else as
  // SVG. Sniffing for "<svg" instead looks reasonable and is wrong: this repo's
  // own mark opens with a 1,300-byte comment, so any fixed-size window misses
  // the tag and silently classifies the SVG as a raster — which produces a full
  // set of plausible icons built from a rasterised copy of itself. `--check`
  // caught exactly that during development; a smaller window would have shipped
  // it. Extensions are not trusted either: a mis-named source must fail loudly
  // in the parser rather than quietly render an empty tile.
  const isRaster =
    // PNG \x89PNG\r\n\x1a\n
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    // WebP: "RIFF" .... "WEBP"
    (bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
      bytes.subarray(8, 12).toString('latin1') === 'WEBP') ||
    // JPEG \xff\xd8\xff
    bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ||
    // GIF87a / GIF89a
    bytes.subarray(0, 4).toString('latin1') === 'GIF8';
  let parsed;
  if (!isRaster) {
    parsed = parseSource(bytes.toString('utf8'));
    parsed.viewBox = await tightViewBox(parsed.viewBox);
  } else {
    parsed = await parseRasterSource(bytes);
  }

  // See FAVICON_TARGET: only owned when it is not itself the source.
  const targets =
    path.resolve(PUBLIC, 'favicon.svg') === sourcePath
      ? TARGETS
      : [...TARGETS, FAVICON_TARGET];

  const drift = [];
  for (const target of targets) {
    const out = path.join(PUBLIC, target.file);
    const next = await render(target, parsed, bg);
    if (check) {
      const current = fs.existsSync(out) ? fs.readFileSync(out) : null;
      // PNG bytes are not reproducible across sharp/libvips versions, so
      // comparing them would fail on an unrelated dependency bump and teach
      // everyone to ignore this check. Only presence is asserted for raster;
      // the SVGs are byte-comparable and carry the real signal.
      if (current === null) drift.push(`${target.file} (missing)`);
      else if (target.kind === 'svg' && !current.equals(next))
        drift.push(`${target.file} (differs from the generated output)`);
      continue;
    }
    fs.writeFileSync(out, next);
    console.log(
      `  ${target.file.padEnd(30)} ${target.size}px ${target.kind}${target.inset === MASKABLE_INSET ? ' maskable' : ''}`
    );
  }

  if (check) {
    if (drift.length) {
      console.error(
        `generate-icons --check: ${drift.length} icon(s) do not match the ` +
          `brand mark at ${path.relative(ROOT, sourcePath)}:\n` +
          drift.map((d) => `  - ${d}`).join('\n') +
          `\n\nRun \`pnpm run generate:icons\` and commit the result.`
      );
      process.exit(1);
    }
    console.log(
      `generate-icons --check: all ${targets.length} icons match ${path.relative(ROOT, sourcePath)}.`
    );
    return;
  }
  console.log(
    `\ngenerate-icons: wrote ${targets.length} assets from ${path.relative(ROOT, sourcePath)} on ${bg}.`
  );
}

main().catch((err) => {
  console.error(`generate-icons: ${err.message}`);
  process.exit(1);
});
