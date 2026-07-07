import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { BOX } from './box';
import { M_PER_DEG_LON, M_PER_DEG_LAT } from './enu';

const NAIP =
  'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage';
const ESRI =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export';

/** Meter-proportional size so the plate-carrée image registers on the cos(lat) ENU ground. */
export function drapePixelSize(mpp: number) {
  const groundWm = (BOX.neLon - BOX.swLon) * M_PER_DEG_LON;
  const groundHm = (BOX.neLat - BOX.swLat) * M_PER_DEG_LAT;
  return {
    width: Math.round(groundWm / mpp),
    height: Math.round(groundHm / mpp),
    groundWm,
    groundHm,
  };
}

export function drapeUrl(
  mpp: number,
  source: 'naip' | 'esri' = 'naip'
): string {
  const { width, height } = drapePixelSize(mpp);
  const bbox = `${BOX.swLon},${BOX.swLat},${BOX.neLon},${BOX.neLat}`; // minx,miny,maxx,maxy
  const base = source === 'naip' ? NAIP : ESRI;
  return `${base}?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=${width},${height}&format=jpeg&f=image`;
}

export async function fetchDrape(outDir: string, mpp = 2) {
  mkdirSync(outDir, { recursive: true });
  const { width, height } = drapePixelSize(mpp);
  const res = await fetch(drapeUrl(mpp, 'naip'));
  if (!res.ok) throw new Error(`NAIP HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(outDir, 'drape.jpg'), buf);
  return { width, height, bytes: buf.length };
}
