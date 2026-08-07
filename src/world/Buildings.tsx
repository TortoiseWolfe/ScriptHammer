'use client';
import { useEffect, useMemo, useRef } from 'react';
import {
  Shape,
  ExtrudeGeometry,
  BufferGeometry,
  BufferAttribute,
  Color,
  type Mesh,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
    const minE = minElevation(grid);
    const nonHero = buildings.filter((b) => !b.swap);
    const geos = nonHero.map((b) => {
      const g = extrude(b, grid, manifest, minE);
      const c = new Color(palette.bricks[b.id % palette.bricks.length]);
      const count = g.attributes.position.count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
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

  if (opacity <= 0) return null;
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      castShadow={opacity >= 1}
      receiveShadow
    >
      {/* UNCONDITIONALLY transparent: three bakes an OPAQUE define into the
          program when a material mounts with transparent=false, and flipping
          `transparent` at runtime never recompiles — the fade would silently
          no-op until a full unmount/remount cycle. One merged mesh, so the
          transparent-pass sorting cost is nil. depthWrite stays on while
          fading: self-overlap artifacts are acceptable for a diagnostic layer
          and it avoids sort popping. Shadows drop while faded so a ghosted
          layer doesn't cast solid shadows on the aerial. */}
      <meshStandardMaterial
        vertexColors
        roughness={0.92}
        metalness={0}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}
