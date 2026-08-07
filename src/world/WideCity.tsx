'use client';
import { Suspense, useEffect, useState } from 'react';
import { TextureLoader, Texture, type Mesh } from 'three';
import { createProjection } from '@/lib/enu';
import { loadSiteJson, siteAssetUrl, loadHouse } from '@/lib/manifest';
import type {
  Building,
  TerrainGrid,
  Manifest,
  HouseInfo,
} from '@/lib/manifest';
import Buildings, { type BuildingPalette } from './Buildings';
import Terrain from './Terrain';
import HouseModel from './HouseModel';
import Water from './Water';
import { elevationAt, minElevation } from './terrainSample';

/** buildings-wide.json entry — raw WGS84 footprints (src/twin/cesium/overpass.ts
 *  `LiveBuilding`). `lonLat` is a FLAT [lon,lat,lon,lat,…] ring. */
interface WideLiveBuilding {
  id: number;
  lonLat: number[];
  heightM: number;
  rule: string;
}

interface WideData {
  grid: TerrainGrid;
  buildings: Building[];
  drape: Texture;
  wideManifest: Manifest;
  twin: { slug: string; house: HouseInfo } | null;
}

/**
 * The Three.js "abstraction of the Cesium map": the FULL `atlasBox` city
 * (`buildings-wide.json` + `terrain-wide.json`, draped in `drape-wide.jpg`) that
 * the Cesium atlas shows, drawn with the diorama's own extrude/terrain pipeline
 * — plus the East Main LiDAR house twin embedded at its true location. This is
 * what `/chatt?diorama` renders.
 *
 * Reuses `Terrain`/`Buildings`/`HouseModel` UNCHANGED by handing them a "wide
 * manifest" sized to the atlasBox. The twin comes from a DIFFERENT baked slug,
 * so its anchor is re-projected exhibit-ENU → lon/lat → this site's wide ENU
 * (`enu.ts` round-trip, offset-exact), and it grounds on this site's terrain.
 */
export default function WideCity({
  slug,
  manifest,
  palette,
  onError,
  onTwinPlaced,
  onGroundReady,
  onBuildingsMesh,
  onTerrainMesh,
}: {
  slug: string;
  manifest: Manifest;
  palette: BuildingPalette;
  onError?: (message: string) => void;
  /** Reports the embedded twin's wide-frame position + label once placed, so
   *  the HUD can offer an in-diorama fly-to instead of a separate page (#332). */
  onTwinPlaced?: (t: { x: number; z: number; label: string }) => void;
  /** Hands the composition root a terrain sampler (runtime Y at ENU x/z) once
   *  the wide grid loads — so Walk-mode ground-follow (and the trolley) ride ON
   *  the hills. The narrow TwinWorld path wires this too; the wide path did not
   *  until #226. */
  onGroundReady?: (groundAt: (x: number, z: number) => number) => void;
  /** Hands over the merged buildings mesh for Walk-mode BVH collision (#226). */
  onBuildingsMesh?: (mesh: Mesh) => void;
  /** Hands over the ground mesh for the Walk-mode physics floor (#226). */
  onTerrainMesh?: (mesh: Mesh) => void;
}) {
  const [data, setData] = useState<WideData | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [wide, grid, drape] = await Promise.all([
        loadSiteJson<WideLiveBuilding[]>(slug, 'buildings-wide.json'),
        loadSiteJson<TerrainGrid>(slug, 'terrain-wide.json'),
        new TextureLoader().loadAsync(siteAssetUrl(slug, 'drape-wide.jpg')),
      ]);
      // Project raw WGS84 → local ENU through the SAME shared transform the bake
      // used, origin = atlasBox centre, with the site's #233 vector offset so
      // footprints register on the wide drape (baked over this same projection).
      const atlasBox = manifest.atlasBox ?? manifest.box;
      const proj = createProjection(atlasBox, manifest.vectorOffsetM);
      const { widthM, depthM } = proj.groundSize();
      const wideManifest: Manifest = {
        ...manifest,
        groundWm: widthM,
        groundHm: depthM,
      };

      // Fold in the LiDAR exhibit twin, declared per-site in config (#332): the
      // site names its embedded exhibit slug + its true lat/lon, so no
      // embeddedTwin => no twin (other wide sites render none). A bonus layer —
      // a missing/failed exhibit must not blank the whole city, so best-effort.
      let twin: WideData['twin'] = null;
      let hide = new Set<number>();
      const embed = manifest.site.embeddedTwin;
      if (embed) {
        try {
          const twinHouse = await loadHouse(embed.slug);
          if (twinHouse) {
            // Anchor the scan by its TRUE location (config lat/lon), projected
            // into this wide frame. North is −Z in both frames, so rotationDeg
            // + the parts registration carry over unchanged.
            const [wx, wz] = proj.lonLatToEnu(embed.lon, embed.lat);
            twin = { slug: embed.slug, house: { ...twinHouse, x: wx, z: wz } };
            if (twinHouse.hideBuildingIds)
              hide = new Set(twinHouse.hideBuildingIds);
          }
        } catch (e) {
          console.warn('[WideCity] embedded twin skipped:', e);
        }
      }

      // Massing box under the scan steps aside so the two never z-fight (OSM ids
      // are global, so the exhibit's hideBuildingIds match in buildings-wide).
      const buildings: Building[] = wide
        .filter((b) => !hide.has(b.id))
        .map((b) => {
          const ring: number[] = [];
          for (let i = 0; i + 1 < b.lonLat.length; i += 2) {
            const [x, z] = proj.lonLatToEnu(b.lonLat[i], b.lonLat[i + 1]);
            ring.push(x, z);
          }
          return { id: b.id, ring, height: b.heightM, rule: b.rule };
        });
      if (!alive) return;
      setData({ grid, buildings, drape, wideManifest, twin });
      if (twin && embed)
        onTwinPlaced?.({
          x: twin.house.x,
          z: twin.house.z,
          label: embed.label,
        });
    })().catch((e: unknown) => {
      // A swallowed rejection here renders as an empty sky with no explanation.
      if (alive) onError?.(e instanceof Error ? e.message : String(e));
    });
    return () => {
      alive = false;
    };
  }, [slug, manifest, onError, onTwinPlaced]);

  // Publish the wide terrain sampler once the grid loads — same normalization
  // (elevationAt − minE) the mesh uses, so Walk-mode feet ride ON the terrain
  // the same way buildings are seated on it. Mirrors TwinWorld's narrow path.
  useEffect(() => {
    if (!data || !onGroundReady) return;
    const { grid, wideManifest } = data;
    const min = minElevation(grid);
    onGroundReady((x, z) => elevationAt(grid, wideManifest, x, z) - min);
  }, [data, onGroundReady]);

  if (!data) return null;
  return (
    <>
      <Terrain
        grid={data.grid}
        drape={data.drape}
        manifest={data.wideManifest}
        onMeshReady={onTerrainMesh}
      />
      {/* The Tennessee River — a full-extent Y=0.5 plane that shows through only
          where the wide terrain carves the channel to the valley floor (~Y=0).
          Same layer the narrow TwinWorld path renders; chatt's manifest is
          water:true. */}
      {manifest.site.water === true && <Water manifest={data.wideManifest} />}
      <Buildings
        buildings={data.buildings}
        palette={palette}
        grid={data.grid}
        manifest={data.wideManifest}
        onMeshReady={onBuildingsMesh}
      />
      {data.twin ? (
        <Suspense fallback={null}>
          <HouseModel
            slug={data.twin.slug}
            house={data.twin.house}
            grid={data.grid}
            manifest={data.wideManifest}
          />
        </Suspense>
      ) : null}
    </>
  );
}
