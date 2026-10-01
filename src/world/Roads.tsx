'use client';
import { useEffect, useMemo, useRef } from 'react';
import {
  BufferGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  RepeatWrapping,
} from 'three';
import { useThree } from '@react-three/fiber';
import { MaterialSystem } from '@/lib/cod';
import type { Street, TerrainGrid, Manifest } from '@/lib/manifest';
import { elevationAt, minElevation } from './terrainSample';
import { roadRibbon } from './roadRibbon';

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
 * Every triangle is wound to face up (`roadRibbon`), so the material is
 * FrontSide. It used to force +Y normals under DoubleSide on triangles that all
 * faced down, which three flips for a back-facing fragment — the roads got no
 * directional light at all (#1175).
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
    const { positions, uvs } = roadRibbon(streets, yAt, ROAD_WIDTH);
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    // Face normals from the (now upward) winding; a sloped segment tilts with
    // the terrain instead of being lit as if flat.
    g.computeVertexNormals();
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
