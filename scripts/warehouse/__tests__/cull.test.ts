// #259 iteration 5 — the context-culling heuristic. Measured problem: 91/134
// published GLBs carried SketchUp site context (district planes, riverbanks,
// terrain sheets) far beyond their building. These tests drive the pure
// classifier and the Document-level cull with synthetic geometry, pinning the
// safety properties: buildings survive, sheets die, wrappers are recursed
// (not condemned), site-plan models abort instead of vanishing.

import { describe, it, expect } from 'vitest';
import { Document } from '@gltf-transform/core';
import { classifyNode, cullContextNodes } from '../cull.mjs';

const bbox = (sx: number, sy: number, sz: number) => ({
  min: [-sx / 2, 0, -sz / 2],
  max: [sx / 2, sy, sz / 2],
});

describe('classifyNode', () => {
  const scene400 = bbox(400, 40, 400);

  it('drops a scene-spanning flat plane (district ground)', () => {
    expect(classifyNode(bbox(400, 2, 400), scene400)).toBe('flat-context');
  });

  it('drops a scene-spanning thin plate (parking sheet)', () => {
    expect(classifyNode(bbox(300, 0.3, 250), scene400)).toBe('thin-plate');
  });

  it('drops a SLOPED terrain sheet (Y scales with footprint, capped)', () => {
    // The Hunter Museum's bluff: 366m wide, 26.6m of relief — not "flat",
    // but Y ≪ XZ. 0.08 × 366 ≈ 29 ⇒ context.
    expect(classifyNode(bbox(366, 26.6, 195), bbox(366, 40, 195))).toBe(
      'flat-context'
    );
  });

  it('keeps a real building (Y comparable to XZ)', () => {
    expect(classifyNode(bbox(62, 49, 94), scene400)).toBe('keep');
  });

  it('keeps anything that does NOT span the scene (a big roof under a bigger site)', () => {
    // 100×0.3×80 roof slab, scene is 700m: 100 < 50% of 700 ⇒ keep.
    expect(classifyNode(bbox(100, 0.3, 80), bbox(700, 40, 300))).toBe('keep');
  });

  it('the Y cap holds at huge extents (a 633m sheet with 12.7m relief dies)', () => {
    expect(classifyNode(bbox(633, 12.7, 364), bbox(633, 51, 364))).toBe(
      'flat-context'
    );
  });
});

// --- Document-level tests -------------------------------------------------

/** A closed box mesh (12 tris) of the given size, centred at (tx, y0.., tz). */
function addBox(
  doc: Document,
  name: string,
  sx: number,
  sy: number,
  sz: number,
  tx = 0,
  tz = 0
) {
  const hx = sx / 2;
  const hz = sz / 2;
  // 8 corners, y in [0, sy]
  const P = [
    [-hx, 0, -hz],
    [hx, 0, -hz],
    [hx, 0, hz],
    [-hx, 0, hz],
    [-hx, sy, -hz],
    [hx, sy, -hz],
    [hx, sy, hz],
    [-hx, sy, hz],
  ].flat();
  const I = [
    0,
    1,
    2,
    0,
    2,
    3, // bottom
    4,
    6,
    5,
    4,
    7,
    6, // top
    0,
    4,
    5,
    0,
    5,
    1,
    1,
    5,
    6,
    1,
    6,
    2,
    2,
    6,
    7,
    2,
    7,
    3,
    3,
    7,
    4,
    3,
    4,
    0,
  ];
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer('b');
  const pos = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array(P))
    .setBuffer(buffer);
  const idx = doc
    .createAccessor()
    .setType('SCALAR')
    .setArray(new Uint16Array(I))
    .setBuffer(buffer);
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', pos)
    .setIndices(idx);
  const mesh = doc.createMesh(name).addPrimitive(prim);
  const node = doc.createNode(name).setMesh(mesh).setTranslation([tx, 0, tz]);
  return node;
}

function sceneWith(doc: Document, nodes: ReturnType<typeof addBox>[]) {
  const scene = doc.createScene('s');
  for (const n of nodes) scene.addChild(n);
  doc.getRoot().setDefaultScene(scene);
  return scene;
}

describe('cullContextNodes', () => {
  it('drops the ground sheet, keeps the building, reports shrunken dims', () => {
    const doc = new Document();
    const building = addBox(doc, 'building', 30, 25, 40);
    const sheet = addBox(doc, 'ground', 400, 1, 400);
    sceneWith(doc, [building, sheet]);
    const res = cullContextNodes(doc, {});
    expect(res.aborted).toBe(false);
    expect(res.culledNodes).toBe(1);
    expect(Math.max(res.preDims.x, res.preDims.z)).toBeCloseTo(400, 0);
    expect(Math.max(res.postDims.x, res.postDims.z)).toBeCloseTo(40, 0);
  });

  it('recurses into a wrapper Root Node instead of condemning it whole', () => {
    // SketchUp exports wrap everything under one flagged-size "Root Node";
    // round-2 regression: the wrapper itself classified as context and the
    // guard then refused to cull ANYTHING.
    const doc = new Document();
    const building = addBox(doc, 'tower', 40, 45, 40);
    const sheet = addBox(doc, 'site', 500, 8, 500);
    const root = doc.createNode('Root Node');
    root.addChild(building);
    root.addChild(sheet);
    const scene = doc.createScene('s');
    scene.addChild(root);
    doc.getRoot().setDefaultScene(scene);
    const res = cullContextNodes(doc, {});
    expect(res.aborted).toBe(false);
    expect(res.culledNodes).toBe(1);
    expect(Math.max(res.postDims.x, res.postDims.z)).toBeCloseTo(40, 0);
  });

  it('recurses even when the wrapper ITSELF classifies as context (low model)', () => {
    // The exact round-2 regression: a low building + sheet wrapper whose own
    // bbox (500×20×500) is under the scaled Y cap — the wrapper must be
    // recursed, not condemned (which tripped the guard and culled nothing).
    const doc = new Document();
    const building = addBox(doc, 'lowrise', 40, 20, 40);
    const sheet = addBox(doc, 'site', 500, 8, 500);
    const root = doc.createNode('Root Node');
    root.addChild(building);
    root.addChild(sheet);
    const scene = doc.createScene('s');
    scene.addChild(root);
    doc.getRoot().setDefaultScene(scene);
    const res = cullContextNodes(doc, {});
    expect(res.aborted).toBe(false);
    expect(res.culledNodes).toBe(1);
    expect(Math.max(res.postDims.x, res.postDims.z)).toBeCloseTo(40, 0);
  });

  it('is inert below the activation gate (building-sized scene)', () => {
    const doc = new Document();
    sceneWith(doc, [
      addBox(doc, 'b', 80, 20, 60),
      addBox(doc, 'pad', 100, 0.3, 90),
    ]);
    const res = cullContextNodes(doc, {});
    expect(res.culledNodes).toBe(0);
  });

  it('keepAll skips the stage entirely (bridges)', () => {
    const doc = new Document();
    sceneWith(doc, [addBox(doc, 'deck', 700, 5, 20)]);
    const res = cullContextNodes(doc, { keepAll: true });
    expect(res.culledNodes).toBe(0);
    expect(res.aborted).toBe(false);
  });

  it('aborts (culls nothing) when the model is mostly context — a site plan', () => {
    const doc = new Document();
    // One scene-spanning sheet and a tiny shed: the sheet is >80% of tris?
    // Both are 12-tri boxes, so weight by adding more sheet geometry.
    const sheet1 = addBox(doc, 'plan-a', 400, 1, 400);
    const sheet2 = addBox(doc, 'plan-b', 390, 1, 390);
    const sheet3 = addBox(doc, 'plan-c', 380, 1, 380);
    const sheet4 = addBox(doc, 'plan-d', 370, 1, 370);
    const sheet5 = addBox(doc, 'plan-e', 360, 1, 360);
    const shed = addBox(doc, 'shed', 5, 3, 5);
    sceneWith(doc, [sheet1, sheet2, sheet3, sheet4, sheet5, shed]);
    const res = cullContextNodes(doc, {});
    expect(res.aborted).toBe(true);
    expect(res.culledNodes).toBe(0);
  });

  it('dropNodes patterns remove by name even below the gate', () => {
    const doc = new Document();
    sceneWith(doc, [
      addBox(doc, 'b', 60, 20, 60),
      addBox(doc, '2668', 40, 30, 40),
    ]);
    const res = cullContextNodes(doc, { dropNodes: ['^2668$'] });
    expect(res.culledNodes).toBe(1);
  });
});
