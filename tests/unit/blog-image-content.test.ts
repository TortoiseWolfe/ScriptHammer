/**
 * Guards that a shipped blog image actually contains an image (#439).
 *
 * ## Why this exists
 * `public/blog-images/admin-dashboard-overview/overview.png` — the thumbnail
 * for "Building a Centralized Admin Dashboard" — shipped to the live blog as a
 * blank white box. It was a valid PNG of the right dimensions that served 200,
 * so every existing check was satisfied. Its CONTENT was gone: 89.1% pure white
 * across 69 distinct colours, down from a real dark-theme screenshot.
 *
 * It was destroyed by commit 9352890, "compressed overview image", which took
 * the file from 54,840 bytes to 5,968. Nothing verified the result, so a blank
 * rectangle sat on the blog from 2026-03-03.
 *
 * ## Why the obvious guard is the WRONG one
 * The first instinct is to reject an image whose dominant colour dominates —
 * "89% white means blank". Measured across every raster image this repo ships,
 * that rule fails badly:
 *
 *     sortable.png   98.5% one colour   FINE (dark-theme screenshot)
 *     users.png      96.9%              FINE
 *     audit.png      96.3%              FINE
 *     overview.png   94.4%              FINE — this is the RESTORED good file
 *
 * A dark UI screenshot is legitimately almost all background. The threshold
 * would have rejected the very image it was meant to protect.
 *
 * ## The signal that does discriminate
 * Distinct colour count. Detail survives compression as colour variety; a
 * blanked image loses it:
 *
 *     broken overview.png       69 colours
 *     restored overview.png    606
 *     lowest legitimate image  254  (bad-seo-example-og.png)
 *
 * The floor below sits between 69 and 254 with margin on both sides. It is set
 * from measurement, not taste — and it is verified to reject the broken file,
 * which is the only thing that makes it a guard rather than decoration.
 *
 * @module tests/unit/blog-image-content.test
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import sharp from 'sharp';

const ROOT = join(process.cwd(), 'public/blog-images');

/**
 * Minimum distinct colours for a shipped raster image.
 *
 * Between the broken file (69) and the least-varied legitimate one (254).
 * Raise it only with fresh measurements across every image — a floor lowered to
 * make a run pass is the failure #396 documents.
 */
const MIN_DISTINCT_COLOURS = 150;

const RASTER = /\.(png|jpe?g)$/i;

function rasterImages(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...rasterImages(full));
    else if (RASTER.test(entry.name)) out.push(full);
  }
  return out;
}

/** Count distinct RGB triples in an image. */
async function distinctColours(file: string): Promise<number> {
  const { data, info } = await sharp(file)
    .removeAlpha()
    // Downscale first: colour VARIETY survives it, so the signal is preserved
    // while a 3.6MB screenshot stops costing a second to decode.
    .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const seen = new Set<number>();
  const stride = info.channels;
  for (let i = 0; i < data.length; i += stride) {
    seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
  }
  return seen.size;
}

describe('shipped blog images contain an image (#439)', () => {
  const files = rasterImages(ROOT);

  it('finds raster images to check', () => {
    // A sweep that silently measures nothing reads as a pass. #411 is the same
    // shape: a green gate that covered 4 of 43 routes.
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((f) => [relative(ROOT, f), f]))(
    '%s is not blank',
    async (_name, file) => {
      expect(statSync(file).size).toBeGreaterThan(0);
      const colours = await distinctColours(file);
      expect(
        colours,
        `only ${colours} distinct colours — a blanked or over-compressed image. ` +
          `overview.png shipped blank at 69; the least-varied legitimate image ` +
          `here has 254. Do NOT lower the floor to make this pass.`
      ).toBeGreaterThanOrEqual(MIN_DISTINCT_COLOURS);
    },
    20_000
  );
});
