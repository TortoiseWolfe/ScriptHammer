'use client';
import { useEffect, useMemo, useRef } from 'react';
import {
  BufferGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  RepeatWrapping,
  DoubleSide,
} from 'three';
import { useThree } from '@react-three/fiber';
import { MaterialSystem } from '@/lib/cod';
import type { Street, TerrainGrid, Manifest } from '@/lib/manifest';
import { elevationAt, minElevation } from './terrainSample';

/** Street ribbon width, metres (streets.json carries only centrelines, so this
 *  is a single downtown-ish default; tune for feel). */
const ROAD_WIDTH = 8;
/** Lift above the draped terrain so the ribbon reads as a surface without
 *  z-fighting the aerial. */
const ROAD_LIFT = 0.12;

/**
 * Extruded asphalt road ribbons for the wide/Walk diorama. `Streets.tsx` draws
 * 1-px lines (fine for the miniature orbit); at street level you need a real
 * surface. Each centreline segment becomes a terrain-riding quad, forge-skinned
 * with the CoD `asphalt` PBR set (albedo + normal + ORM) — the same bake the
 * buildings use. Flat dark fallback when there's no live renderer (unit test).
 *
 * Normals are forced +Y (roads are near-horizontal) and the material is
 * DoubleSide, so lighting is correct regardless of per-segment winding.
 */
export default function Roads({
  streets,
  grid,
  manifest,
}: {
  streets: Street[];
  grid: TerrainGrid;
  manifest: Manifest;
}) {
  const geometry = useMemo(() => {
    const minE = minElevation(grid);
    const yAt = (x: number, z: number) =>
      elevationAt(grid, manifest, x, z) - minE + ROAD_LIFT;
    const half = ROAD_WIDTH / 2;
    const positions: number[] = [];
    const uvs: number[] = [];
    for (const s of streets) {
      const p = s.pts;
      for (let i = 0; i + 3 < p.length; i += 2) {
        const x0 = p[i],
          z0 = p[i + 1],
          x1 = p[i + 2],
          z1 = p[i + 3];
        let dx = x1 - x0,
          dz = z1 - z0;
        const len = Math.hypot(dx, dz);
        if (len < 1e-3) continue;
        dx /= len;
        dz /= len;
        // Perpendicular offset in XZ (road half-width to each side).
        const nx = -dz * half,
          nz = dx * half;
        // Corners: A=left@start B=right@start C=left@end D=right@end.
        const aX = x0 + nx,
          aZ = z0 + nz,
          bX = x0 - nx,
          bZ = z0 - nz,
          cX = x1 + nx,
          cZ = z1 + nz,
          dX = x1 - nx,
          dZ = z1 - nz;
        const aY = yAt(aX, aZ),
          bY = yAt(bX, bZ),
          cY = yAt(cX, cZ),
          dY = yAt(dX, dZ);
        // Two triangles (A,B,C) + (C,B,D).
        positions.push(aX, aY, aZ, bX, bY, bZ, cX, cY, cZ);
        positions.push(cX, cY, cZ, bX, bY, bZ, dX, dY, dZ);
        // Planar top-down UVs in metres → the asphalt tiles by `repeat`.
        uvs.push(aX, aZ, bX, bZ, cX, cZ);
        uvs.push(cX, cZ, bX, bZ, dX, dZ);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    // Roads are near-horizontal — a flat +Y normal keeps lighting right under
    // DoubleSide without depending on triangle winding.
    const n = new Float32Array(positions.length);
    for (let i = 1; i < n.length; i += 3) n[i] = 1;
    g.setAttribute('normal', new Float32BufferAttribute(n, 3));
    return g;
  }, [streets, grid, manifest]);

  // Forge-skin with the CoD `asphalt` PBR set (mirrors Buildings' bake: live
  // renderer required, render-target save/restore, flat fallback under the
  // mocked-Canvas unit test). Baked once.
  const gl = useThree((s) => s.gl);
  const forgeRef = useRef<MaterialSystem | null>(null);
  const material = useMemo(() => {
    const flat = () =>
      new MeshStandardMaterial({
        color: 0x30323a,
        roughness: 0.96,
        metalness: 0,
        side: DoubleSide,
      });
    if (!gl) return flat();
    try {
      if (!forgeRef.current) {
        const forge = new MaterialSystem({ renderer: gl });
        void forge.init({});
        forgeRef.current = forge;
      }
      const prevRT = gl.getRenderTarget();
      const prevAutoClear = gl.autoClear;
      const set = forgeRef.current.getTextureSet('asphalt');
      gl.setRenderTarget(prevRT);
      gl.autoClear = prevAutoClear;
      if (!set || !set.albedo) return flat();
      const maxAniso = gl.capabilities.getMaxAnisotropy();
      // UVs are planar metres; ~4 m per tile reads like real asphalt aggregate.
      const rep = 1 / 4;
      for (const t of [set.albedo, set.normal, set.orm]) {
        if (!t) continue;
        t.wrapS = RepeatWrapping;
        t.wrapT = RepeatWrapping;
        t.repeat.set(rep, rep);
        t.anisotropy = maxAniso;
      }
      return new MeshStandardMaterial({
        map: set.albedo,
        normalMap: set.normal,
        roughnessMap: set.orm, // ORM: roughness in .g
        metalnessMap: set.orm, // ORM: metalness in .b
        roughness: 1,
        metalness: 0,
        side: DoubleSide,
      });
    } catch (err) {
      console.warn('[Roads] forge skin failed; flat fallback', err);
      return flat();
    }
  }, [gl]);

  useEffect(
    () => () => {
      forgeRef.current?.dispose();
      forgeRef.current = null;
    },
    []
  );

  return <mesh geometry={geometry} material={material} receiveShadow />;
}
