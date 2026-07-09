'use client';
// Premium as-built scan (#234): renders a twin's house/model.glb at its
// house.json anchor. Scan meshes are open shells with mixed winding, so
// materials render DoubleSide; the model auto-grounds (bbox bottom seated on
// the terrain at the anchor) with yOffset as the fine-tune.
import { useMemo } from 'react';
import { Box3, DoubleSide, Vector3 } from 'three';
import type { Mesh, MeshStandardMaterial } from 'three';
import { useGLTF } from '@react-three/drei';
import { siteAssetUrl } from '@/lib/manifest';
import type { HouseInfo, Manifest, TerrainGrid } from '@/lib/manifest';
import { elevationAt, minElevation } from './terrainSample';

export default function HouseModel({
  slug,
  house,
  grid,
  manifest,
}: {
  slug: string;
  house: HouseInfo;
  grid: TerrainGrid;
  manifest: Manifest;
}) {
  const { scene } = useGLTF(siteAssetUrl(slug, 'house/model.glb'));

  const { groundY, bottomY } = useMemo(() => {
    scene.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const m of mats) (m as MeshStandardMaterial).side = DoubleSide;
      }
    });
    const box = new Box3().setFromObject(scene);
    return {
      groundY:
        elevationAt(grid, manifest, house.x, house.z) - minElevation(grid),
      bottomY: box.min.y,
    };
  }, [scene, grid, manifest, house.x, house.z]);

  const scale = house.scale ?? 1;
  return (
    <primitive
      object={scene}
      position={[
        house.x,
        groundY - bottomY * scale + (house.yOffset ?? 0),
        house.z,
      ]}
      rotation={[0, ((house.rotationDeg ?? 0) * Math.PI) / 180, 0]}
      scale={scale}
    />
  );
}
