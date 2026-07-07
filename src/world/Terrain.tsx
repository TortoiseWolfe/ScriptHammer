'use client';
import { useMemo } from 'react';
import { PlaneGeometry, Texture } from 'three';
import type { TerrainGrid, Manifest } from '@/lib/manifest';
import { bilinear, assertExtent } from './terrainSample';
import { materialKit } from '@/stage/materialKit';

export default function Terrain({
  grid,
  drape,
  manifest,
}: {
  grid: TerrainGrid;
  drape: Texture;
  manifest: Manifest;
}) {
  const geometry = useMemo(() => {
    const w = manifest.groundWm,
      h = manifest.groundHm;
    assertExtent(manifest, w, h); // fail loud if the box/mpp changed under us
    const g = new PlaneGeometry(w, h, grid.cols - 1, grid.rows - 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / w + 0.5; // W->E
      const v = pos.getY(i) / h + 0.5; // S->N (plane Y before rotate)
      pos.setZ(i, bilinear(grid, u, v)); // displace along plane normal
    }
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, [grid, manifest]);

  const material = useMemo(() => materialKit.drapedGround(drape), [drape]);
  return <mesh geometry={geometry} material={material} receiveShadow />;
}
