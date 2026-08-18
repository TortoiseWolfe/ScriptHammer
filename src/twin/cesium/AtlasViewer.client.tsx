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
  landmarkStops,
  cornerStops,
  resolveGround,
  describeTargets,
  shouldAutoStart,
  type TourStop,
} from './tour';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  buildingsToWgs84,
  groundSpanM,
  classify,
  unbucketedLadderTypes,
  DEFAULT_COLOR_BY,
  type AtlasBuilding,
  type ColorBy,
} from './buildings';
import {
  BuildingCard,
  prettyType,
  addressOf,
  type BuildingCardModel,
} from './BuildingCard';

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

export default function AtlasViewer({ slug }: { slug: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [status, setStatus] = useState('starting globe…');
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<AtlasPickId | null>(null);
  const [colorBy, setColorBy] = useState<ColorBy>(DEFAULT_COLOR_BY);
  const [legend, setLegend] = useState<
    { key: string; label: string; color: string; n: number }[]
  >([]);
  const placedRef = useRef<AtlasBuilding[]>([]);
  const primRef = useRef<Cesium.Primitive | null>(null);
  // The effect below runs once; these let it read/publish the live colour mode
  // without taking `colorBy` as a dependency and tearing the viewer down on
  // every toggle.
  const colorByRef = useRef<ColorBy>(DEFAULT_COLOR_BY);
  const rebuildRef = useRef<((m: ColorBy) => void) | null>(null);
  // Index-based, not just "the current stop": a tour you can only watch is a
  // demo. Prev/next must know where they are in which list.
  const [tour, setTour] = useState<{ list: TourStop[]; i: number } | null>(
    null
  );
  const tourRef = useRef<{
    stops: TourStop[];
    corners: TourStop[];
    play: (list: TourStop[]) => void;
    stop: () => void;
    goTo: (s: TourStop) => void;
    step: (d: number) => void;
  } | null>(null);
  const tourAbort = useRef<{ cancelled: boolean } | null>(null);
  const rebuildTourRef = useRef<((l: AtlasBuilding[]) => void) | null>(null);
  const hiRef = useRef<Cesium.Primitive | null>(null);
  // matchMedia, no provider — the SAME hook Scene.tsx:85 uses to gate
  // auto-orbit. AccessibilityContext's settings.reduceMotion throws without a
  // provider and no 3D code reads it (#292 task-4 brief).
  const reducedMotion = useReducedMotion();
  // The main effect below only depends on [slug] (see colorByRef's comment
  // above); buildTour needs the LIVE value at the moment it fires, so it's
  // mirrored into a ref rather than added as an effect dependency, which
  // would tear the viewer down whenever the OS preference changes mid-visit.
  const reducedMotionRef = useRef(reducedMotion);
  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);
  // The tour plays itself once, the first time stops exist (#292). This
  // guards against firing twice: buildTour runs again once the live/wide
  // building fetch resolves (rebuildTourRef), and a rebuild must not restart
  // a tour the user already cancelled by dragging or clicking stop.
  const autoStartedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  // 'wide' = widened via the baked buildings-wide.json (the default path,
  // #292); 'live' = widened via a real Overpass request (?live). Distinct
  // states so the HUD below can say which one actually happened instead of
  // reporting 'live' for both, which was Task 1's regression (#292 review).
  const [live, setLive] = useState<
    'baked' | 'loading' | 'wide' | 'live' | 'offline'
  >('baked');
  // window.location.search, NOT useSearchParams — same convention as
  // TwinCanvasHost's ?atlas and TwinCanvas's ?house/?ortho; useSearchParams
  // forces a Suspense bailout under output:'export'. Safe to read during
  // render here because AtlasViewer only ever renders behind TwinCanvasHost's
  // dynamic(ssr:false) branch, so there is no hydration mismatch to create.
  // This is the SAME signal fetchLiveBuildings (overpass.ts) checks
  // internally to pick its path — read here too so the HUD reports what
  // actually happened rather than assuming.
  const isLiveQuery =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('live');

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    // Reset the auto-start guard on every slug change (#292 review, fix-now
    // minor #1) — without this, navigating from one twin to another inside
    // the same session left autoStartedRef permanently true, silently
    // suppressing the new site's auto-play tour.
    autoStartedRef.current = false;
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
        // Cesium defaults this to FALSE: primitives draw over the globe
        // regardless of depth, so a building behind a ridge paints on top of it
        // and reads as hovering in mid-air. Invisible while the terrain was flat;
        // obvious the moment the wide DEM put real hillsides in the view.
        //
        // Trade-off for later: this also depth-tests billboards/labels, so the
        // splat pins and live-layer markers (#292) will need
        // disableDepthTestDistance when they land. The atlas has none today.
        viewer.scene.globe.depthTestAgainstTerrain = true;

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
          // Frame the ATLAS extent, not `box`.
          //
          // `box` is the DIORAMA's 1.46 x 5.79 km corridor. Everything else now
          // works at atlasBox scale (5.66 x 7.57 km — terrain, and 8031 live
          // buildings), so framing `box` put the ground centre of frame at
          // ~35.050: the river sat at the top edge and the whole North Shore was
          // horizon haze. The buildings were all there and mostly unseeable.
          const b = framing.atlasBox ?? framing.box;
          const midLon = (b.swLon + b.neLon) / 2;
          const depthDeg = b.neLat - b.swLat;
          const depthM = depthDeg * 110941;
          // Pull back far enough that the far edge clears the horizon at this
          // pitch: ground-distance to frame centre is alt/tan(pitch), so an
          // altitude of ~depth*0.55 puts centre-of-frame near the box middle.
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(
              midLon,
              b.swLat - depthDeg * 0.28,
              Math.max(2500, depthM * 0.62)
            ),
            orientation: {
              heading: 0, // north, up the long axis
              pitch: Cesium.Math.toRadians(-34),
              roll: 0,
            },
          });
        }

        setStatus('loading baked site…');
        const manifest = framing;
        const [buildings, fine, wide] = await Promise.all([
          loadSiteJson<Building[]>(slug, 'buildings.json'),
          loadSiteJson<TerrainGrid>(slug, 'terrain.json'),
          // Coarse DEM over the atlas extent. Optional: a site with no atlasBox
          // (or a pre-2026-07 bake) has none, and the ladder degrades to
          // fine + clamp rather than dropping a 176 m cliff at the box edge.
          loadSiteJson<TerrainGrid>(slug, 'terrain-wide.json').catch(
            () => undefined
          ),
        ]);
        const terrain = { fine, wide };
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
        // Publish the probe handle HERE — before the live fetch, not after it.
        //
        // Cesium is an ES module so there is no window.Cesium for a capture
        // script to reach through, and the claims that matter for this layer
        // (is the terrain real, do buildings sit ON it, is the camera framing
        // the right box) need an oblique camera and height queries. Published
        // after the Overpass round-trip, the handle was simply absent for 60s+
        // — worse under a 429 mirror fallback — so probes saw `undefined` and
        // read it as "broken" rather than "not yet".
        //
        // `placed` is a ref, not a snapshot: Cesium frees
        // Primitive.geometryInstances once built, so the rendered geometry is
        // unreadable afterwards and this is the ONLY way to ask where the
        // buildings actually are. That question is what caught the camera
        // framing the diorama box while the data covered the atlas box.
        (
          window as unknown as {
            __atlas?: {
              viewer: Cesium.Viewer;
              sampleEllipsoidalM: (lon: number, lat: number) => number;
              geoidOffsetM: number;
              manifest: typeof manifest;
              placed: { current: AtlasBuilding[] };
              tour: { current: unknown };
            };
          }
        ).__atlas = {
          viewer,
          sampleEllipsoidalM: sample,
          geoidOffsetM: manifest.geoidOffsetM ?? 0,
          manifest,
          placed: placedRef,
          tour: tourRef,
        };
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

        // ── Tour ────────────────────────────────────────────────────────────
        const v2 = viewer;
        // 1.2s, not 2.5s. Seven stops at 2.5s fly + 5s dwell was 52 seconds of
        // sitting still with no way out.
        const FLY_S = 1.2;
        // HIGHLIGHT.chatt is 8031 near-identical boxes; a caption saying "13.5 m,
        // measured" is useless if you cannot tell WHICH box it means. Yellow is
        // deliberately outside the provenance palette (blue/green/orange/red/
        // yellow-ochre) — a selection colour must not read as a data value.
        const HI = Cesium.Color.fromCssColorString('#ffe14d');
        const highlight = (st: TourStop) => {
          if (hiRef.current) {
            v2.scene.primitives.remove(hiRef.current);
            hiRef.current = null;
          }
          if (!st.target) return;
          const b = placedRef.current.find((x) => x.id === st.target!.id);
          if (!b) return;
          const { baseM, topM } = groundSpanM(b, sample);
          try {
            hiRef.current = v2.scene.primitives.add(
              new Cesium.Primitive({
                geometryInstances: new Cesium.GeometryInstance({
                  geometry: new Cesium.PolygonGeometry({
                    polygonHierarchy: new Cesium.PolygonHierarchy(
                      Cesium.Cartesian3.fromDegreesArray(b.lonLat)
                    ),
                    // A hair above the massing box: same span, nudged, so it
                    // reads as a highlight rather than z-fighting with itself.
                    height: baseM,
                    extrudedHeight: topM + 0.5,
                    vertexFormat:
                      Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
                  }),
                  attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(HI),
                  },
                }),
                appearance: new Cesium.PerInstanceColorAppearance({
                  translucent: false,
                  closed: true,
                }),
                asynchronous: false, // must appear WITH the caption, not after
              })
            );
          } catch {
            // self-intersecting ring — skip the highlight, keep the stop
          }
        };

        const goTo = (st: TourStop) => {
          highlight(st);
          v2.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              st.lon,
              st.lat,
              st.heightM
            ),
            orientation: {
              heading: st.headingRad,
              pitch: st.pitchRad,
              roll: 0,
            },
            duration: FLY_S,
          });
        };
        const stopTour = () => {
          if (tourAbort.current) tourAbort.current.cancelled = true;
          tourAbort.current = null;
          if (hiRef.current) {
            v2.scene.primitives.remove(hiRef.current);
            hiRef.current = null;
          }
          setTour(null);
        };
        // Autoplay and the prev/next buttons drive the SAME path — two ways to
        // move that disagree is how "next" lands somewhere the caption is not
        // describing.
        const step = (d: number) => {
          if (tourAbort.current) {
            tourAbort.current.cancelled = true; // stepping by hand ends autoplay
            tourAbort.current = null;
          }
          setTour((cur) => {
            if (!cur) return cur;
            const n = cur.list.length;
            const idx = (((cur.i + d) % n) + n) % n; // wraps both ways
            goTo(cur.list[idx]);
            return { list: cur.list, i: idx };
          });
        };
        const play = async (list: TourStop[]) => {
          if (tourAbort.current) tourAbort.current.cancelled = true;
          const token = { cancelled: false };
          tourAbort.current = token;
          for (let i = 0; i < list.length; i++) {
            if (token.cancelled || disposed) return;
            setTour({ list, i });
            goTo(list[i]);
            // Dwell capped: the authored 5s was tuned for a cinematic diorama
            // flythrough, not for reading a data card.
            const dwellMs = Math.min(list[i].dwell, 2.5) * 1000;
            await new Promise((r) => setTimeout(r, FLY_S * 1000 + dwellMs));
          }
          if (!token.cancelled) tourAbort.current = null;
        };
        const buildTour = (list: AtlasBuilding[]) => {
          const cos = manifest.cosLat;
          tourRef.current = {
            stops: describeTargets(landmarkStops(manifest, fine), list, cos),
            // Corner stops are placed against LIVE terrain, not the authored ENU
            // frame — resolveGround uses the same ground definition the terrain
            // provider renders, so a stop cannot end up inside a hill.
            corners: describeTargets(
              resolveGround(cornerStops(manifest, fine, list), sample),
              list,
              cos
            ),
            play,
            stop: stopTour,
            goTo,
            step,
          };
          // Auto-start (#292): fire once, the first time stops exist — not on
          // page load, since there are none until buildTour runs the first
          // time. The ref guard means the SECOND buildTour call (after the
          // live/wide fetch resolves) never re-attempts, whether or not the
          // first attempt actually played.
          if (!autoStartedRef.current) {
            autoStartedRef.current = true;
            const notour = new URLSearchParams(window.location.search).has(
              'notour'
            );
            if (
              shouldAutoStart({
                hasStops: tourRef.current.stops.length > 0,
                notour,
                reducedMotion: reducedMotionRef.current,
              })
            ) {
              tourRef.current.play(tourRef.current.stops);
            }
          }
        };
        buildTour(placed);
        rebuildTourRef.current = buildTour;
        setReady(true);
        setStatus('');

        // Then widen to the baked civic extent (#292's default path — this
        // only becomes a LIVE Overpass fetch behind ?live). The baked box is a
        // 1.46 km diorama corridor; buildings-wide.json widens it to the full
        // atlas extent — 8031 buildings, 1510 of which keep their baked height
        // (1328 of those measured from USGS 3DEP lidar). The rest resolve
        // through the SAME ladder via src/lib/height.ts.
        //
        // Read fresh here (not the render-scope `isLiveQuery`) so this effect
        // doesn't have to list it as a dependency — the query string cannot
        // change without a navigation, which already remounts this effect via
        // `slug`.
        const isLiveQuery = new URLSearchParams(window.location.search).has(
          'live'
        );
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
          rebuildTourRef.current?.(placedLive); // corners follow the live extremes
          // Bind the non-null viewer the enclosing block already proved — the
          // closure outlives this scope and TS cannot narrow `viewer` inside it.
          const v = viewer;
          rebuildRef.current = (m: ColorBy) => {
            if (primRef.current) v.scene.primitives.remove(primRef.current);
            primRef.current = addBuildings(v, placedRef.current, sample, m);
            setLegend(legendOf(placedRef.current, m));
          };
          // fetchLiveBuildings resolves on BOTH paths (the default fetch of
          // buildings-wide.json AND the ?live Overpass query) — isLiveQuery
          // is what actually distinguishes them, not the fact it resolved.
          setLive(isLiveQuery ? 'live' : 'wide');
        } catch {
          // buildings-wide.json is OPTIONAL, exactly like terrain-wide.json
          // (loadSiteJson('terrain-wide.json').catch(() => undefined) above) —
          // a site with no atlasBox never had one baked, and that is the
          // NORMAL state for such a site, not a failure. Only a real ?live
          // Overpass failure (every mirror down) is 'offline'; the default
          // path's baked layer simply stays 'baked', with no "unreachable"
          // claim (#292 review B1b — defence-in-depth alongside B1a, which
          // keeps a site with no atlasBox off the atlas entirely).
          if (!disposed) setLive(isLiveQuery ? 'offline' : 'baked');
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

  // Abort the tour on GLOBE interaction — registered on the Cesium mount
  // element (mountRef), NOT `document`, and NOT the Cesium
  // ScreenSpaceEventHandler above. That handler is created only after the
  // live-fetch await the effect above budgets at 60s+, while auto-start fires
  // well before it (inside buildTour, right after the baked layer renders) —
  // an abort hooked to the Cesium handler would be inert for exactly the
  // window the tour is playing. This is the same needs-no-Cesium-object
  // pattern Scene.tsx:~112 uses for auto-orbit.
  //
  // #292 review B2: this used to listen on `document` and allowlist two
  // testids as "the tour's own chrome" — but `document` sees EVERY page
  // interaction, not just the globe's, including things nowhere near this
  // component: CookieConsent's "Accept All" (src/app/layout.tsx renders it as
  // a sibling of the twin route, fixed z-[60]), GlobalNav, PWAInstall
  // (fixed, floating over the globe), CountdownBanner, SetupBanner. A
  // first-time visitor — exactly who the auto-playing tour and the OG card
  // exist to hook — loses the tour the moment they click the cookie banner
  // that's already on screen. The spec asks for "globe interaction — drag,
  // zoom, click"; mountRef IS the globe (the div Cesium.Viewer was
  // constructed on) and every one of the chrome panels above is a DOM
  // SIBLING of it, not a descendant, so listening here scopes correctly by
  // construction — no allowlist needed, the tour's own HUD/caption panels
  // are siblings too.
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const abort = () => tourRef.current?.stop();
    const opts = { passive: true } as const;
    el.addEventListener('pointerdown', abort, opts);
    el.addEventListener('wheel', abort, opts);
    el.addEventListener('touchstart', abort, opts);
    return () => {
      el.removeEventListener('pointerdown', abort);
      el.removeEventListener('wheel', abort);
      el.removeEventListener('touchstart', abort);
    };
  }, []);

  // From the legend — the ONE tally. A second count source is what made the
  // headline read '0 buildings' over a correct 8031-building legend.
  const total = legend.reduce((a, r) => a + r.n, 0);

  return (
    // THE SCENE IS THE PAGE (#301). `fixed; inset:0`, not `relative h-screen`.
    //
    // `relative h-screen` made this 100vh tall starting at y=65 (below the
    // sticky nav) inside a document that also renders pb-14 + a footer, so the
    // body measured 871 against a 630 viewport -- 241px of scroll. Scrolling
    // slid this container up under the sticky nav while the HUD (z-10) lost to
    // the nav (z-50), which is how the `type` chip became unreachable and why
    // it "rendered fine now and randomly glitched later": the variable was
    // scroll position, not time.
    //
    // Taking the scene out of flow collapses the flex-1 wrapper to free space,
    // so the body is exactly the viewport and THE PAGE CANNOT SCROLL -- the HUD
    // cannot hide because there is no scroll to hide it. Measured live:
    // scrollHeight 871 -> 630 == innerHeight. It also un-clips the globe's
    // bottom, the other half of this same bug, and retires the 100dvh question:
    // `inset:0` computes no length, so there is no unit to be unstable on
    // mobile.
    //
    // No z-index, deliberately: a positioned element with z-index:auto paints
    // at step 8 and the nav's z-50 at step 9, so the scene lands BEHIND the
    // chrome by construction. Adding z-0 here would only invite someone to
    // "fix" it later.
    //
    // bg-base-300 stays: it is the pre-WebGL / error backdrop.
    <div className="bg-base-300 fixed inset-0">
      <div ref={mountRef} className="absolute inset-0" />

      {/* DOM chrome, not canvas — CI has no guaranteed WebGL (playwright.config
          sets no launchOptions.args), so the E2E spec asserts on this and gates
          the canvas behind a WebGL probe. Same tactic as twins.spec.ts. */}
      {/* top-[--nav-h], not top-0: the container now starts at y=0, BEHIND the
          nav. This puts the panel back at y=77 -- the exact panelTop the owner
          already accepts at scroll 0, now unconditional. */}
      <div
        data-testid="atlas-hud"
        className="pointer-events-none absolute top-[var(--nav-h)] left-0 z-10 p-3"
      >
        {/* max-w-64 (#307). The panel is intrinsically sized, so its width was
            set by its single longest line -- the status line below, at 383px of
            `8031 buildings · baked OSM + baked lidar · 3DEP · no token`. Every
            other row needs <=222px, so ~40% of the panel was empty space
            existing to hold one string of pipeline provenance: the line least
            about Chattanooga was dictating the size of the thing that describes
            it. Capping the width makes that line wrap instead of dictate.
            Measured: 407x304 -> ~256x336, about -30% area.
            A cap, not a fixed width: the panel must still shrink for short
            slugs, and must still grow taller (never clip) when
            --font-scale-factor reaches 2.125. */}
        <div className="bg-base-100/85 rounded-box pointer-events-auto max-w-64 p-3 shadow-lg backdrop-blur">
          <div className="text-sm font-semibold">Atlas — {slug}</div>
          <div className="text-base-content font-mono text-[11px]">
            {error
              ? `error: ${error}`
              : ready
                ? `${total} buildings · ${
                    live === 'live'
                      ? 'live OSM + baked lidar'
                      : live === 'wide'
                        ? 'baked OSM + baked lidar'
                        : live === 'loading'
                          ? isLiveQuery
                            ? 'baked · widening to live OSM…'
                            : 'baked · widening to baked OSM…'
                          : // 'offline' is only ever set on a ?live request
                            // whose mirrors all failed (see the catch above) —
                            // a missing buildings-wide.json on the default
                            // path is optional-by-design and stays 'baked',
                            // never a claim of unreachability.
                            live === 'offline'
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
              <div className="mt-2" data-testid="atlas-tour">
                {/* Full-width primary, not a chip: this was a btn-xs min-h-0
                    control — below the 44px touch target CLAUDE.md mandates —
                    fifth in a row of near-identical chips, guarding the best
                    thing on the page. It now auto-plays on arrival too (#292
                    shouldAutoStart); this button is how you replay it or start
                    it after ?notour suppressed the auto-flight. */}
                <button
                  className="btn btn-primary btn-sm min-h-11 w-full"
                  onClick={() => tourRef.current?.play(tourRef.current.stops)}
                  disabled={!tourRef.current?.stops.length}
                >
                  ▶ Play tour
                </button>
                <div className="mt-2 flex gap-1">
                  <button
                    className="btn btn-xs min-h-0"
                    title="Fly the four baked-box corners — where the fine/wide DEM seam, the drape edge and lidar coverage all end"
                    onClick={() =>
                      tourRef.current?.play(tourRef.current.corners)
                    }
                    disabled={!tourRef.current?.corners.length}
                  >
                    ⊹ corners
                  </button>
                </div>
                {/* Stop lives on the caption now, next to prev/next — the
                    controls belong where you are reading, not in the launcher. */}
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
                    <span className="text-base-content">{row.label}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* One card for the tour caption AND the click-to-inspect card (#303) —
          a tour stop IS a selected building. `selected` wins if both are set (a
          manual click over autoplay); in practice a click's pointerdown stops
          the tour before its LEFT_CLICK selects (see the mountRef listener), so
          they do not coexist. */}
      {(() => {
        let model: BuildingCardModel | null = null;
        if (selected) {
          const typed = prettyType(selected.tags);
          model = {
            name:
              selected.tags?.name ??
              (typed
                ? typed.replace(/^./, (c) => c.toUpperCase())
                : 'Untyped building'),
            onClose: () => setSelected(null),
            facts: {
              heightM: selected.heightM,
              rule: selected.rule,
              osmWayId: selected.atlasId,
            },
            // {} not undefined: a baked-only building has no tags but is still a
            // click, so the "untyped — tag it" ask (which keys off tags !==
            // undefined) still shows.
            tags: selected.tags ?? {},
          };
        } else if (tour) {
          const stop = tour.list[tour.i];
          model = {
            name: stop.name,
            onClose: () => tourRef.current?.stop(),
            facts: stop.target
              ? {
                  heightM: stop.target.heightM,
                  rule: stop.target.rule,
                  osmWayId: stop.target.id,
                }
              : undefined,
            tour: {
              index: tour.i,
              total: tour.list.length,
              blurb: stop.blurb,
              onPrev: () => tourRef.current?.step(-1),
              onNext: () => tourRef.current?.step(1),
              nearby: stop.target?.nearby ?? 0,
              nearbyMeasured: stop.target?.nearbyMeasured ?? 0,
            },
          };
        }
        return model ? <BuildingCard model={model} /> : null;
      })()}
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
    // base = under every vertex (never floats); top = over the highest vertex
    // by the building's full height (never buries). See groundSpanM.
    const { baseM, topM } = groundSpanM(b, sample);
    const { color } = classify(b, mode);
    try {
      instances.push(
        new Cesium.GeometryInstance({
          geometry: new Cesium.PolygonGeometry({
            polygonHierarchy: new Cesium.PolygonHierarchy(
              Cesium.Cartesian3.fromDegreesArray(b.lonLat)
            ),
            height: baseM,
            extrudedHeight: topM,
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
