import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { BOX } from './box';

const DATASET = 'ned10m';
const MAX_PER_REQ = 100;
const THROTTLE_MS = 1100; // OpenTopoData: 1 req/s public cap

export function buildGrid(
  cols: number,
  rows: number
): { lat: number; lon: number }[] {
  const pts: { lat: number; lon: number }[] = [];
  for (let j = 0; j < rows; j++) {
    const lat = BOX.swLat + (BOX.neLat - BOX.swLat) * (j / (rows - 1));
    for (let i = 0; i < cols; i++) {
      const lon = BOX.swLon + (BOX.neLon - BOX.swLon) * (i / (cols - 1));
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
  batch: { lat: number; lon: number }[]
): Promise<number[]> {
  const locs = batch
    .map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`)
    .join('|');
  const url = `https://api.opentopodata.org/v1/${DATASET}?locations=${locs}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      const j = (await res.json()) as {
        results?: { elevation: number | null }[];
      };
      if (!j.results) throw new Error('elevation service unavailable');
      return j.results.map((r) => (r.elevation == null ? 0 : r.elevation));
    }
    if (res.status === 429)
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    else throw new Error(`OpenTopoData HTTP ${res.status}`);
  }
  throw new Error('OpenTopoData 429 backoff exhausted');
}

export async function fetchTerrain(outDir: string, cols = 40, rows = 40) {
  mkdirSync(outDir, { recursive: true });
  const grid = buildGrid(cols, rows);
  const heights: number[] = [];
  const batches = chunk(grid, MAX_PER_REQ);
  for (let b = 0; b < batches.length; b++) {
    heights.push(...(await fetchBatch(batches[b])));
    if (b < batches.length - 1)
      await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }
  const out = { cols, rows, heights };
  writeFileSync(join(outDir, 'terrain.json'), JSON.stringify(out));
  return out;
}
