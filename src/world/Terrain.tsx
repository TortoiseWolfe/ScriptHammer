'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { TextureLoader } from 'three';
import { siteAssetUrl } from '@/lib/manifest';
import { PlaneGeometry, Texture, type Mesh } from 'three';
import type { TerrainGrid, Manifest } from '@/lib/manifest';
import { bilinear, assertExtent, minElevation } from './terrainSample';
import { materialKit } from '@/stage/materialKit';
import {
  worldToGridUv,
  tileSegments,
  tilePlacement,
  tilingCoversExtent,
  tilesByPriority,
  type DrapeTiling,
} from './groundTiles';

export default function Terrain({
  grid,
  drape,
  tiling,
  tileSlug,
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
  /** Site slug, used to resolve tile URLs. Required when `tiling` is given. */
  tileSlug?: string;
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

  /**
   * Stream tile textures nearest-to-camera, a few at a time.
   *
   * NEVER BLOCKS. The downscaled `drape-wide.jpg` is already loaded and drawn,
   * so every tile that arrives is an upgrade over something already on screen.
   * The previous version awaited all 221 textures before rendering anything —
   * 55 MB of dead page — which is also wasted work, because the pulled-back
   * diorama camera resolves about 6 m/px on screen while these tiles are 0.5.
   *
   * RADIUS, not everything. Beyond it the fallback is indistinguishable at this
   * camera distance, so fetching more spends a visitor's bandwidth on pixels
   * they cannot see.
   */
  const RADIUS_M = 1800;
  const IN_FLIGHT = 4;
  const [tileTextures, setTileTextures] = useState<Map<string, Texture>>(
    () => new Map()
  );
  const wanted = useRef<Set<string>>(new Set());
  const loading = useRef(0);
  const loader = useMemo(() => new TextureLoader(), []);
  const camera = useThree((s) => s.camera);

  useFrame(() => {
    if (!tiling || !tileSlug || loading.current >= IN_FLIGHT) return;
    const next = tilesByPriority(
      tiling,
      camera.position.x,
      camera.position.z,
      RADIUS_M
    ).find((t) => !wanted.current.has(t.path));
    if (!next) return;
    wanted.current.add(next.path);
    loading.current += 1;
    loader
      .loadAsync(siteAssetUrl(tileSlug, `${tiling.dir}/${next.path}`))
      .then((tex) =>
        setTileTextures((prev) => new Map(prev).set(next.path, tex))
      )
      // A tile that will not load is simply never drawn, leaving the fallback
      // showing there. One blurry patch, not a black one — which is the failure
      // that matters, since a texture a device cannot take draws black silently.
      .catch(() => {})
      .finally(() => {
        loading.current -= 1;
      });
  });

  // Tiles are used only when they demonstrably cover THIS scene. A tiling baked
  // against a different extent yields real imagery at wrong world rectangles —
  // a plausible-looking place that is wrong everywhere, which is worse than
  // blurry. See tilingCoversExtent.
  const tiled = useMemo(() => {
    if (!tileTextures.size) return null;
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

  /**
   * polygonOffset, not a Y nudge. Tiles sit on the SAME displaced surface as
   * the fallback beneath them, so without a depth bias the two z-fight across
   * the whole city. Lifting the tiles in Y instead would make them float at
   * grazing street-level angles and break the physics floor's agreement with
   * what you see. A depth-buffer bias moves neither.
   */
  const tileMaterials = useMemo(
    () =>
      tiled?.map((t) => {
        const m = materialKit.drapedGround(t.tex, maxAniso);
        m.polygonOffset = true;
        m.polygonOffsetFactor = -1;
        m.polygonOffsetUnits = -1;
        return m;
      }) ?? null,
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
