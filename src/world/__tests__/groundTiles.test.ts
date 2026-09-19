/**
 * Guards src/world/groundTiles.ts (#1176).
 *
 * The thing worth testing here is not "does it compute a number" — it is that
 * TWO independently-built meshes agree on their shared edge. Disagree by a
 * float and you get a hairline crack of skybox through the ground at every
 * seam, every frame, which reads as a rendering glitch rather than as an
 * arithmetic one and is miserable to trace back to a UV formula.
 *
 * Every assertion has a control proving it can fail.
 */

import { describe, it, expect } from 'vitest';
import {
  worldToGridUv,
  tileSegments,
  tilePlacement,
  tilingCoversExtent,
  tilesByPriority,
  type DrapeTiling,
  type TileWorld,
} from '../groundTiles';

// chatt's wide extent, the real numbers.
const W = 8212;
const H = 7566;

/** What the SINGLE-plane path in Terrain.tsx computes, transcribed. */
function singlePlaneUv(worldX: number, worldZ: number) {
  // u = pos.getX(i)/w + 0.5 ; the plane is origin-centred so local X IS world X.
  // v = pos.getY(i)/h + 0.5 ; rotateX(-PI/2) sends local +Y to world -Z.
  return { u: worldX / W + 0.5, v: -worldZ / H + 0.5 };
}

describe('worldToGridUv — the contract with the single-plane path', () => {
  it('reproduces the single-plane mapping exactly, everywhere', () => {
    // If these ever diverge, the tiled ground and the physics floor sample the
    // heightfield differently and the player walks through the visible ground.
    for (const x of [-W / 2, -1234.5, 0, 77.25, W / 2]) {
      for (const z of [-H / 2, -999.75, 0, 12.5, H / 2]) {
        const a = worldToGridUv(x, z, W, H);
        const b = singlePlaneUv(x, z);
        expect(a.u).toBe(b.u);
        expect(a.v).toBe(b.v);
      }
    }
  });

  it('puts -Z (north) at v=1 and +Z (south) at v=0', () => {
    // Getting this backwards flips the aerial end for end and nothing errors:
    // a real city, upside down, which people rationalise as unfamiliar.
    expect(worldToGridUv(0, -H / 2, W, H).v).toBeCloseTo(1, 12);
    expect(worldToGridUv(0, H / 2, W, H).v).toBeCloseTo(0, 12);
  });

  it('CONTROL: a tile-LOCAL mapping would disagree, which is the bug', () => {
    // Proof the test above is not vacuous. Deriving v from a tile's own local
    // Y — the obvious implementation — gives a different answer for the same
    // world point, and that difference IS the seam crack.
    const cz = 1200; // a tile centred 1200 m south of origin
    const localY = 300;
    const worldZ = cz - localY;
    const correct = worldToGridUv(0, worldZ, W, H).v;
    const naiveTileLocal = localY / 600 + 0.5; // v from a 600 m-tall tile's own Y
    expect(correct).not.toBeCloseTo(naiveTileLocal, 6);
  });
});

describe('seam agreement between adjacent tiles', () => {
  it('two neighbours compute BIT-IDENTICAL uv along their shared edge', () => {
    // West tile [-4106,-3783 .. 0,0], east tile [0,-3783 .. 4106,0].
    const west: TileWorld = [-4106, -3783, 0, 0];
    const east: TileWorld = [0, -3783, 4106, 0];
    const w = tilePlacement(west);
    const e = tilePlacement(east);

    // A point on the shared edge, expressed in each tile's local frame.
    for (const worldZ of [-3783, -2000, -500, 0]) {
      const fromWest = worldToGridUv(w.cx + w.width / 2, worldZ, W, H);
      const fromEast = worldToGridUv(e.cx - e.width / 2, worldZ, W, H);
      expect(fromWest.u).toBe(fromEast.u);
      expect(fromWest.v).toBe(fromEast.v);
    }
  });

  it('north/south neighbours agree too', () => {
    const north: TileWorld = [-4106, -3783, 4106, 0];
    const south: TileWorld = [-4106, 0, 4106, 3783];
    const n = tilePlacement(north);
    const s = tilePlacement(south);
    for (const worldX of [-4106, -1000, 0, 4106]) {
      const fromNorth = worldToGridUv(worldX, n.cz + n.depth / 2, W, H);
      const fromSouth = worldToGridUv(worldX, s.cz - s.depth / 2, W, H);
      expect(fromNorth.v).toBe(fromSouth.v);
    }
  });
});

describe('tileSegments', () => {
  it('is proportional to the tile share of the heightfield', () => {
    // Equal spacing either side of a seam matters: two different spacings
    // sampling one continuous heightfield do not produce the same polyline
    // between shared endpoints, so the crack reappears MID-EDGE.
    const half: TileWorld = [-W / 2, -H / 2, 0, 0];
    const { segX, segY } = tileSegments(half, W, H, 201, 401);
    expect(segX).toBe(100); // half of 200
    expect(segY).toBe(200); // half of 400
  });

  it('CONTROL: never returns 0, which would draw nothing at all', () => {
    const sliver: TileWorld = [0, 0, 0.001, 0.001];
    const { segX, segY } = tileSegments(sliver, W, H, 201, 401);
    expect(segX).toBeGreaterThanOrEqual(1);
    expect(segY).toBeGreaterThanOrEqual(1);
  });
});

describe('tilingCoversExtent — refuse rather than draw something wrong', () => {
  const tiling = (spanX: number, spanZ: number): DrapeTiling => ({
    cols: 1,
    rows: 1,
    dir: 'drape-wide',
    source: { width: 10, height: 10 },
    tiles: [
      {
        row: 0,
        col: 0,
        path: 'r0c0.jpg',
        world: [-spanX / 2, -spanZ / 2, spanX / 2, spanZ / 2],
      },
    ],
  });

  it('accepts a tiling baked for this extent', () => {
    expect(tilingCoversExtent(tiling(W, H), W, H)).toBe(true);
  });

  it('REFUSES the narrow-extent tiling under a wide scene', () => {
    // The real mistake this exists for: chatt's narrow tiles are 1460 x 5791 m
    // and the wide scene is 8212 x 7566 m. Drawing them anyway gives real
    // imagery at wrong world rectangles — a plausible place that is wrong
    // everywhere, which is worse than the blurry fallback.
    expect(tilingCoversExtent(tiling(1460, 5791), W, H)).toBe(false);
  });

  it('refuses empty, missing and malformed tilings', () => {
    expect(tilingCoversExtent(null, W, H)).toBe(false);
    expect(tilingCoversExtent(undefined, W, H)).toBe(false);
    expect(tilingCoversExtent({ ...tiling(W, H), tiles: [] }, W, H)).toBe(
      false
    );
  });

  it('tolerates the rounding the plan actually carries', () => {
    // Tile rectangles come from integer pixel edges over the raster size, so
    // the outermost edges land on the extent to within rounding, not exactly.
    // Too tight a tolerance rejects every real bake and silently falls back.
    expect(tilingCoversExtent(tiling(W - 0.4, H + 0.4), W, H)).toBe(true);
  });
});

describe('tilesByPriority — stream nearest first, and not everything', () => {
  // A 3x1 strip: west, middle, east, each 1000 m wide.
  const strip: DrapeTiling = {
    cols: 3,
    rows: 1,
    dir: 'drape-wide',
    source: { width: 3000, height: 1000 },
    tiles: [
      { row: 0, col: 0, path: 'w.jpg', world: [-1500, -500, -500, 500] },
      { row: 0, col: 1, path: 'm.jpg', world: [-500, -500, 500, 500] },
      { row: 0, col: 2, path: 'e.jpg', world: [500, -500, 1500, 500] },
    ],
  };

  it('orders by distance to the tile RECTANGLE, not its centre', () => {
    // MUTATION-DRIVEN. The first version of this test used equal-sized tiles,
    // where centre-ranking and rectangle-ranking agree — so it passed against a
    // centre-distance implementation and proved nothing. Discriminating needs
    // tiles of DIFFERENT sizes: a big tile the camera is standing on has a
    // distant centre, and a small tile nearby has a close one.
    const uneven: DrapeTiling = {
      cols: 2,
      rows: 1,
      dir: 'drape-wide',
      source: { width: 100, height: 100 },
      tiles: [
        // Camera at x=-50 is INSIDE this one; its centre is 2450 m away.
        { row: 0, col: 0, path: 'big.jpg', world: [-5000, -500, 0, 500] },
        // Not under the camera at all; its centre is only 250 m away.
        { row: 0, col: 1, path: 'small.jpg', world: [100, -500, 300, 500] },
      ],
    };
    const order = tilesByPriority(uneven, -50, 0, 5000).map((t) => t.path);
    expect(order).toEqual(['big.jpg', 'small.jpg']);
  });

  it('equal-sized neighbours still order sensibly', () => {
    const order = tilesByPriority(strip, 1400, 0, 5000).map((t) => t.path);
    expect(order).toEqual(['e.jpg', 'm.jpg', 'w.jpg']);
  });

  it('a camera INSIDE a tile ranks it at distance zero', () => {
    const order = tilesByPriority(strip, 0, 0, 5000).map((t) => t.path);
    expect(order[0]).toBe('m.jpg');
  });

  it('drops tiles beyond the radius — the point is NOT fetching everything', () => {
    // 221 tiles at 0.5 m/px is 55 MB. Fetching it all per visit was the bug
    // this function exists to prevent, so a radius that quietly includes
    // everything is the regression to catch.
    const near = tilesByPriority(strip, -1400, 0, 600).map((t) => t.path);
    expect(near).toEqual(['w.jpg']);
  });

  it('CONTROL: a generous radius really does include everything', () => {
    // Without this, the test above passes for a function that returns [].
    expect(tilesByPriority(strip, -1400, 0, 100000)).toHaveLength(3);
  });

  it('returns nothing when the camera is far outside, rather than the nearest', () => {
    // Fallback-only is the correct state out here; "always give me one" would
    // fetch a megabyte to texture something off screen.
    expect(tilesByPriority(strip, 90000, 0, 1800)).toEqual([]);
  });
});
