'use client';
import { useEffect, useState } from 'react';
import { TextureLoader, Texture } from 'three';
import { loadSiteJson, siteAssetUrl } from '@/lib/manifest';
import type {
  Building,
  Street,
  Hero,
  TerrainGrid,
  Manifest,
} from '@/lib/manifest';
import Buildings from './Buildings';
import Terrain from './Terrain';
import Streets from './Streets';
import Heroes from './Heroes';
import Water from './Water';

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
  onError,
}: {
  slug: string;
  manifest: Manifest;
  palette: { bricks: number[] };
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

  if (!data) return null;
  return (
    <>
      <Terrain grid={data.terrain} drape={data.drape} manifest={manifest} />
      {/* Water is gated on the bake result — a waterless site would otherwise
          get a spurious pond at its terrain minimum. */}
      {manifest.site.water === true && <Water manifest={manifest} />}
      <Buildings
        buildings={data.buildings}
        palette={palette}
        grid={data.terrain}
        manifest={manifest}
      />
      <Streets streets={data.streets} grid={data.terrain} manifest={manifest} />
      <Heroes heroes={data.heroes} grid={data.terrain} manifest={manifest} />
    </>
  );
}
