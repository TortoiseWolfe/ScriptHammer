import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Projection } from './enu';

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
export function drapePixelSize(proj: Projection, mpp: number) {
  const { box } = proj;
  const groundWm = (box.neLon - box.swLon) * proj.mPerDegLon;
  const groundHm = (box.neLat - box.swLat) * proj.mPerDegLat;
  const degLon = box.neLon - box.swLon;
  const degLat = box.neLat - box.swLat;
  const width = Math.round(groundWm / mpp);
  // height so that width/height === degLon/degLat → ArcGIS returns the exact bbox.
  const height = Math.round(width * (degLat / degLon));
  return { width, height, groundWm, groundHm };
}

export function drapeUrl(
  proj: Projection,
  mpp: number,
  source: 'naip' | 'esri' = 'naip'
): string {
  const { box } = proj;
  const { width, height } = drapePixelSize(proj, mpp);
  const bbox = `${box.swLon},${box.swLat},${box.neLon},${box.neLat}`; // minx,miny,maxx,maxy
  const base = source === 'naip' ? NAIP : ESRI;
  return `${base}?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=${width},${height}&format=jpeg&f=image`;
}

export async function fetchDrape(
  outDir: string,
  proj: Projection,
  mpp = 2,
  source: 'naip' | 'esri' = 'naip'
): Promise<{
  width: number;
  height: number;
  bytes: number;
  source: 'naip' | 'esri';
}> {
  mkdirSync(outDir, { recursive: true });
  const { width, height } = drapePixelSize(proj, mpp);

  // The site config pins the imagery source as part of its reproducibility
  // contract — NEVER silently substitute the other source (Esri pixels carve a
  // different waterline than the NAIP-tuned classifier expects). Retry the
  // pinned source on transient errors, then fail loudly.
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(drapeUrl(proj, mpp, source));
    if (res.ok) break;
    console.warn(
      `[fetch-drape] ${source.toUpperCase()} HTTP ${res.status} (attempt ${attempt + 1}/3)`
    );
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  if (!res || !res.ok) {
    const hint =
      source === 'naip'
        ? ' (NAIP covers the US only — set "drapeSource": "esri" in the site config for non-US sites)'
        : '';
    throw new Error(`${source.toUpperCase()} HTTP ${res?.status}${hint}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  // ArcGIS services return HTTP 200 with a JSON error body even for f=image
  // requests, and silently clamp sizes beyond maxImageWidth/Height (~4000 px on
  // USGSNAIPImagery). Validate we actually got a JPEG of the requested size so
  // a corrupt/clamped drape can never ship (it would both mis-register and
  // derail the water carve).
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw new Error(
      `${source.toUpperCase()} returned a non-JPEG body (${buf.length} bytes): ${buf
        .subarray(0, 120)
        .toString('utf8')}`
    );
  }
  const meta = await sharp(buf).metadata();
  if (meta.width !== width || meta.height !== height) {
    throw new Error(
      `${source.toUpperCase()} returned ${meta.width}x${meta.height}, requested ${width}x${height} — ` +
        `the service likely clamped the request (maxImageWidth/Height); use a coarser mpp or a smaller box`
    );
  }

  writeFileSync(join(outDir, 'drape.jpg'), buf);
  return { width, height, bytes: buf.length, source };
}
