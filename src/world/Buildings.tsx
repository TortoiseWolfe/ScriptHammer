'use client';
import { useEffect, useMemo, useRef } from 'react';
import {
  Shape,
  ExtrudeGeometry,
  BufferGeometry,
  BufferAttribute,
  Color,
  MeshStandardMaterial,
  RepeatWrapping,
  type Mesh,
} from 'three';
import { useThree } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MaterialSystem } from '@/lib/cod';
import type { Building, TerrainGrid, Manifest } from '@/lib/manifest';
import { ringToShape } from './geometry';
import { elevationAt, minElevation } from './terrainSample';

export interface BuildingPalette {
  bricks: number[];
}

function extrude(
  b: Building,
  grid: TerrainGrid,
  manifest: Manifest,
  minE: number
): BufferGeometry {
  const { center, localRing } = ringToShape(b.ring);
  const shape = new Shape();
  // N↔S mirror fix: Terrain builds its plane north-positive (plane +Y = north)
  // then rotateX(-π/2), so the drape's north sits at world −Z (matching ENU,
  // where north = −z). The extrude Shape must use the SAME sign. Feeding the raw
  // ENU z as shape-Y and then applying the same rotateX(-π/2) lands each vertex
  // at worldZ = 2·cz − z — every mass reflected N↔S about its own centroid
  // (centroid correct, orientation mirrored; reads as a rotation on the
  // off-cardinal downtown grid). So negate the shape's Y (ENU z) so shape-north
  // maps to world +Z like the drape, and REVERSE the ring order to undo the
  // winding flip the reflection causes — otherwise the extruded walls face
  // inward (inside-out buildings).
  // N↔S mirror fix: Terrain builds its plane north-positive (plane +Y = north)
  // then rotateX(-π/2), so the drape's north sits at world −Z (matching ENU,
  // where north = −z). The extrude Shape must use the SAME sign. Feeding the raw
  // ENU z as shape-Y and then applying the same rotateX(-π/2) lands each vertex
  // at worldZ = 2·cz − z — every mass reflected N↔S about its own centroid
  // (centroid correct, orientation mirrored; reads as a rotation on the
  // off-cardinal downtown grid). So negate the shape's Y (ENU z) so shape-north
  // maps to world +Z like the drape, and REVERSE the ring order to undo the
  // winding flip the reflection causes — otherwise the extruded walls face
  // inward (inside-out buildings).
  const outline = [...localRing].reverse();
  outline.forEach(([x, z], i) =>
    i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)
  );
  shape.closePath();
  // Extrude along +Z by default: build in the shape's local XY then rotate
  // so the extrusion depth maps to world +Y (buildings stand upright).
  const geo = new ExtrudeGeometry(shape, {
    depth: b.height,
    bevelEnabled: false,
  });
  geo.rotateX(-Math.PI / 2); // shape's Y -> world Z; extrude depth -> world +Y
  // Seat the building base at the LOWEST terrain under its footprint (ring
  // vertices + centroid), normalized to the same Y=0 floor the Terrain mesh
  // uses. Seating at the centroid alone left downhill corners hanging in the
  // air on sloped lots (~55 m of relief across the corridor) — a big part of
  // the perceived "floating buildings" (#225/#229). Seating at the minimum
  // embeds the uphill side slightly, which is how real buildings cut into a
  // slope.
  let groundE = elevationAt(grid, manifest, center[0], center[1]);
  for (let i = 0; i < b.ring.length; i += 2) {
    const e = elevationAt(grid, manifest, b.ring[i], b.ring[i + 1]);
    if (e < groundE) groundE = e;
  }
  geo.translate(center[0], groundE - minE, center[1]);
  return geo;
}

export default function Buildings({
  buildings,
  palette,
  grid,
  manifest,
  opacity = 1,
  onMeshReady,
}: {
  buildings: Building[];
  palette: BuildingPalette;
  grid: TerrainGrid;
  manifest: Manifest;
  /** Layer fade (registration checks against the aerial); 1 = opaque. */
  opacity?: number;
  /** Hands the merged buildings mesh to the composition root once built, so a
   *  physics layer (Walk-mode collision, #226) can bake it into a BVH. Fires
   *  whenever the merged geometry changes. */
  onMeshReady?: (mesh: Mesh) => void;
}) {
  const meshRef = useRef<Mesh>(null);
  const { geometry } = useMemo(() => {
    // Fake contact ambient-occlusion: darken each building's vertices from
    // AO_FLOOR at its base up to full colour by AO_HEIGHT metres — cheap
    // seated-on-the-ground depth now that the real-time cast shadows are gone.
    // The vertex colour IS the wall albedo (no map), so scaling it darkens the
    // base directly; zero shader work, zero per-frame cost.
    const AO_HEIGHT = 4;
    const AO_FLOOR = 0.5;
    const minE = minElevation(grid);
    const nonHero = buildings.filter((b) => !b.swap);
    const geos = nonHero.map((b) => {
      const g = extrude(b, grid, manifest, minE);
      const c = new Color(palette.bricks[b.id % palette.bricks.length]);
      const pos = g.attributes.position;
      const count = pos.count;
      g.computeBoundingBox();
      const baseY = g.boundingBox!.min.y; // extrude seats the base here
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const k =
          AO_FLOOR +
          (1 - AO_FLOOR) * Math.min(1, (pos.getY(i) - baseY) / AO_HEIGHT);
        colors[i * 3] = c.r * k;
        colors[i * 3 + 1] = c.g * k;
        colors[i * 3 + 2] = c.b * k;
      }
      g.setAttribute('color', new BufferAttribute(colors, 3));
      return g;
    });
    return {
      geometry: geos.length
        ? mergeGeometries(geos, false)
        : new BufferGeometry(),
    };
  }, [buildings, palette, grid, manifest]);

  // Publish the merged mesh for the physics layer (#226). Keyed on `geometry`
  // so a rebuild (new footprints) hands over a fresh mesh; guarded on the ref so
  // the faded-out (opacity 0, unmounted) frames never emit a stale handle.
  useEffect(() => {
    if (meshRef.current && onMeshReady) onMeshReady(meshRef.current);
  }, [geometry, onMeshReady]);

  // Skin the buildings with the CoD procedural-PBR forge for brick RELIEF
  // (normalMap + ORM roughness) while the WALL COLOUR comes from the per-building
  // `vertexColors` tint (the palette brick). The brick *albedo* map is deliberately
  // NOT used: multiplying that dark brick albedo (linear ~0.03–0.15) by the warm
  // tint drove every mass to ~(0.07,0.015,0.004) — near-black, and the same hue as
  // the aerial ground, so the whole city vanished at street level (regression from
  // the "brick city" change). Dropping the albedo restores the bright, visible
  // palette colour the masses had before, and the normal/roughness keep the façade
  // texture. The forge needs a live renderer, so the mocked-Canvas unit test (no
  // gl) falls back to the flat material. Bakes once. Mirrors CodSkeleton's
  // render-target save/restore. Stays UNCONDITIONALLY transparent so the opacity
  // fade can recompile-free (see the old note).
  const gl = useThree((s) => s.gl);
  const forgeRef = useRef<MaterialSystem | null>(null);
  const material = useMemo(() => {
    const flat = () =>
      new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.92,
        metalness: 0,
        transparent: true,
        opacity,
      });
    if (!gl) return flat();
    try {
      if (!forgeRef.current) {
        const forge = new MaterialSystem({ renderer: gl });
        void forge.init({}); // synchronous body → full bake
        forgeRef.current = forge;
      }
      const prevRT = gl.getRenderTarget();
      const prevAutoClear = gl.autoClear;
      const set = forgeRef.current.getTextureSet('brick');
      gl.setRenderTarget(prevRT);
      gl.autoClear = prevAutoClear;
      if (!set || !set.albedo) return flat();
      const maxAniso = gl.capabilities.getMaxAnisotropy();
      // UVs are in metres (ExtrudeGeometry over metre footprints); ~3 m per tile
      // reads like a real façade. Tune `rep` if bricks look too big / small.
      const rep = 1 / 3;
      // Tile only the relief maps — the albedo is intentionally unused (see note).
      for (const t of [set.normal, set.orm]) {
        if (!t) continue;
        t.wrapS = RepeatWrapping;
        t.wrapT = RepeatWrapping;
        t.repeat.set(rep, rep);
        t.anisotropy = maxAniso;
      }
      return new MeshStandardMaterial({
        // No `map`: the vertexColors tint IS the wall colour (bright, visible);
        // the dark brick albedo would multiply it to near-black.
        normalMap: set.normal,
        roughnessMap: set.orm, // ORM: roughness in .g
        metalnessMap: set.orm, // ORM: metalness in .b
        vertexColors: true,
        roughness: 1,
        metalness: 0,
        transparent: true,
        opacity,
      });
    } catch (err) {
      console.warn('[Buildings] forge skin failed; flat fallback', err);
      return flat();
    }
  }, [gl, opacity]);

  useEffect(
    () => () => {
      forgeRef.current?.dispose();
      forgeRef.current = null;
    },
    []
  );

  if (opacity <= 0) return null;
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      castShadow={opacity >= 1}
      receiveShadow
    />
  );
}
