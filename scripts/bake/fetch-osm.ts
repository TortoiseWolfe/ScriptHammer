import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { BOX } from './box';
import { overpassQuery } from './overpass';

/** bbox in Overpass order: south,west,north,east */
function bbox(): string {
  return `${BOX.swLat},${BOX.swLon},${BOX.neLat},${BOX.neLon}`;
}

export function buildOsmQL(): string {
  const b = bbox();
  return [
    '[out:json][timeout:120];',
    '(',
    `  way["building"](${b});`,
    `  relation["building"](${b});`,
    `  relation["type"="building"](${b});`,
    `  way["highway"](${b});`,
    ');',
    'out geom;',
  ].join('\n');
}

export async function fetchOsm(outDir: string) {
  mkdirSync(outDir, { recursive: true });
  const data = await overpassQuery(buildOsmQL());
  writeFileSync(join(outDir, 'osm.json'), JSON.stringify(data));
  const buildings = data.elements.filter(
    (e) => e.type === 'way' && e.tags?.building
  ).length;
  const relations = data.elements.filter((e) => e.type === 'relation').length;
  const highways = data.elements.filter(
    (e) => e.type === 'way' && e.tags?.highway
  ).length;
  return { buildings, highways, relations };
}
