'use client';
import { useMemo } from 'react';
import {
  Shape,
  ExtrudeGeometry,
  BufferGeometry,
  BufferAttribute,
  Color,
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
  localRing.forEach(([x, z], i) =>
    i === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z)
  );
  shape.closePath();
  // Extrude along +Z by default: build in the shape's local XY then rotate
  // so the extrusion depth maps to world +Y (buildings stand upright).
  const geo = new ExtrudeGeometry(shape, {
    depth: b.height,
    bevelEnabled: false,
  });
  geo.rotateX(-Math.PI / 2); // shape's Y -> world Z; extrude depth -> world +Y
  // Seat the building base on the terrain at its own centroid (normalized to the
  // same Y=0 floor the Terrain mesh uses), so it sits ON the topology, not below it.
  const groundY = elevationAt(grid, manifest, center[0], center[1]) - minE;
  geo.translate(center[0], groundY, center[1]);
  return geo;
}

export default function Buildings({
  buildings,
  palette,
  grid,
  manifest,
}: {
  buildings: Building[];
  palette: BuildingPalette;
  grid: TerrainGrid;
  manifest: Manifest;
}) {
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

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.92} metalness={0} />
    </mesh>
  );
}
