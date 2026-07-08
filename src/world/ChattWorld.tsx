'use client';
import { useEffect, useState } from 'react';
import { TextureLoader, Texture } from 'three';
import { getAssetUrl } from '@/config/project.config';
import { loadJson, loadManifest } from '@/lib/manifest';
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
  manifest: Manifest;
  buildings: Building[];
  streets: Street[];
  heroes: Hero[];
  terrain: TerrainGrid;
  drape: Texture;
}

export default function ChattWorld({
  palette,
  onLoaded,
}: {
  palette: { bricks: number[] };
  onLoaded?: (m: Manifest) => void;
}) {
  const [data, setData] = useState<WorldData | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const [manifest, buildings, streets, heroes, terrain] = await Promise.all(
        [
          loadManifest(),
          loadJson<Building[]>('buildings.json'),
          loadJson<Street[]>('streets.json'),
          loadJson<Hero[]>('heroes.json'),
          loadJson<TerrainGrid>('terrain.json'),
        ]
      );
      const drape = await new TextureLoader().loadAsync(
        getAssetUrl('/chatt/drape.jpg')
      );
      if (!alive) return;
      setData({ manifest, buildings, streets, heroes, terrain, drape });
      onLoaded?.(manifest);
    })();
    return () => {
      alive = false;
    };
  }, [onLoaded]);

  if (!data) return null;
  return (
    <>
      <Terrain
        grid={data.terrain}
        drape={data.drape}
        manifest={data.manifest}
      />
      <Water manifest={data.manifest} />
      <Buildings
        buildings={data.buildings}
        palette={palette}
        grid={data.terrain}
        manifest={data.manifest}
      />
      <Streets
        streets={data.streets}
        grid={data.terrain}
        manifest={data.manifest}
      />
      <Heroes
        heroes={data.heroes}
        grid={data.terrain}
        manifest={data.manifest}
      />
    </>
  );
}
