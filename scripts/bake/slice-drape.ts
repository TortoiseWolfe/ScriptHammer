/**
 * ONE PHOTOGRAPH 5.8 KM LONG IS NOT A TEXTURE, IT IS A LIABILITY.
 *
 * `drape.jpg` is 2433 x 7938 for chatt. Three things go wrong with shipping
 * that to a phone as a single texture:
 *
 *   1. It may not upload AT ALL. three's own downscale guard
 *      (`WebGLTextures.js` -> `resizeImage(…, maxTextureSize)`) only fires for
 *      HTMLImageElement / Canvas / ImageBitmap / VideoFrame. Under expo-gl the
 *      image is a `{ data: { localUri }, width, height }` shim from
 *      `@react-three/fiber/native`, which is none of those, so it walks past
 *      the guard to a native upload that fails with NO JS error. The web
 *      export silently downscales; the phone silently renders black ground.
 *
 *   2. ~77 MB of RGBA plus ~26 MB of mips, resident for the life of the app,
 *      to display the ~16 m of ground actually under the animal.
 *
 *   3. It caps the resolution of the whole twin at whatever one image can
 *      hold. Six-inch imagery over this corridor is 366 megapixels; it can
 *      only ever arrive as tiles.
 *
 * So: slice the stitched drape into a grid. Nothing is re-fetched and nothing
 * is re-projected — this is a pure raster operation on the file the bake
 * already produced, which means it cannot disturb the georegistration that
 * `fetchDrape` works so hard to validate.
 *
 * TILE BOUNDS COME FROM PIXELS, NOT FROM METRES. Each tile's world rectangle
 * is derived from its integer pixel range, so tile i's east edge is bit-for-bit
 * tile i+1's west edge and the ground meshes that carry them share vertices
 * exactly. Doing it the other way — dividing metres, then rounding to pixels —
 * leaves a sub-pixel gap at every seam that shows as a bright line.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

/** One slice of the drape, and the patch of world it covers. */
export interface GroundTile {
  /** Grid position, row 0 = north edge, col 0 = west edge. */
  row: number;
  col: number;
  /** Filename within the tile directory. */
  path: string;
  /** Pixel window in the source raster: x, y, width, height. */
  px: [number, number, number, number];
  /**
   * World rectangle in metres, centred like the rest of the twin:
   * [minX, minZ, maxX, maxZ]. Derived from `px`, never the other way round.
   */
  world: [number, number, number, number];
}

export interface DrapeTiling {
  cols: number;
  rows: number;
  /** Directory holding the tiles, relative to the twin root. */
  dir: string;
  /** Source raster dimensions the world rectangles were derived from. */
  source: { width: number; height: number };
  tiles: GroundTile[];
}

/**
 * Split `total` into `n` near-equal integer parts whose cumulative edges are
 * exact. Returned as n+1 boundaries so callers read edges rather than widths —
 * adjacent tiles must AGREE on their shared edge, and reconstructing it from
 * two independently rounded widths is how seams appear.
 */
export function splitEdges(total: number, n: number): number[] {
  const edges = [0];
  for (let i = 1; i <= n; i++) edges.push(Math.round((total * i) / n));
  return edges;
}

/**
 * Choose a grid that keeps every tile under `maxPx` on both axes while using
 * as few tiles as possible. Fewer, larger tiles mean fewer draw calls and
 * fewer requests; the cap is what makes them safe.
 */
export function planTiling(
  width: number,
  height: number,
  maxPx = 2048
): { cols: number; rows: number } {
  return {
    cols: Math.max(1, Math.ceil(width / maxPx)),
    rows: Math.max(1, Math.ceil(height / maxPx)),
  };
}

export function planGroundTiles(
  width: number,
  height: number,
  halfX: number,
  halfZ: number,
  maxPx = 2048,
  dir = 'drape'
): DrapeTiling {
  const { cols, rows } = planTiling(width, height, maxPx);
  const xs = splitEdges(width, cols);
  const ys = splitEdges(height, rows);
  const tiles: GroundTile[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = xs[c],
        x1 = xs[c + 1],
        y0 = ys[r],
        y1 = ys[r + 1];
      // Pixel row 0 is the NORTH edge, which is -Z in the twin's frame.
      tiles.push({
        row: r,
        col: c,
        path: `r${r}c${c}.jpg`,
        px: [x0, y0, x1 - x0, y1 - y0],
        world: [
          -halfX + (x0 / width) * halfX * 2,
          -halfZ + (y0 / height) * halfZ * 2,
          -halfX + (x1 / width) * halfX * 2,
          -halfZ + (y1 / height) * halfZ * 2,
        ],
      });
    }
  }
  return { cols, rows, dir, source: { width, height }, tiles };
}

/**
 * Slice `<twin>/drape.jpg` into `<twin>/drape/rNcM.jpg` and return the plan.
 *
 * Quality 92 rather than the stitch's 90: this is a second JPEG generation on
 * already-lossy imagery, and the extra two points cost a few percent of bytes
 * to keep it from compounding visibly at the kerbs, which are the hard edges
 * the eye reads a street by.
 */
export async function sliceDrape(
  twinDir: string,
  halfX: number,
  halfZ: number,
  opts: { filename?: string; dir?: string; maxPx?: number } = {}
): Promise<DrapeTiling & { bytes: number }> {
  const filename = opts.filename ?? 'drape.jpg';
  const dir = opts.dir ?? 'drape';
  const src = join(twinDir, filename);
  if (!existsSync(src)) throw new Error(`slice-drape: no ${src}`);

  const image = sharp(src);
  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height)
    throw new Error(`slice-drape: ${src} has no dimensions`);

  const plan = planGroundTiles(width, height, halfX, halfZ, opts.maxPx, dir);
  const outDir = join(twinDir, dir);
  mkdirSync(outDir, { recursive: true });

  let bytes = 0;
  for (const t of plan.tiles) {
    // A fresh sharp() per tile: extract() mutates the pipeline, so reusing one
    // instance across tiles crops the already-cropped result.
    const buf = await sharp(src)
      .extract({ left: t.px[0], top: t.px[1], width: t.px[2], height: t.px[3] })
      .jpeg({ quality: 92 })
      .toBuffer();
    writeFileSync(join(outDir, t.path), buf);
    bytes += buf.length;
  }

  writeFileSync(
    join(twinDir, 'drape-tiles.json'),
    JSON.stringify({ ...plan, bytes }, null, 2)
  );
  return { ...plan, bytes };
}
