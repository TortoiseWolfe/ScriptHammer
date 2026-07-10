#!/usr/bin/env node
/**
 * The "sampling" pass (issue #259): Warehouse GLB → abstracted twin building.
 *
 * Creative direction (2026-07-10): the Warehouse models are source material,
 * not artifacts to preserve — like a rapper sampling, the output is MORE
 * ABSTRACT than the original. Massing and roof silhouettes survive; the
 * desktop-grade textures do not: every textured material collapses to its
 * dominant color (flat, matte), materials merge via palette(), geometry is
 * aggressively simplified, and three LOD levels land in one meshopt-compressed
 * GLB whose named nodes (LOD0/LOD1/LOD2) the runtime <Detailed> switches.
 *
 * Chain per model (order matters):
 *   sampleMaterials (textures → dominant baseColorFactor, matte)
 *   → dedup → palette → flatten → join → weld → simplify(LOD0 base)
 *   → prune → buildLodNodes(LOD1/LOD2 clones) → meshopt compression.
 *
 * Stage 2 of the crank (see docs/twins/warehouse-flow.md):
 * In:  sites/_warehouse/raw/<slug>.glb               (fetch-glbs.ts output)
 * Out: public/twins/<site>/models/<slug>.glb         (SERVED directly — no
 *      intermediate copy; the dir is gitignored/local-only)
 *      sites/_warehouse/report.json                  (before/after stats)
 *
 * Run:  docker compose exec scripthammer node scripts/warehouse/abstract-glb.mjs [--site chatt] [--only <slug>] [--force]
 */

import { readdir, readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup,
  palette,
  flatten,
  join,
  weld,
  simplify,
  simplifyPrimitive,
  prune,
  meshopt,
  inspect,
} from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const { values: args } = parseArgs({
  options: {
    only: { type: 'string' },
    site: { type: 'string', default: 'chatt' }, // served GLBs land in this twin
    force: { type: 'boolean', default: false }, // bypass the freshness skip
    ratio: { type: 'string', default: '0.4' }, // LOD0 keep-ratio of welded base
  },
});

const ROOT = path.resolve('sites/_warehouse');
// Iteration-3 flow collapse: read the raw cache, write the SERVED GLB
// directly (no intermediate abstract.glb copy) — one model = raw → served.
const RAW = path.join(ROOT, 'raw');
const OUT = path.resolve(`public/twins/${args.site}/models`);
const LOD0 = { ratio: Number(args.ratio), error: 0.005 };
const LODS = [
  { name: 'LOD1', ratio: 0.15, error: 0.02 },
  { name: 'LOD2', ratio: 0.04, error: 0.08 },
];

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });

/** sRGB byte → linear float (baseColorFactor is linear). */
const srgbToLinear = (b) => {
  const c = b / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/**
 * The abstraction: every material loses its textures and takes the dominant
 * (average) color of its base texture as a flat, matte baseColorFactor.
 */
async function sampleMaterials(doc) {
  for (const mat of doc.getRoot().listMaterials()) {
    // 2011-era SketchUp exports often use KHR_materials_pbrSpecularGlossiness,
    // whose diffuse texture the core getters never see — it would survive
    // prune() and bloat a 400-triangle building to multi-MB. Sample its
    // diffuse as the dominant color, then drop the extension entirely.
    const sg = mat.getExtension('KHR_materials_pbrSpecularGlossiness');
    const tex = mat.getBaseColorTexture() ?? sg?.getDiffuseTexture?.() ?? null;
    if (sg) {
      const df = sg.getDiffuseFactor?.();
      if (df) mat.setBaseColorFactor(df);
      mat.setExtension('KHR_materials_pbrSpecularGlossiness', null);
      // Detaching only unlinks the extension from the material — the SG
      // property OBJECT survives, still holding its diffuse/specular textures
      // (parents "PBRSpecularGlossiness+Root"), invisible to prune() and the
      // Root-only orphan sweep. Dispose it so its textures actually orphan.
      sg.dispose();
    }
    if (tex) {
      try {
        const raw = await sharp(Buffer.from(tex.getImage())).resize(1, 1).raw().toBuffer();
        const [r, g, b] = raw;
        const factor = mat.getBaseColorFactor();
        mat.setBaseColorFactor([
          srgbToLinear(r) * factor[0],
          srgbToLinear(g) * factor[1],
          srgbToLinear(b) * factor[2],
          factor[3],
        ]);
      } catch {
        // unreadable image — keep the existing factor
      }
    }
    mat.setBaseColorTexture(null);
    mat.setEmissiveTexture(null);
    mat.setNormalTexture(null);
    mat.setOcclusionTexture(null);
    mat.setMetallicRoughnessTexture(null);
    mat.setMetallicFactor(0);
    mat.setRoughnessFactor(1); // diorama matte
  }
}

/** SketchUp exports carry edge-LINES primitives; drop everything non-TRIANGLES. */
function dropNonTriangles(doc) {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4 /* TRIANGLES */) {
        mesh.removePrimitive(prim);
        prim.dispose();
      }
    }
  }
}

/** prune() leaves textures whose only parent is the Root — sweep them
 *  explicitly (2011-era GLBs carry dozens of orphaned facade photos). */
function dropOrphanTextures(doc) {
  for (const tex of doc.getRoot().listTextures()) {
    if (tex.listParents().every((p) => p.propertyType === 'Root')) {
      tex.dispose();
    }
  }
}

function stats(doc, glbBytes) {
  const rep = inspect(doc);
  const tris = rep.meshes.properties.reduce((s, m) => s + (m.glPrimitives ?? 0), 0);
  const verts = rep.meshes.properties.reduce((s, m) => s + (m.vertices ?? 0), 0);
  return {
    triangles: tris,
    vertices: verts,
    meshes: rep.meshes.properties.length,
    materials: rep.materials.properties.length,
    textures: rep.textures.properties.length,
    textureBytes: rep.textures.properties.reduce((s, t) => s + (t.size ?? 0), 0),
    glbBytes,
  };
}

function trianglesUnder(node) {
  let tris = 0;
  node.traverse((n) => {
    const mesh = n.getMesh?.();
    if (!mesh) return;
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute('POSITION');
      tris += Math.floor((idx ? idx.getCount() : (pos?.getCount() ?? 0)) / 3);
    }
  });
  return tris;
}

/** Wrap the scene under LOD0 and add simplified LOD1/LOD2 clones (shared materials). */
function buildLodNodes(doc) {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const lod0 = doc.createNode('LOD0');
  for (const child of [...scene.listChildren()]) {
    scene.removeChild(child);
    lod0.addChild(child);
  }
  scene.addChild(lod0);

  const lodTris = { LOD0: trianglesUnder(lod0) };
  for (const { name, ratio, error } of LODS) {
    const lodN = doc.createNode(name);
    lod0.traverse((node) => {
      const mesh = node.getMesh?.();
      if (!mesh) return;
      const clone = mesh.clone();
      for (const prim of clone.listPrimitives()) {
        simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio, error });
      }
      const holder = doc.createNode(`${name}-${node.getName() || 'mesh'}`);
      holder.setMesh(clone);
      holder.setMatrix(node.getWorldMatrix());
      lodN.addChild(holder);
    });
    scene.addChild(lodN);
    lodTris[name] = trianglesUnder(lodN);
  }
  return lodTris;
}

const only = args.only;
await mkdir(OUT, { recursive: true });
const dirs = (await readdir(RAW))
  .filter((f) => f.endsWith('.glb'))
  .map((f) => f.slice(0, -4))
  .filter((slug) => !only || slug === only)
  .sort();
// Freshness must also see edits to THIS SCRIPT (the abstraction recipe):
// without this, changing simplify ratios or the material sampler silently
// ships the old abstraction until someone remembers --force.
const scriptMtime = (await stat(new URL(import.meta.url))).mtimeMs;

const report = [];
const failed = [];
for (const slug of dirs) {
  const rawPath = path.join(RAW, `${slug}.glb`);
  const outPath = path.join(OUT, `${slug}.glb`);

  // Idempotent crank: skip models whose served GLB is newer than BOTH the
  // raw cache and the abstraction script (unless --force / --only).
  if (!only && !args.force) {
    const [rawStat, outStat] = await Promise.all([
      stat(rawPath).catch(() => null),
      stat(outPath).catch(() => null),
    ]);
    if (
      rawStat &&
      outStat &&
      outStat.mtimeMs > Math.max(rawStat.mtimeMs, scriptMtime)
    ) {
      continue;
    }
  }

  // Runs the full sampling chain. `ratio` tightens on oversize retries;
  // `compress=false` falls back to a plain GLB when the meshopt encoder
  // asserts on a pathological vertex buffer (post-abstraction models are
  // small enough that plain output is acceptable).
  async function process(ratio, compress) {
    const rawBytes = (await readFile(rawPath)).length;
    const doc = await io.read(rawPath);
    const before = stats(doc, rawBytes);

    dropNonTriangles(doc);
    await sampleMaterials(doc);
    await doc.transform(
      dedup(),
      palette({ min: 2 }),
      flatten(),
      join(),
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio, error: LOD0.error }),
      prune()
    );
    const lodTris = buildLodNodes(doc);
    await doc.transform(prune());
    dropOrphanTextures(doc);
    if (compress) {
      await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    }
    await io.write(outPath, doc);
    const outBytes = (await readFile(outPath)).length;
    return { before, lodTris, outBytes, compressed: compress };
  }

  try {
    let mode = 'meshopt';
    let result;
    try {
      result = await process(LOD0.ratio, true);
    } catch {
      // Meshopt encoder assertion — retry uncompressed.
      mode = 'plain';
      result = await process(LOD0.ratio, false);
    }
    // Oversize guard: one auto-retry with a much tighter simplify budget.
    if (result.outBytes > 1_000_000) {
      mode += '+tightened';
      result = await process(LOD0.ratio * 0.3, result.compressed);
    }

    const { before, lodTris, outBytes } = result;
    const after = { ...stats(await io.read(outPath), outBytes), lodTriangles: lodTris, mode };

    report.push({ slug, before, after });
    console.log(
      `[abstract] ${slug}: ${(before.glbBytes / 1e6).toFixed(1)}MB/${(before.triangles / 1e3).toFixed(0)}k tris → ` +
        `${(outBytes / 1e6).toFixed(2)}MB (LOD0 ${(lodTris.LOD0 / 1e3).toFixed(1)}k / LOD1 ${(lodTris.LOD1 / 1e3).toFixed(1)}k / LOD2 ${(lodTris.LOD2 / 1e3).toFixed(1)}k tris, ` +
        `${after.materials} mats, ${after.textures} tex, ${mode})`
    );
  } catch (err) {
    // One pathological model must not kill a 135-model batch. No abstract.glb
    // is written, so emit skips it; the failure is loud in the report.
    failed.push({ slug, error: String(err?.message ?? err).slice(0, 200) });
    console.error(`[abstract] ${slug}: FAILED — ${err?.message ?? err}`);
  }
}

// Merge with the previous report: freshness-skipped models keep their prior
// entries; re-processed slugs replace them.
const reportPath = path.join(ROOT, 'report.json');
const prior = await readFile(reportPath, 'utf8')
  .then((t) => JSON.parse(t).models ?? [])
  .catch(() => []);
const bySlug = new Map(prior.map((r) => [r.slug, r]));
for (const r of report) bySlug.set(r.slug, r);
for (const f of failed) bySlug.delete(f.slug); // a failed model has no valid stats
// Prune entries whose raw cache is gone (model removed from curation) — a
// stale report entry would inflate the budget gate with a model that no
// longer ships.
const rawSet = new Set(dirs);
for (const slug of [...bySlug.keys()]) {
  if (!rawSet.has(slug) && !only) bySlug.delete(slug);
}
const merged = [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));

await writeFile(
  reportPath,
  JSON.stringify(
    { generated: new Date().toISOString(), lod0: LOD0, failed, models: merged },
    null,
    2
  )
);
const totalOut = merged.reduce((s, r) => s + r.after.glbBytes, 0);
const totalIn = merged.reduce((s, r) => s + r.before.glbBytes, 0);
console.log(
  `\n[abstract] ${report.length} processed (+${merged.length - report.length} cached, ${failed.length} FAILED): ` +
    `${(totalIn / 1e6).toFixed(1)}MB → ${(totalOut / 1e6).toFixed(1)}MB total; report → sites/_warehouse/report.json`
);
