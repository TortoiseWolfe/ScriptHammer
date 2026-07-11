// #259 iteration 6 — coincident-face dedup. SketchUp models every wall twice
// with opposite winding; weld() snaps the twins coincident and this transform
// drops one so the shell renders clean as FrontSide. These tests pin the pure
// helpers and the Document transform against synthetic geometry (a reversed
// pair is removed, a distinct pair is kept, degenerates dropped, and the
// front/back twins split across DIFFERENT primitives — the real SketchUp
// case — are still caught).

import { describe, it, expect } from 'vitest';
import { Document } from '@gltf-transform/core';
import {
  dedupeFaces,
  keepFirst,
  triDoubleArea,
  triKey,
} from '../dedupe-faces.mjs';

describe('triKey', () => {
  it('is order-independent (a reversed winding hashes identically)', () => {
    const fwd = triKey(0, 0, 0, 1, 0, 0, 0, 1, 0);
    const rev = triKey(0, 0, 0, 0, 1, 0, 1, 0, 0); // same 3 verts, reversed
    expect(fwd).toBe(rev);
  });
  it('differs for a genuinely different triangle', () => {
    expect(triKey(0, 0, 0, 1, 0, 0, 0, 1, 0)).not.toBe(
      triKey(0, 0, 0, 1, 0, 0, 0, 0, 1)
    );
  });
  it('quantizes to ~1mm (sub-mm jitter collapses)', () => {
    expect(triKey(0, 0, 0, 1, 0, 0, 0, 1, 0)).toBe(
      triKey(0.0002, 0, 0, 1.0003, 0, 0, 0, 1.0001, 0)
    );
  });
});

describe('triDoubleArea', () => {
  it('is ~0 for a degenerate (collinear) triangle', () => {
    expect(triDoubleArea(0, 0, 0, 1, 0, 0, 2, 0, 0)).toBeCloseTo(0, 9);
  });
  it('is positive for a real triangle', () => {
    expect(triDoubleArea(0, 0, 0, 1, 0, 0, 0, 1, 0)).toBeGreaterThan(0);
  });
});

describe('keepFirst', () => {
  it('keeps the outward triangle: face normal agrees with vertex normals', () => {
    // Shared vertex normals point +Z (the wall's true outward direction).
    // A's face normal is +Z (agrees → outward); B's is -Z (the reversed twin,
    // disagrees). Keep A.
    expect(keepFirst([0, 0, 1], [0, 0, 3], [0, 0, -1], [0, 0, 3])).toBe(true);
    // symmetric: swap which one is reversed → keep B
    expect(keepFirst([0, 0, -1], [0, 0, 3], [0, 0, 1], [0, 0, 3])).toBe(false);
  });
  it('keeps A deterministically when neither has vertex normals', () => {
    expect(keepFirst([0, 0, 1], null, [0, 0, -1], null)).toBe(true);
  });
});

// --- Document transform ---------------------------------------------------

/** Add a single triangle as its own primitive+mesh+node (so we can place
 *  front/back twins in DIFFERENT primitives like SketchUp does). Winding is
 *  the vertex order; the NORMAL points +normalSign along Z. */
function addTri(doc: Document, verts: number[], nz: number) {
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  const pos = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array(verts))
    .setBuffer(buffer);
  const nrm = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array([0, 0, nz, 0, 0, nz, 0, 0, nz]))
    .setBuffer(buffer);
  const idx = doc
    .createAccessor()
    .setType('SCALAR')
    .setArray(new Uint16Array([0, 1, 2]))
    .setBuffer(buffer);
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', pos)
    .setAttribute('NORMAL', nrm)
    .setIndices(idx);
  const mesh = doc.createMesh().addPrimitive(prim);
  const node = doc.createNode().setMesh(mesh);
  return { prim, node };
}

function triCount(doc: Document) {
  let t = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const p of mesh.listPrimitives()) {
      const idx = p.getIndices();
      const pos = p.getAttribute('POSITION');
      t += Math.floor((idx ? idx.getCount() : (pos?.getCount() ?? 0)) / 3);
    }
  return t;
}

describe('dedupeFaces transform', () => {
  const FWD = [0, 0, 0, 1, 0, 0, 0, 1, 0]; // CCW, faces +Z
  const REV = [0, 0, 0, 0, 1, 0, 1, 0, 0]; // same verts, reversed → faces -Z

  it('removes the reversed twin of a coincident pair (same primitive)', () => {
    const doc = new Document();
    const scene = doc.createScene();
    scene.addChild(addTri(doc, FWD, 1).node); // outward
    scene.addChild(addTri(doc, REV, -1).node); // reversed twin
    expect(triCount(doc)).toBe(2);
    dedupeFaces()(doc);
    expect(triCount(doc)).toBe(1);
    expect(doc.getRoot().getExtras().faceDedup.removedPairs).toBe(1);
  });

  it('catches twins split across DIFFERENT primitives (the SketchUp case)', () => {
    // Already separate primitives above — assert the outward one survived by
    // checking its normal sign remains +Z after dedup.
    const doc = new Document();
    const scene = doc.createScene();
    const a = addTri(doc, FWD, 1); // outward, +Z
    const b = addTri(doc, REV, -1); // reversed, -Z
    scene.addChild(a.node);
    scene.addChild(b.node);
    dedupeFaces()(doc);
    // one of the two primitives now has zero triangles; the surviving one is
    // the outward (+Z-normal) copy
    const survivingNz: number[] = [];
    for (const mesh of doc.getRoot().listMeshes())
      for (const p of mesh.listPrimitives()) {
        const idx = p.getIndices();
        if (idx && idx.getCount() > 0) {
          const nrm = p.getAttribute('NORMAL')!;
          const n = [0, 0, 0];
          nrm.getElement(0, n);
          survivingNz.push(n[2]);
        }
      }
    expect(survivingNz).toEqual([1]); // only the +Z copy remains
  });

  it('keeps a genuinely distinct pair of faces', () => {
    const doc = new Document();
    const scene = doc.createScene();
    scene.addChild(addTri(doc, FWD, 1).node);
    scene.addChild(addTri(doc, [0, 0, 5, 1, 0, 5, 0, 1, 5], 1).node); // offset
    dedupeFaces()(doc);
    expect(triCount(doc)).toBe(2);
    expect(doc.getRoot().getExtras().faceDedup.removedPairs).toBe(0);
  });

  it('drops a degenerate (zero-area) triangle', () => {
    const doc = new Document();
    const scene = doc.createScene();
    scene.addChild(addTri(doc, FWD, 1).node);
    scene.addChild(addTri(doc, [0, 0, 0, 1, 0, 0, 2, 0, 0], 1).node); // collinear
    dedupeFaces()(doc);
    expect(triCount(doc)).toBe(1);
    expect(doc.getRoot().getExtras().faceDedup.removedDegenerate).toBe(1);
  });
});
