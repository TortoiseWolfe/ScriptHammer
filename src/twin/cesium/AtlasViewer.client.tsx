'use client';
// The atlas layer: the baked twin on a georeferenced Cesium globe.
//
// Per the Build Plan's renderer split — "Cesium is the atlas, Three.js is the
// exhibit ... the data is the bridge, not the engine". Same route (/twins/<slug>),
// same baked artifacts under public/twins/<slug>/, different renderer. The R3F
// diorama is untouched and still owns the art-directed view.
//
// What this deliberately does NOT do, vs the design project's Phase 0 viewer:
//   * It does not query Overpass. The bake already resolved these footprints,
//     and its heights are better: 1328 of 1510 are measured from USGS 3DEP
//     lidar, where the Phase 0 viewer would use `levels × 3.3` or a flat 6 m.
//   * It does not extrude at a blind `height: 0`. See groundEllipsoidHeightM().
//
// Cesium is imported ONLY from here (and only through the ssr:false dynamic
// import in TwinCanvasHost), which is what keeps its ~3MB inside the `cesium`
// webpack cacheGroup and off every other route.
import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import {
  loadManifest,
  loadSiteJson,
  type Building,
  type TerrainGrid,
} from '@/lib/manifest';
import { createBakedTerrainProvider, sampleEllipsoidalM } from './terrain';
import { fetchLiveBuildings, atlasBoxFor } from './overpass';
import {
  buildingsToWgs84,
  groundEllipsoidHeightM,
  classify,
  RULE_LABELS,
  unbucketedLadderTypes,
  type AtlasBuilding,
  type ColorBy,
} from './buildings';

/** The `id` payload attached to each building GeometryInstance, and what
 *  scene.pick() hands back. Distinct from a Cesium Entity — Primitive ids are
 *  plain objects, so this shape is ours to define. */
interface AtlasPickId {
  atlasId: number;
  heightM: number;
  rule: string;
  /** Live OSM tags — name / building / addr:* / building:levels. Undefined on
   *  baked-only buildings (buildings.json has no tags by design). */
  tags?: Record<string, string>;
}

const COLOR_MODES: { id: ColorBy; label: string }[] = [
  { id: 'provenance', label: 'source' },
  { id: 'type', label: 'type' },
  { id: 'height', label: 'height' },
];

/** `semidetached_house` -> `semidetached house`; `yes` is not a type. */
function prettyType(tags?: Record<string, string>): string | null {
  const b = tags?.building;
  if (!b || b === 'yes') return null;
  return b.replace(/_/g, ' ');
}
function addressOf(tags?: Record<string, string>): string | null {
  if (!tags) return null;
  const a = [tags['addr:housenumber'], tags['addr:street']]
    .filter(Boolean)
    .join(' ');
  return a || null;
}

export default function AtlasViewer({ slug }: { slug: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [status, setStatus] = useState('starting globe…');
  const [ready, setReady] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<AtlasPickId | null>(null);
  const [colorBy, setColorBy] = useState<ColorBy>('provenance');
  const [legend, setLegend] = useState<
    { key: string; label: string; color: string; n: number }[]
  >([]);
  const placedRef = useRef<AtlasBuilding[]>([]);
  const primRef = useRef<Cesium.Primitive | null>(null);
  // The effect below runs once; these let it read/publish the live colour mode
  // without taking `colorBy` as a dependency and tearing the viewer down on
  // every toggle.
  const colorByRef = useRef<ColorBy>('provenance');
  const rebuildRef = useRef<((m: ColorBy) => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<'baked' | 'loading' | 'live' | 'offline'>(
    'baked'
  );

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let disposed = false;
    let viewer: Cesium.Viewer | null = null;
    const ac = new AbortController();

    (async () => {
      try {
        // Token-free floor, deliberately: Esri World Imagery on the ellipsoid.
        // The Build Plan's token model — works with no account; an ion token is
        // an upgrade, never a requirement.
        viewer = new Cesium.Viewer(el, {
          baseLayer: new Cesium.ImageryLayer(
            new Cesium.UrlTemplateImageryProvider({
              url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
              credit: 'Esri World Imagery',
              maximumLevel: 19,
            })
          ),
          // Replaced with the baked 3DEP provider once the grid loads.
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          timeline: false,
          animation: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
        });
        if (disposed) {
          viewer.destroy();
          return;
        }
        viewerRef.current = viewer;
        viewer.scene.globe.baseColor =
          Cesium.Color.fromCssColorString('#16162a');

        // FRAME THE SITE FIRST — before any await.
        //
        // This used to sit after the building load; once the live-OSM fetch
        // (#292) was added the camera sat behind a ~60s Overpass round-trip and
        // the user opened the page to the whole planet. Nothing downstream
        // needs to finish for us to know where the site is: the box is in the
        // manifest, and the manifest is the first thing we load.
        //
        // Oblique, not top-down. flyTo(Rectangle) frames the box from directly
        // overhead, which is the one angle where 55.5 m of 3DEP relief is
        // invisible and the view is indistinguishable from the flat-ellipsoid
        // version. Come in from the south looking north up the corridor.
        const framing = await loadManifest(slug);
        if (disposed) return;
        {
          const b = framing.box;
          const midLon = (b.swLon + b.neLon) / 2;
          const depthDeg = b.neLat - b.swLat;
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(
              midLon,
              b.swLat - depthDeg * 0.25,
              Math.max(2500, depthDeg * 110941 * 0.55)
            ),
            orientation: {
              heading: 0, // north, up the long axis
              pitch: Cesium.Math.toRadians(-32),
              roll: 0,
            },
          });
        }

        setStatus('loading baked site…');
        const manifest = framing;
        const [buildings, terrain] = await Promise.all([
          loadSiteJson<Building[]>(slug, 'buildings.json'),
          loadSiteJson<TerrainGrid>(slug, 'terrain.json'),
        ]);
        if (disposed) return;

        // USGS 3DEP, already on disk — no ion token, and finer than the World
        // Terrain the Build Plan spends a token on in its Phase 1.
        viewer.terrainProvider = createBakedTerrainProvider(manifest, terrain);
        const sample = (lon: number, lat: number) =>
          sampleEllipsoidalM(manifest, terrain, lon, lat);

        setStatus(`projecting ${buildings.length} buildings…`);
        const placed = buildingsToWgs84(
          manifest,
          buildings,
          // From the manifest now, not a per-slug constant in this file.
          manifest.vectorOffsetM ?? { x: 0, z: 0 }
        );

        // Baked first: the offline floor. Renders immediately, needs no
        // network, and is what remains if Overpass is unreachable.
        placedRef.current = placed;
        primRef.current = addBuildings(
          viewer,
          placed,
          sample,
          colorByRef.current
        );
        setLegend(legendOf(placed, colorByRef.current));
        rebuildRef.current = (m: ColorBy) => {
          if (primRef.current) viewer!.scene.primitives.remove(primRef.current);
          primRef.current = addBuildings(viewer!, placedRef.current, sample, m);
          setLegend(legendOf(placedRef.current, m));
        };
        setReady(true);
        setStatus('');

        // Then widen to the live civic extent (#292). The baked box is a
        // 1.46 km diorama corridor — 1,547 of the area's 6,099 OSM buildings.
        // Baked heights win on the overlap (1328 are lidar-measured); the rest
        // resolve through the SAME ladder via src/lib/height.ts.
        try {
          setLive('loading');
          const live = await fetchLiveBuildings(
            slug,
            manifest,
            buildings,
            ac.signal
          );
          if (disposed) return;
          // Keep the tags. Dropping them here is the bug the owner caught:
          // "everything is labeled building now? no structure type?" — we fetch
          // name/building/addr:*/levels for every building and then discard it.
          const placedLive: AtlasBuilding[] = live.map((b) => ({
            id: b.id,
            lonLat: b.lonLat,
            heightM: b.heightM,
            rule: b.rule,
            tags: b.tags,
          }));
          if (primRef.current) viewer.scene.primitives.remove(primRef.current);
          placedRef.current = placedLive;
          primRef.current = addBuildings(
            viewer,
            placedLive,
            sample,
            colorByRef.current
          );
          setLegend(legendOf(placedLive, colorByRef.current));
          // Bind the non-null viewer the enclosing block already proved — the
          // closure outlives this scope and TS cannot narrow `viewer` inside it.
          const v = viewer;
          rebuildRef.current = (m: ColorBy) => {
            if (primRef.current) v.scene.primitives.remove(primRef.current);
            primRef.current = addBuildings(v, placedRef.current, sample, m);
            setLegend(legendOf(placedRef.current, m));
          };
          setLive('live');
        } catch {
          // Additive by design: keep the baked layer and say so, rather than
          // failing the view over a third-party endpoint.
          if (!disposed) setLive('offline');
        }

        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((m: { position: Cesium.Cartesian2 }) => {
          const picked = viewer!.scene.pick(m.position) as
            | { id?: Partial<AtlasPickId> }
            | undefined;
          const id = picked?.id;
          // Guard on the discriminant: scene.pick() also returns imagery/globe
          // hits whose id is undefined or some other shape entirely.
          setSelected(
            typeof id?.atlasId === 'number' ? (id as AtlasPickId) : null
          );
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Scripted-probe handle, same idea as TwinCanvas's window.__twinPerf:
        // Cesium is an ES module here, so there is no window.Cesium for a
        // capture script to reach through. The verification that matters for
        // this layer — is the terrain real, do buildings sit ON it, does the
        // datum hold — needs an oblique camera and a height query, and neither
        // is reachable from the DOM. Exposing the viewer is what makes those
        // claims checkable instead of asserted.
        (
          window as unknown as {
            __atlas?: {
              viewer: Cesium.Viewer;
              sampleEllipsoidalM: (lon: number, lat: number) => number;
              geoidOffsetM: number;
            };
          }
        ).__atlas = {
          viewer,
          sampleEllipsoidalM: sample,
          geoidOffsetM: manifest.geoidOffsetM ?? 0,
        };
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      disposed = true;
      ac.abort();
      const v = viewerRef.current;
      viewerRef.current = null;
      if (v && !v.isDestroyed()) v.destroy();
    };
  }, [slug]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-base-300 relative h-screen w-full">
      <div ref={mountRef} className="absolute inset-0" />

      {/* DOM chrome, not canvas — CI has no guaranteed WebGL (playwright.config
          sets no launchOptions.args), so the E2E spec asserts on this and gates
          the canvas behind a WebGL probe. Same tactic as twins.spec.ts. */}
      <div
        data-testid="atlas-hud"
        className="pointer-events-none absolute top-0 left-0 z-10 p-3"
      >
        <div className="bg-base-100/85 rounded-box pointer-events-auto p-3 shadow-lg backdrop-blur">
          <div className="text-sm font-semibold">Atlas — {slug}</div>
          <div className="text-base-content/60 font-mono text-[11px]">
            {error
              ? `error: ${error}`
              : ready
                ? `${total} buildings · ${
                    live === 'live'
                      ? 'live OSM + baked lidar'
                      : live === 'loading'
                        ? 'baked · widening to live OSM…'
                        : live === 'offline'
                          ? 'baked only (Overpass unreachable)'
                          : 'baked'
                  } · 3DEP · no token`
                : status}
          </div>
          {ready && (
            <>
              <div className="mt-2 flex gap-1" data-testid="atlas-colorby">
                {COLOR_MODES.map((m) => (
                  <button
                    key={m.id}
                    className={`btn btn-xs min-h-0 ${colorBy === m.id ? 'btn-primary' : ''}`}
                    onClick={() => {
                      setColorBy(m.id);
                      colorByRef.current = m.id;
                      rebuildRef.current?.(m.id); // recolour, never re-fetch
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <ul className="mt-2 space-y-0.5">
                {legend.map((row) => (
                  <li
                    key={row.key}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: row.color }}
                    />
                    <span className="font-mono">{row.n}</span>
                    <span className="text-base-content/60">{row.label}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {selected && (
        <div className="bg-base-100/90 rounded-box absolute top-3 right-3 z-10 w-64 p-3 shadow-lg backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 text-sm font-semibold">
              {selected.tags?.name ??
                (prettyType(selected.tags)
                  ? prettyType(selected.tags)!.replace(/^./, (c) =>
                      c.toUpperCase()
                    )
                  : 'Untyped building')}
            </div>
            <button
              className="btn btn-xs min-h-0"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="mt-2 font-mono text-2xl">
            {selected.heightM.toFixed(1)} m
          </div>
          <div className="text-base-content/70 mt-1 text-[11px]">
            {RULE_LABELS[selected.rule] ?? selected.rule}
          </div>
          {/* Only rows we actually have. 85% of the box is building=yes with no
              name/address, so rendering empty rows would be noise on most
              clicks — and the absence IS the civic ask. */}
          <div className="mt-2 space-y-1">
            {prettyType(selected.tags) && (
              <Row k="Type" v={prettyType(selected.tags)!} />
            )}
            {selected.tags?.['building:levels'] && (
              <Row k="Levels" v={selected.tags['building:levels']} />
            )}
            {addressOf(selected.tags) && (
              <Row k="Address" v={addressOf(selected.tags)!} />
            )}
          </div>
          {!selected.tags?.name && !prettyType(selected.tags) && (
            <div className="border-warning text-base-content/60 mt-2 border-l-2 pl-2 text-[11px] leading-snug">
              Untyped in OpenStreetMap (
              <span className="font-mono">building=yes</span>). 85% of downtown
              is. Tag it and it appears here on the next load.
            </div>
          )}
          <a
            className="link link-primary mt-2 block text-[11px]"
            href={`https://www.openstreetmap.org/way/${selected.atlasId}`}
            target="_blank"
            rel="noreferrer"
          >
            OSM way {selected.atlasId} →
          </a>
        </div>
      )}
    </div>
  );
}

/** One construction path for both the baked and the live building sets, so the
 *  two cannot drift in how they extrude, colour, or pick. */
function addBuildings(
  viewer: Cesium.Viewer,
  list: AtlasBuilding[],
  sample: (lon: number, lat: number) => number,
  mode: ColorBy
): Cesium.Primitive {
  const instances: Cesium.GeometryInstance[] = [];
  for (const b of list) {
    const base = groundEllipsoidHeightM(b, sample);
    const { color } = classify(b, mode);
    try {
      instances.push(
        new Cesium.GeometryInstance({
          geometry: new Cesium.PolygonGeometry({
            polygonHierarchy: new Cesium.PolygonHierarchy(
              Cesium.Cartesian3.fromDegreesArray(b.lonLat)
            ),
            height: base,
            extrudedHeight: base + b.heightM,
            vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
          }),
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(
              Cesium.Color.fromCssColorString(color)
            ),
          },
          // tags ride along: the card is the whole reason we fetch them.
          id: {
            atlasId: b.id,
            heightM: b.heightM,
            rule: b.rule,
            tags: b.tags,
          },
        })
      );
    } catch {
      // A self-intersecting OSM ring throws inside PolygonGeometry; drop the
      // building rather than the whole layer.
    }
  }
  return viewer.scene.primitives.add(
    new Cesium.Primitive({
      geometryInstances: instances,
      appearance: new Cesium.PerInstanceColorAppearance({
        translucent: false,
        closed: true,
      }),
      asynchronous: true,
    })
  );
}

function legendOf(
  list: AtlasBuilding[],
  mode: ColorBy
): { key: string; label: string; color: string; n: number }[] {
  const m = new Map<
    string,
    { key: string; label: string; color: string; n: number }
  >();
  for (const b of list) {
    const c = classify(b, mode);
    const hit = m.get(c.key);
    if (hit) hit.n++;
    else m.set(c.key, { ...c, n: 1 });
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[64px_1fr] gap-2 text-[11px]">
      <span className="text-base-content/50">{k}</span>
      <span className="font-mono break-words">{v}</span>
    </div>
  );
}
