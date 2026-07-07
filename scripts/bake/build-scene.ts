import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { lonLatToEnu, enuGroundSize, M_PER_DEG_LON } from './enu';
import { BOX } from './box';
import { resolveHeight } from './height';

export function ringAreaM2(ring: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[(i + 1) % ring.length];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a) / 2;
}

export function polygonCentroid(ring: [number, number][]): [number, number] {
  let x = 0,
    z = 0;
  for (const [px, pz] of ring) {
    x += px;
    z += pz;
  }
  return [x / ring.length, z / ring.length];
}

// --- Hero-swap landmark resolution -----------------------------------------
//
// DEVIATION FROM BRIEF: the brief's reference implementation matched hero
// slots with a loose case-insensitive regex against OSM `name` tags
// (`heroSlot()`). That approach was verified against the actual committed
// `_raw/osm.json` and found to be unsafe:
//   - `/walnut.*bridge/i` and similar patterns can match highway/street ways
//     (e.g. a street named "Walnut Street") rather than the actual landmark
//     building/way, silently mis-placing a hero on a street centerline.
//   - Several landmarks (Tivoli, Dome Building, Chattanooga Choo Choo) are
//     not reliably tagged by name in OSM at all, so the regex would simply
//     never match them (0 heroes for those slots).
//
// Fix: resolve each of the 8 hero slots explicitly, either by exact OSM
// element id (verified against the real _raw/osm.json) or by a fixed
// lon/lat coordinate anchor when no matching OSM way/relation exists.
//
// Way-based heroes: tag the actual building `way` (by id) with `swap`, and
// emit the hero at that building's polygon centroid — this guarantees the
// hero sits on the real footprint, not a street.
export const HERO_WAY_IDS: Record<number, string> = {
  173782782: 'aquarium', // Tennessee Aquarium (tourism=aquarium)
  164158074: 'walnut_st_bridge', // Walnut Street bridge (historic=yes way, not the street)
  79292898: 'courthouse', // Hamilton County Courthouse (amenity=courthouse)
  66951392: 'republic_centre', // Republic Centre
};

// Coordinate-anchor heroes: no reliably-tagged OSM way/relation matches by
// name, so we pin a fixed lon/lat and project it straight into ENU. No
// building footprint is required for these.
//
// hunter_museum: OSM relation id 1186493 ("Hunter Museum of American Art")
// carries no direct `geometry` (relations aren't walked for footprints here),
// but its members *do* carry geometry. We use the mean of all member-way
// vertices from the actual committed _raw/osm.json as the anchor
// (lat=35.0558416, lon=-85.3062145) rather than the brief's suggested
// approximate anchor (lat=35.0553, lon=-85.2954), which was verified to sit
// ~1km east of the real building — outside the box's east edge (-85.300)
// entirely.
export const HERO_ANCHORS: { swap: string; lat: number; lon: number }[] = [
  { swap: 'hunter_museum', lat: 35.0558416, lon: -85.3062145 },
  { swap: 'tivoli', lat: 35.0455, lon: -85.3078 },
  { swap: 'dome_building', lat: 35.0466, lon: -85.3086 },
  { swap: 'choo_choo', lat: 35.0093, lon: -85.3086 },
];

const q = (n: number) => Math.round(n * 10) / 10; // 0.1 m quantization

export async function buildScene(rawDir: string, outDir: string, mpp = 2) {
  mkdirSync(outDir, { recursive: true });
  const osm = JSON.parse(readFileSync(join(rawDir, 'osm.json'), 'utf8')) as {
    elements: {
      type: string;
      id: number;
      tags?: Record<string, string>;
      geometry?: { lat: number; lon: number }[];
    }[];
  };

  const buildings: {
    id: number;
    ring: number[];
    height: number;
    rule: string;
    swap?: string;
  }[] = [];
  const heroes: { swap: string; x: number; z: number; name: string }[] = [];
  const streets: { pts: number[] }[] = [];
  const ruleHistogram: Record<string, number> = {
    height: 0,
    levels: 0,
    override: 0,
    fallback: 0,
  };

  // Way ids in HERO_WAY_IDS that we've already emitted a hero for. Some hero
  // ways (e.g. the Walnut Street Bridge) are tagged `highway=footway` rather
  // than `building=*`, so they never enter the building branch below — this
  // set lets a fallback pass catch them from their raw geometry regardless of
  // which OSM tag shape they use.
  const heroWaysEmitted = new Set<number>();

  for (const el of osm.elements) {
    const tags = el.tags || {};
    if (
      el.type === 'way' &&
      tags.building &&
      el.geometry &&
      el.geometry.length >= 3
    ) {
      const ringEnu = el.geometry.map((g) => lonLatToEnu(g.lon, g.lat)) as [
        number,
        number,
      ][];
      const area = ringAreaM2(ringEnu);
      const { meters, rule } = resolveHeight(tags, area);
      ruleHistogram[rule]++;
      const swap = HERO_WAY_IDS[el.id];
      const flat: number[] = [];
      for (const [x, z] of ringEnu) flat.push(q(x), q(z));
      buildings.push({ id: el.id, ring: flat, height: q(meters), rule, swap });
      if (swap) {
        const [cx, cz] = polygonCentroid(ringEnu);
        heroes.push({
          swap,
          x: q(cx),
          z: q(cz),
          name: tags.name ?? swap,
        });
        heroWaysEmitted.add(el.id);
      }
    } else if (
      el.type === 'way' &&
      tags.highway &&
      el.geometry &&
      el.geometry.length >= 2
    ) {
      const flat: number[] = [];
      for (const g of el.geometry) {
        const [x, z] = lonLatToEnu(g.lon, g.lat);
        flat.push(q(x), q(z));
      }
      streets.push({ pts: flat });
    }

    // Fallback: a hero-tagged way that isn't a `building` footprint (e.g. the
    // Walnut Street Bridge, tagged `highway=footway` + `historic=yes`) still
    // needs its hero emitted, from its own geometry — independent of whether
    // it was also recorded as a street above.
    if (
      el.type === 'way' &&
      el.geometry &&
      el.geometry.length >= 2 &&
      HERO_WAY_IDS[el.id] &&
      !heroWaysEmitted.has(el.id)
    ) {
      const swap = HERO_WAY_IDS[el.id];
      const ringEnu = el.geometry.map((g) => lonLatToEnu(g.lon, g.lat)) as [
        number,
        number,
      ][];
      const [cx, cz] = polygonCentroid(ringEnu);
      heroes.push({ swap, x: q(cx), z: q(cz), name: tags.name ?? swap });
      heroWaysEmitted.add(el.id);
    }
  }

  // Coordinate-anchor heroes: no building way matched by id, so project the
  // fixed lon/lat straight into ENU.
  for (const anchor of HERO_ANCHORS) {
    const [x, z] = lonLatToEnu(anchor.lon, anchor.lat);
    heroes.push({ swap: anchor.swap, x: q(x), z: q(z), name: anchor.swap });
  }

  const { widthM, depthM } = enuGroundSize();
  const drapePath = join(outDir, 'drape.jpg');
  if (existsSync(join(rawDir, 'drape.jpg')))
    copyFileSync(join(rawDir, 'drape.jpg'), drapePath);

  const manifest = {
    box: {
      swLat: BOX.swLat,
      swLon: BOX.swLon,
      neLat: BOX.neLat,
      neLon: BOX.neLon,
    },
    groundWm: q(widthM),
    groundHm: q(depthM),
    cosLat: M_PER_DEG_LON / 111320,
    drape: {
      path: 'chatt/drape.jpg',
      width: Math.round(widthM / mpp),
      height: Math.round(depthM / mpp),
      mpp,
    },
    provenance: '© OpenStreetMap · USGS 3DEP · USGS NAIP',
    fetchedAt: new Date().toISOString(),
    ruleHistogram,
  };

  writeFileSync(join(outDir, 'buildings.json'), JSON.stringify(buildings));
  writeFileSync(join(outDir, 'streets.json'), JSON.stringify(streets));
  writeFileSync(join(outDir, 'heroes.json'), JSON.stringify(heroes));
  copyFileSync(join(rawDir, 'terrain.json'), join(outDir, 'terrain.json'));
  writeFileSync(
    join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  return manifest;
}
