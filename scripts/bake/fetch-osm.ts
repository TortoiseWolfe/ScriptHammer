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
    // Water: the river surface. Without these the terrain has no idea where the
    // water is, so the coarse heightfield smears the bank ~100 m off and
    // riverfront buildings render sitting in the Tennessee River (see #225).
    // `natural=water` (+ `water=river/lake/pond`) are the surface polygons we
    // stamp into the terrain as a flat channel; `waterway=riverbank` is the
    // legacy polygon tag; `waterway=river/stream` centerlines are a fallback.
    `  way["natural"="water"](${b});`,
    `  way["waterway"="riverbank"](${b});`,
    `  relation["natural"="water"](${b});`,
    `  way["waterway"~"^(river|stream|canal)$"](${b});`,
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
  const water = data.elements.filter(
    (e) => e.tags?.natural === 'water' || e.tags?.waterway
  ).length;
  return { buildings, highways, relations, water };
}
