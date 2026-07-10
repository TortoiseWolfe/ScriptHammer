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

// The stated budget (issue #259 asks for explicit numbers, reported honestly):
const CEILINGS = {
  lod0Triangles: 24_000, // per building, post-abstraction
  totalLod0Triangles: 150_000, // whole imported set
  glbBytes: 1_000_000, // per building file
  totalGlbBytes: 15_000_000, // whole set download
  materials: 8, // per building after palette()
  textures: 2, // palette texture (+1 slack)
};

describe.skipIf(!present)('#259 sampled-building budget ceilings', () => {
  const report = present
    ? (JSON.parse(readFileSync(REPORT, 'utf8')) as {
        models: {
          slug: string;
          after: {
            glbBytes: number;
            materials: number;
            textures: number;
            lodTriangles: Record<string, number>;
          };
        }[];
      })
    : { models: [] };

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
      (s, m) => s + (m.after.lodTriangles.LOD0 ?? 0),
      0
    );
    const bytes = report.models.reduce((s, m) => s + m.after.glbBytes, 0);
    expect(tris).toBeLessThanOrEqual(CEILINGS.totalLod0Triangles);
    expect(bytes).toBeLessThanOrEqual(CEILINGS.totalGlbBytes);
  });

  it('every reported model has LOD0/LOD1/LOD2 counts', () => {
    for (const m of report.models) {
      expect(Object.keys(m.after.lodTriangles)).toEqual(
        expect.arrayContaining(['LOD0', 'LOD1', 'LOD2'])
      );
    }
  });
});
