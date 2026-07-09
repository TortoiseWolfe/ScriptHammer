'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { TextureLoader, Texture } from 'three';
import { loadSiteJson, siteAssetUrl } from '@/lib/manifest';
import type {
  Building,
  Street,
  Hero,
  HouseInfo,
  TerrainGrid,
  Manifest,
} from '@/lib/manifest';
import Buildings from './Buildings';
import HouseModel from './HouseModel';
import Terrain from './Terrain';
import Streets from './Streets';
import Heroes from './Heroes';
import Water from './Water';
import { elevationAt, minElevation } from './terrainSample';

interface WorldData {
  buildings: Building[];
  streets: Street[];
  heroes: Hero[];
  terrain: TerrainGrid;
  drape: Texture;
}

export default function TwinWorld({
  slug,
  manifest,
  palette,
  house,
  showHouse = false,
  onHouseGround,
  onError,
}: {
  slug: string;
  manifest: Manifest;
  palette: { bricks: number[] };
  /** Optional as-built scan descriptor (#234). */
  house?: HouseInfo | null;
  /** When true, render the scan and hide its massing boxes. */
  showHouse?: boolean;
  /** Reports the terrain height (runtime Y) under the house anchor once the
   *  grid loads — lets the composition root aim the camera at the parcel. */
  onHouseGround?: (y: number) => void;
  onError?: (message: string) => void;
}) {
  const [data, setData] = useState<WorldData | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const [buildings, streets, heroes, terrain] = await Promise.all([
        loadSiteJson<Building[]>(slug, 'buildings.json'),
        loadSiteJson<Street[]>(slug, 'streets.json'),
        loadSiteJson<Hero[]>(slug, 'heroes.json'),
        loadSiteJson<TerrainGrid>(slug, 'terrain.json'),
      ]);
      // drape.path is a filename relative to the site dir (defensively take the
      // basename so an old dir-prefixed manifest still resolves).
      const drapeFile = manifest.drape.path.split('/').pop() ?? 'drape.jpg';
      const drape = await new TextureLoader().loadAsync(
        siteAssetUrl(slug, drapeFile)
      );
      if (!alive) return;
      setData({ buildings, streets, heroes, terrain, drape });
    })().catch((e: unknown) => {
      // Surface asset failures — a swallowed rejection here renders as an
      // empty sky with no explanation.
      if (alive) onError?.(e instanceof Error ? e.message : String(e));
    });
    return () => {
      alive = false;
    };
  }, [slug, manifest, onError]);

  useEffect(() => {
    if (!data || !house || !onHouseGround) return;
    onHouseGround(
      elevationAt(data.terrain, manifest, house.x, house.z) -
        minElevation(data.terrain)
    );
  }, [data, house, manifest, onHouseGround]);

  // While the as-built scan is shown, its massing boxes step aside so the two
  // don't z-fight on the parcel (identity changes only on toggle).
  const scanVisible = showHouse && !!house;
  const visibleBuildings = useMemo(() => {
    if (!data) return [];
    if (!scanVisible || !house?.hideBuildingIds?.length) return data.buildings;
    const hide = new Set(house.hideBuildingIds);
    return data.buildings.filter((b) => !hide.has(b.id));
  }, [data, scanVisible, house]);

  if (!data) return null;
  return (
    <>
      <Terrain grid={data.terrain} drape={data.drape} manifest={manifest} />
      {/* Water is gated on the bake result — a waterless site would otherwise
          get a spurious pond at its terrain minimum. */}
      {manifest.site.water === true && <Water manifest={manifest} />}
      <Buildings
        buildings={visibleBuildings}
        palette={palette}
        grid={data.terrain}
        manifest={manifest}
      />
      <Streets streets={data.streets} grid={data.terrain} manifest={manifest} />
      <Heroes heroes={data.heroes} grid={data.terrain} manifest={manifest} />
      {scanVisible && house ? (
        <Suspense fallback={null}>
          <HouseModel
            slug={slug}
            house={house}
            grid={data.terrain}
            manifest={manifest}
          />
        </Suspense>
      ) : null}
    </>
  );
}
