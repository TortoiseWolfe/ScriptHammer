'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { ImageBitmapLoader } from 'three';
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
  tileUrl,
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
  /** Where a tile's pixels come from. Decoupled from Terrain on purpose: it is
   *  a baked file for one caller and a live county /export for another, and the
   *  renderer should not know or care which. */
  tileUrl?: (tile: {
    path: string;
    world: [number, number, number, number];
  }) => string;
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
  // 700 m rather than 1800: tiles are ~161 m now (sized so 1024px reaches the
  // source's native 0.1588 m/px), not the 483 m a baked raster happened to cut.
  // A radius tuned for big tiles fetches nine times as many small ones for
  // ground the camera cannot resolve anyway.
  const RADIUS_M = 700;
  const IN_FLIGHT = 6;
  const [tileTextures, setTileTextures] = useState<Map<string, Texture>>(
    () => new Map()
  );
  const wanted = useRef<Set<string>>(new Set());
  const loading = useRef(0);
  /**
   * ImageBitmapLoader, not TextureLoader.
   *
   * MEASURED, not assumed. Driving the camera for 30 s with TextureLoader: 184
   * frames over 250 ms, and 125 of them — 68% — landed within 400 ms of a tile
   * finishing. TextureLoader decodes JPEG through an <img> ON THE MAIN THREAD,
   * so every arriving tile stalls the frame it lands in. That is the periodic
   * hitch felt when walking into new ground, and it is not the network: the
   * fetches are async and never blocked anything.
   *
   * createImageBitmap decodes off-thread and hands back something the GPU can
   * take directly. `imageOrientation: 'flipY'` does the flip the loader would
   * otherwise make three do on the main thread as well.
   */
  const loader = useMemo(() => {
    const l = new ImageBitmapLoader();
    // The live source is a different origin. Without this the texture uploads
    // as a tainted canvas in some browsers and draws black, silently.
    l.setCrossOrigin('anonymous');
    l.setOptions({ imageOrientation: 'flipY' });
    return l;
  }, []);
  const camera = useThree((s) => s.camera);

  /** Decoded and waiting for their one-per-frame turn to be uploaded. */
  const ready = useRef<[string, ImageBitmap][]>([]);

  useFrame(() => {
    // Promote at most ONE decoded tile per frame. This is the whole point of
    // the queue — see the comment at the push site.
    const pending = ready.current.shift();
    if (pending) {
      const [path, bitmap] = pending;
      const tex = new Texture(bitmap as unknown as HTMLImageElement);
      tex.needsUpdate = true;
      setTileTextures((prev) => new Map(prev).set(path, tex));
      return; // do not also start a fetch in the same frame
    }
    if (!tiling || !tileUrl || loading.current >= IN_FLIGHT) return;
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
      .loadAsync(tileUrl(next))
      // Decoded bitmaps QUEUE rather than mounting immediately. Uploading a
      // texture to the GPU happens on its first draw and costs a frame, so
      // three finishing together cost three in one frame. The queue is drained
      // one per frame below, which trades a few frames of latency for a stall
      // the eye reads as a hitch.
      .then((bitmap) => {
        ready.current.push([next.path, bitmap as unknown as ImageBitmap]);
      })
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
  /**
   * Tile geometry, built ONCE per tile and cached.
   *
   * WHY. The first version rebuilt every loaded tile's PlaneGeometry — every
   * vertex displaced through the heightfield, then computeVertexNormals — on
   * every texture arrival, because `tileTextures` was a useMemo dependency and
   * a new Map lands on each load. With N tiles loaded that is O(N) full
   * geometry builds per tile, so O(N^2) over a walk. It also swept all 2,397
   * grid entries each pass to find the loaded handful.
   *
   * Measured before the fix, driving the camera for 45 s: worst frame 4,650 ms,
   * 28 frames over 250 ms. That is the periodic hitch you feel crossing into
   * new tiles, and it is not the network — the fetches are async and never
   * blocked anything.
   *
   * The cache is keyed by tile path and cleared only when the SURFACE changes
   * (the grid, the extent, the tiling), never when imagery arrives.
   */
  const geomCache = useRef(new Map<string, PlaneGeometry>());
  const tileByPath = useMemo(
    () => new Map((tiling?.tiles ?? []).map((t) => [t.path, t])),
    [tiling]
  );

  useEffect(() => {
    const cache = geomCache.current;
    return () => {
      // Geometries hold GPU buffers; dropping the Map alone leaks them.
      cache.forEach((g) => g.dispose());
      cache.clear();
    };
  }, [tiling, grid, manifest]);

  const surfaceOk = tilingCoversExtent(
    tiling,
    manifest.groundWm,
    manifest.groundHm
  );

  const tiled = useMemo(() => {
    if (!tileTextures.size || !surfaceOk) return null;
    const W = manifest.groundWm,
      H = manifest.groundHm;
    const minE = minElevation(grid);
    const out: {
      key: string;
      geometry: PlaneGeometry;
      cx: number;
      cz: number;
      tex: Texture;
    }[] = [];
    // Iterate what is LOADED, not the whole grid.
    for (const [path, tex] of tileTextures) {
      const t = tileByPath.get(path);
      if (!t) continue;
      const { cx, cz, width, depth } = tilePlacement(t.world);
      let g = geomCache.current.get(path);
      if (!g) {
        const { segX, segY } = tileSegments(
          t.world,
          W,
          H,
          grid.cols,
          grid.rows
        );
        g = new PlaneGeometry(width, depth, segX, segY);
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
        geomCache.current.set(path, g);
      }
      out.push({ key: path, geometry: g, cx, cz, tex });
    }
    return out;
  }, [tileTextures, tileByPath, surfaceOk, grid, manifest]);

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

  // The full-extent mesh is ALWAYS mounted AND ALWAYS DRAWN. It is #226's
  // physics floor (one mesh — splitting it would change that contract) and it
  // is also the far level of the pyramid: tiles arrive over time and only
  // within a radius, so everywhere without one yet shows this underneath.
  //
  // An earlier version hid it as soon as the first tile arrived. On screen that
  // is not subtle — the ground vanishes, the full-extent water plane shows
  // through, and the city reads as floating on an empty blue sea with a few
  // scraps of aerial at the edges.
  //
  // It is also the whole resilience story for the live imagery: the county host
  // is a `mapsdev` box with no SLA, and if it goes away every tile fetch fails
  // and this is what the visitor sees instead of a hole.
  return (
    <>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        receiveShadow
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
