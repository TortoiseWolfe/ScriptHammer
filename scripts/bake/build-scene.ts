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
import { drapePixelSize } from './fetch-drape';
import {
  classifyAerialWater,
  carveToMask,
  type TerrainGrid,
} from './carve-water';

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

  // Box half-extents in ENU metres. Overpass returns any way that has ANY node
  // in the bbox, and `out geom;` returns that way's FULL geometry — including
  // the parts that extend outside the box. Left unclipped, boundary-straddling
  // streets/buildings render far beyond the aerial drape (which covers only the
  // box), so the map reads as misaligned. We clip everything to the box.
  const ground = enuGroundSize();
  const halfW = ground.widthM / 2;
  const halfH = ground.depthM / 2;
  const inBox = (x: number, z: number) =>
    x >= -halfW && x <= halfW && z >= -halfH && z <= halfH;

  // Clip a polyline (flat [x,z,x,z,...] ENU) to the box rectangle, returning
  // one or more in-box sub-polylines. Segments crossing an edge are cut at the
  // edge (Liang–Barsky parametric clip per segment).
  function clipPolyline(pts: number[]): number[][] {
    const out: number[][] = [];
    let cur: number[] = [];
    const push = (x: number, z: number) => {
      cur.push(x, z);
    };
    const flush = () => {
      if (cur.length >= 4) out.push(cur);
      cur = [];
    };
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const seg = clipSegment(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
      if (!seg) {
        flush();
        continue;
      }
      if (cur.length === 0) push(seg.x0, seg.z0);
      else if (
        cur[cur.length - 2] !== seg.x0 ||
        cur[cur.length - 1] !== seg.z0
      ) {
        // segment start was clipped inward → break the run
        flush();
        push(seg.x0, seg.z0);
      }
      push(seg.x1, seg.z1);
      if (seg.exitClipped) flush();
    }
    flush();
    return out;
  }

  // Clip one segment to the box; returns the (possibly shortened) endpoints, or
  // null if it lies entirely outside. `exitClipped` marks that the segment's
  // end hit an edge (so the polyline run must break there).
  function clipSegment(
    x0: number,
    z0: number,
    x1: number,
    z1: number
  ): {
    x0: number;
    z0: number;
    x1: number;
    z1: number;
    exitClipped: boolean;
  } | null {
    let t0 = 0;
    let t1 = 1;
    const dx = x1 - x0;
    const dz = z1 - z0;
    const p = [-dx, dx, -dz, dz];
    const q2 = [x0 + halfW, halfW - x0, z0 + halfH, halfH - z0];
    for (let k = 0; k < 4; k++) {
      if (p[k] === 0) {
        if (q2[k] < 0) return null; // parallel & outside
      } else {
        const r = q2[k] / p[k];
        if (p[k] < 0) {
          if (r > t1) return null;
          if (r > t0) t0 = r;
        } else {
          if (r < t0) return null;
          if (r < t1) t1 = r;
        }
      }
    }
    return {
      x0: x0 + t0 * dx,
      z0: z0 + t0 * dz,
      x1: x0 + t1 * dx,
      z1: z0 + t1 * dz,
      exitClipped: t1 < 1,
    };
  }

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
      const [cX, cZ] = polygonCentroid(ringEnu);
      // Drop buildings whose footprint centroid falls outside the box — these
      // are boundary-straddlers Overpass returned in full; they'd render off the
      // drape. (A hero way is never dropped: its swap tag pins a landmark.)
      const swap = HERO_WAY_IDS[el.id];
      if (!swap && !inBox(cX, cZ)) continue;
      const { meters, rule } = resolveHeight(tags, area);
      ruleHistogram[rule]++;
      const flat: number[] = [];
      for (const [x, z] of ringEnu) flat.push(q(x), q(z));
      buildings.push({ id: el.id, ring: flat, height: q(meters), rule, swap });
      if (swap) {
        heroes.push({
          swap,
          x: q(cX),
          z: q(cZ),
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
      // Project then clip the polyline to the box (a straddling street would
      // otherwise trail far outside the drape). One OSM way may yield several
      // in-box sub-polylines.
      const projected: number[] = [];
      for (const g of el.geometry) {
        const [x, z] = lonLatToEnu(g.lon, g.lat);
        projected.push(x, z);
      }
      for (const sub of clipPolyline(projected)) {
        streets.push({ pts: sub.map((v) => q(v)) });
      }
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

  const { widthM, depthM } = ground;
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
      // Actual fetched image dimensions (degree-aspect height, not metre-derived)
      // so the manifest matches the real drape.jpg and stays honest about what
      // was baked. Registration uses groundWm/groundHm, not these pixel counts.
      ...(() => {
        const { width, height } = drapePixelSize(mpp);
        return { width, height };
      })(),
      mpp,
    },
    provenance: '© OpenStreetMap · USGS 3DEP · USGS NAIP',
    fetchedAt: new Date().toISOString(),
    ruleHistogram,
  };

  writeFileSync(join(outDir, 'buildings.json'), JSON.stringify(buildings));
  writeFileSync(join(outDir, 'streets.json'), JSON.stringify(streets));
  writeFileSync(join(outDir, 'heroes.json'), JSON.stringify(heroes));

  // Carve the river into the terrain by following the AERIAL waterline (#225):
  // classify the drape's water at pixel resolution and lower every terrain sample
  // whose drape pixel is water to the water level. The bank then follows the real
  // shoreline (buildings register to the drape), instead of the ragged coarse-grid
  // edge that made riverfront buildings float. Falls back to the raw grid if the
  // drape is missing.
  const rawGrid = JSON.parse(
    readFileSync(join(rawDir, 'terrain.json'), 'utf8')
  ) as TerrainGrid;
  const drapeSrc = existsSync(join(rawDir, 'drape.jpg'))
    ? join(rawDir, 'drape.jpg')
    : existsSync(drapePath)
      ? drapePath
      : null;
  let carvedGrid = rawGrid;
  if (drapeSrc) {
    const mask = await classifyAerialWater(drapeSrc);
    const res = carveToMask(rawGrid, mask, widthM, depthM);
    carvedGrid = res.grid;
    const waterPx = mask.mask.reduce((a, v) => a + v, 0);
    console.log(
      `[carve-water] aerial water ${waterPx}px → ${res.carved} terrain samples lowered to ${res.waterLevel.toFixed(1)} m`
    );
  } else {
    console.log('[carve-water] no drape found; terrain left uncarved');
  }
  writeFileSync(join(outDir, 'terrain.json'), JSON.stringify(carvedGrid));
  writeFileSync(
    join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  return manifest;
}
