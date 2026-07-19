'use client';
// Premium as-built scan (#234): renders a twin's house/model.glb at its
// house.json anchor. Scan meshes are open shells with mixed winding, so
// materials render DoubleSide; the model auto-grounds (bbox bottom seated on
// the terrain at the anchor) with yOffset as the fine-tune.
//
// Multi-fragment captures: a Polycam PROJECT converts to one GLB with one
// named group per fragment (convert-scan.mjs --dae ... --dae ...), but each
// fragment keeps its own capture origin. house.json `parts` carries the
// measured registration per fragment (from the voxel-overlap search):
//   pos' = T(position) · RotY(−yawDeg) · T(−pivot)   — pivot = fragment
// vertex centroid, position = its registered location in the PRIMARY
// fragment's frame. Parts without an entry stay at their native origin.
import { useMemo } from 'react';
import { Box3, DoubleSide, Matrix4, Vector3 } from 'three';
import type { Mesh, MeshStandardMaterial, Object3D } from 'three';
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

  const { groundY, bottomY, centerX, centerZ } = useMemo(() => {
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
    // Seat registered fragments BEFORE measuring the grounding bbox — an
    // unplaced fragment at its capture origin would drag box.min.y down and
    // float the whole model.
    if (house.parts) {
      for (const [name, part] of Object.entries(house.parts)) {
        let target: Object3D | null = null;
        scene.traverse((o) => {
          if (o.name === name) target = o;
        });
        if (!target) {
          console.warn(`[house] parts["${name}"] has no matching GLB group`);
          continue;
        }
        const yaw = (part.yawDeg * Math.PI) / 180;
        const m = new Matrix4()
          .makeTranslation(part.position[0], part.position[1], part.position[2])
          .multiply(new Matrix4().makeRotationY(-yaw))
          .multiply(
            new Matrix4().makeTranslation(
              -part.pivot[0],
              -part.pivot[1],
              -part.pivot[2]
            )
          );
        (target as Object3D).matrixAutoUpdate = false;
        (target as Object3D).matrix.copy(m);
      }
      scene.updateMatrixWorld(true);
    }
    const box = new Box3().setFromObject(scene);
    return {
      groundY:
        elevationAt(grid, manifest, house.x, house.z) - minElevation(grid),
      bottomY: box.min.y,
      // Scan captures have an arbitrary origin (rarely the footprint centre), so
      // seating the raw origin at the anchor drops the house on the wrong corner.
      // Centre the footprint's XZ on the anchor instead (rotate about the house's
      // own centre), which — paired with a geocoded anchor — lands it true.
      centerX: (box.min.x + box.max.x) / 2,
      centerZ: (box.min.z + box.max.z) / 2,
    };
  }, [scene, grid, manifest, house.x, house.z, house.parts]);

  const scale = house.scale ?? 1;
  return (
    <group
      position={[house.x, groundY + (house.yOffset ?? 0), house.z]}
      rotation={[0, ((house.rotationDeg ?? 0) * Math.PI) / 180, 0]}
      scale={scale}
    >
      <primitive object={scene} position={[-centerX, -bottomY, -centerZ]} />
    </group>
  );
}
