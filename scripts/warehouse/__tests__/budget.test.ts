// #259 budget gate — deterministic asset ceilings for the sampled buildings.
//
// FPS is never asserted here (CI renders on CPU; absolute frame rates are
// noise). What IS deterministic: the shipped GLBs themselves. This test
// measures the COMMITTED models in public/twins/chatt/models directly (it used
// to read the gitignored pipeline report.json, so on CI the whole file skipped
// and the budget guarded nothing) and holds every model to the stated budget.

import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
// @ts-expect-error — untyped .mjs shared with the abstraction pass
import { trianglesUnder } from '../cull.mjs';

const MODELS_DIR = path.resolve('public/twins/chatt/models');

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

interface Measured {
  slug: string;
  glbBytes: number;
  materials: number;
  textures: number;
  lodTriangles: Record<string, number>;
  dimensions: { x: number; y: number; z: number };
}

type Node = {
  getName(): string;
  listChildren(): Node[];
};

describe('#259 sampled-building budget ceilings', () => {
  // The gate guards what SHIPS into the twin: models excluded by the
  // committed overrides never emit, so they don't count against the budget.
  const overrides = JSON.parse(
    readFileSync(path.resolve('scripts/warehouse/overrides-chatt.json'), 'utf8')
  ) as Record<string, { exclude?: boolean }>;

  const report: { models: Measured[] } = { models: [] };

  beforeAll(async () => {
    await MeshoptDecoder.ready;
    const io = new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    const slugs = readdirSync(MODELS_DIR)
      .filter((f) => f.endsWith('.glb'))
      .map((f) => f.slice(0, -4))
      .filter((slug) => !overrides[slug]?.exclude)
      .sort();
    for (const slug of slugs) {
      const file = path.join(MODELS_DIR, `${slug}.glb`);
      const doc = await io.read(file);
      const root = doc.getRoot();
      const scene = root.getDefaultScene() ?? root.listScenes()[0];
      const top = scene.listChildren() as unknown as Node[];
      const lod = (name: string) =>
        top.find((n) => n.getName() === name) as unknown;
      const lodTriangles: Record<string, number> = {};
      for (const name of ['LOD0', 'LOD1', 'LOD2']) {
        const n = lod(name);
        if (n) lodTriangles[name] = trianglesUnder(n);
      }
      // Extents of the geometry that ships (LOD0 — all levels share the footprint).
      const bbox = getBounds((lod('LOD0') ?? scene) as typeof scene);
      report.models.push({
        slug,
        glbBytes: statSync(file).size,
        materials: root.listMaterials().length,
        textures: root.listTextures().length,
        lodTriangles,
        dimensions: {
          x: bbox.max[0] - bbox.min[0],
          y: bbox.max[1] - bbox.min[1],
          z: bbox.max[2] - bbox.min[2],
        },
      });
    }
  }, 120_000);

  it('has models to check', () => {
    expect(existsSync(MODELS_DIR)).toBe(true);
    expect(report.models.length).toBeGreaterThan(0);
  });

  it('every model holds the per-building ceilings', () => {
    const violations: string[] = [];
    for (const m of report.models) {
      if (m.lodTriangles.LOD0 > CEILINGS.lod0Triangles)
        violations.push(`${m.slug}: LOD0 ${m.lodTriangles.LOD0} tris`);
      if (m.glbBytes > CEILINGS.glbBytes)
        violations.push(`${m.slug}: ${m.glbBytes} bytes`);
      if (m.materials > CEILINGS.materials)
        violations.push(`${m.slug}: ${m.materials} materials`);
      if (m.textures > CEILINGS.textures)
        violations.push(`${m.slug}: ${m.textures} textures`);
    }
    expect(violations, 'per-building budget violations').toEqual([]);
  });

  it('the whole set holds the totals', () => {
    const tris = report.models.reduce(
      (s, m) => s + (m.lodTriangles.LOD2 ?? 0),
      0
    );
    const bytes = report.models.reduce((s, m) => s + m.glbBytes, 0);
    expect(tris).toBeLessThanOrEqual(CEILINGS.totalLod2Triangles);
    expect(bytes).toBeLessThanOrEqual(CEILINGS.totalGlbBytes);
  });

  it('every shipped model in models.json has a committed GLB, and vice versa', () => {
    const published = (
      JSON.parse(
        readFileSync(path.join(MODELS_DIR, 'models.json'), 'utf8')
      ) as { models: { slug: string; file: string }[] }
    ).models;
    for (const p of published) {
      expect(existsSync(path.join(MODELS_DIR, p.file)), p.file).toBe(true);
    }
    const publishedSlugs = new Set(published.map((p) => p.slug));
    const orphans = report.models
      .map((m) => m.slug)
      .filter((slug) => !publishedSlugs.has(slug));
    expect(orphans, 'GLBs on disk that models.json does not publish').toEqual(
      []
    );
  });

  it('every model has LOD0/LOD1/LOD2 counts', () => {
    for (const m of report.models) {
      expect(Object.keys(m.lodTriangles), m.slug).toEqual(
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
      const d = m.dimensions;
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
});
