'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { PlaneGeometry, Texture, type Mesh } from 'three';
import type { TerrainGrid, Manifest } from '@/lib/manifest';
import { bilinear, assertExtent, minElevation } from './terrainSample';
import { materialKit } from '@/stage/materialKit';
import {
  worldToGridUv,
  tileSegments,
  tilePlacement,
  tilingCoversExtent,
  type DrapeTiling,
} from './groundTiles';

export default function Terrain({
  grid,
  drape,
  tiling,
  tileTextures,
  manifest,
  onMeshReady,
}: {
  grid: TerrainGrid;
  /** Single full-extent aerial. Always required — it is the fallback, and the
   *  physics floor is built whether or not tiles are in play. */
  drape: Texture;
  /** Tiled aerial (#1176). When present AND its extent matches the scene, the
   *  visible ground is drawn from these instead of `drape`, which removes the
   *  8192px single-texture ceiling on drape resolution. */
  tiling?: DrapeTiling | null;
  /** Tile textures, keyed by the tile's `path`. A tile with no texture yet
   *  simply is not drawn, so a slow network degrades to holes over the fallback
   *  rather than to a black ground. */
  tileTextures?: Map<string, Texture> | null;
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

  // Tiles are used only when they demonstrably cover THIS scene. A tiling baked
  // against a different extent yields real imagery at wrong world rectangles —
  // a plausible-looking place that is wrong everywhere, which is worse than
  // blurry. See tilingCoversExtent.
  const tiled = useMemo(() => {
    if (!tileTextures?.size) return null;
    if (!tilingCoversExtent(tiling, manifest.groundWm, manifest.groundHm))
      return null;
    const W = manifest.groundWm,
      H = manifest.groundHm;
    const minE = minElevation(grid);
    return tiling!.tiles
      .map((t) => {
        const tex = tileTextures.get(t.path);
        if (!tex) return null;
        const { cx, cz, width, depth } = tilePlacement(t.world);
        const { segX, segY } = tileSegments(
          t.world,
          W,
          H,
          grid.cols,
          grid.rows
        );
        const g = new PlaneGeometry(width, depth, segX, segY);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          // Sample by WORLD position, never tile-local — this is what makes two
          // neighbours agree on their shared edge. rotateX(-PI/2) sends local
          // +Y to world -Z, so worldZ = cz - localY.
          const { u, v } = worldToGridUv(
            cx + pos.getX(i),
            cz - pos.getY(i),
            W,
            H
          );
          pos.setZ(i, bilinear(grid, u, v) - minE);
        }
        g.rotateX(-Math.PI / 2);
        g.computeVertexNormals();
        return { key: t.path, geometry: g, cx, cz, tex };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [tiling, tileTextures, grid, manifest]);

  const tileMaterials = useMemo(
    () => tiled?.map((t) => materialKit.drapedGround(t.tex, maxAniso)) ?? null,
    [tiled, maxAniso]
  );

  // The full-extent mesh is ALWAYS mounted, because #226's physics floor is one
  // mesh and splitting it would change that contract. When tiles are drawn it
  // is invisible — `visible={false}` skips the draw entirely, so the cost is
  // one heightfield geometry, not a second pass over the scene.
  return (
    <>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        receiveShadow
        visible={!tiled}
      />
      {tiled?.map((t, i) => (
        <mesh
          key={t.key}
          geometry={t.geometry}
          material={tileMaterials![i]}
          position={[t.cx, 0, t.cz]}
          receiveShadow
        />
      ))}
    </>
  );
}
