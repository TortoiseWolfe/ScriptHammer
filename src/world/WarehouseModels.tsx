'use client';
// Warehouse-sampled buildings (#259): renders a twin's models/*.glb at their
// models.json ENU anchors. Each GLB is an abstracted 3D Warehouse landmark
// (sampling pass: scripts/warehouse/abstract-glb.mjs) carrying three named
// LOD nodes (LOD0/LOD1/LOD2) that drei's <Detailed> switches by camera
// distance. Grounding follows the HouseModel pattern: bbox bottom seated on
// the terrain at the anchor, yOffset as the fine-tune.
//
// Iteration 2: live placement OVERRIDES (the ?edit editor's localStorage
// state) merge over the emitted entries — the same semantics as the durable
// scripts/warehouse/overrides-*.json merged at emit time (dx/dz add to the
// anchor; yaw/scale/yOffset replace; exclude hides). Selection highlights via
// emissive tint (safe: every model owns its GLB's materials, and LOD clones
// share them, so all levels highlight together).
//
// useGLTF is called with useDraco=false, useMeshopt=true — explicit intent:
// the GLBs are EXT_meshopt_compression (decoder bundled in three-stdlib, no
// public/ wasm, no CDN), and drei's default draco path points at a gstatic
// CDN this offline-capable static site must not depend on.
import { useEffect, useMemo } from 'react';
import { Box3, Color } from 'three';
import type { Mesh, MeshStandardMaterial, Object3D } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { Detailed, useGLTF } from '@react-three/drei';
import { siteAssetUrl } from '@/lib/manifest';
import type {
  Manifest,
  TerrainGrid,
  TwinPlacementOverride,
  WarehouseModelEntry,
  WarehouseModelsInfo,
} from '@/lib/manifest';
import { elevationAt, minElevation } from './terrainSample';

const LOD_NAMES = ['LOD0', 'LOD1', 'LOD2'] as const;
const LOD_DISTANCES = [0, 150, 400];
const HIGHLIGHT = new Color(0x3377ff);
const BLACK = new Color(0x000000);

/** Merge a live editor override onto an emitted entry (mirrors
 *  scripts/warehouse/lib.ts applyOverrides; null = excluded). */
export function mergeOverride(
  entry: WarehouseModelEntry,
  ov: TwinPlacementOverride | undefined
): WarehouseModelEntry | null {
  if (!ov) return entry;
  if (ov.exclude) return null;
  return {
    ...entry,
    x: entry.x + (ov.dx ?? 0),
    z: entry.z + (ov.dz ?? 0),
    yawDeg: ov.yawDeg ?? entry.yawDeg,
    scale: ov.scale ?? entry.scale,
    yOffset: ov.yOffset ?? entry.yOffset,
  };
}

function SampledBuilding({
  slug,
  entry,
  grid,
  manifest,
  selected,
  onSelect,
}: {
  slug: string;
  entry: WarehouseModelEntry;
  grid: TerrainGrid;
  manifest: Manifest;
  selected: boolean;
  onSelect?: (slug: string) => void;
}) {
  const gltf = useGLTF(siteAssetUrl(slug, `models/${entry.file}`), false, true);

  const { lods, bottomY } = useMemo(() => {
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
    return { lods, bottomY: box.min.y };
  }, [gltf]);

  // Grounding is recomputed when the editor nudges the anchor: the building
  // keeps its feet on the terrain as it moves.
  const groundY = useMemo(
    () => elevationAt(grid, manifest, entry.x, entry.z) - minElevation(grid),
    [grid, manifest, entry.x, entry.z]
  );

  // Selection highlight — emissive tint on this model's own materials.
  useEffect(() => {
    const mats = new Set<MeshStandardMaterial>();
    for (const lod of lods) {
      lod.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        for (const m of Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material]) {
          mats.add(m as MeshStandardMaterial);
        }
      });
    }
    for (const m of mats) {
      if (m.emissive) {
        m.emissive.copy(selected ? HIGHLIGHT : BLACK);
        m.emissiveIntensity = selected ? 0.4 : 0;
      }
    }
  }, [lods, selected]);

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
  // R3F's synthetic click carries screen-space movement since pointer-down
  // (`delta`); a drag that ends on a building must not select it. The Rig's
  // native drag listeners are a separate channel and unaffected either way.
  const handleClick = onSelect
    ? (e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 5) return;
        e.stopPropagation();
        onSelect(entry.slug);
      }
    : undefined;

  if (lods.length === 1) {
    return (
      <group onClick={handleClick}>
        <primitive
          object={lods[0]}
          position={position}
          rotation={rotation}
          scale={scale}
        />
      </group>
    );
  }
  return (
    <group onClick={handleClick}>
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
    </group>
  );
}

export default function WarehouseModels({
  slug,
  info,
  grid,
  manifest,
  overrides,
  selected,
  onSelect,
}: {
  slug: string;
  info: WarehouseModelsInfo;
  grid: TerrainGrid;
  manifest: Manifest;
  /** Live editor overrides (localStorage-backed), keyed by model slug. */
  overrides?: Record<string, TwinPlacementOverride>;
  /** Slug of the editor-selected building (emissive highlight). */
  selected?: string | null;
  onSelect?: (slug: string) => void;
}) {
  const placed = useMemo(
    () =>
      info.models
        .map((entry) => mergeOverride(entry, overrides?.[entry.slug]))
        .filter((e): e is WarehouseModelEntry => e !== null),
    [info.models, overrides]
  );
  return (
    <>
      {placed.map((entry) => (
        <SampledBuilding
          key={entry.slug}
          slug={slug}
          entry={entry}
          grid={grid}
          manifest={manifest}
          selected={selected === entry.slug}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}
