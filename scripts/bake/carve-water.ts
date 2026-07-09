import sharp from 'sharp';

/**
 * Carve the river into the terrain by following the AERIAL waterline (#225).
 *
 * WHY: the diorama rendered buildings sitting in the Tennessee River. In 2D the
 * building footprints register perfectly onto the NAIP aerial (drape) — the fault
 * is the 3D terrain. Two problems compounded:
 *   1. The bake fetched no water at all, so the terrain had no channel and the
 *      river was just dark drape pixels on a flat mesh (a black void).
 *   2. Deriving water from the terrain's own low-elevation band gave a RAGGED,
 *      coarse-grid shoreline (~30–98 m cells) that didn't match the real bank, so
 *      riverfront buildings fell on the wrong side of a jagged edge and floated.
 *
 * FIX: the drape IS the truth (buildings register to it). Classify the aerial's
 * water at PIXEL resolution — the river surface is smooth, green-dominant, and
 * mid-to-low brightness, which is separable from tree-shadow (shadow has high
 * local variance; open water is flat). Then carve every terrain sample whose
 * drape pixel is water down to the water level. The bank now follows the real
 * shoreline (limited only by the terrain grid spacing, which fetch-terrain.ts
 * keeps fine), so buildings sit behind the true waterline instead of over it.
 *
 * NOTE on the shadow==water caveat (#225): a naive brightness threshold conflates
 * tree-shadow with water and lies. The added low-local-variance test is what makes
 * this safe — it keys on the river surface being texturally FLAT, not merely dark.
 */

export interface TerrainGrid {
  cols: number;
  rows: number;
  heights: number[];
}

/**
 * Classify aerial water from the drape's raw RGB. A pixel is water when it is:
 *  - green-dominant (river reads teal/green in NAIP), AND
 *  - mid-to-low brightness (not bright rooftops/roads/sand), AND
 *  - texturally smooth — low local standard deviation over a small window. This
 *    is the discriminator that separates flat open water from tree-shadow, which
 *    is dark+greenish but HIGH-variance (canopy texture).
 * Then only large connected components are kept (drops rooftop/lot specks).
 */
export async function classifyAerialWater(
  drapePath: string
): Promise<{ mask: Uint8Array; width: number; height: number }> {
  const { data, info } = await sharp(drapePath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const ch = info.channels; // 3 after removeAlpha
  const N = W * H;

  const bright = new Float32Array(N);
  const green = new Uint8Array(N); // green-dominant + brightness band
  for (let i = 0; i < N; i++) {
    const r = data[i * ch];
    const g = data[i * ch + 1];
    const b = data[i * ch + 2];
    const br = (r + g + b) / 3;
    bright[i] = br;
    green[i] = g >= r - 3 && g >= b - 3 && br > 35 && br < 120 ? 1 : 0;
  }

  // Local std over a (2R+1) box via integral images of bright and bright^2.
  const R = 3;
  const sum = new Float64Array((W + 1) * (H + 1));
  const sumSq = new Float64Array((W + 1) * (H + 1));
  const at = (x: number, y: number) => y * (W + 1) + x;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = bright[y * W + x];
      sum[at(x + 1, y + 1)] =
        v + sum[at(x, y + 1)] + sum[at(x + 1, y)] - sum[at(x, y)];
      sumSq[at(x + 1, y + 1)] =
        v * v + sumSq[at(x, y + 1)] + sumSq[at(x + 1, y)] - sumSq[at(x, y)];
    }
  }
  const boxStd = (x: number, y: number): number => {
    const x0 = Math.max(0, x - R);
    const y0 = Math.max(0, y - R);
    const x1 = Math.min(W, x + R + 1);
    const y1 = Math.min(H, y + R + 1);
    const n = (x1 - x0) * (y1 - y0);
    const s =
      sum[at(x1, y1)] - sum[at(x0, y1)] - sum[at(x1, y0)] + sum[at(x0, y0)];
    const sq =
      sumSq[at(x1, y1)] -
      sumSq[at(x0, y1)] -
      sumSq[at(x1, y0)] +
      sumSq[at(x0, y0)];
    const mu = s / n;
    return Math.sqrt(Math.max(sq / n - mu * mu, 0));
  };

  const raw = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (green[i] && boxStd(x, y) < 9) raw[i] = 1;
    }
  }

  // Keep only large connected components (the river + major tributaries), so
  // stray smooth-green rooftops/lots don't punch phantom ponds into downtown.
  const mask = keepLargeComponents(raw, W, H, 2000);
  return { mask, width: W, height: H };
}

/** 4-connected components; keep only those with >= minSize pixels. */
function keepLargeComponents(
  raw: Uint8Array,
  W: number,
  H: number,
  minSize: number
): Uint8Array {
  const label = new Int32Array(W * H);
  const out = new Uint8Array(W * H);
  const stack: number[] = [];
  let next = 0;
  for (let start = 0; start < W * H; start++) {
    if (!raw[start] || label[start]) continue;
    next++;
    stack.length = 0;
    stack.push(start);
    label[start] = next;
    const members: number[] = [];
    while (stack.length) {
      const p = stack.pop()!;
      members.push(p);
      const x = p % W;
      const y = (p - x) / W;
      const nb = [
        x > 0 ? p - 1 : -1,
        x < W - 1 ? p + 1 : -1,
        y > 0 ? p - W : -1,
        y < H - 1 ? p + W : -1,
      ];
      for (const q of nb) {
        if (q >= 0 && raw[q] && !label[q]) {
          label[q] = next;
          stack.push(q);
        }
      }
    }
    if (members.length >= minSize) for (const p of members) out[p] = 1;
  }
  return out;
}

/**
 * Carve the terrain to the aerial waterline. Each grid sample (c, r) maps to a
 * drape pixel via the runtime UV mapping: u = c/(cols-1) (W→E), and the drape row
 * from the flipY'd S→N v (fetch-terrain row 0 = south → v = r/(rows-1); drape row
 * 0 = north → drow = (1-v)·(dH-1)). If the aerial mask says that pixel is water,
 * the sample is lowered to the water level (grid minimum) — a flat surface with a
 * sharp bank at the mask boundary.
 */
export function carveToMask(
  grid: TerrainGrid,
  mask: { mask: Uint8Array; width: number; height: number },
  groundWm: number,
  groundHm: number
): { grid: TerrainGrid; carved: number; waterLevel: number } {
  void groundWm; // (E-W extent unused; N-S extent sizes the dilation rounds)
  const { cols, rows, heights } = grid;
  const { mask: m, width: dW, height: dH } = mask;
  // NOT Math.min(...heights): spreading overflows the call stack at ~126k
  // args, and 1 m-class grids (#229 accuracy v2) exceed that.
  let waterLevel = Infinity;
  for (const h of heights) if (h < waterLevel) waterLevel = h;
  const out = heights.slice();

  // Pass 1: cells whose drape pixel the classifier marked as water.
  const isWater = new Uint8Array(cols * rows);
  const surfaceSamples: number[] = [];
  for (let r = 0; r < rows; r++) {
    const v = r / (rows - 1);
    const drow = Math.min(dH - 1, Math.max(0, Math.round((1 - v) * (dH - 1))));
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1);
      const dcol = Math.min(dW - 1, Math.max(0, Math.round(u * (dW - 1))));
      if (m[drow * dW + dcol]) {
        isWater[r * cols + c] = 1;
        surfaceSamples.push(heights[r * cols + c]);
      }
    }
  }

  // Pass 2: elevation-gated dilation. Fine (1 m-class) DEMs are
  // hydro-flattened: open water sits at one surface elevation. Where the
  // imagery classifier has holes (bridge shadows, sun glint), the uncarved
  // samples poke ~0.5 m above the carved ones and render as stripes across
  // the water. Grow the mask into 4-adjacent cells whose DEM height matches
  // the masked-region's median surface — fills holes without touching bridge
  // decks (metres higher) or rising banks. The gate is deliberately TIGHT
  // (hydro-flat equality, not "roughly low"): flat dry shoreline — mudflats,
  // boat ramps, riverside parks — commonly sits <1 m above pool level and
  // must NOT flood, since the imagery classifier (the module's ground truth)
  // said it was land. Rounds scale inversely with cell size so coarse default
  // grids can't creep ~180 m inland.
  if (surfaceSamples.length > 0) {
    surfaceSamples.sort((a, b) => a - b);
    const waterSurface = surfaceSamples[surfaceSamples.length >> 1];
    const TOL = 0.35;
    const cellNsM = rows > 1 ? groundHm / (rows - 1) : groundHm;
    const DILATE_ROUNDS = Math.min(
      6,
      Math.max(2, Math.round(50 / Math.max(cellNsM, 1)))
    );
    for (let round = 0; round < DILATE_ROUNDS; round++) {
      let grew = false;
      const next = isWater.slice();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          if (next[i]) continue;
          if (Math.abs(heights[i] - waterSurface) > TOL) continue;
          const nbr =
            (c > 0 && isWater[i - 1]) ||
            (c < cols - 1 && isWater[i + 1]) ||
            (r > 0 && isWater[i - cols]) ||
            (r < rows - 1 && isWater[i + cols]);
          if (nbr) {
            next[i] = 1;
            grew = true;
          }
        }
      }
      isWater.set(next);
      if (!grew) break;
    }
  }

  let carved = 0;
  for (let i = 0; i < isWater.length; i++) {
    if (isWater[i] && out[i] !== waterLevel) {
      out[i] = waterLevel;
      carved++;
    }
  }
  return { grid: { cols, rows, heights: out }, carved, waterLevel };
}
