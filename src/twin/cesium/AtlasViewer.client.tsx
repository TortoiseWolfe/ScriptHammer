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
import {
  buildingsToWgs84,
  groundEllipsoidHeightM,
  RULE_COLORS,
  RULE_LABELS,
  type AtlasBuilding,
} from './buildings';

/** The `id` payload attached to each building GeometryInstance, and what
 *  scene.pick() hands back. Distinct from a Cesium Entity — Primitive ids are
 *  plain objects, so this shape is ours to define. */
interface AtlasPickId {
  atlasId: number;
  heightM: number;
  rule: string;
}

export default function AtlasViewer({ slug }: { slug: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [status, setStatus] = useState('starting globe…');
  const [ready, setReady] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<AtlasPickId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let disposed = false;
    let viewer: Cesium.Viewer | null = null;

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

        setStatus('loading baked site…');
        const [manifest, buildings, terrain] = await Promise.all([
          loadManifest(slug),
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

        const instances: Cesium.GeometryInstance[] = [];
        const tally: Record<string, number> = {};
        for (const b of placed) {
          tally[b.rule] = (tally[b.rule] ?? 0) + 1;
          const base = groundEllipsoidHeightM(b, sample);
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
                    Cesium.Color.fromCssColorString(b.cssColor)
                  ),
                },
                id: { atlasId: b.id, heightM: b.heightM, rule: b.rule },
              })
            );
          } catch {
            // A self-intersecting OSM ring throws inside PolygonGeometry; drop
            // the building rather than the whole layer.
          }
        }
        if (disposed) return;

        viewer.scene.primitives.add(
          new Cesium.Primitive({
            geometryInstances: instances,
            appearance: new Cesium.PerInstanceColorAppearance({
              translucent: false,
              closed: true,
            }),
            asynchronous: true,
          })
        );
        setCounts(tally);

        // Frame the site from its own baked box — no hardcoded camera.
        const { box } = manifest;
        viewer.camera.flyTo({
          destination: Cesium.Rectangle.fromDegrees(
            box.swLon,
            box.swLat,
            box.neLon,
            box.neLat
          ),
          duration: 0,
        });

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

        setReady(true);
        setStatus('');
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      disposed = true;
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
                ? `${total} baked buildings · 3DEP terrain · Esri · no token`
                : status}
          </div>
          {ready && (
            <ul className="mt-2 space-y-0.5">
              {Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .map(([rule, n]) => (
                  <li
                    key={rule}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background: RULE_COLORS[rule] ?? RULE_COLORS.fallback,
                      }}
                    />
                    <span className="font-mono">{n}</span>
                    <span className="text-base-content/60">
                      {RULE_LABELS[rule] ?? rule}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      {selected && (
        <div className="bg-base-100/90 rounded-box absolute top-3 right-3 z-10 w-64 p-3 shadow-lg backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-semibold">
              Building {selected.atlasId}
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
