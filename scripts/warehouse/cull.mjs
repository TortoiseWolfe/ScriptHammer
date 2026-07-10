// Context-geometry culling (#259 iteration 5).
//
// SketchUp Warehouse authors model SITE CONTEXT around their building —
// district ground planes, riverbanks, parking plates, neighbor blocks.
// Measured on the published chatt set: 91/134 served GLBs exceeded 150 m XZ
// extent, 31 exceeded 300 m (real buildings: 20–100 m). Those planes co-plane
// with the terrain drape (shimmer), vanish edge-on / fill the screen face-on
// ("appears only at certain angles"), and LOD-decimate into serrated shards
// ("junk geometry"). This stage removes the context and keeps the building.
//
// It MUST run before flatten()/join() — afterwards the model is a handful of
// merged meshes and the context is no longer separable. Pure module (no
// top-level execution) so vitest can drive it with synthetic Documents;
// abstract-glb.mjs imports it.
//
// Heuristic v1 — deliberately conservative; every rule requires the node to
// span a large FRACTION of the scene, so "context" means "spans the site":
// a 100 m building's flat roof under a 700 m scene never trips it. Anything
// the heuristic gets wrong is one line of per-slug config
// (scripts/warehouse/abstract-<site>.json) + a --only re-crank.

import { getBounds } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';

/** Stage only activates above this scene extent — building-sized models are
 *  never touched. */
export const ACTIVATION_EXTENT_M = 150;
/** Rule 1 (flat context): min XZ extent + max height. The height cap SCALES
 *  with footprint (clamped 6–30 m): context isn't always literally flat —
 *  Chattanooga site sheets carry real terrain relief (the Hunter Museum's
 *  bluff: 366 m wide, 26.6 m of slope; the Marriott's site: 633 m, 12.7 m).
 *  What discriminates context from building is Y ≪ XZ, not Y ≈ 0. */
export const FLAT_CONTEXT_MIN_XZ_M = 120;
export const FLAT_CONTEXT_MAX_Y_M = 6;
export const FLAT_CONTEXT_Y_RATIO = 0.08;
export const FLAT_CONTEXT_Y_CAP_M = 30;
/** Rule 2 (thin plate): ground/parking sheets that co-plane with the drape. */
export const THIN_PLATE_MAX_Y_M = 0.5;
export const THIN_PLATE_MIN_XZ_M = 60;
/** Both rules also require the node to span this fraction of the scene's
 *  larger XZ extent — the semantic core of "context". */
export const MIN_SCENE_FRACTION = 0.5;
/** Safety guard: refuse to cull when this fraction of triangles would go. */
export const MAX_CULL_FRACTION = 0.8;

/** Triangles under a node (indexed or not). Shared with abstract-glb.mjs. */
export function trianglesUnder(node) {
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

const size = (b) => ({
  x: b.max[0] - b.min[0],
  y: b.max[1] - b.min[1],
  z: b.max[2] - b.min[2],
});

/**
 * Pure classifier — exported for unit tests.
 * @param nodeBBox  {min,max} world bounds of the candidate subtree
 * @param sceneBBox {min,max} world bounds of the whole scene
 * @returns 'keep' | 'flat-context' | 'thin-plate'
 */
export function classifyNode(nodeBBox, sceneBBox) {
  const n = size(nodeBBox);
  const s = size(sceneBBox);
  const nXZ = Math.max(n.x, n.z);
  const sXZ = Math.max(s.x, s.z);
  const spansScene = sXZ > 0 && nXZ >= MIN_SCENE_FRACTION * sXZ;
  if (!spansScene) return 'keep';
  if (n.y < THIN_PLATE_MAX_Y_M && nXZ > THIN_PLATE_MIN_XZ_M)
    return 'thin-plate';
  const flatYMax = Math.min(
    FLAT_CONTEXT_Y_CAP_M,
    Math.max(FLAT_CONTEXT_MAX_Y_M, FLAT_CONTEXT_Y_RATIO * nXZ)
  );
  if (n.y < flatYMax && nXZ > FLAT_CONTEXT_MIN_XZ_M) return 'flat-context';
  return 'keep';
}

function dropSubtree(node) {
  node.traverse((n) => {
    const mesh = n.getMesh?.();
    if (mesh) n.setMesh(null);
  });
  node.dispose();
}

/**
 * Cull context geometry from a Document in place.
 *
 * Walk: classify the scene's direct-child subtrees; a huge-but-tall subtree
 * (possible mixed container: building + ground in one group) is recursed into
 * rather than judged whole. Recursion stops at mesh-owning nodes — a single
 * huge mesh is kept (splitting one mesh needs vertex surgery; per-slug
 * dropNodes or curation covers those).
 *
 * @param doc  gltf-transform Document (before flatten/join)
 * @param cfg  per-slug config: { keepAll?, dropFlatContext?, dropNodes? }
 * @returns { culledNodes, culledTriangles, aborted, preDims, postDims }
 */
export function cullContextNodes(doc, cfg = {}) {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const sceneBBox = getBounds(scene);
  const preDims = size(sceneBBox);
  const result = {
    culledNodes: 0,
    culledTriangles: 0,
    aborted: false,
    preDims,
    postDims: preDims,
  };
  if (cfg.keepAll) return result;

  const dropPatterns = (cfg.dropNodes ?? []).map((p) => new RegExp(p, 'i'));
  const matchesDropPattern = (node) =>
    dropPatterns.some((re) => re.test(node.getName() ?? ''));

  const activated =
    Math.max(preDims.x, preDims.z) > ACTIVATION_EXTENT_M &&
    cfg.dropFlatContext !== false;
  const totalTris = trianglesUnder(scene);

  // Collect victims first (mutating while traversing invites skips).
  const victims = [];
  const consider = (node) => {
    if (matchesDropPattern(node)) {
      victims.push(node);
      return;
    }
    if (!activated) {
      // dropNodes patterns still apply below the gate; heuristics don't.
      for (const child of node.listChildren()) consider(child);
      return;
    }
    const bbox = getBounds(node);
    const cls = classifyNode(bbox, sceneBBox);
    if (cls !== 'keep') {
      // A flagged node that holds essentially the WHOLE model is a wrapper
      // (SketchUp "Root Node"), not a context sheet — recurse to find the
      // actual sheet inside instead of condemning everything (which would
      // only trip the abort guard and cull nothing).
      if (
        trianglesUnder(node) > MAX_CULL_FRACTION * totalTris &&
        node.listChildren().length > 0
      ) {
        for (const child of node.listChildren()) consider(child);
        return;
      }
      victims.push(node);
      return;
    }
    // Huge-but-tall container? Recurse — a building group (walls + roof)
    // is 20–40 m tall and never re-enters here; a group that merely WRAPS
    // a building plus a ground plane does, and the plane falls out below.
    const n = size(bbox);
    if (
      Math.max(n.x, n.z) > FLAT_CONTEXT_MIN_XZ_M &&
      node.listChildren().length > 0
    ) {
      for (const child of node.listChildren()) consider(child);
    }
  };
  for (const child of [...scene.listChildren()]) consider(child);

  if (victims.length === 0) return result;

  const victimTris = victims.reduce((s, v) => s + trianglesUnder(v), 0);
  const remainingMeshes = totalTris - victimTris;
  if (victimTris > MAX_CULL_FRACTION * totalTris || remainingMeshes <= 0) {
    // A "model" that is mostly context is a site plan — that's a curation
    // call (exclude), not a geometry call. Refuse loudly, cull nothing.
    result.aborted = true;
    return result;
  }

  for (const v of victims) dropSubtree(v);
  result.culledNodes = victims.length;
  result.culledTriangles = victimTris;
  result.postDims = size(getBounds(scene));
  return result;
}

/** Convenience: cull + sweep orphans in one call (abstract-glb.mjs entry). */
export async function cullAndPrune(doc, cfg) {
  const res = cullContextNodes(doc, cfg);
  if (res.culledNodes > 0) {
    await doc.transform(prune());
  }
  return res;
}
