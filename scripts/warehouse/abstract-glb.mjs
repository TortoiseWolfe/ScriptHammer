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
 * In:  sites/_warehouse/models/<slug>/raw.glb        (fetch-glbs.mjs output)
 * Out: sites/_warehouse/models/<slug>/abstract.glb   (local-only, gitignored)
 *      sites/_warehouse/report.json                  (before/after stats)
 *
 * Run:  docker compose exec scripthammer node scripts/warehouse/abstract-glb.mjs [--only <slug>] [--ratio 0.4]
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
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
    ratio: { type: 'string', default: '0.4' }, // LOD0 keep-ratio of welded base
  },
});

const ROOT = path.resolve('sites/_warehouse');
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
    const tex = mat.getBaseColorTexture();
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
const dirs = (await readdir(path.join(ROOT, 'models'), { withFileTypes: true }))
  .filter((d) => d.isDirectory() && (!only || d.name === only))
  .map((d) => d.name);

const report = [];
for (const slug of dirs) {
  const rawPath = path.join(ROOT, 'models', slug, 'raw.glb');
  const outPath = path.join(ROOT, 'models', slug, 'abstract.glb');
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
    simplify({ simplifier: MeshoptSimplifier, ratio: LOD0.ratio, error: LOD0.error }),
    prune()
  );
  const lodTris = buildLodNodes(doc);
  await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));

  await io.write(outPath, doc);
  const outBytes = (await readFile(outPath)).length;
  const after = { ...stats(doc, outBytes), lodTriangles: lodTris };

  report.push({ slug, before, after });
  console.log(
    `[abstract] ${slug}: ${(before.glbBytes / 1e6).toFixed(1)}MB/${(before.triangles / 1e3).toFixed(0)}k tris → ` +
      `${(outBytes / 1e6).toFixed(2)}MB (LOD0 ${(lodTris.LOD0 / 1e3).toFixed(1)}k / LOD1 ${(lodTris.LOD1 / 1e3).toFixed(1)}k / LOD2 ${(lodTris.LOD2 / 1e3).toFixed(1)}k tris, ` +
      `${after.materials} mats, ${after.textures} tex)`
  );
}

await writeFile(
  path.join(ROOT, 'report.json'),
  JSON.stringify({ generated: new Date().toISOString(), lod0: LOD0, models: report }, null, 2)
);
const totalOut = report.reduce((s, r) => s + r.after.glbBytes, 0);
const totalIn = report.reduce((s, r) => s + r.before.glbBytes, 0);
console.log(
  `\n[abstract] ${report.length} models: ${(totalIn / 1e6).toFixed(1)}MB → ${(totalOut / 1e6).toFixed(1)}MB total; report → sites/_warehouse/report.json`
);
