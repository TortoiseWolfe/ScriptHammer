import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { BOX } from './box';
import { M_PER_DEG_LON, M_PER_DEG_LAT } from './enu';

const NAIP =
  'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage';
const ESRI =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export';

/**
 * Drape pixel size for a plate-carrée (SR 4326) request.
 *
 * REGISTRATION INVARIANT: ArcGIS `exportImage` returns the requested bbox
 * EXACTLY only when the requested pixel aspect equals the bbox aspect *in the
 * request SR*. In 4326 the bbox aspect is measured in DEGREES, so the pixel
 * aspect must be the degree aspect — NOT the cos(lat)-corrected metre aspect.
 * Requesting metre-proportional pixels against a degree bbox made ArcGIS expand
 * the latitude extent by ~616 m each end (returned 35.00223..35.06557 for a
 * 35.0078..35.06 request), which shifted every N-S feature and floated the
 * south-bank buildings out over the river. See fetch-drape.test.ts.
 *
 * The runtime maps world-Z→row linearly via `manifest.groundHm` (true ground
 * metres), independent of pixel count, so the image only has to *span exactly
 * the box lat/lon*. We fix E-W resolution at `groundWm/mpp` and derive height
 * from the DEGREE aspect so the request self-registers (no extent expansion).
 * The image is a touch taller in pixels; it still maps linearly and correctly.
 */
export function drapePixelSize(mpp: number) {
  const groundWm = (BOX.neLon - BOX.swLon) * M_PER_DEG_LON;
  const groundHm = (BOX.neLat - BOX.swLat) * M_PER_DEG_LAT;
  const degLon = BOX.neLon - BOX.swLon;
  const degLat = BOX.neLat - BOX.swLat;
  const width = Math.round(groundWm / mpp);
  // height so that width/height === degLon/degLat → ArcGIS returns the exact bbox.
  const height = Math.round(width * (degLat / degLon));
  return { width, height, groundWm, groundHm };
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
