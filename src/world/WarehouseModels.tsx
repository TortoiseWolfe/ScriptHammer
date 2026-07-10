'use client';
// Warehouse-sampled buildings (#259): renders a twin's models/*.glb at their
// models.json ENU anchors. Each GLB is an abstracted 3D Warehouse landmark
// (sampling pass: scripts/warehouse/abstract-glb.mjs) carrying three named
// LOD nodes (LOD0/LOD1/LOD2) that drei's <Detailed> switches by camera
// distance. Grounding follows the HouseModel pattern: bbox bottom seated on
// the terrain at the anchor, yOffset as the fine-tune.
//
// useGLTF is called with useDraco=false, useMeshopt=true — explicit intent:
// the GLBs are EXT_meshopt_compression (decoder bundled in three-stdlib, no
// public/ wasm, no CDN), and drei's default draco path points at a gstatic
// CDN this offline-capable static site must not depend on.
import { useMemo } from 'react';
import { Box3, Vector3 } from 'three';
import type { Mesh, Object3D } from 'three';
import { Detailed, useGLTF } from '@react-three/drei';
import { siteAssetUrl } from '@/lib/manifest';
import type {
  Manifest,
  TerrainGrid,
  WarehouseModelEntry,
  WarehouseModelsInfo,
} from '@/lib/manifest';
import { elevationAt, minElevation } from './terrainSample';

const LOD_NAMES = ['LOD0', 'LOD1', 'LOD2'] as const;
const LOD_DISTANCES = [0, 150, 400];

function SampledBuilding({
  slug,
  entry,
  grid,
  manifest,
}: {
  slug: string;
  entry: WarehouseModelEntry;
  grid: TerrainGrid;
  manifest: Manifest;
}) {
  const gltf = useGLTF(siteAssetUrl(slug, `models/${entry.file}`), false, true);

  const { lods, groundY, bottomY } = useMemo(() => {
    gltf.scene.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    const found = LOD_NAMES.map((n) => gltf.scene.getObjectByName(n)).filter(
      (o): o is Object3D => Boolean(o)
    );
    // A GLB without LOD nodes (foreign/hand-made) renders whole as one level.
    const lods = found.length === LOD_NAMES.length ? found : [gltf.scene];
    // Ground on LOD0's extent — all levels share the footprint.
    const box = new Box3().setFromObject(lods[0]);
    return {
      lods,
      groundY:
        elevationAt(grid, manifest, entry.x, entry.z) - minElevation(grid),
      bottomY: box.min.y,
    };
  }, [gltf, grid, manifest, entry.x, entry.z]);

  const scale = entry.scale ?? 1;
  const position: [number, number, number] = [
    entry.x,
    groundY - bottomY * scale + (entry.yOffset ?? 0),
    entry.z,
  ];
  const rotation: [number, number, number] = [
    0,
    ((entry.yawDeg ?? 0) * Math.PI) / 180,
    0,
  ];

  if (lods.length === 1) {
    return (
      <primitive
        object={lods[0]}
        position={position}
        rotation={rotation}
        scale={scale}
      />
    );
  }
  return (
    <Detailed
      distances={LOD_DISTANCES}
      hysteresis={0.1}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      {lods.map((o) => (
        <primitive key={o.name} object={o} />
      ))}
    </Detailed>
  );
}

export default function WarehouseModels({
  slug,
  info,
  grid,
  manifest,
}: {
  slug: string;
  info: WarehouseModelsInfo;
  grid: TerrainGrid;
  manifest: Manifest;
}) {
  return (
    <>
      {info.models.map((entry) => (
        <SampledBuilding
          key={entry.slug}
          slug={slug}
          entry={entry}
          grid={grid}
          manifest={manifest}
        />
      ))}
    </>
  );
}
