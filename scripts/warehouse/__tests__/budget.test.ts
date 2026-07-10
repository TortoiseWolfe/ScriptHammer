// #259 budget gate — deterministic asset ceilings for the sampled buildings.
//
// FPS is never asserted here (CI renders on CPU; absolute frame rates are
// noise). What IS deterministic: the abstraction pass's output stats. This
// test reads the pipeline's report.json and holds every model to the stated
// budget. When the local-only pipeline outputs are absent (CI — the models
// are gitignored per the 2026-07-10 distribution decision), it skips, exactly
// like the optional runtime layer it guards.

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const REPORT = path.resolve('sites/_warehouse/report.json');
const present = existsSync(REPORT);

// The stated budget (issue #259 asks for explicit numbers, reported honestly).
// Iteration 2 (135-building city): the whole-set triangle proxy is the LOD2
// sum — at miniature distance everything renders LOD2, so that's what a
// full-city frame actually rasterizes. Per-building LOD0 bounds the close-up
// cost (only nearby buildings promote past 150 m).
const CEILINGS = {
  lod0Triangles: 24_000, // per building, post-abstraction
  totalLod2Triangles: 150_000, // whole imported set at miniature distance
  glbBytes: 3_000_000, // per building file (bridges/garages are the big end)
  totalGlbBytes: 15_000_000, // whole set download
  materials: 8, // per building after palette()
  textures: 2, // palette texture (+1 slack)
};

describe.skipIf(!present)('#259 sampled-building budget ceilings', () => {
  const raw = present
    ? (JSON.parse(readFileSync(REPORT, 'utf8')) as {
        models: {
          slug: string;
          after: {
            glbBytes: number;
            materials: number;
            textures: number;
            lodTriangles: Record<string, number>;
            dimensions?: { x: number; y: number; z: number };
          };
          culled?: { aborted?: boolean };
        }[];
      })
    : { models: [] };
  // The gate guards what SHIPS into the twin: models excluded by the
  // committed overrides never emit, so they don't count against the budget.
  const overrides = JSON.parse(
    readFileSync(path.resolve('scripts/warehouse/overrides-chatt.json'), 'utf8')
  ) as Record<string, { exclude?: boolean }>;
  const report = {
    models: raw.models.filter((m) => !overrides[m.slug]?.exclude),
  };

  it('has models to check', () => {
    expect(report.models.length).toBeGreaterThan(0);
  });

  it('every model holds the per-building ceilings', () => {
    const violations: string[] = [];
    for (const m of report.models) {
      const a = m.after;
      if (a.lodTriangles.LOD0 > CEILINGS.lod0Triangles)
        violations.push(`${m.slug}: LOD0 ${a.lodTriangles.LOD0} tris`);
      if (a.glbBytes > CEILINGS.glbBytes)
        violations.push(`${m.slug}: ${a.glbBytes} bytes`);
      if (a.materials > CEILINGS.materials)
        violations.push(`${m.slug}: ${a.materials} materials`);
      if (a.textures > CEILINGS.textures)
        violations.push(`${m.slug}: ${a.textures} textures`);
    }
    expect(violations, 'per-building budget violations').toEqual([]);
  });

  it('the whole set holds the totals', () => {
    const tris = report.models.reduce(
      (s, m) => s + (m.after.lodTriangles.LOD2 ?? 0),
      0
    );
    const bytes = report.models.reduce((s, m) => s + m.after.glbBytes, 0);
    expect(tris).toBeLessThanOrEqual(CEILINGS.totalLod2Triangles);
    expect(bytes).toBeLessThanOrEqual(CEILINGS.totalGlbBytes);
  });

  it('no model failed abstraction', () => {
    const failed = (
      JSON.parse(readFileSync(REPORT, 'utf8')) as {
        failed?: { slug: string }[];
      }
    ).failed;
    expect(failed ?? []).toEqual([]);
  });

  it('every reported model has LOD0/LOD1/LOD2 counts', () => {
    for (const m of report.models) {
      expect(Object.keys(m.after.lodTriangles)).toEqual(
        expect.arrayContaining(['LOD0', 'LOD1', 'LOD2'])
      );
    }
  });

  // #259 iter 5 — the extents gate. The review measured 91/134 shipping
  // models carrying SketchUp site context (>150m XZ; buildings are 20–100m).
  // Post-cull, every SHIPPING model is either building-sized or carries an
  // explicit documented grant in abstract-chatt.json (bridges, districts,
  // block-scale complexes). An ungranted oversize here is context leaking
  // back in — fix the model or grant it deliberately, never silently.
  const abstractCfg = JSON.parse(
    readFileSync(path.resolve('scripts/warehouse/abstract-chatt.json'), 'utf8')
  ) as Record<string, { keepAll?: boolean; maxExtentM?: number }>;
  const MAX_UNGRANTED_EXTENT_M = 150;

  it('every shipping model is building-sized or explicitly granted', () => {
    const violations: string[] = [];
    for (const m of report.models) {
      const d = m.after.dimensions;
      if (!d) continue; // pre-iter-5 report entry — regenerate to cover
      const xz = Math.max(d.x, d.z);
      const grant = abstractCfg[m.slug] ?? {};
      const granted =
        grant.keepAll === true ||
        (typeof grant.maxExtentM === 'number' && xz <= grant.maxExtentM);
      if (xz > MAX_UNGRANTED_EXTENT_M && !granted) {
        violations.push(`${m.slug}: ${Math.round(xz)}m XZ extent, no grant`);
      }
    }
    expect(violations, 'ungranted oversize models (site context?)').toEqual([]);
  });

  it('no shipping model hit the cull abort guard without a grant', () => {
    const aborted = report.models
      .filter((m) => m.culled?.aborted)
      .filter((m) => {
        const g = abstractCfg[m.slug] ?? {};
        return !(g.keepAll || typeof g.maxExtentM === 'number');
      })
      .map((m) => m.slug);
    expect(aborted, 'guard-aborted models needing curation/grant').toEqual([]);
  });
});
