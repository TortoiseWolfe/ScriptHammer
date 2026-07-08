import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { GeoBox } from './enu';

const MAX_PER_REQ = 100;
const THROTTLE_MS = 1100; // OpenTopoData: 1 req/s public cap

export function buildGrid(
  box: GeoBox,
  cols: number,
  rows: number
): { lat: number; lon: number }[] {
  const pts: { lat: number; lon: number }[] = [];
  for (let j = 0; j < rows; j++) {
    const lat = box.swLat + (box.neLat - box.swLat) * (j / (rows - 1));
    for (let i = 0; i < cols; i++) {
      const lon = box.swLon + (box.neLon - box.swLon) * (i / (cols - 1));
      pts.push({ lat, lon });
    }
  }
  return pts;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchBatch(
  dataset: string,
  batch: { lat: number; lon: number }[]
): Promise<{ heights: number[]; nulls: number }> {
  const locs = batch
    .map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`)
    .join('|');
  const url = `https://api.opentopodata.org/v1/${dataset}?locations=${locs}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      const j = (await res.json()) as {
        results?: { elevation: number | null }[];
      };
      if (!j.results) throw new Error('elevation service unavailable');
      let nulls = 0;
      const heights = j.results.map((r) => {
        if (r.elevation == null) {
          nulls++;
          return 0;
        }
        return r.elevation;
      });
      return { heights, nulls };
    }
    if (res.status === 429)
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    else throw new Error(`OpenTopoData HTTP ${res.status}`);
  }
  throw new Error('OpenTopoData 429 backoff exhausted');
}

// ~30 m isotropic grids resolve riverbanks; coarser grids smear the bank across
// a cell and misplace the 3D water edge ~100 m from where buildings stop, so
// riverfront buildings render sitting in the water (#225). Grid dims come from
// the site config (or defaultTerrainGrid), pinned per site for reproducibility.
export async function fetchTerrain(
  outDir: string,
  box: GeoBox,
  opts: { cols: number; rows: number; dataset?: string }
) {
  const { cols, rows } = opts;
  const dataset = opts.dataset ?? 'ned10m';
  mkdirSync(outDir, { recursive: true });
  const grid = buildGrid(box, cols, rows);
  const heights: number[] = [];
  let nulls = 0;
  const batches = chunk(grid, MAX_PER_REQ);
  for (let b = 0; b < batches.length; b++) {
    const batch = await fetchBatch(dataset, batches[b]);
    heights.push(...batch.heights);
    nulls += batch.nulls;
    if (b < batches.length - 1)
      await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }
  // Out-of-coverage points come back null (e.g. the US-only ned10m outside the
  // US) and would otherwise silently bake flat 0 m terrain. Warn on any, fail
  // when the grid is meaningfully affected.
  if (nulls > 0) {
    const pct = (100 * nulls) / heights.length;
    const msg = `[fetch-terrain] ${nulls}/${heights.length} samples (${pct.toFixed(1)}%) have no "${dataset}" coverage`;
    if (pct > 1) {
      throw new Error(
        `${msg} — pick a dataset that covers this site in the config (e.g. "srtm30m" or "mapzen")`
      );
    }
    console.warn(`${msg}; coerced to 0 m`);
  }
  const out = { cols, rows, heights };
  writeFileSync(join(outDir, 'terrain.json'), JSON.stringify(out));
  return out;
}
