'use client';
import { useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { Street, TerrainGrid, Manifest } from '@/lib/manifest';
import { elevationAt, minElevation } from './terrainSample';

export default function Streets({
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
    // Ride the terrain: each street vertex sits at the ground elevation (same
    // Y=0 normalization as Terrain/Buildings) + a small lift so the lines don't
    // z-fight with the draped surface.
    const y = (x: number, z: number) =>
      elevationAt(grid, manifest, x, z) - minE + 0.6;
    const verts: number[] = [];
    for (const s of streets) {
      for (let i = 0; i + 3 < s.pts.length; i += 2) {
        verts.push(
          s.pts[i],
          y(s.pts[i], s.pts[i + 1]),
          s.pts[i + 1],
          s.pts[i + 2],
          y(s.pts[i + 2], s.pts[i + 3]),
          s.pts[i + 3]
        );
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(verts, 3));
    return g;
  }, [streets, grid, manifest]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={0x9c9384} />
    </lineSegments>
  );
}
