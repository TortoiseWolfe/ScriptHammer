'use client';

// Digital-twin composition root (#232). Mounts the generic 3D stage
// (StageCore + Rig) with per-site content (TwinWorld + optional Trolley)
// inside an R3F <Canvas>, plus the generic <Hud> as a DOM sibling. Everything
// site-specific arrives as data: the baked manifest's `site` block plus the
// framing derived from the model's true extents (src/lib/framing.ts).

import { Canvas, useThree, useFrame } from '@react-three/fiber';
import {
  NoToneMapping,
  LinearSRGBColorSpace,
  type DirectionalLight,
  type Group,
  type Vector3,
} from 'three';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StageCore, { StageHandle } from '@/stage/StageCore';
import { Rig, RigMode, RigWaypoint } from '@/stage/Rig';
import TwinWorld from '@/world/TwinWorld';
import Trolley from '@/agents/trolley';
import Hud, { HudCaption, HudLink, HudOption, HudSlider } from '@/stage/Hud';
import PlacementEditor from './PlacementEditor';
import SelectedBuildingCard from './SelectedBuildingCard';
import WarehouseGizmo from './WarehouseGizmo';
import { useWarehouseEditor } from './useWarehouseEditor';
import type { ModelGroupRegistry } from '@/world/WarehouseModels';
import { computeDay } from '@/stage/lightRig';
import { PALETTES, applyProfile } from '@/packs/themes';
import {
  loadHouse,
  loadLocalLinks,
  loadManifest,
  loadWarehouseModels,
} from '@/lib/manifest';
import type {
  HouseInfo,
  Manifest,
  PaletteKey,
  TourWaypoint,
  TwinLink,
  TwinPlacementOverride,
  WarehouseModelsInfo,
} from '@/lib/manifest';
import { hasWideExtent } from '@/lib/manifest';
import { createProjection } from '@/lib/enu';
import { deriveFraming, type Framing, type OrthoFrame } from '@/lib/framing';
import { getInternalUrl } from '@/config/project.config';

/** 'house' focuses the camera on the as-built parcel (the property view).
 *  Reached via the `?house` query param — a dedicated route can't exist under
 *  output:'export' because house assets are never in the committed tree, so a
 *  route's generateStaticParams would be empty (which static export rejects). */
export type TwinFocus = 'twin' | 'house';

/** The camera dock: the Rig's modes plus the pseudo-mode 'ortho' (true
 *  orthographic top-down — StageCore renders it directly; the Rig idles). */
type CameraMode = RigMode | 'ortho';

/** The camera dock for a site's data: every entry must DO something — Tour
 *  needs waypoints, Ride needs a trolley to board (an unboarded follow mode
 *  just chases an invisible avatar: the "does nothing" mode the dock used to
 *  ship). Pure for unit tests. */
export function modesForSite(
  hasTour: boolean,
  hasTrolley: boolean
): HudOption[] {
  // Walk and Top-down are `secondary` — real modes, but niche (Walk is
  // disorienting at diorama scale; Top-down is a registration diagnostic), so
  // the HUD tucks them in the ⋯ overflow. The array ORDER and LENGTH are
  // unchanged so the position-based digit-key shortcuts below keep mapping to
  // the same modes.
  return [
    ...(hasTour ? [{ key: 'tour', label: 'Tour' }] : []),
    { key: 'orbit', label: 'Miniature' },
    ...(hasTrolley ? [{ key: 'follow', label: 'Ride' }] : []),
    { key: 'walk', label: 'Walk', secondary: true },
    { key: 'ortho', label: 'Top-down', secondary: true },
  ];
}

/** One-line control hints for the embodied modes — without them Walk reads
 *  as broken (nothing moves until you click for pointer-lock) and Ride's
 *  drag-to-orbit isn't discoverable. Shown via the HUD caption card. */
const MODE_HINTS: Partial<Record<CameraMode, HudCaption>> = {
  walk: {
    name: 'Walk',
    blurb: 'Click the scene to look around · WASD to move · Shift to sprint',
  },
  follow: {
    name: 'Ride',
    blurb: 'Riding the trolley — drag to look around it · scroll to zoom',
  },
};

/** Scripted-capture override: `?ortho=cx,cz,halfH` zooms the orthographic
 *  compare view onto a district (world metres). Bare `?ortho` = full extent. */
export function parseOrthoParam(search: string): {
  on: boolean;
  frame?: { center: [number, number]; halfH: number };
} {
  const params = new URLSearchParams(search);
  if (!params.has('ortho')) return { on: false };
  const v = params.get('ortho');
  const m = v
    ? /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?)$/.exec(v)
    : null;
  // halfH must be strictly positive — 0 would build a degenerate frustum
  // (0/0 aspect → NaN projection → blank canvas with no error). Any
  // malformed value degrades to the full-extent frame, never a broken view.
  if (!m || !(Number(m[3]) > 0)) return { on: true };
  return {
    on: true,
    frame: { center: [Number(m[1]), Number(m[2])], halfH: Number(m[3]) },
  };
}

function SceneInner({
  slug,
  manifest,
  framing,
  tour,
  house,
  showHouse,
  buildingsOpacity,
  crisp = false,
  paletteKey,
  day,
  mode,
  ortho,
  onCaption,
  onHouseGround,
  onWorldError,
  onTwinPlaced,
  registerHandle,
  registerRig,
  onFps,
  warehouseModels,
  modelOverrides,
  selectedModel,
  onSelectModel,
  patchOverride,
  onGizmoLive,
  gizmoMode,
}: {
  slug: string;
  manifest: Manifest;
  framing: Framing;
  tour: TourWaypoint[];
  house: HouseInfo | null;
  showHouse: boolean;
  buildingsOpacity: number;
  /** Architectural close-up: disable the tilt-shift blur (property page). */
  crisp?: boolean;
  paletteKey: PaletteKey;
  day: number;
  mode: CameraMode;
  /** Present while Top-down mode is active. */
  ortho?: OrthoFrame;
  onCaption: (c: HudCaption | null) => void;
  onHouseGround?: (y: number) => void;
  onWorldError: (message: string) => void;
  /** Wide sites only: the embedded twin's wide-frame position + label once
   *  placed, lifted so the HUD can offer an in-diorama fly-to (#332). */
  onTwinPlaced?: (t: { x: number; z: number; label: string }) => void;
  registerHandle: (h: StageHandle) => void;
  /** Lifts the Rig to the composition root (directory fly-to), mirroring the
   *  registerHandle pattern. */
  registerRig?: (rig: Rig) => void;
  /** ~2 Hz averaged frame rate for the HUD counter (#259 perf work). */
  onFps?: (fps: number) => void;
  warehouseModels?: WarehouseModelsInfo | null;
  modelOverrides?: Record<string, TwinPlacementOverride>;
  selectedModel?: string | null;
  onSelectModel?: (slug: string) => void;
  /** Present in edit mode: the gizmo writes drag deltas through this. */
  patchOverride?: (patch: TwinPlacementOverride) => void;
  /** Display-only live values while a gizmo handle drags (null = ended). */
  onGizmoLive?: (patch: TwinPlacementOverride | null) => void;
  gizmoMode?: 'translate' | 'rotate';
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const site = manifest.site;
  const rig = useMemo(() => {
    // Orbit/walk ranges scale with the model (the Rig's defaults came from a
    // tiny procedural city). Derived in src/lib/framing.ts — set here, not in
    // Rig.ts, to keep the Rig generic/liftable.
    const r = new Rig(
      camera as import('three').PerspectiveCamera,
      gl.domElement,
      {
        minR: framing.minR,
        maxR: framing.maxR,
        moveSpeed: framing.moveSpeed,
        panMinX: framing.panMinX,
        panMaxX: framing.panMaxX,
        panMinZ: framing.panMinZ,
        panMaxZ: framing.panMaxZ,
      }
    );
    // Aim BEFORE first paint (not in a post-paint effect) so the tour is
    // pointed at the city from frame 0 — no empty-void first frames.
    r.setWaypoints(tour as RigWaypoint[]);
    r.focus.set(...framing.homeFocus);
    r.radius = framing.homeRadius;
    r.tRadius = framing.homeRadius;
    return r;
  }, [camera, gl, framing, tour]);

  useEffect(() => {
    rig.bind();
    rig.onCaption = (cap) => {
      onCaption(cap ? { name: cap.name, blurb: cap.blurb } : null);
    };
    return () => rig.dispose();
  }, [rig, onCaption]);

  // Wire the HUD mode buttons to the Rig. Without this, clicking
  // Miniature/Follow/Walk only updated React state — the Rig kept running in
  // its previous mode, so the camera never re-framed (and Miniature inherited
  // whatever grazing/buried angle the tour left, looking like a broken slab).
  // Top-down is a StageCore render mode, not a Rig mode — the Rig idles in
  // orbit underneath. Keyed on the DOCK selection (mode), not the derived
  // rigMode: rig input stays bound while Top-down renders, so drags during
  // ortho silently move the hidden perspective camera — exiting
  // ortho→Miniature keeps rigMode 'orbit' but must still re-frame cleanly.
  useEffect(() => {
    const rigMode: RigMode = mode === 'ortho' ? 'orbit' : mode;
    if (rigMode === 'orbit' && !rig.tFocus) {
      // Enter Miniature from a clean, guaranteed-good overhead frame rather than
      // syncing from a possibly-buried tour camera: pull up and look down at the
      // home focus so the whole diorama reads as a toy model. Skipped while a
      // fly-to glide is pending (directory/editor flyToModel switched the mode
      // and set rig.tFocus synchronously) — the glide owns focus/radius then.
      const { homeFocus, homeRadius, homePhi, homeTheta } = framing;
      rig.focus.set(...homeFocus);
      rig.radius = rig.tRadius = homeRadius;
      rig.theta = rig.tTheta = homeTheta;
      rig.phi = rig.tPhi = homePhi;
      rig.cam.position.set(
        homeFocus[0] + homeRadius * Math.sin(homePhi) * Math.sin(homeTheta),
        homeFocus[1] + homeRadius * Math.cos(homePhi),
        homeFocus[2] + homeRadius * Math.sin(homePhi) * Math.cos(homeTheta)
      );
      rig.cam.lookAt(rig.focus);
    }
    rig.setMode(rigMode);
  }, [rig, mode, framing]);

  // R3F's Canvas camera options only apply at creation — sync the palette's
  // fov onto the live camera so the Toy/True-to-life toggle actually changes
  // the lens after mount.
  useEffect(() => {
    const cam = camera as import('three').PerspectiveCamera;
    cam.fov = PALETTES[paletteKey].fov;
    cam.updateProjectionMatrix();
  }, [camera, paletteKey]);

  const d = useMemo(() => computeDay(day), [day]);
  const grade = useMemo(
    () => applyProfile(d.gradeBase, PALETTES[paletteKey]),
    [d, paletteKey]
  );
  // Stable object identities: fresh literals here would re-trigger StageCore's
  // effects and rebuild the merged building geometry on every re-render (the
  // tour emits a caption every few seconds).
  const lens = useMemo(
    () => ({
      focus: 0.52,
      // The miniature-diorama blur reads as depth at corridor scale but turns
      // an architectural close-up to mush — the property page renders crisp.
      blur: crisp ? 0 : PALETTES[paletteKey].maxBlur,
    }),
    [paletteKey, crisp]
  );
  const bricks = useMemo(
    () => ({ bricks: PALETTES[paletteKey].bricks }),
    [paletteKey]
  );

  // Lift the Rig for directory fly-to (mirrors registerHandle).
  useEffect(() => {
    registerRig?.(rig);
  }, [rig, registerRig]);

  // Gizmo plumbing (#259 iter 4): the selected building registers its placed
  // group (WarehouseModels only registers the selected one); the gizmo
  // attaches to it and writes drag deltas back as placement overrides. While
  // a handle drags, the Rig ignores pointer input so moving a building
  // doesn't also orbit the camera.
  const [gizmoTarget, setGizmoTarget] = useState<Group | null>(null);
  const registerModelGroup = useCallback<ModelGroupRegistry>(
    (_slug, group) => setGizmoTarget(group),
    []
  );
  const gizmoBase = useMemo(() => {
    if (!selectedModel || !warehouseModels) return null;
    const m = warehouseModels.models.find((e) => e.slug === selectedModel);
    // dx/dz are deltas from the UN-overridden emitted anchor.
    return m ? { x: m.x, z: m.z } : null;
  }, [selectedModel, warehouseModels]);
  const handleGizmoDragging = useCallback(
    (dragging: boolean) => {
      rig.inputEnabled = !dragging;
    },
    [rig]
  );

  // Shadow fit (#259 iter-4 review): three's defaults — 512² map, ±5 m ortho
  // frustum — over a multi-km scene meant every surface sampled the same few
  // texels, reading as acne/shimmer while orbiting. Fit the frustum to the
  // ground extents (symmetric half-span: valid for any sun azimuth), scale
  // the map, and lean on normalBias (surface-slope offset, no peter-panning
  // at these texel sizes). Imperative because shadow-camera props applied
  // post-mount don't refresh the projection matrix, and resizing mapSize
  // must dispose the already-allocated map.
  const sunRef = useRef<DirectionalLight | null>(null);
  useEffect(() => {
    const sun = sunRef.current;
    if (!sun) return;
    const half = Math.max(framing.panMaxX, framing.panMaxZ);
    const cam = sun.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 1;
    cam.far = Math.hypot(d.sunPos[0], d.sunPos[1], d.sunPos[2]) + half;
    cam.updateProjectionMatrix();
    if (
      sun.shadow.mapSize.x !== 2048 &&
      sun.shadow.map // resize after allocation → must drop the old target
    ) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.normalBias = 1;
  }, [framing, d]);

  // Honest perf sampling (#259). renderer.info auto-resets after EVERY
  // gl.render — with the EffectComposer chain the last post pass would report
  // 1 call / 2 triangles. So: autoReset off; this priority-0 frame runs BEFORE
  // StageCore's priority-1 authoritative render, meaning the totals read here
  // are the full PREVIOUS frame (scene + shadow + post passes); read, then
  // reset for the frame about to render.
  const perfAcc = useRef({ frames: 0, t: 0 });
  useEffect(() => {
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);
  useFrame((_, dt) => {
    rig.update(dt);
    const acc = perfAcc.current;
    acc.frames += 1;
    acc.t += dt;
    if (acc.t >= 0.5) {
      // Only construct the sample when someone is listening (the FPS HUD /
      // scripted probes) — no per-half-second garbage on the default path.
      if (onFps) {
        const fps = acc.frames / acc.t;
        onFps(fps);
        (
          window as unknown as { __twinPerf?: Record<string, number> }
        ).__twinPerf = {
          fps: Math.round(fps),
          calls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures,
        };
      }
      acc.frames = 0;
      acc.t = 0;
    }
    gl.info.reset();
  });

  // Ride mode (#follow): the trolley registers itself as the Rig's boarded
  // object each frame; entering follow mode boards it, leaving unboards. The
  // Rig's dormant board()/_follow plumbing does the rest (trail the boarded
  // object's own heading — Rig.ts:504-531). The world hands us its terrain
  // sampler so the trolley (and therefore the chase camera) rides ON the
  // ground instead of at sea level.
  const trolleyTarget = useRef({ position: { x: 0, y: 0, z: 0 }, heading: 0 });
  const groundAtRef = useRef<((x: number, z: number) => number) | null>(null);
  const handleGroundReady = useCallback(
    (fn: (x: number, z: number) => number) => {
      groundAtRef.current = fn;
    },
    []
  );
  const trolleyGroundAt = useCallback(
    (x: number, z: number) => groundAtRef.current?.(x, z) ?? 0,
    []
  );
  const handleTrolleyTick = useCallback((pos: Vector3, heading: number) => {
    trolleyTarget.current.position.x = pos.x;
    trolleyTarget.current.position.y = pos.y;
    trolleyTarget.current.position.z = pos.z;
    trolleyTarget.current.heading = heading;
  }, []);
  useEffect(() => {
    if (mode === 'follow' && site.trolley) {
      rig.board(trolleyTarget.current);
      // Trail distance tuned live: long trails (44 m) put the camera inside
      // downtown buildings (the chase cam has no collision — future item);
      // 28 m clears the trolley's roofline while staying inside street
      // canyons most of the route.
      rig.radius = rig.tRadius = 28;
    } else {
      rig.unboard();
    }
  }, [rig, mode, site.trolley]);

  return (
    <StageCore
      lens={lens}
      grade={grade}
      ortho={ortho}
      registerHandle={registerHandle}
    >
      {/* Sky background + atmospheric fog, ranged to the model's extents so
          they add depth without hiding the city. */}
      <color attach="background" args={[d.skyColor]} />
      <fog attach="fog" args={[d.fogColor, framing.fogNear, framing.fogFar]} />
      <ambientLight intensity={d.ambient} />
      <hemisphereLight args={[d.hemiSky, d.hemiGround, d.hemiIntensity]} />
      <directionalLight
        ref={sunRef}
        position={d.sunPos}
        intensity={d.sunIntensity}
        color={d.sunColor}
        castShadow
      />
      <TwinWorld
        slug={slug}
        manifest={manifest}
        palette={bricks}
        house={house}
        showHouse={showHouse}
        buildingsOpacity={buildingsOpacity}
        warehouseModels={warehouseModels}
        modelOverrides={modelOverrides}
        selectedModel={selectedModel}
        onSelectModel={onSelectModel}
        registerModelGroup={patchOverride ? registerModelGroup : undefined}
        onHouseGround={onHouseGround}
        onGroundReady={handleGroundReady}
        onError={onWorldError}
        onTwinPlaced={onTwinPlaced}
      />
      {gizmoTarget && gizmoBase && patchOverride ? (
        <WarehouseGizmo
          target={gizmoTarget}
          base={gizmoBase}
          mode={gizmoMode ?? 'translate'}
          onCommit={patchOverride}
          onLive={onGizmoLive}
          onDragging={handleGizmoDragging}
        />
      ) : null}
      {site.trolley && (
        <Trolley
          polyline={site.trolley}
          onTick={handleTrolleyTick}
          groundAt={trolleyGroundAt}
        />
      )}
    </StageCore>
  );
}

// top:0, not 64 (#301): the scene is the page on twin routes and renders
// BEHIND the glass nav, same as the atlas. The HUD does the insetting now
// (stage/Hud.tsx), which is also what un-buries its wordmark (#299).
const shellStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: '#070a12',
  color: '#f0ead8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
};

function TwinCanvasInner({
  slug,
  manifest,
  house,
  localLinks,
  warehouseModels,
  focus,
}: {
  slug: string;
  manifest: Manifest;
  house: HouseInfo | null;
  localLinks: TwinLink[];
  warehouseModels: WarehouseModelsInfo | null;
  focus: TwinFocus;
}) {
  const site = manifest.site;
  const houseFocused = focus === 'house' && !!house;
  // Wide sites (chatt) render the full atlasBox city (WideCity) — frame the
  // ~8x7.6 km extent, and drop the narrow-box tour (its waypoints are box-
  // centred ENU coords that would fly the camera to the wrong place).
  const wide = useMemo(() => hasWideExtent(manifest), [manifest]);
  // The property page is a static close-up study — no tour there; the wide
  // atlasBox view has no tour either (its waypoints are narrow-box coords).
  const hasTour = (site.tour?.length ?? 0) > 0 && !houseFocused && !wide;
  const tour = useMemo<TourWaypoint[]>(
    () => (hasTour ? (site.tour ?? []) : []),
    [hasTour, site.tour]
  );
  // Terrain height under the house anchor (reported by the world once the
  // grid loads) — the orbit pivot must sit ON the parcel, not at sea level.
  const [houseGroundY, setHouseGroundY] = useState(0);
  const framing = useMemo(() => {
    if (wide) {
      // Frame the whole atlasBox extent (WideCity is atlasBox-centred at the
      // origin). Feed deriveFraming a manifest sized to the wide box, with the
      // narrow-tuned framing + tour dropped so homeRadius/maxR/fog/far all scale
      // up to the ~8 x 7.6 km city instead of the 1.5 km corridor.
      const { widthM, depthM } = createProjection(
        manifest.atlasBox ?? manifest.box
      ).groundSize();
      return deriveFraming({
        ...manifest,
        groundWm: widthM,
        groundHm: depthM,
        site: { ...site, tour: undefined, framing: undefined },
      });
    }
    if (!houseFocused || !house) return deriveFraming(manifest);
    // Frame the parcel: pivot mid-house on the parcel's terrain, pulled back
    // for a close shot, approaching from the street side. The twin's origin is
    // the geocoded address point, which Nominatim pins on the street — so
    // aiming the camera from the origin's direction reads as "standing on the
    // street looking at the property" for any site. Routing through
    // deriveFraming keeps initialCameraPos and the ortho frame consistent.
    const streetTheta =
      house.x === 0 && house.z === 0 ? 0 : Math.atan2(-house.x, -house.z);
    return deriveFraming({
      ...manifest,
      site: {
        ...site,
        tour: undefined,
        framing: {
          ...site.framing,
          homeFocus: [house.x, houseGroundY + 3, house.z],
          homeRadius: 40,
          // The derived minR (max(50, L/30)) would silently clamp the 40 m
          // close-up AND forbid zooming in — parcel study needs to get close.
          minR: 8,
          homeTheta: streetTheta,
          homePhi: 1.1, // low orbit (~27° above horizon): façades, not rooftops
        },
      },
    });
  }, [manifest, site, house, houseFocused, houseGroundY, wide]);
  const modes = useMemo<HudOption[]>(
    () => modesForSite(hasTour, site.trolley != null),
    [hasTour, site.trolley]
  );
  // As-built ⇄ massing view switch, only for twins that carry a scan. On the
  // property page the scan leads; in the plain twin the massing leads.
  const [view, setView] = useState<'massing' | 'asbuilt'>(
    houseFocused ? 'asbuilt' : 'massing'
  );
  const views = useMemo<HudOption[] | undefined>(
    () =>
      house
        ? [
            { key: 'massing', label: 'Massing' },
            { key: 'asbuilt', label: 'As-built' },
          ]
        : undefined,
    [house]
  );
  const links = useMemo<HudLink[]>(() => {
    const out: HudLink[] = [];
    if (house && !houseFocused) {
      out.push({
        label: house.label,
        href: getInternalUrl(`/twins/${slug}/?house`),
      });
    }
    if (houseFocused) {
      out.push({ label: site.name, href: getInternalUrl(`/twins/${slug}/`) });
    }
    // Committed site links (e.g. the published portfolio property page)
    // render before any private local-only links.
    for (const l of site.links ?? []) {
      out.push({ label: l.label, href: getInternalUrl(l.href) });
    }
    for (const l of localLinks) {
      out.push({ label: l.label, href: getInternalUrl(l.href) });
    }
    return out;
  }, [house, houseFocused, localLinks, site.name, site.links, slug]);

  // ?ortho opens straight into the compare view (scripted captures); an
  // optional `cx,cz,halfH` value zooms it onto a district.
  const orthoParam = useMemo(
    () =>
      parseOrthoParam(
        typeof window !== 'undefined' ? window.location.search : ''
      ),
    []
  );
  const [mode, setMode] = useState<CameraMode>(
    orthoParam.on ? 'ortho' : hasTour ? 'tour' : 'orbit'
  );
  const orthoFrame = useMemo<OrthoFrame | undefined>(() => {
    if (mode !== 'ortho') return undefined;
    if (!orthoParam.frame) return framing.ortho;
    return {
      center: orthoParam.frame.center,
      // Square target; StageCore expands to the viewport aspect either way.
      halfW: orthoParam.frame.halfH,
      halfH: orthoParam.frame.halfH,
      height: framing.ortho.height,
    };
  }, [mode, orthoParam, framing.ortho]);
  const [paletteKey, setPaletteKey] = useState<PaletteKey>(
    site.palette ?? 'toy'
  );
  const [caption, setCaption] = useState<HudCaption | null>(
    hasTour ? { name: site.tour![0].name, blurb: site.tour![0].blurb } : null
  );
  const [showFps, setShowFps] = useState(false);
  const [fps, setFps] = useState<number | undefined>(undefined);
  const [worldError, setWorldError] = useState<string | null>(null);
  // Wide diorama only: the embedded twin's wide-frame position, reported by
  // WideCity once it places the scan — drives the HUD fly-to button (#332).
  const [embeddedTwinPos, setEmbeddedTwinPos] = useState<{
    x: number;
    z: number;
    label: string;
  } | null>(null);

  // --- Warehouse layer: directory + placement editor (#259) ---
  // The whole editor surface (edit mode, selection, overrides + persistence,
  // directory data, fly-to, hotkeys) lives in the hook; this component just
  // wires its returns to the HUD, the scene, and the panel.
  const requestOrbit = useCallback(() => setMode('orbit'), []);
  const {
    registerRig,
    editMode,
    toggleEdit,
    directory,
    directoryOpen,
    toggleDirectory,
    selectedModel,
    setSelectedModel,
    gizmoMode,
    setGizmoMode,
    modelOverrides,
    liveDrag,
    setLiveDrag,
    patchOverride,
    resetSelected,
    clearAll,
    exportOverrides,
    saveAvailable,
    saveToFile,
    flyToModel,
    flyTo,
  } = useWarehouseEditor({ slug, warehouseModels, requestOrbit });
  // In-diorama fly-to for the embedded twin (#332): once WideCity reports the
  // twin's wide-frame position, prepend a camera-jump button to the HUD dock so
  // the exhibit is reachable without leaving the map (this replaces the retired
  // "As-built demo" page link). Non-wide sites never fire onTwinPlaced, so
  // embeddedTwinPos stays null and this is inert.
  const hudLinks = useMemo<HudLink[]>(() => {
    if (!embeddedTwinPos) return links;
    return [
      {
        label: embeddedTwinPos.label,
        onClick: () => flyTo(embeddedTwinPos.x, embeddedTwinPos.z, 60),
      },
      ...links,
    ];
  }, [links, embeddedTwinPos, flyTo]);
  // Click-away deselect (iter 5): pointer-missed fires for clicks that hit
  // no scene object — but an orbit DRAG that ends over empty sky must not
  // deselect, so gate on the same 12px travel grain as the select gate.
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      pointerDownPos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('pointerdown', down);
    return () => window.removeEventListener('pointerdown', down);
  }, []);
  const handlePointerMissed = useCallback(
    (e: MouseEvent) => {
      if (!editMode) return;
      const d = pointerDownPos.current;
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) return;
      setSelectedModel(null);
    },
    [editMode, setSelectedModel]
  );
  // Layer fade for judging footprint registration against the aerial (the
  // buildings/heroes layer fades; streets stay as the reference).
  const [buildingsOpacity, setBuildingsOpacity] = useState(1);
  const sliders = useMemo<HudSlider[]>(
    () => [
      {
        key: 'buildings',
        label: 'Buildings',
        value: buildingsOpacity,
        onChange: setBuildingsOpacity,
      },
    ],
    [buildingsOpacity]
  );
  // Property page AND edit mode get solar noon — the close-up reads baked
  // photo textures, and nobody can tune placement on dusk-black buildings
  // (iter-5 audit: the single highest-impact editor fix). computeDay's
  // brightness is sin(π·t), peaking at 0.5 — a Math.max on t would DARKEN
  // dusk-authored sites.
  const day = houseFocused || editMode ? 0.5 : (site.day ?? 0.4);
  const handleRef = useRef<StageHandle | null>(null);
  // Stable identity — an inline arrow would re-run StageCore's registerHandle
  // effect (whose cleanup disposes the composer) on every re-render.
  const registerHandle = useCallback((h: StageHandle) => {
    handleRef.current = h;
  }, []);

  // Shell keys only — the editor's nudge keys live in useWarehouseEditor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Backquote') setShowFps((v) => !v);
      // Escape clears the selected-building card in normal view. In edit mode
      // the editor hook owns Escape (deselect there), so this defers.
      if (e.code === 'Escape' && !editMode && selectedModel) {
        setSelectedModel(null);
        return;
      }
      // Digit keys map by position into the FULL mode list — including the
      // `secondary` modes now tucked in the ⋯ overflow (Walk, Top-down). They
      // keep their existing digits so muscle memory is preserved even though
      // they moved out of the primary bar.
      const m = /^Digit([1-5])$/.exec(e.code);
      if (m) {
        const opt = modes[Number(m[1]) - 1];
        if (opt) setMode(opt.key as CameraMode);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modes, editMode, selectedModel, setSelectedModel]);

  // Route-scoped chrome (`twin-fullscreen` / `twin-diorama`) is set by
  // TwinCanvasHost, not here (#301). It lived in this file until the atlas
  // became the default (#292), at which point /chatt got no chrome suppression
  // at all -- a renderer cannot own something the ROUTE needs.

  // The full entry for the selected building (drives the info card).
  const selectedEntry = selectedModel
    ? (warehouseModels?.models.find((m) => m.slug === selectedModel) ?? null)
    : null;

  return (
    // The scene is the page (#301): full-viewport, rendering BEHIND the glass
    // nav, matching the atlas. This used to be `top: 64` to inset below the
    // nav; the HUD carries that offset now (stage/Hud.tsx), which is what
    // finally lifts its wordmark out from under the nav (#299).
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#070a12',
      }}
    >
      <Canvas
        // "percentage" = PCFShadowMap. three r184 deprecated PCFSoftShadowMap
        // (R3F's `shadows` bool default) and silently substitutes PCF anyway,
        // warning on EVERY shadow render — same map, no console spam.
        shadows="percentage"
        onPointerMissed={handlePointerMissed}
        dpr={[1, 1.75]}
        gl={{
          toneMapping: NoToneMapping,
          // The Grade pass is the SOLE color owner: renderer stays linear (no
          // sRGB encode on present), the composer buffers stay linear, and the
          // Grade shader does its color grading then the single final lin2srgb
          // encode. (Letting the renderer ALSO encode = double-encode → neon;
          // folding ACES in = hue-shift, since ACES wants linear HDR not this
          // LDR scene. Verified by screenshot: this combo renders natural.)
          outputColorSpace: LinearSRGBColorSpace,
          antialias: true,
          powerPreference: 'high-performance',
        }}
        camera={{
          fov: PALETTES[paletteKey].fov,
          // Frame 0 shows the city, not the origin void: the first tour shot
          // when a tour exists, else the home orbit position. far covers the
          // whole model + orbit pull-back.
          position: framing.initialCameraPos,
          near: framing.cameraNear,
          far: framing.cameraFar,
        }}
      >
        <SceneInner
          slug={slug}
          manifest={manifest}
          framing={framing}
          tour={tour}
          house={house}
          showHouse={view === 'asbuilt'}
          buildingsOpacity={buildingsOpacity}
          // Tilt-shift blur off for close-up study AND while editing — 0.5 m
          // nudges are invisible through the miniature blur.
          crisp={houseFocused || editMode}
          paletteKey={paletteKey}
          day={day}
          mode={mode}
          ortho={orthoFrame}
          onCaption={setCaption}
          onHouseGround={houseFocused ? setHouseGroundY : undefined}
          onWorldError={setWorldError}
          onTwinPlaced={setEmbeddedTwinPos}
          registerHandle={registerHandle}
          registerRig={registerRig}
          onFps={showFps ? setFps : undefined}
          warehouseModels={warehouseModels}
          modelOverrides={modelOverrides}
          selectedModel={selectedModel}
          // Selection works in NORMAL viewing too (not only edit mode) so a
          // click surfaces the building's info card; edit-only wiring stays
          // gated below.
          onSelectModel={warehouseModels ? setSelectedModel : undefined}
          patchOverride={editMode ? patchOverride : undefined}
          onGizmoLive={editMode ? setLiveDrag : undefined}
          gizmoMode={gizmoMode}
        />
      </Canvas>
      {houseFocused && house ? (
        <div
          style={{
            position: 'absolute',
            top: 84,
            left: 16,
            maxWidth: 320,
            padding: '14px 16px',
            background: 'rgba(12, 16, 24, 0.72)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 12,
            color: '#f0ead8',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            zIndex: 11,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>{house.label}</div>
          {house.details ? (
            <dl style={{ margin: '10px 0 0', fontSize: 12.5 }}>
              {Object.entries(house.details).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '2px 0',
                  }}
                >
                  <dt style={{ opacity: 0.65 }}>{k}</dt>
                  <dd style={{ margin: 0, textAlign: 'right' }}>{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
      {worldError && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            color: '#f0ead8',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: 560,
              padding: 24,
              textAlign: 'center',
              background: 'rgba(12, 16, 24, 0.75)',
              borderRadius: 12,
            }}
          >
            <p style={{ fontSize: 16, marginBottom: 8 }}>
              This twin&apos;s assets failed to load.
            </p>
            <p style={{ fontSize: 13, opacity: 0.7 }}>{worldError}</p>
          </div>
        </div>
      )}
      <Hud
        title={site.name}
        subtitle={site.subtitle}
        provenance={manifest.provenance}
        modes={modes}
        activeMode={mode}
        onMode={(m) => setMode(m as CameraMode)}
        palettes={[
          { key: 'trueToLife', label: 'True to life' },
          { key: 'toy', label: 'Toy' },
        ]}
        activePalette={paletteKey}
        onPalette={(p) => setPaletteKey(p as PaletteKey)}
        views={views}
        activeView={view}
        onView={(v) => setView(v as 'massing' | 'asbuilt')}
        links={hudLinks}
        sliders={sliders}
        caption={
          mode === 'tour' ? caption : (MODE_HINTS[mode] ?? null) // embodied modes explain their controls
        }
        directory={directory}
        directoryOpen={directoryOpen}
        onDirectoryToggle={toggleDirectory}
        onDirectorySelect={flyToModel}
        directoryActive={selectedModel}
        editActive={editMode}
        onEditToggle={warehouseModels ? toggleEdit : undefined}
        toggles={[
          {
            key: 'fps',
            label: 'FPS counter',
            active: showFps,
            onToggle: () => setShowFps((v) => !v),
          },
        ]}
        showFps={showFps}
        fps={fps}
      />
      {/* Selected-building info card (normal view): rating, downloads, and a
          "may look rough" flag when the model is oversized. In edit mode the
          PlacementEditor (top-right) owns the selection UI, so the card only
          shows outside editing. */}
      {!editMode && selectedEntry ? (
        <SelectedBuildingCard
          entry={selectedEntry}
          onDismiss={() => setSelectedModel(null)}
        />
      ) : null}
      {editMode ? (
        <PlacementEditor
          entry={
            warehouseModels?.models.find((m) => m.slug === selectedModel) ??
            null
          }
          // Live gizmo values overlay the committed override while dragging
          // (display-only; the commit lands on release).
          override={
            (selectedModel && {
              ...modelOverrides[selectedModel],
              ...(liveDrag ?? {}),
            }) ||
            {}
          }
          overrideCount={Object.keys(modelOverrides).length}
          gizmoMode={gizmoMode}
          onGizmoMode={setGizmoMode}
          onChange={patchOverride}
          onReset={resetSelected}
          onExport={exportOverrides}
          onClearAll={clearAll}
          saveAvailable={saveAvailable}
          onSaveToFile={saveToFile}
        />
      ) : null}
    </div>
  );
}

export default function TwinCanvas({
  slug,
  focus,
}: {
  slug: string;
  focus?: TwinFocus;
}) {
  // This component is client-only (ssr:false dynamic import), so the query
  // string is readable at first render — `?house` opens the property view.
  const effectiveFocus: TwinFocus =
    focus ??
    (typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('house')
      ? 'house'
      : 'twin');
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [house, setHouse] = useState<HouseInfo | null>(null);
  const [localLinks, setLocalLinks] = useState<TwinLink[]>([]);
  const [warehouseModels, setWarehouseModels] =
    useState<WarehouseModelsInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setManifest(null);
    setHouse(null);
    setLocalLinks([]);
    setWarehouseModels(null);
    setError(null);
    Promise.all([
      loadManifest(slug),
      // Optional per twin (404 → null is the normal case), but a PRESENT-and-
      // broken capture must stay diagnosable — warn, don't swallow silently.
      loadHouse(slug).catch((e: unknown) => {
        console.warn('[twin] as-built capture ignored:', e);
        return null;
      }),
      loadLocalLinks(slug),
      // Optional sampled-buildings layer (#259) — same warn-don't-break rule.
      loadWarehouseModels(slug).catch((e: unknown) => {
        console.warn('[twin] warehouse models ignored:', e);
        return null;
      }),
    ])
      .then(([m, h, links, wm]) => {
        if (!alive) return;
        setHouse(h);
        setLocalLinks(links);
        setWarehouseModels(wm);
        setManifest(m);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  if (error) {
    return (
      <div style={shellStyle} role="alert">
        <div style={{ maxWidth: 560, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>
            This twin failed to load.
          </p>
          <p style={{ fontSize: 13, opacity: 0.7 }}>{error}</p>
        </div>
      </div>
    );
  }
  if (!manifest) {
    return (
      <div style={shellStyle} aria-busy="true">
        <p style={{ fontSize: 14, opacity: 0.7 }}>loading twin…</p>
      </div>
    );
  }
  return (
    <TwinCanvasInner
      slug={slug}
      manifest={manifest}
      house={house}
      localLinks={localLinks}
      warehouseModels={warehouseModels}
      focus={effectiveFocus}
    />
  );
}
