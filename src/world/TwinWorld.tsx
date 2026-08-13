'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { TextureLoader, Texture, type Mesh } from 'three';
import { loadSiteJson, siteAssetUrl, hasWideExtent } from '@/lib/manifest';
import { createProjection } from '@/lib/enu';
import type {
  Building,
  Street,
  Hero,
  HouseInfo,
  TerrainGrid,
  Manifest,
  TwinPlacementOverride,
  WarehouseModelsInfo,
} from '@/lib/manifest';
import Buildings from './Buildings';
import HouseModel from './HouseModel';
import WarehouseModels, {
  type ModelGroupRegistry,
  type ModelColliderRegistry,
} from './WarehouseModels';
import Terrain from './Terrain';
import WideCity from './WideCity';
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
  buildingsOpacity = 1,
  warehouseModels,
  modelOverrides,
  selectedModel,
  onSelectModel,
  registerModelGroup,
  registerCollider,
  onHouseGround,
  onGroundReady,
  onError,
  onTwinPlaced,
  onBuildingsMesh,
  onTerrainMesh,
}: {
  slug: string;
  manifest: Manifest;
  palette: { bricks: number[] };
  /** Optional as-built scan descriptor (#234). */
  house?: HouseInfo | null;
  /** When true, render the scan and hide its massing boxes. */
  showHouse?: boolean;
  /** Buildings/heroes layer fade (1 = opaque) — registration diagnostics. */
  buildingsOpacity?: number;
  /** Warehouse-sampled buildings layer (#259) — loaded by the composition
   *  root (the HUD directory shares it); null/undefined = layer off. */
  warehouseModels?: WarehouseModelsInfo | null;
  /** Live ?edit overrides + selection, forwarded to the models layer. */
  modelOverrides?: Record<string, TwinPlacementOverride>;
  selectedModel?: string | null;
  onSelectModel?: (slug: string) => void;
  /** Surfaces the selected building's group for the editor's gizmo. */
  registerModelGroup?: ModelGroupRegistry;
  registerCollider?: ModelColliderRegistry;
  /** Reports the terrain height (runtime Y) under the house anchor once the
   *  grid loads — lets the composition root aim the camera at the parcel. */
  onHouseGround?: (y: number) => void;
  /** Hands the composition root a terrain sampler (runtime Y at ENU x/z)
   *  once the grid loads — ground agents (the trolley) ride ON the terrain
   *  instead of at sea level, and so does the camera that follows them. */
  onGroundReady?: (groundAt: (x: number, z: number) => number) => void;
  onError?: (message: string) => void;
  /** Wide sites only: reports the embedded twin's wide-frame position + label
   *  once placed, so the HUD can offer an in-diorama fly-to (#332). */
  onTwinPlaced?: (t: { x: number; z: number; label: string }) => void;
  /** Wide sites only: hands over the merged buildings mesh for Walk-mode BVH
   *  collision (#226). */
  onBuildingsMesh?: (mesh: Mesh) => void;
  /** Wide sites only: hands over the ground mesh for the Walk-mode physics floor. */
  onTerrainMesh?: (mesh: Mesh) => void;
}) {
  const [data, setData] = useState<WorldData | null>(null);
  // Wide sites (chatt) render the full atlasBox city + embedded twin (WideCity)
  // instead of the narrow box — data-driven off the baked atlasBox, so
  // `/chatt?diorama` IS the wide map with no `?wide` param to guess.
  const wide = useMemo(() => hasWideExtent(manifest), [manifest]);
  useEffect(() => {
    if (wide) return; // wide mode renders WideCity; skip the narrow-box load
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
  }, [slug, manifest, onError, wide]);

  useEffect(() => {
    if (!data || !house || !onHouseGround) return;
    onHouseGround(
      elevationAt(data.terrain, manifest, house.x, house.z) -
        minElevation(data.terrain)
    );
  }, [data, house, manifest, onHouseGround]);

  useEffect(() => {
    if (!data || !onGroundReady) return;
    const min = minElevation(data.terrain);
    onGroundReady((x, z) => elevationAt(data.terrain, manifest, x, z) - min);
  }, [data, manifest, onGroundReady]);

  // Massing boxes step aside wherever a higher-fidelity layer occupies the
  // same volume, so the two never z-fight: the as-built scan's parcel boxes
  // (while shown) and every sampled Warehouse building's box(es) — the
  // latter emitted per-anchor by point-in-polygon at emit time.
  const scanVisible = showHouse && !!house;
  const visibleBuildings = useMemo(() => {
    if (!data) return [];
    const hide = new Set<number>(warehouseModels?.hideBuildingIds ?? []);
    if (scanVisible && house?.hideBuildingIds?.length) {
      for (const id of house.hideBuildingIds) hide.add(id);
    }
    if (hide.size === 0) return data.buildings;
    return data.buildings.filter((b) => !hide.has(b.id));
  }, [data, scanVisible, house, warehouseModels]);

  // Wide city (chatt) — atlasBox-centred with the embedded LiDAR twin, so it
  // replaces the narrow layers wholesale. After all hooks (rules-of-hooks).
  if (wide) {
    return (
      <WideCity
        slug={slug}
        manifest={manifest}
        palette={palette}
        warehouseModels={warehouseModels}
        onError={onError}
        onTwinPlaced={onTwinPlaced}
        onGroundReady={onGroundReady}
        onBuildingsMesh={onBuildingsMesh}
        onTerrainMesh={onTerrainMesh}
        registerCollider={registerCollider}
        selectedModel={selectedModel}
        onSelectModel={onSelectModel}
      />
    );
  }

  if (!data) return null;
  // Resolve the scan anchor from its geocoded lat/lon into THIS site's frame
  // (the true-location placement HouseModel then centres on), falling back to
  // the hand-tuned x/z when the house has no geo anchor.
  const geoHouse =
    house && house.lat != null && house.lon != null
      ? (() => {
          const [gx, gz] = createProjection(
            manifest.box,
            manifest.vectorOffsetM
          ).lonLatToEnu(house.lon, house.lat);
          return { ...house, x: gx, z: gz };
        })()
      : house;
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
        opacity={buildingsOpacity}
      />
      <Streets streets={data.streets} grid={data.terrain} manifest={manifest} />
      <Heroes
        heroes={data.heroes}
        grid={data.terrain}
        manifest={manifest}
        opacity={buildingsOpacity}
      />
      {warehouseModels ? (
        <Suspense fallback={null}>
          <WarehouseModels
            slug={slug}
            info={warehouseModels}
            grid={data.terrain}
            manifest={manifest}
            overrides={modelOverrides}
            selected={selectedModel}
            onSelect={onSelectModel}
            registerGroup={registerModelGroup}
          />
        </Suspense>
      ) : null}
      {scanVisible && geoHouse ? (
        <Suspense fallback={null}>
          <HouseModel
            slug={slug}
            house={geoHouse}
            grid={data.terrain}
            manifest={manifest}
          />
        </Suspense>
      ) : null}
    </>
  );
}
