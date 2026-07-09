// Accuracy package v2 (#229): tiled native-res drape, 3DEP raster terrain,
// Microsoft ML heights — pure-function coverage, all offline.

import { describe, it, expect } from 'vitest';
import { writeArrayBuffer } from 'geotiff';
import { createProjection, type GeoBox } from '../enu';
import { sliceDrapeTiles, drapePixelSize, tileUrl } from '../fetch-drape';
import { parseDemTiff } from '../fetch-terrain';
import {
  terrainGridFor3Dep,
  defaultTerrainGridFor,
  provenanceFor,
} from '../site-config';
import {
  tileXYToQuadkey,
  quadkeysForBox,
  pointInRing,
  matchMsHeights,
  type MsBuilding,
} from '../fetch-ms-heights';
import { resolveHeight } from '../height';

const CHATT_BOX: GeoBox = {
  swLat: 35.0078,
  swLon: -85.316,
  neLat: 35.06,
  neLon: -85.3,
};
const proj = createProjection(CHATT_BOX);

describe('sliceDrapeTiles (native-res row x col grid tiling)', () => {
  it('chatt at mpp 0.6: global 2433x7938 sliced into 2 tiles under the 4000 cap', () => {
    const { width, height, tiles } = sliceDrapeTiles(proj, 0.6);
    expect(width).toBe(2433);
    expect(height).toBe(7938);
    expect(tiles).toHaveLength(2);
    expect(tiles.map((t) => t.rows)).toEqual([4000, 3938]);
    // Σ rows === global height; offsets contiguous
    expect(tiles[0].rowOffset).toBe(0);
    expect(tiles[1].rowOffset).toBe(4000);
    // shared edge EXACT (tile 0 bottom lat === tile 1 top lat) — no seams
    expect(tiles[0].bbox[1]).toBe(tiles[1].bbox[3]);
    // outer edges are the box edges exactly
    expect(tiles[0].bbox[3]).toBe(CHATT_BOX.neLat);
    expect(tiles[1].bbox[1]).toBe(CHATT_BOX.swLat);
    // per-tile pixel aspect matches per-tile degree aspect (registration invariant)
    for (const t of tiles) {
      const degAspect = (t.bbox[2] - t.bbox[0]) / (t.bbox[3] - t.bbox[1]);
      expect(t.cols / t.rows).toBeCloseTo(degAspect, 4);
      expect(tileUrl(t)).toContain(`size=${t.cols},${t.rows}`);
    }
  });
  it('chatt at mpp 0.3: 4867x15879 → 2x4 grid, exact shared edges both axes', () => {
    const { width, height, tiles } = sliceDrapeTiles(proj, 0.3);
    expect(width).toBe(4867);
    expect(height).toBe(15879);
    expect(
      tiles.map((t) => [t.cols, t.rows, t.colOffset, t.rowOffset])
    ).toEqual([
      [4000, 4000, 0, 0],
      [867, 4000, 4000, 0],
      [4000, 4000, 0, 4000],
      [867, 4000, 4000, 4000],
      [4000, 4000, 0, 8000],
      [867, 4000, 4000, 8000],
      [4000, 3879, 0, 12000],
      [867, 3879, 4000, 12000],
    ]);
    // E-W shared edge EXACT within each row band; outer lon edges = box edges
    for (let r = 0; r < 4; r++) {
      const west = tiles[r * 2];
      const east = tiles[r * 2 + 1];
      expect(west.bbox[2]).toBe(east.bbox[0]);
      expect(west.bbox[0]).toBe(CHATT_BOX.swLon);
      expect(east.bbox[2]).toBe(CHATT_BOX.neLon);
      // Σ cols across the band === global width
      expect(west.cols + east.cols).toBe(width);
    }
    // N-S shared edges EXACT between bands
    expect(tiles[0].bbox[1]).toBe(tiles[2].bbox[3]);
    expect(tiles[4].bbox[1]).toBe(tiles[6].bbox[3]);
    // Σ rows down a column === global height
    expect(tiles[0].rows + tiles[2].rows + tiles[4].rows + tiles[6].rows).toBe(
      height
    );
  });
  it('exact-cap and cap+1 edges', () => {
    // synthesize boxes whose global height is exactly 4000 / 4001
    const mk = (h: number) => {
      const degLon = 0.016;
      const width = drapePixelSize(proj, 2).width; // 730
      // height = round(width * degLat/degLon) → degLat = h*degLon/width
      const degLat = (h * degLon) / width;
      return createProjection({
        swLat: 35,
        swLon: -85.316,
        neLat: 35 + degLat,
        neLon: -85.3,
      });
    };
    expect(sliceDrapeTiles(mk(4000), 2).tiles).toHaveLength(1);
    expect(sliceDrapeTiles(mk(4001), 2).tiles).toHaveLength(2);
  });
  it('mini-twin-sized box (1600 m) at 0.6 is a single tile', () => {
    const mini = createProjection({
      swLat: 35.0140213,
      swLon: -85.2761,
      neLat: 35.0284,
      neLon: -85.2586,
    });
    const { tiles, width, height } = sliceDrapeTiles(mini, 0.6);
    expect(tiles).toHaveLength(1);
    expect(width).toBeLessThanOrEqual(4000);
    expect(height).toBeLessThanOrEqual(4000);
  });
  it('mini-twin at TDOT-native mpp 0.25: 6389x5249 → 2x2 grid', () => {
    const mini = createProjection({
      swLat: 35.0140213,
      swLon: -85.2761,
      neLat: 35.0284,
      neLon: -85.2586,
    });
    const { width, height, tiles } = sliceDrapeTiles(mini, 0.25);
    expect(width).toBe(6389);
    expect(height).toBe(5249);
    expect(
      tiles.map((t) => [t.cols, t.rows, t.colOffset, t.rowOffset])
    ).toEqual([
      [4000, 4000, 0, 0],
      [2389, 4000, 4000, 0],
      [4000, 1249, 0, 4000],
      [2389, 1249, 4000, 4000],
    ]);
  });
});

describe('terrainGridFor3Dep (degree-square raster grids)', () => {
  it('chatt at 9 m N-S target: 198x644, degree-square', () => {
    const { cols, rows } = terrainGridFor3Dep(CHATT_BOX);
    expect(cols).toBe(198);
    expect(rows).toBe(644);
    const degAspect =
      (CHATT_BOX.neLon - CHATT_BOX.swLon) / (CHATT_BOX.neLat - CHATT_BOX.swLat);
    expect((cols - 1) / (rows - 1)).toBeCloseTo(degAspect, 2);
    expect(cols * rows).toBeLessThanOrEqual(180_000);
  });
  it('dispatches by dataset', () => {
    expect(defaultTerrainGridFor('3dep1m', CHATT_BOX)).toEqual({
      cols: 198,
      rows: 644,
    });
    // point-query datasets keep the ~10k budget
    const pt = defaultTerrainGridFor('ned10m', CHATT_BOX);
    expect(pt.cols * pt.rows).toBeLessThanOrEqual(10_000);
  });
});

describe('parseDemTiff (float32 DEM → terrain.json layout)', () => {
  const COLS = 4;
  const ROWS = 6;
  const S_LON = 0.005;
  const S_LAT = 0.01 / 6;
  // geotiff's writeArrayBuffer anchors at (-180, 90) with the given pixel
  // scale — derive the bbox it actually encodes rather than fighting the
  // writer API (parseDemTiff only cares that request == returned extent).
  const TIFF_BBOX = [-180, 90 - ROWS * S_LAT, -180 + COLS * S_LON, 90];
  const cell = { sLon: S_LON, sLat: S_LAT };

  async function synth(withGlitch = false) {
    // north-first raster: value = tiffRow + col*100
    const data = new Float32Array(COLS * ROWS);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) data[r * COLS + c] = r + c * 100;
    if (withGlitch) data[0] = Number.NaN;
    return (await writeArrayBuffer(data as unknown as number[], {
      width: COLS,
      height: ROWS,
      ModelPixelScale: [S_LON, S_LAT, 0],
      SampleFormat: [3],
      BitsPerSample: [32],
    })) as ArrayBuffer;
  }

  it('flips rows north-first → south-first and quantizes 0.1 m', async () => {
    const buf = await synth();
    const { heights, nulls } = await parseDemTiff(
      buf,
      COLS,
      ROWS,
      TIFF_BBOX,
      cell
    );
    expect(nulls).toBe(0);
    // terrain.json row 0 = SOUTH = tiff row 5 → value 5 at col 0
    expect(heights[0]).toBe(5);
    // last row = NORTH = tiff row 0
    expect(heights[(ROWS - 1) * COLS]).toBe(0);
    expect(heights[1]).toBe(105); // col 1 → +100
  });
  it('coerces NoData/NaN samples and counts them', async () => {
    const buf = await synth(true);
    const { heights, nulls } = await parseDemTiff(
      buf,
      COLS,
      ROWS,
      TIFF_BBOX,
      cell
    );
    expect(nulls).toBe(1);
    // NaN was at tiff row 0 col 0 → terrain row ROWS-1 col 0
    expect(heights[(ROWS - 1) * COLS]).toBe(0);
  });
  it('guards dimension mismatch', async () => {
    const buf = await synth();
    await expect(
      parseDemTiff(buf, COLS + 1, ROWS, TIFF_BBOX, cell)
    ).rejects.toThrow(/clamped/);
  });
  it('guards extent adjustment', async () => {
    const buf = await synth();
    const shifted = [
      TIFF_BBOX[0] + 0.01,
      TIFF_BBOX[1],
      TIFF_BBOX[2] + 0.01,
      TIFF_BBOX[3],
    ];
    await expect(parseDemTiff(buf, COLS, ROWS, shifted, cell)).rejects.toThrow(
      /extent/
    );
  });
});

describe('quadkeys (Microsoft Buildings tiling)', () => {
  it('matches Bing documentation vectors', () => {
    expect(tileXYToQuadkey(3, 5, 3)).toBe('213');
    expect(tileXYToQuadkey(0, 0, 1)).toBe('0');
    expect(tileXYToQuadkey(1, 1, 1)).toBe('3');
  });
  it('chatt (and the mini-twin inside it) resolve to tile 032002130', () => {
    expect(quadkeysForBox(CHATT_BOX)).toEqual(['032002130']);
  });
  it('a box straddling tile edges returns the full span', () => {
    // 4 z9 tiles around lon/lat tile boundaries near Chattanooga
    const keys = quadkeysForBox({
      swLat: 35.4,
      swLon: -85.9,
      neLat: 36.7,
      neLon: -84.2,
    });
    expect(keys.length).toBeGreaterThanOrEqual(4);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('pointInRing / matchMsHeights', () => {
  const square: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ];
  it('ray-cast basics', () => {
    expect(pointInRing(5, 5, square)).toBe(true);
    expect(pointInRing(15, 5, square)).toBe(false);
    const concave: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [5, 5],
      [0, 10],
      [0, 0],
    ];
    expect(pointInRing(5, 8, concave)).toBe(false); // in the notch
    expect(pointInRing(2, 2, concave)).toBe(true);
  });
  it('containment matches; smallest containing polygon wins; glitch heights skipped', () => {
    const ms: MsBuilding[] = [
      { ring: square, height: 12 },
      {
        // small inner polygon around (5,5)
        ring: [
          [4, 4],
          [6, 4],
          [6, 6],
          [4, 6],
          [4, 4],
        ],
        height: 30,
      },
      {
        // glitch-height detection covering (1,1)
        ring: [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0],
        ],
        height: 999,
      },
    ];
    const out = matchMsHeights(
      [
        { id: 1, lon: 5, lat: 5 }, // inside both → smallest (30) wins
        { id: 2, lon: 8, lat: 8 }, // only the big square → 12
        { id: 3, lon: 1, lat: 1 }, // glitch skipped → falls to square → 12
        { id: 4, lon: 50, lat: 50 }, // outside everything → unmatched
      ],
      ms
    );
    expect(out.get(1)).toBe(30);
    expect(out.get(2)).toBe(12);
    expect(out.get(3)).toBe(12);
    expect(out.has(4)).toBe(false);
  });
});

describe('carveToMask elevation-gated dilation', () => {
  it('fills classifier holes at the water surface but spares bridges and banks', async () => {
    const { carveToMask } = await import('../carve-water');
    // 2 identical rows (the mask row-mapping needs rows >= 2), 7 cells each:
    // [bank 5m, water 1m(masked), HOLE 1.2m, water 1m(masked), bridge 8m, water 1.1m(masked), bank 4m]
    const rowH = [5, 1, 1.2, 1, 8, 1.1, 4];
    const grid = { cols: 7, rows: 2, heights: [...rowH, ...rowH] };
    const maskRow = [0, 1, 0, 1, 0, 1, 0];
    const mask = {
      mask: new Uint8Array([...maskRow, ...maskRow]),
      width: 7,
      height: 2,
    };
    const res = carveToMask(grid, mask, 7, 2);
    const w = res.waterLevel; // global min = 1
    for (const r of [0, 1]) {
      const o = r * 7;
      expect(res.grid.heights[o + 1]).toBe(w);
      expect(res.grid.heights[o + 3]).toBe(w);
      expect(res.grid.heights[o + 5]).toBe(w);
      // the HOLE (1.2m ≈ surface) gets dilated into water
      expect(res.grid.heights[o + 2]).toBe(w);
      // the bridge deck (8m) and banks (4-5m) are untouched
      expect(res.grid.heights[o + 4]).toBe(8);
      expect(res.grid.heights[o + 0]).toBe(5);
      expect(res.grid.heights[o + 6]).toBe(4);
    }
  });
});

describe('resolveHeight ms rule', () => {
  const cfg = { overrides: { Named: 50 }, fallbackClampM: 91.44 };
  it('ms displaces only the fallback', () => {
    expect(resolveHeight({ building: 'yes' }, 100, cfg, 17.3)).toEqual({
      meters: 17.3,
      rule: 'ms',
    });
    expect(resolveHeight({ height: '40' }, 100, cfg, 17.3).rule).toBe('height');
    expect(resolveHeight({ 'building:levels': '3' }, 100, cfg, 17.3).rule).toBe(
      'levels'
    );
    expect(resolveHeight({ name: 'Named' }, 100, cfg, 17.3).rule).toBe(
      'override'
    );
    expect(resolveHeight({ building: 'yes' }, 100, cfg).rule).toBe('fallback');
  });
});

describe('provenance', () => {
  it('carries the 1m dataset + Microsoft credit', () => {
    expect(provenanceFor('3dep1m', 'naip', true)).toBe(
      '© OpenStreetMap · USGS 3DEP 1m · USGS NAIP · Microsoft Buildings'
    );
  });
});
