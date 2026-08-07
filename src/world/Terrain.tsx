'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { PlaneGeometry, Texture, type Mesh } from 'three';
import type { TerrainGrid, Manifest } from '@/lib/manifest';
import { bilinear, assertExtent, minElevation } from './terrainSample';
import { materialKit } from '@/stage/materialKit';

export default function Terrain({
  grid,
  drape,
  manifest,
  onMeshReady,
}: {
  grid: TerrainGrid;
  drape: Texture;
  manifest: Manifest;
  /** Hands the displaced ground mesh to the composition root once built, so a
   *  physics layer (Walk-mode gravity/step/slope, #226) can bake it as the floor.
   *  Fires whenever the geometry rebuilds. */
  onMeshReady?: (mesh: Mesh) => void;
}) {
  const meshRef = useRef<Mesh>(null);
  const geometry = useMemo(() => {
    const w = manifest.groundWm,
      h = manifest.groundHm;
    assertExtent(manifest, w, h); // fail loud if the box/mpp changed under us
    const g = new PlaneGeometry(w, h, grid.cols - 1, grid.rows - 1);
    const pos = g.attributes.position;
    // Normalize so the lowest ground sits at Y=0 (raw elevations are ~194-249m;
    // buildings/heroes/streets subtract the SAME minE so everything is coupled).
    const minE = minElevation(grid);
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / w + 0.5; // W->E
      const v = pos.getY(i) / h + 0.5; // S->N (plane Y before rotate)
      pos.setZ(i, bilinear(grid, u, v) - minE); // displace, normalized to Y=0 floor
    }
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, [grid, manifest]);

  // Anisotropic filtering keeps the aerial sharp at grazing street-level angles.
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const material = useMemo(
    () => materialKit.drapedGround(drape, maxAniso),
    [drape, maxAniso]
  );

  // Publish the ground mesh for the physics floor (#226). Keyed on `geometry` so
  // a rebuild hands over the fresh mesh; guarded on the ref.
  useEffect(() => {
    if (meshRef.current && onMeshReady) onMeshReady(meshRef.current);
  }, [geometry, onMeshReady]);

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} receiveShadow />
  );
}
