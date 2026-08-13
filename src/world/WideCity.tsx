'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { TextureLoader, Texture, type Mesh } from 'three';
import { createProjection } from '@/lib/enu';
import { loadSiteJson, siteAssetUrl, loadHouse } from '@/lib/manifest';
import type {
  Building,
  Street,
  TerrainGrid,
  Manifest,
  HouseInfo,
  WarehouseModelsInfo,
} from '@/lib/manifest';
import Buildings, { type BuildingPalette } from './Buildings';
import Terrain from './Terrain';
import HouseModel from './HouseModel';
import Water from './Water';
import Roads from './Roads';
import CityProps from './CityProps';
import WarehouseModels, { type ModelColliderRegistry } from './WarehouseModels';
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
  streets: Street[];
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
  warehouseModels,
  onError,
  onTwinPlaced,
  onGroundReady,
  registerCollider,
  selectedModel,
  onSelectModel,
  onBuildingsMesh,
  onTerrainMesh,
}: {
  slug: string;
  manifest: Manifest;
  palette: BuildingPalette;
  /** Real landmark GLBs (models.json), narrow-frame — reprojected into the wide
   *  frame here and rendered read-only (no editor gizmo in the walk path). */
  warehouseModels?: WarehouseModelsInfo | null;
  onError?: (message: string) => void;
  /** Reports the embedded twin's wide-frame position + label once placed, so
   *  the HUD can offer an in-diorama fly-to instead of a separate page (#332). */
  onTwinPlaced?: (t: { x: number; z: number; label: string }) => void;
  /** Hands the composition root a terrain sampler (runtime Y at ENU x/z) once
   *  the wide grid loads — so Walk-mode ground-follow (and the trolley) ride ON
   *  the hills. The narrow TwinWorld path wires this too; the wide path did not
   *  until #226. */
  onGroundReady?: (groundAt: (x: number, z: number) => number) => void;
  registerCollider?: ModelColliderRegistry;
  /** Crosshair inspection in Walk mode (#706). Selection was narrow-path only, so the
   *  walk path could never open a building's info card at all. */
  selectedModel?: string | null;
  onSelectModel?: (slug: string) => void;
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
      // Roads: streets.json is baked in the NARROW box frame. Reproject each
      // polyline into the wide/atlasBox frame the SAME offset-exact way buildings
      // are — narrow ENU → lon/lat (narrowProj.enuToLonLat) → wide ENU
      // (proj.lonLatToEnu); both projections use the same site vectorOffsetM, so
      // the round-trip recovers the true position. Best-effort: a site without
      // streets.json (or a bad parse) just renders no roads, never a blank city.
      // Coverage is the narrow corridor (where you spawn/walk), not the whole
      // atlasBox — acceptable for v1; a wide streets bake would extend it.
      let streets: Street[] = [];
      try {
        const narrow = await loadSiteJson<Street[]>(slug, 'streets.json');
        const narrowProj = createProjection(
          manifest.box,
          manifest.vectorOffsetM
        );
        streets = narrow.map((s) => {
          const pts: number[] = [];
          for (let i = 0; i + 1 < s.pts.length; i += 2) {
            const [lon, lat] = narrowProj.enuToLonLat(s.pts[i], s.pts[i + 1]);
            const [wx, wz] = proj.lonLatToEnu(lon, lat);
            pts.push(wx, wz);
          }
          return { pts };
        });
      } catch (e) {
        console.warn('[WideCity] streets skipped:', e);
      }

      if (!alive) return;
      setData({ grid, buildings, streets, drape, wideManifest, twin });
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

  // Real landmark GLBs are anchored (models.json) in the NARROW box frame.
  // Reproject each anchor into the wide/atlasBox frame the same offset-exact way
  // buildings/streets are (narrow enuToLonLat → wide lonLatToEnu), so they land
  // at their true locations. Hook stays above the early return (rules of hooks).
  const wideModels = useMemo<WarehouseModelsInfo | null>(() => {
    if (!warehouseModels) return null;
    const narrowProj = createProjection(manifest.box, manifest.vectorOffsetM);
    const wideProj = createProjection(
      manifest.atlasBox ?? manifest.box,
      manifest.vectorOffsetM
    );
    return {
      ...warehouseModels,
      models: warehouseModels.models.map((e) => {
        const [lon, lat] = narrowProj.enuToLonLat(e.x, e.z);
        const [wx, wz] = wideProj.lonLatToEnu(lon, lat);
        return { ...e, x: wx, z: wz };
      }),
    };
  }, [warehouseModels, manifest]);

  // Hide the massing box under each landmark GLB so the model IS the building
  // there (no double geometry) — mirrors TwinWorld's narrow visibleBuildings.
  const visibleBuildings = useMemo(() => {
    if (!data) return [];
    const hide = new Set<number>(warehouseModels?.hideBuildingIds ?? []);
    return hide.size
      ? data.buildings.filter((b) => !hide.has(b.id))
      : data.buildings;
  }, [data, warehouseModels]);

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
      {/* Road ribbons — narrow streets reprojected into the wide frame (corridor
          coverage). Terrain-riding asphalt so streets read at ground level. */}
      <Roads
        streets={data.streets}
        grid={data.grid}
        manifest={data.wideManifest}
      />
      {/* Zero-asset city life — instanced street trees + parked cars scattered
          along the streets so the city isn't dead-empty. */}
      <CityProps
        streets={data.streets}
        grid={data.grid}
        manifest={data.wideManifest}
      />
      <Buildings
        buildings={visibleBuildings}
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
      {/* Real landmark GLBs at their true (reprojected) locations — read-only in
          the wide/Walk path (the editor gizmo is narrow-path only). */}
      {wideModels ? (
        <Suspense fallback={null}>
          <WarehouseModels
            slug={slug}
            info={wideModels}
            grid={data.grid}
            manifest={data.wideManifest}
            registerCollider={registerCollider}
            selected={selectedModel}
            onSelect={onSelectModel}
          />
        </Suspense>
      ) : null}
    </>
  );
}
