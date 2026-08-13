'use client';
// Warehouse-sampled buildings (#259): renders a twin's models/*.glb at their
// models.json ENU anchors. Each GLB is an abstracted 3D Warehouse landmark
// (sampling pass: scripts/warehouse/abstract-glb.mjs) carrying three named
// LOD nodes (LOD0/LOD1/LOD2) that drei's <Detailed> switches by camera
// distance. Grounding follows the HouseModel pattern: bbox bottom seated on
// the terrain at the anchor, yOffset as the fine-tune.
//
// CLONE-ON-MOUNT (iter-4 review C1+C2): useGLTF returns a CACHED, SHARED
// gltf — mutating its materials (selection highlight) or re-parenting its
// nodes (<primitive>) corrupts the cache the moment a file is reused. Every
// instance therefore deep-clones the scene AND its materials up front;
// highlight mutation and re-parenting are then per-instance-safe.
//
// Live placement overrides (the Edit mode's localStorage state) merge via
// the SHARED applyOverrides from src/lib/placement.ts — the same function
// the emit stage uses, so the live preview and the emitted artifact are
// bit-identical (the review found the hand-copied version had already
// drifted on rounding).
//
// useGLTF is called with useDraco=false, useMeshopt=true — explicit intent:
// the GLBs are EXT_meshopt_compression (decoder bundled in three-stdlib, no
// public/ wasm, no CDN), and drei's default draco path points at a gstatic
// CDN this offline-capable static site must not depend on.
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Box3, Color, FrontSide, Group } from 'three';
import type { Mesh, MeshStandardMaterial, Object3D } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { siteAssetUrl } from '@/lib/manifest';
import type {
  Manifest,
  TerrainGrid,
  TwinPlacementOverride,
  WarehouseModelEntry,
  WarehouseModelsInfo,
} from '@/lib/manifest';
import { applyOverrides } from '@/lib/placement';
import { elevationAt, minElevation } from './terrainSample';

const LOD_NAMES = ['LOD0', 'LOD1', 'LOD2'] as const;
const HIGHLIGHT = new Color(0x66aaff);

/** Ref handle the editor's gizmo attaches to (the placed group). */
export type ModelGroupRegistry = (slug: string, group: Group | null) => void;

/**
 * Hands the placed group to whoever bakes collision (#702).
 *
 * SEPARATE FROM `ModelGroupRegistry` ON PURPOSE. That one is the editor gizmo's
 * attach point and only the SELECTED model reports through it — exactly one at a
 * time, usually none. Collision needs EVERY model, so reusing it would have given
 * the landmarks collision only while they were selected in the editor.
 *
 * The group, not the LOD mesh: the group carries the placement transform
 * (position/rotation/scale), and `bakeMesh` reads `matrixWorld`. Passing the raw
 * LOD would bake every landmark at the origin.
 */
export type ModelColliderRegistry = (slug: string, group: Group | null) => void;

function SampledBuilding({
  slug,
  entry,
  grid,
  manifest,
  selected,
  onSelect,
  registerGroup,
  registerCollider,
}: {
  slug: string;
  entry: WarehouseModelEntry;
  grid: TerrainGrid;
  manifest: Manifest;
  selected: boolean;
  onSelect?: (slug: string) => void;
  registerGroup?: ModelGroupRegistry;
  registerCollider?: ModelColliderRegistry;
}) {
  const gltf = useGLTF(siteAssetUrl(slug, `models/${entry.file}`), false, true);

  // Per-instance clone: scene graph AND materials (Object3D.clone shares
  // materials — both must clone for highlight mutation to be instance-safe).
  const { lods, bottomY } = useMemo(() => {
    const scene = gltf.scene.clone(true);
    scene.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        const cloned = mats.map((m) => {
          const c = (m as MeshStandardMaterial).clone();
          // FrontSide (#259 iter 6): the bake now removes SketchUp's reversed
          // duplicate faces (dedupe-faces.mjs), so the shell is a single
          // consistent layer. DoubleSide used to be needed to stop single-
          // sided walls vanishing, but it also rendered the interior/reversed
          // duplicates — the "shit faces at some angles". With the duplicates
          // gone, FrontSide culls backfaces correctly and the mess is gone.
          c.side = FrontSide;
          return c;
        });
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
        // Meshopt/quantized GLBs ship a wrong bounding volume → THREE frustum-
        // culls the model at some camera angles (it vanishes). Recompute from the
        // decoded positions so culling is correct and off-screen landmarks cull.
        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();
      }
    });
    const found = LOD_NAMES.map((n) => scene.getObjectByName(n)).filter(
      (o): o is Object3D => Boolean(o)
    );
    // A GLB without LOD nodes (foreign/hand-made) renders whole as one level.
    const lods = found.length === LOD_NAMES.length ? found : [scene];
    // Ground on LOD0's extent — all levels share the footprint.
    const box = new Box3().setFromObject(lods[0]);
    return { lods, bottomY: box.min.y };
  }, [gltf]);

  // Grounding recomputes when the editor nudges the anchor: the building
  // keeps its feet on the terrain as it moves.
  const groundY = useMemo(
    () => elevationAt(grid, manifest, entry.x, entry.z) - minElevation(grid),
    [grid, manifest, entry.x, entry.z]
  );

  // Selection highlight on the per-instance materials, with cleanup so an
  // unmount-while-selected never strands a tint.
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
        m.emissive.copy(selected ? HIGHLIGHT : new Color(0x000000));
        m.emissiveIntensity = selected ? 1.0 : 0;
      }
    }
    return () => {
      for (const m of mats) {
        if (m.emissive) {
          m.emissive.setHex(0x000000);
          m.emissiveIntensity = 0;
        }
      }
    };
  }, [lods, selected]);

  // Only the SELECTED building registers its group (the gizmo's attach
  // point). React flushes all effect cleanups before creates, so on a
  // selection switch the old building's null lands before the new group.
  const groupRef = useRef<Group>(null);
  useEffect(() => {
    if (!registerGroup || !selected) return;
    registerGroup(entry.slug, groupRef.current);
    return () => registerGroup(entry.slug, null);
  }, [registerGroup, entry.slug, selected]);

  // Collision (#702). NOT gated on `selected` — every landmark and bridge needs to
  // be solid, not just whichever one the editor has picked. Depends on `groundY`
  // so the collider is registered with the model's FINAL placement: the group is
  // grounded onto the terrain, and baking before that would put the collision
  // shell at the wrong height.
  useEffect(() => {
    if (!registerCollider) return;
    registerCollider(entry.slug, groupRef.current);
    return () => registerCollider(entry.slug, null);
  }, [registerCollider, entry.slug, groundY]);

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
  // (`delta`); a drag that ends on a building must not select it — but the
  // old 5px gate rejected nearly every real click after an orbit settle
  // (review: THE primary "edits don't apply" cause). 12px matches typical
  // click jitter while still excluding deliberate drags.
  const handleClick = onSelect
    ? (e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 12) return;
        e.stopPropagation();
        onSelect(entry.slug);
      }
    : undefined;

  // The OUTER group carries the placement transform in both branches — one
  // consistent attach point for selection, the highlight, and the gizmo.
  return (
    <group
      ref={groupRef}
      onClick={handleClick}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      {/* Render LOD0 directly. The abstraction bake's LOD1/LOD2 are unreliable
          and, for these models, ~equivalent to LOD0 (measured: no tri change when
          forced to LOD0), so drei <Detailed>'s per-frame distance switching over
          129 models was pure overhead — and a risk of showing a degenerate far
          level. LOD0 is the good level; show it at every distance. Off-screen ones
          cull (bounds recomputed above). */}
      <primitive object={lods[0]} />
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
  registerGroup,
  registerCollider,
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
  /** Lets the editor's gizmo find the selected building's group. */
  registerGroup?: ModelGroupRegistry;
  registerCollider?: ModelColliderRegistry;
}) {
  const placed = useMemo(
    () =>
      info.models
        .map((entry) => applyOverrides(entry, overrides?.[entry.slug]))
        .filter((e): e is WarehouseModelEntry => e !== null),
    [info.models, overrides]
  );
  return (
    <>
      {placed.map((entry) => (
        // Per-model boundary: the city streams in progressively instead of
        // all-or-nothing — one slow (or hung) GLB can no longer hold every
        // other building (and the editor's selection/gizmo) in fallback.
        <Suspense key={entry.slug} fallback={null}>
          <SampledBuilding
            slug={slug}
            entry={entry}
            grid={grid}
            manifest={manifest}
            selected={selected === entry.slug}
            onSelect={onSelect}
            registerGroup={registerGroup}
            registerCollider={registerCollider}
          />
        </Suspense>
      ))}
    </>
  );
}
