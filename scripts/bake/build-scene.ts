import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Projection } from './enu';
import { resolveHeight } from './height';
import { buildWideBuildings } from './build-wide-buildings';
import { drapePixelSize, type DrapeSource } from './fetch-drape';
import {
  provenanceFor,
  siteManifestBlock,
  type SiteConfig,
  atlasBoxFor,
} from './site-config';
import {
  matchMsHeights,
  pointInRing,
  type MsBuilding,
} from './fetch-ms-heights';
import {
  classifyAerialWater,
  carveToMask,
  type TerrainGrid,
} from './carve-water';
import { runRegistration } from './registration';

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

const q = (n: number) => Math.round(n * 10) / 10; // 0.1 m quantization

export async function buildScene(
  rawDir: string,
  outDir: string,
  site: SiteConfig,
  proj: Projection,
  drapeSource: DrapeSource = site.drapeSource,
  opts: {
    /** #233 measurement (Sobel over the full drape, ~10s at flagship size).
     *  Always on in real bakes; tests not asserting registration skip it. */
    registration?: boolean;
    /** Where the report + overlays land (default rawDir/registration/) —
     *  test seam so suite runs never touch a developer's real _raw cache. */
    registrationDir?: string;
  } = {}
) {
  const { registration: measureReg = true } = opts;
  mkdirSync(outDir, { recursive: true });
  const osm = JSON.parse(readFileSync(join(rawDir, 'osm.json'), 'utf8')) as {
    elements: {
      type: string;
      id: number;
      tags?: Record<string, string>;
      geometry?: { lat: number; lon: number }[];
    }[];
  };

  // --- Hero-swap landmark resolution ---------------------------------------
  //
  // Loose name-regex matching was verified unsafe against real _raw/osm.json
  // (matches street ways, misses untagged landmarks — see #229). Each hero is
  // resolved explicitly from the site config: either by exact OSM way id
  // (emitted at that way's footprint centroid, guaranteed on the real
  // footprint) or by a fixed lon/lat anchor when no reliably-tagged OSM
  // way/relation exists.
  const heroWayIds = new Map<number, string>();
  for (const h of site.heroes) {
    if (h.wayId != null) heroWayIds.set(h.wayId, h.slug);
  }
  const heroAnchors = site.heroes.filter(
    (h): h is typeof h & { anchor: { lat: number; lon: number } } =>
      h.anchor != null
  );

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
    lidar: 0,
    ms: 0,
    fallback: 0,
  };

  // Lidar-measured heights (fetch-lidar-heights stage, #229 PR-B): keyed by
  // OSM way id directly (points were binned into the footprints themselves).
  let lidarHeightByOsmId = new Map<number, number>();
  const lidarPath = join(rawDir, 'lidar-heights.json');
  if (site.lidar && !existsSync(lidarPath)) {
    console.warn(
      '[build-scene] site.lidar is set but _raw/lidar-heights.json is missing — run the full bake (fetch-lidar-heights); heights fall back to ms/priors'
    );
  }
  if (site.lidar && existsSync(lidarPath)) {
    const lidar = JSON.parse(readFileSync(lidarPath, 'utf8')) as {
      heights: Record<string, number>;
    };
    lidarHeightByOsmId = new Map(
      Object.entries(lidar.heights).map(([id, h]) => [Number(id), h])
    );
    console.log(
      `[build-scene] lidar heights for ${lidarHeightByOsmId.size} footprints`
    );
  }

  // Microsoft ML-measured heights (fetch-ms-heights stage). Matching runs on
  // RAW lon/lat centroids (containment is projection-invariant) before any
  // ENU work; absence of the file (msHeights: false) degrades to no matches.
  let msHeightByOsmId = new Map<number, number>();
  const msPath = join(rawDir, 'ms-buildings.json');
  if (site.msHeights && !existsSync(msPath)) {
    console.warn(
      '[build-scene] msHeights is on but _raw/ms-buildings.json is missing — run the full bake (fetch-ms-heights) or set "msHeights": false; heights fall back to priors'
    );
  }
  if (site.msHeights && existsSync(msPath)) {
    const ms = JSON.parse(readFileSync(msPath, 'utf8')) as MsBuilding[];
    const centroids: { id: number; lon: number; lat: number }[] = [];
    let concaveSkips = 0;
    for (const el of osm.elements) {
      if (
        el.type === 'way' &&
        el.tags?.building &&
        el.geometry &&
        el.geometry.length >= 3
      ) {
        let lon = 0;
        let lat = 0;
        for (const g of el.geometry) {
          lon += g.lon;
          lat += g.lat;
        }
        const cLon = lon / el.geometry.length;
        const cLat = lat / el.geometry.length;
        // The vertex-mean of a concave (L/U-shaped) footprint can land
        // OUTSIDE the building — matching it against MS detections would
        // assign a NEIGHBOR's height (verified live: a 9-story hotel baked
        // 2 stories). Only ms-match buildings whose mean point is inside
        // their own ring; the rest keep their prior-based fallback.
        const ownRing = el.geometry.map(
          (g) => [g.lon, g.lat] as [number, number]
        );
        if (!pointInRing(cLon, cLat, ownRing)) {
          concaveSkips++;
          continue;
        }
        centroids.push({ id: el.id, lon: cLon, lat: cLat });
      }
    }
    msHeightByOsmId = matchMsHeights(centroids, ms);
    console.log(
      `[build-scene] Microsoft heights matched ${msHeightByOsmId.size}/${centroids.length} OSM buildings ` +
        `(${ms.length} MS detections in box, ${concaveSkips} concave footprints kept on priors)`
    );
  }

  // Way ids in heroWayIds that we've already emitted a hero for. Some hero
  // ways (e.g. a pedestrian bridge) are tagged `highway=footway` rather than
  // `building=*`, so they never enter the building branch below — this set
  // lets a fallback pass catch them from their raw geometry regardless of
  // which OSM tag shape they use.
  const heroWaysEmitted = new Set<number>();

  // Box half-extents in ENU metres. Overpass returns any way that has ANY node
  // in the bbox, and `out geom;` returns that way's FULL geometry — including
  // the parts that extend outside the box. Left unclipped, boundary-straddling
  // streets/buildings render far beyond the aerial drape (which covers only the
  // box), so the map reads as misaligned. We clip everything to the box.
  const ground = proj.groundSize();
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
      const ringEnu = el.geometry.map((g) =>
        proj.lonLatToEnu(g.lon, g.lat)
      ) as [number, number][];
      const area = ringAreaM2(ringEnu);
      const [cX, cZ] = polygonCentroid(ringEnu);
      // Drop buildings whose footprint centroid falls outside the box — these
      // are boundary-straddlers Overpass returned in full; they'd render off the
      // drape. (A hero way is never dropped: its swap tag pins a landmark.)
      const swap = heroWayIds.get(el.id);
      if (!swap && !inBox(cX, cZ)) continue;
      const { meters, rule } = resolveHeight(
        tags,
        area,
        site.heights,
        msHeightByOsmId.get(el.id),
        lidarHeightByOsmId.get(el.id)
      );
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
        const [x, z] = proj.lonLatToEnu(g.lon, g.lat);
        projected.push(x, z);
      }
      for (const sub of clipPolyline(projected)) {
        streets.push({ pts: sub.map((v) => q(v)) });
      }
    }

    // Fallback: a hero-tagged way that isn't a `building` footprint (e.g. a
    // pedestrian bridge tagged `highway=footway` + `historic=yes`) still
    // needs its hero emitted, from its own geometry — independent of whether
    // it was also recorded as a street above.
    if (
      el.type === 'way' &&
      el.geometry &&
      el.geometry.length >= 2 &&
      heroWayIds.has(el.id) &&
      !heroWaysEmitted.has(el.id)
    ) {
      const swap = heroWayIds.get(el.id)!;
      const ringEnu = el.geometry.map((g) =>
        proj.lonLatToEnu(g.lon, g.lat)
      ) as [number, number][];
      const [cx, cz] = polygonCentroid(ringEnu);
      heroes.push({ swap, x: q(cx), z: q(cz), name: tags.name ?? swap });
      heroWaysEmitted.add(el.id);
    }
  }

  // Coordinate-anchor heroes: no building way matched by id, so project the
  // fixed lon/lat straight into ENU (config-array order).
  for (const anchor of heroAnchors) {
    const [x, z] = proj.lonLatToEnu(anchor.anchor.lon, anchor.anchor.lat);
    heroes.push({ swap: anchor.slug, x: q(x), z: q(z), name: anchor.slug });
  }

  const { widthM, depthM } = ground;
  const drapePath = join(outDir, 'drape.jpg');
  if (existsSync(join(rawDir, 'drape.jpg')))
    copyFileSync(join(rawDir, 'drape.jpg'), drapePath);
  // Wide atlas aerial drape — passes straight through raw -> tmp so the atomic
  // promotion in run.ts picks it up. No manifest entry: WideCity maps it 0-1
  // across the atlasBox ground it was baked over, so no pixel dims are needed.
  if (existsSync(join(rawDir, 'drape-wide.jpg')))
    copyFileSync(
      join(rawDir, 'drape-wide.jpg'),
      join(outDir, 'drape-wide.jpg')
    );
  const drapeSrc = existsSync(join(rawDir, 'drape.jpg'))
    ? join(rawDir, 'drape.jpg')
    : existsSync(drapePath)
      ? drapePath
      : null;

  // Measure footprint-vs-aerial registration (#233): report + overlays land
  // in _raw/registration/ (local-only), the summary block goes into the
  // manifest. When the site config pins a measured vectorOffsetM, the rings
  // above are already shifted — this measures the RESIDUAL, so a corrected
  // bake should report ~0.
  let registration: Awaited<ReturnType<typeof runRegistration>> | undefined;
  if (measureReg && drapeSrc && buildings.length > 0) {
    registration = await runRegistration(
      rawDir,
      drapeSrc,
      buildings,
      widthM,
      depthM,
      opts.registrationDir
    );
  }

  const manifest = {
    box: {
      swLat: site.box.swLat,
      swLon: site.box.swLon,
      neLat: site.box.neLat,
      neLon: site.box.neLon,
    },
    groundWm: q(widthM),
    groundHm: q(depthM),
    cosLat: proj.mPerDegLon / 111320,
    drape: {
      // Filename relative to the site's asset dir (the runtime prefixes
      // /twins/<slug>/ itself).
      path: 'drape.jpg',
      // Actual fetched image dimensions (degree-aspect height, not metre-derived)
      // so the manifest matches the real drape.jpg and stays honest about what
      // was baked. Registration uses groundWm/groundHm, not these pixel counts.
      ...(() => {
        const { width, height } = drapePixelSize(proj, site.mpp);
        return { width, height };
      })(),
      mpp: site.mpp,
    },
    provenance: provenanceFor(
      site.terrain?.dataset ?? 'ned10m',
      drapeSource,
      site.msHeights,
      site.lidar != null
    ),
    fetchedAt: new Date().toISOString(),
    ruleHistogram,
    // The two georeferencing constants a globe consumer cannot recover from the
    // artifacts alone.
    //
    // vectorOffsetM: the correction APPLIED to every ring by createProjection.
    // `registration` below is the RESIDUAL after applying it, not the value —
    // so without this, inverting a baked ring back to lon/lat silently lands
    // ~0.5 m off on chatt and there is nothing to catch it.
    //
    // geoidOffsetM: terrain/height data here is NAVD88 orthometric; a globe
    // wants ellipsoidal. See site-config.ts.
    vectorOffsetM: proj.offsetM,
    geoidOffsetM: site.geoidOffsetM ?? 0,
    // Unioned here, not in the viewer: the atlas must never cover less than the
    // bake, and every consumer (live-OSM fetch, wide DEM, runtime) must agree.
    atlasBox: atlasBoxFor(site),
    ...(registration ? { registration } : {}),
    // `site.water` is a bake RESULT (did the carve find water?), filled in
    // below — the runtime uses it to gate the water mesh, so a waterless site
    // never renders a spurious pond at its terrain minimum.
    site: siteManifestBlock(site) as ReturnType<typeof siteManifestBlock> & {
      water?: boolean;
    },
  };

  writeFileSync(join(outDir, 'buildings.json'), JSON.stringify(buildings));
  writeFileSync(join(outDir, 'streets.json'), JSON.stringify(streets));
  writeFileSync(join(outDir, 'heroes.json'), JSON.stringify(heroes));

  // Carve the water into the terrain by following the AERIAL waterline (#225):
  // classify the drape's water at pixel resolution and lower every terrain sample
  // whose drape pixel is water to the water level. The bank then follows the real
  // shoreline (buildings register to the drape), instead of the ragged coarse-grid
  // edge that made riverfront buildings float. Falls back to the raw grid if the
  // drape is missing. Sites without water disable this via carveWater: false.
  const rawGrid = JSON.parse(
    readFileSync(join(rawDir, 'terrain.json'), 'utf8')
  ) as TerrainGrid;
  let carvedGrid = rawGrid;
  let carvedSamples = 0;
  if (!site.carveWater) {
    console.log('[carve-water] disabled by site config; terrain left uncarved');
  } else if (drapeSrc) {
    // The water classifier's window/threshold tuning is SCALE-dependent
    // (validated at mpp 2: 7x7 variance window ≈ 14 m). For sharper drapes,
    // classify a working copy downscaled to mpp-2 scale — preserves the tuned
    // semantics and caps classifier memory. carveToMask maps grid→mask by
    // fractions, so the mask resolution is otherwise irrelevant.
    let classifySrc = drapeSrc;
    if (site.mpp < 2) {
      const classifyPath = join(rawDir, 'drape-classify.jpg');
      await sharp(drapeSrc)
        .resize({ width: Math.round(widthM / 2) })
        .jpeg({ quality: 90 })
        .toFile(classifyPath);
      classifySrc = classifyPath;
    }
    const mask = await classifyAerialWater(classifySrc);
    const res = carveToMask(rawGrid, mask, widthM, depthM);
    carvedGrid = res.grid;
    carvedSamples = res.carved;
    const waterPx = mask.mask.reduce((a, v) => a + v, 0);
    console.log(
      `[carve-water] aerial water ${waterPx}px → ${res.carved} terrain samples lowered to ${res.waterLevel.toFixed(1)} m`
    );
  } else {
    console.log('[carve-water] no drape found; terrain left uncarved');
  }
  manifest.site.water = carvedSamples > 0;
  writeFileSync(join(outDir, 'terrain.json'), JSON.stringify(carvedGrid));

  // Ship the wide atlas DEM alongside it (#292). Copied, not carved: the water
  // carve is a box-scoped drape operation, and the wide grid exists to remove
  // the 176 m cliff at the box edge, not to add detail — the fine grid above
  // covers the site itself. Absent for sites with no atlasBox.
  const wideRaw = join(rawDir, 'terrain-wide.json');
  if (existsSync(wideRaw)) {
    copyFileSync(wideRaw, join(outDir, 'terrain-wide.json'));
  }

  // Ship the wide atlas buildings alongside it (#292). Same join
  // fetchLiveBuildings runs live at request time, computed once here so the
  // atlas's default path needs no Overpass call. It still calls a public API
  // on every load regardless — services.arcgisonline.com for base imagery,
  // unthrottled and token-free (AtlasViewer.client.tsx) — this step only
  // removes Overpass, not every third party. Absent for sites with no
  // atlasBox (no osm-wide.json was fetched).
  const osmWidePath = join(rawDir, 'osm-wide.json');
  if (existsSync(osmWidePath)) {
    const osmWide = JSON.parse(readFileSync(osmWidePath, 'utf8')) as {
      elements: {
        type: string;
        id: number;
        tags?: Record<string, string>;
        geometry?: { lat: number; lon: number }[];
      }[];
    };
    // Same scalar as manifest.cosLat below (proj.mPerDegLon / 111320, from
    // createProjection(site.box) — the NARROW baked box). buildWideBuildings'
    // OSM data spans the wide atlasBox, but resolveHeight's rule-6 area bonus
    // must use the SAME flat-earth scalar the runtime join reads off the
    // manifest, or the two silently diverge on un-baked buildings near a
    // tier threshold.
    const wideBuildings = buildWideBuildings(
      osmWide,
      buildings,
      proj.mPerDegLon / 111320
    );
    writeFileSync(
      join(outDir, 'buildings-wide.json'),
      JSON.stringify(wideBuildings)
    );
  }

  writeFileSync(
    join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  return manifest;
}
