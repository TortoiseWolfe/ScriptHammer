'use client';
import { Suspense, useEffect, useState } from 'react';
import { TextureLoader, Texture } from 'three';
import { createProjection } from '@/lib/enu';
import {
  loadSiteJson,
  siteAssetUrl,
  loadHouse,
  loadManifest,
} from '@/lib/manifest';
import type {
  Building,
  TerrainGrid,
  Manifest,
  HouseInfo,
} from '@/lib/manifest';
import Buildings, { type BuildingPalette } from './Buildings';
import Terrain from './Terrain';
import HouseModel from './HouseModel';

/** buildings-wide.json entry — raw WGS84 footprints (src/twin/cesium/overpass.ts
 *  `LiveBuilding`). `lonLat` is a FLAT [lon,lat,lon,lat,…] ring. */
interface WideLiveBuilding {
  id: number;
  lonLat: number[];
  heightM: number;
  rule: string;
}

/** The as-built LiDAR exhibit to fold into the wide city: a separate baked slug
 *  whose house scan is re-projected into this site's frame and stood at its real
 *  location (the "merge these two views into one" ask, #049). */
const EMBED_SLUG = 'east-main-street-chattanooga';

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
}: {
  slug: string;
  manifest: Manifest;
  palette: BuildingPalette;
  onError?: (message: string) => void;
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

      // Fold in the LiDAR exhibit twin. It is a bonus layer — a missing/failed
      // exhibit must not blank the whole city, so this is best-effort.
      let twin: WideData['twin'] = null;
      let hide = new Set<number>();
      try {
        const [twinManifest, twinHouse] = await Promise.all([
          loadManifest(EMBED_SLUG),
          loadHouse(EMBED_SLUG),
        ]);
        if (twinHouse) {
          // Anchor the scan by its TRUE location, projected into this wide frame.
          // Prefer the geocoded lat/lon (survey-honest, no per-frame eyeballing);
          // fall back to re-projecting the exhibit-frame x/z anchor (exhibit ENU
          // → lon/lat, offset removed → wide ENU, this site's offset added).
          // North is −Z in both frames, so rotationDeg + the parts registration
          // carry over unchanged.
          let lon: number, lat: number;
          if (twinHouse.lat != null && twinHouse.lon != null) {
            lon = twinHouse.lon;
            lat = twinHouse.lat;
          } else {
            const twinProj = createProjection(
              twinManifest.box,
              twinManifest.vectorOffsetM
            );
            [lon, lat] = twinProj.enuToLonLat(twinHouse.x, twinHouse.z);
          }
          const [wx, wz] = proj.lonLatToEnu(lon, lat);
          twin = { slug: EMBED_SLUG, house: { ...twinHouse, x: wx, z: wz } };
          if (twinHouse.hideBuildingIds)
            hide = new Set(twinHouse.hideBuildingIds);
        }
      } catch (e) {
        console.warn('[WideCity] embedded twin skipped:', e);
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
    })().catch((e: unknown) => {
      // A swallowed rejection here renders as an empty sky with no explanation.
      if (alive) onError?.(e instanceof Error ? e.message : String(e));
    });
    return () => {
      alive = false;
    };
  }, [slug, manifest, onError]);

  if (!data) return null;
  return (
    <>
      <Terrain
        grid={data.grid}
        drape={data.drape}
        manifest={data.wideManifest}
      />
      <Buildings
        buildings={data.buildings}
        palette={palette}
        grid={data.grid}
        manifest={data.wideManifest}
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
