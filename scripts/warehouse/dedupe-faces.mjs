// Coincident-face dedup + degenerate removal (#259 iteration 6).
//
// SketchUp models every wall as TWO coplanar triangles at the same location
// with OPPOSITE winding (the classic "reversed faces"). Measured on the
// served city: at-t-field-model had 619 opposite-winding coincident pairs out
// of ~750 triangles (~82% junk); clean models had zero. The runtime forced
// `side = DoubleSide` to stop single-sided walls from vanishing, which then
// rendered BOTH halves of every doubled wall — they z-fight and the interior
// copy shows through the shell as the camera orbits ("shit faces at some
// angles"). weld()/dedup()/join() cannot fix this: weld merges identical
// vertices, but the two halves have opposite index winding so both triangles
// survive.
//
// This transform removes the reversed twin (keeping the outward-facing one)
// and drops zero-area degenerates, so the shell becomes a single consistent
// layer that renders correctly as FrontSide — no DoubleSide, no z-fight.
//
// Runs BEFORE flatten/join in abstract-glb.mjs, per-primitive. Pure geometry
// (positions + optional normals); exported helpers are unit-tested.

const QUANT = 1000; // positions quantized to 1mm for the coincidence key

/** Order-independent key for a triangle's three vertices (front & back copies
 *  of the same tri hash identically). Exported for tests. */
export function triKey(ax, ay, az, bx, by, bz, cx, cy, cz) {
  const q = (v) => Math.round(v * QUANT);
  const corners = [
    [q(ax), q(ay), q(az)],
    [q(bx), q(by), q(bz)],
    [q(cx), q(cy), q(cz)],
  ].sort((p, r) => p[0] - r[0] || p[1] - r[1] || p[2] - r[2]);
  return corners.flat().join(',');
}

/** Geometric (face) normal of a triangle, unnormalized is fine for sign. */
function faceNormal(ax, ay, az, bx, by, bz, cx, cy, cz) {
  const ux = bx - ax,
    uy = by - ay,
    uz = bz - az;
  const vx = cx - ax,
    vy = cy - ay,
    vz = cz - az;
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}

/** Twice the triangle area (magnitude of the cross product). */
export function triDoubleArea(ax, ay, az, bx, by, bz, cx, cy, cz) {
  const [nx, ny, nz] = faceNormal(ax, ay, az, bx, by, bz, cx, cy, cz);
  return Math.hypot(nx, ny, nz);
}

/**
 * Which of two coincident triangles to keep: the one whose face normal best
 * agrees with its stored vertex normals (the outward-facing copy). Returns
 * true to keep triangle A, false to keep B. If neither has vertex normals,
 * keep A deterministically. Exported for tests.
 */
export function keepFirst(faceN_A, vertN_A, faceN_B, vertN_B) {
  const dot = (a, b) =>
    a && b ? a[0] * b[0] + a[1] * b[1] + a[2] * b[2] : null;
  const dA = dot(faceN_A, vertN_A);
  const dB = dot(faceN_B, vertN_B);
  if (dA == null && dB == null) return true;
  if (dA == null) return dB < 0; // keep A only if B faces inward
  if (dB == null) return dA >= 0;
  return dA >= dB; // keep the one more aligned with its vertex normals
}

/**
 * Read a primitive's triangles into records. SketchUp assigns the front and
 * back copy of a wall DIFFERENT materials, so the reversed twins live in
 * DIFFERENT primitives — coincidence must be detected across the whole mesh,
 * not per-primitive (the per-primitive version found 0 pairs where 743
 * existed). Exported for tests.
 * @returns { records, removedDegenerate } — records carry {prim, t, i0,i1,i2,
 *          key, fn, vn} and a `keep` flag defaulting true.
 */
export function collectTriangles(prim) {
  const pos = prim.getAttribute('POSITION');
  const nrm = prim.getAttribute('NORMAL');
  const idx = prim.getIndices();
  const records = [];
  let removedDegenerate = 0;
  if (!pos) return { records, removedDegenerate };
  const count = idx ? idx.getCount() : pos.getCount();
  const triCount = Math.floor(count / 3);
  const vidx = (t, k) => (idx ? idx.getScalar(t * 3 + k) : t * 3 + k);
  const P = (i) => {
    const a = [0, 0, 0];
    pos.getElement(i, a);
    return a;
  };
  const N = (i) => {
    if (!nrm) return null;
    const a = [0, 0, 0];
    nrm.getElement(i, a);
    return a;
  };
  for (let t = 0; t < triCount; t++) {
    const i0 = vidx(t, 0),
      i1 = vidx(t, 1),
      i2 = vidx(t, 2);
    const p0 = P(i0),
      p1 = P(i1),
      p2 = P(i2);
    if (triDoubleArea(...p0, ...p1, ...p2) < 1e-9) {
      removedDegenerate++;
      continue;
    }
    const n0 = N(i0),
      n1 = N(i1),
      n2 = N(i2);
    records.push({
      prim,
      t,
      i0,
      i1,
      i2,
      key: triKey(...p0, ...p1, ...p2),
      fn: faceNormal(...p0, ...p1, ...p2),
      vn:
        n0 && n1 && n2
          ? [
              n0[0] + n1[0] + n2[0],
              n0[1] + n1[1] + n2[1],
              n0[2] + n1[2] + n2[2],
            ]
          : null,
      keep: true,
    });
  }
  return { records, removedDegenerate };
}

/**
 * gltf-transform document transform: remove coincident opposite-winding
 * triangle pairs (SketchUp reversed faces) and zero-area degenerates across
 * the whole document, then rebuild each triangle primitive's index. Records
 * the counts in root.extras.faceDedup.
 */
export function dedupeFaces() {
  return (doc) => {
    const prims = [];
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMode() === 4) prims.push(prim);
      }
    }

    // Collect all triangles across all primitives, bucket by coincidence key.
    const byKey = new Map();
    const byPrim = new Map();
    let removedDegenerate = 0;
    for (const prim of prims) {
      const { records, removedDegenerate: d } = collectTriangles(prim);
      removedDegenerate += d;
      byPrim.set(prim, records);
      for (const rec of records) {
        const b = byKey.get(rec.key);
        if (b) b.push(rec);
        else byKey.set(rec.key, [rec]);
      }
    }

    // In each coincidence bucket keep the best outward-facing triangle; mark
    // the rest for removal.
    let removedPairs = 0;
    for (const bucket of byKey.values()) {
      if (bucket.length < 2) continue;
      let best = bucket[0];
      for (let j = 1; j < bucket.length; j++) {
        if (!keepFirst(best.fn, best.vn, bucket[j].fn, bucket[j].vn)) {
          best = bucket[j];
        }
      }
      for (const rec of bucket) if (rec !== best) rec.keep = false;
      removedPairs += bucket.length - 1;
    }

    // Rebuild each primitive's index from its kept triangles. Degenerates were
    // never added to records, so they drop out here too.
    if (removedPairs > 0 || removedDegenerate > 0) {
      for (const prim of prims) {
        const records = byPrim.get(prim);
        const pos = prim.getAttribute('POSITION');
        const idx = prim.getIndices();
        const kept = records.filter((r) => r.keep);
        const newIndices = [];
        for (const r of kept) newIndices.push(r.i0, r.i1, r.i2);
        const IndexArray = pos.getCount() > 65535 ? Uint32Array : Uint16Array;
        if (idx) {
          idx.setArray(new IndexArray(newIndices));
        } else {
          const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
          const newIdx = doc
            .createAccessor()
            .setType('SCALAR')
            .setArray(new IndexArray(newIndices))
            .setBuffer(buffer);
          prim.setIndices(newIdx);
        }
      }
    }

    doc.getRoot().setExtras({
      ...doc.getRoot().getExtras(),
      faceDedup: { removedPairs, removedDegenerate },
    });
  };
}
