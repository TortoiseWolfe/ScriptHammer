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
 *   → cullContextNodes (drop site-context planes — MUST precede flatten/join,
 *     see scripts/warehouse/cull.mjs; per-slug grants in abstract-<site>.json)
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
import { NodeIO, getBounds } from '@gltf-transform/core';
import { cullAndPrune, trianglesUnder } from './cull.mjs';
import { dedupeFaces } from './dedupe-faces.mjs';
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
// LOD2 was ratio 0.04 / error 0.08 — on the big context planes that shredded
// into serrated blobs ("junk geometry", iter-5 review). 0.08/0.05 stays under
// the committed 150k totalLod2Triangles ceiling by construction: LOD2@0.08 ≤
// LOD1@0.15 per model, and the LOD1 total is ~128k.
const LODS = [
  { name: 'LOD1', ratio: 0.15, error: 0.02 },
  { name: 'LOD2', ratio: 0.08, error: 0.05 },
];
// An LOD2 that lands under this is a silhouette-free shard blob — ship the
// LOD1 geometry at that level instead (33 models today).
const LOD2_SHARD_FLOOR_TRIS = 120;

// Per-slug pipeline config (#259 iter 5): culling grants (keepAll for the
// bridges), dropNodes regexes, expected extents for QC, LOD ratio overrides.
// Committed next to the curation list; absent file = no per-slug config.
const abstractCfg = await readFile(
  path.resolve(`scripts/warehouse/abstract-${args.site}.json`),
  'utf8'
)
  .then((t) => JSON.parse(t))
  .catch(() => ({}));
const cfgFor = (slug) => abstractCfg[slug] ?? {};

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

/** Wrap the scene under LOD0 and add simplified LOD1/LOD2 clones (shared
 *  materials). Per-slug `lodRatios` override the global keep-ratios; an LOD2
 *  that simplifies below the shard floor ships LOD1's geometry instead. */
function buildLodNodes(doc, cfg = {}) {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const lod0 = doc.createNode('LOD0');
  for (const child of [...scene.listChildren()]) {
    scene.removeChild(child);
    lod0.addChild(child);
  }
  scene.addChild(lod0);

  const lodTris = { LOD0: trianglesUnder(lod0) };
  const built = {};
  for (const { name, ratio, error } of LODS) {
    const useRatio = cfg.lodRatios?.[name.toLowerCase()] ?? ratio;
    const lodN = doc.createNode(name);
    lod0.traverse((node) => {
      const mesh = node.getMesh?.();
      if (!mesh) return;
      const clone = mesh.clone();
      for (const prim of clone.listPrimitives()) {
        simplifyPrimitive(prim, {
          simplifier: MeshoptSimplifier,
          ratio: useRatio,
          error,
        });
      }
      const holder = doc.createNode(`${name}-${node.getName() || 'mesh'}`);
      holder.setMesh(clone);
      holder.setMatrix(node.getWorldMatrix());
      lodN.addChild(holder);
    });
    // Shard floor: a far level reduced to a handful of stretched triangles
    // reads as junk, not a silhouette. Rebuild it from the previous level's
    // geometry (LOD1, else LOD0 stays the only source of truth).
    if (name === 'LOD2' && trianglesUnder(lodN) < LOD2_SHARD_FLOOR_TRIS) {
      for (const child of [...lodN.listChildren()]) {
        child.traverse((n) => n.getMesh?.() && n.setMesh(null));
        child.dispose();
      }
      const src = built.LOD1 ?? lod0;
      src.traverse((node) => {
        const mesh = node.getMesh?.();
        if (!mesh) return;
        const holder = doc.createNode(`${name}-${node.getName() || 'mesh'}`);
        holder.setMesh(mesh); // share, don't clone — same geometry, no bloat
        holder.setMatrix(node.getWorldMatrix());
        lodN.addChild(holder);
      });
    }
    scene.addChild(lodN);
    built[name] = lodN;
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
// Freshness must also see edits to the abstraction RECIPE — this script, the
// cull module, and the per-slug config: without this, changing simplify
// ratios, culling rules, or a slug's grant silently ships the old
// abstraction until someone remembers --force.
const recipeMtimes = await Promise.all(
  [
    new URL(import.meta.url),
    new URL('./cull.mjs', import.meta.url),
    path.resolve(`scripts/warehouse/abstract-${args.site}.json`),
  ].map((p) => stat(p).then((s) => s.mtimeMs).catch(() => 0))
);
const scriptMtime = Math.max(...recipeMtimes);

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
    const cfg = cfgFor(slug);

    dropNonTriangles(doc);
    await sampleMaterials(doc);
    // Context culling (iter 5): strip site-context planes while source nodes
    // are still separate — flatten/join below merges everything.
    const culled = await cullAndPrune(doc, cfg);
    await doc.transform(
      dedup(),
      palette({ min: 2 }),
      flatten(),
      join(),
      weld(),
      // Remove SketchUp's reversed/duplicate coplanar faces (#259 iter 6):
      // every wall is modeled twice with opposite winding; weld() snaps the
      // twins coincident and this drops one, so the shell is a single clean
      // layer that renders correctly as FrontSide (no DoubleSide, no z-fight —
      // that was the "shit faces at some angles"). Runs BEFORE simplify so
      // both the LOD0 base and the LOD clones inherit clean geometry.
      dedupeFaces(),
      simplify({ simplifier: MeshoptSimplifier, ratio, error: LOD0.error }),
      prune()
    );
    const faceDedup = doc.getRoot().getExtras().faceDedup ?? {
      removedPairs: 0,
      removedDegenerate: 0,
    };
    const lodTris = buildLodNodes(doc, cfg);
    await doc.transform(prune());
    dropOrphanTextures(doc);
    // Post-abstraction bounds of the geometry that actually ships (LOD0 —
    // all levels share the footprint): feeds QC extent badges, the extents
    // test, size-aware fly-to, and future footprint-rect massing suppression.
    const scene =
      doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
    const lod0Node = scene
      .listChildren()
      .find((n) => n.getName() === 'LOD0');
    const bbox = getBounds(lod0Node ?? scene);
    const dimensions = {
      x: Number((bbox.max[0] - bbox.min[0]).toFixed(2)),
      y: Number((bbox.max[1] - bbox.min[1]).toFixed(2)),
      z: Number((bbox.max[2] - bbox.min[2]).toFixed(2)),
    };
    const center = {
      x: Number(((bbox.max[0] + bbox.min[0]) / 2).toFixed(2)),
      y: Number(((bbox.max[1] + bbox.min[1]) / 2).toFixed(2)),
      z: Number(((bbox.max[2] + bbox.min[2]) / 2).toFixed(2)),
    };
    if (compress) {
      await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    }
    await io.write(outPath, doc);
    const outBytes = (await readFile(outPath)).length;
    return { before, lodTris, outBytes, compressed: compress, culled, faceDedup, dimensions, center };
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

    const { before, lodTris, outBytes, culled, faceDedup, dimensions, center } =
      result;
    const after = {
      ...stats(await io.read(outPath), outBytes),
      lodTriangles: lodTris,
      dimensions,
      center,
      mode,
    };

    report.push({ slug, before, after, culled, faceDedup });
    const cullNote = culled.aborted
      ? ', CULL ABORTED (mostly context — curation call)'
      : culled.culledNodes > 0
        ? `, culled ${culled.culledNodes} context nodes/${(culled.culledTriangles / 1e3).toFixed(1)}k tris (${Math.round(Math.max(culled.preDims.x, culled.preDims.z))}m → ${Math.round(Math.max(culled.postDims.x, culled.postDims.z))}m)`
        : '';
    if (culled.aborted) {
      console.warn(
        `[abstract] WARNING ${slug}: cull guard refused — >80% of geometry is context; exclude via overrides or grant via abstract-${args.site}.json`
      );
    }
    const dedupNote =
      faceDedup.removedPairs > 0 || faceDedup.removedDegenerate > 0
        ? `, deduped ${faceDedup.removedPairs} reversed faces/${faceDedup.removedDegenerate} degenerate`
        : '';
    console.log(
      `[abstract] ${slug}: ${(before.glbBytes / 1e6).toFixed(1)}MB/${(before.triangles / 1e3).toFixed(0)}k tris → ` +
        `${(outBytes / 1e6).toFixed(2)}MB (LOD0 ${(lodTris.LOD0 / 1e3).toFixed(1)}k / LOD1 ${(lodTris.LOD1 / 1e3).toFixed(1)}k / LOD2 ${(lodTris.LOD2 / 1e3).toFixed(1)}k tris, ` +
        `${Math.round(dimensions.x)}×${Math.round(dimensions.y)}×${Math.round(dimensions.z)}m, ` +
        `${after.materials} mats, ${after.textures} tex, ${mode}${cullNote}${dedupNote})`
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
