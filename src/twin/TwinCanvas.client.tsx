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
  type Group,
  type Mesh,
  type Object3D,
  type Vector3,
} from 'three';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import StageCore, { StageHandle } from '@/stage/StageCore';
import { Rig, RigMode, RigWaypoint } from '@/stage/Rig';
import {
  EmbodiedController,
  useFootsteps,
  useAmbientCity,
  useFootstepDust,
  useCameraFeel,
  useWeather,
  type WeatherKind,
  bus,
} from '@/lib/cod';
import {
  makeWalkMove,
  chaseBackDir,
  type BikeView,
} from '@/stage/embodiedWalk';
import TwinWorld from '@/world/TwinWorld';
import Trolley from '@/agents/trolley';
import Bike from '@/agents/bike';
import PlayerCharacter from '@/agents/playerCharacter';
import ProceduralSky from '@/components/game/ProceduralSky';
import Hud, { HudCaption, HudLink, HudOption, HudSlider } from '@/stage/Hud';
import PlacementEditor from './PlacementEditor';
import SelectedBuildingCard from './SelectedBuildingCard';
import LocationHud from './LocationHud';
import WarehouseGizmo from './WarehouseGizmo';
import { useWarehouseEditor } from './useWarehouseEditor';
import type {
  ModelGroupRegistry,
  ModelColliderRegistry,
} from '@/world/WarehouseModels';
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
import {
  markerBlock,
  nearestLandmark,
  osmUrl,
  parseAtParam,
} from '@/lib/twin-location';
import {
  createCommitScheduler,
  type CommitScheduler,
} from '@/lib/collider-commit';
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
    blurb:
      'Click to look · WASD · Shift sprint · B bike · V view · C crouch · X prone · Space jump',
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

/** `?hour=N` (0–24) sets the procedural-sky time of day; default 13 (bright
 *  afternoon). ONLY the sky dome follows it — the Walk key lighting stays fixed
 *  and bright, so the street reads at any hour (no moody day-cycle recoupling,
 *  which is what darkened the scene before). Malformed → the default. */
export function parseHourParam(search: string): number {
  const v = new URLSearchParams(search).get('hour');
  if (v == null || v.trim() === '') return 13; // absent or bare `?hour=`
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(24, Math.max(0, n)) : 13;
}

/** `?weather=rain` turns on ambient rain in Walk mode; anything else → none. */
export function parseWeatherParam(search: string): WeatherKind {
  return new URLSearchParams(search).get('weather') === 'rain'
    ? 'rain'
    : 'none';
}

/** `?walk` — "this is a walk session". The navbar Play link (GlobalNav.tsx) and every
 *  marker return link (`markerBlock`, src/lib/twin-location.ts) carry it.
 *
 *  Parsed in ONE exported place because two components have to agree on it and they use it
 *  for different decisions: TwinCanvasInner decides WHEN to enter walk, SceneInner decides
 *  WHETHER to build a collision world at all. When those two disagreed, walk mode became
 *  unreachable — see the gate below. */
export function parseWalkParam(search: string): boolean {
  return new URLSearchParams(search).has('walk');
}

/** Player position in every frame of reference the readout and the harness need (#706). */
export interface TwinLocus {
  lat: number;
  lon: number;
  /** ENU metres — what the stair harness is driven with. */
  x: number;
  z: number;
  near: string | null;
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
  onNearBike,
  onWalkReady,
  walkIntent,
  onLocus,
  pickRef,
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
  /** Walk mode: near/far transitions of the parked bike, for the ride prompt. */
  onNearBike?: (near: boolean) => void;
  /** Fires once the embodied walk controller is built (deep-link gating). */
  onWalkReady?: () => void;
  /** The URL asked for first-person walk at mount (`?walk`). SESSION-CONSTANT — the parent
   *  parses it once with an empty-dep useMemo. It seeds `wantsWalkWorldRef`, which `mode`
   *  cannot do on its own because `mode` is downstream of the build that ref gates. */
  walkIntent: boolean;
  /** Publishes the player's position ~4x/s for the location readout (#706). */
  onLocus?: (locus: TwinLocus | null) => void;
  /** The scene assigns its crosshair-pick here; the key handler lives a level up. */
  pickRef?: { current: (() => void) | null };
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
    // First-person needs a normal-lens fov; the "toy" palette's telephoto 34
    // is claustrophobic on foot. Wider only in Walk; palette fov otherwise.
    cam.fov = mode === 'walk' ? 72 : PALETTES[paletteKey].fov;
    cam.updateProjectionMatrix();
  }, [camera, paletteKey, mode]);

  const d = useMemo(() => computeDay(day), [day]);
  const grade = useMemo(() => {
    const g = applyProfile(d.gradeBase, PALETTES[paletteKey]);
    // Walk mode drops the moody miniature grade (heavy vignette + boosted sepia
    // saturation/contrast) for a bright, neutral street-level look, so the aerial
    // ground + façades read true instead of crushed dark-brown.
    return mode === 'walk'
      ? { saturation: 1.02, contrast: 0.98, vignette: 0 }
      : g;
  }, [d, paletteKey, mode]);
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
  // Time of day for the procedural sky (?hour=N, default 13). Read once — the
  // URL param is a static override like ?walk/?house. Drives ONLY the sky dome.
  const skyHour = useMemo(
    () =>
      parseHourParam(
        typeof window !== 'undefined' ? window.location.search : ''
      ),
    []
  );
  // Ambient weather (?weather=rain) — reuses the CoD GPU particle layer, only in
  // Walk. tick() is a no-op when disabled, so the useFrame is free otherwise.
  const weatherKind = useMemo(
    () =>
      parseWeatherParam(
        typeof window !== 'undefined' ? window.location.search : ''
      ),
    []
  );
  const weather = useWeather(mode === 'walk' ? weatherKind : 'none');
  useFrame((_, dt) => weather.tick(dt));
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

  /**
   * Bake a landmark/bridge GLB into the collision world (#702).
   *
   * Landmarks and bridges rendered but were not solid — you walked and rode
   * straight through them — because the collision world was built from exactly
   * two meshes (terrain + buildings) and these were never handed to it.
   *
   * ADDS TO THE LIVE WORLD; DOES NOT REBUILD THE CONTROLLER. Rebuilding would
   * re-seed the player and bike to spawn, which is #703. `addCollider` grows the
   * existing `StaticWorld` and re-derives its BVH, leaving every pose untouched.
   *
   * Models arrive whenever their GLB finishes loading, which may be before or
   * after walk mode exists, so both orders are handled: bake now if the
   * controller is up, otherwise stash and drain after it is built. Keyed by slug
   * so a remount replaces rather than double-bakes.
   */
  /**
   * ONE BVH build per burst of registrations, not one per model (#702).
   *
   * A `requestAnimationFrame` coalesce was NOT enough and is the frame drag the owner
   * reported. `WarehouseModels` gives every model its own `<Suspense>` so the city
   * streams in progressively — the 129 GLBs mount on ~129 different frames, so a
   * per-frame coalesce merges nothing. See `createCommitScheduler` for the reasoning;
   * the quiet window matches how the models actually arrive.
   */
  const colliderCommitRef = useRef<CommitScheduler | null>(null);
  if (colliderCommitRef.current === null) {
    colliderCommitRef.current = createCommitScheduler(() =>
      walkCtrlRef.current?.commitColliders()
    );
  }
  const scheduleColliderCommit = useCallback(
    () => colliderCommitRef.current?.schedule(),
    []
  );
  useEffect(() => () => colliderCommitRef.current?.cancel(), []);

  const registerCollider = useCallback<ModelColliderRegistry>(
    (slug, group) => {
      const ctrl = walkCtrlRef.current;
      if (!group) {
        // Unmounted: drop the geometry too. Leaving it would be an invisible wall
        // where a landmark used to be — worse than no collision at all.
        pendingCollidersRef.current.delete(slug);
        const ids = colliderIdsRef.current.get(slug);
        if (ids && ctrl) {
          ctrl.removeColliders(ids);
          scheduleColliderCommit(); // batched like additions — a mass unmount storms too
        }
        colliderIdsRef.current.delete(slug);
        return;
      }
      pendingCollidersRef.current.set(slug, group);
      if (!ctrl) return; // walk mode not up yet — drained when it builds
      colliderIdsRef.current.set(slug, ctrl.addCollider(group, 'concrete'));
      scheduleColliderCommit();
    },
    [scheduleColliderCommit]
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
  // Stored in a ref AND used to retry the walk build, because it is now one of
  // the three things tryBuildWalk waits on. Whichever of the three arrives last
  // has to be the one that triggers the spawn; before #651's second fix only the
  // two meshes retried, so a sampler that arrived last was simply never noticed.
  //
  // `tryBuildWalkRef` rather than `tryBuildWalk` directly: tryBuildWalk is
  // declared below this point and depends on `manifest`/`framing`, so naming it
  // here would be a use-before-declaration and would also rebuild this callback
  // on every manifest change, re-firing the child effect that calls it.
  const tryBuildWalkRef = useRef<(() => void) | null>(null);
  /** The exact inputs the live controller was built from — see the guard in
   *  tryBuildWalk (#703). Identity comparison, so a real mesh swap still rebuilds. */
  const builtFromRef = useRef<{
    terrain: Mesh;
    buildings: Mesh;
    groundAt: (x: number, z: number) => number;
  } | null>(null);
  /** Landmark/bridge GLB roots awaiting collision bake (#702). Keyed by slug so a
   *  remount replaces rather than duplicates. Populated whether or not walk mode
   *  exists yet; drained into the controller once it does. */
  /**
   * Does this SESSION ever need a collision world? (the #718 gate)
   *
   * NOT "is the live camera mode walk". That version asked the gate about its own output:
   * `mode` only becomes 'walk' once `walkReady` fires, which needs the controller, which
   * needs this gate to open — so `?walk` deadlocked and the city just orbited forever.
   *
   * THE RULE: this predicate may only read things that are NOT downstream of the build.
   * `walkIntent` is parsed from the URL at mount and never changes, so it is safe. `mode` is
   * safe only as a LATCH for manual entry (digit 3 / the HUD), never as the whole answer.
   *
   * SEEDED DURING RENDER, NOT FROM AN EFFECT. React runs child effects before parent ones,
   * so TwinWorld's mesh handovers reach `tryBuildWalk` before any effect in SceneInner has
   * run. A flag set in an effect is still false at that moment, `mode` is still 'orbit', and
   * nothing retries — the same deadlock, moved one hop.
   */
  const wantsWalkWorldRef = useRef(walkIntent);
  const pendingCollidersRef = useRef<Map<string, Object3D>>(new Map());
  /** Collision-object ids per slug, so an unmounted model's geometry can be
   *  removed again. Cleared whenever the world is rebuilt from scratch. */
  const colliderIdsRef = useRef<Map<string, number[]>>(new Map());
  const handleGroundReady = useCallback(
    (fn: (x: number, z: number) => number) => {
      groundAtRef.current = fn;
      tryBuildWalkRef.current?.();
    },
    []
  );
  const trolleyGroundAt = useCallback(
    (x: number, z: number) => groundAtRef.current?.(x, z) ?? 0,
    []
  );

  // ── Walk-mode embodied physics (#226) ──────────────────────────────────────
  // The world hands over its terrain + buildings meshes; we bake BOTH into a CoD
  // StaticWorld and let an EmbodiedController own the first-person avatar
  // (gravity, jump, step-up, slopes, crouch/prone) in Walk mode. The Rig keeps
  // look and calls `walkMove`, which returns the eye position. Feel/audio/dust
  // come from the toolkit hooks (safe here — SceneInner is inside <Canvas>).
  const { resume: resumeAudio, step: stepAudio } = useFootsteps();
  // Looping procedural city bed (wind + distant traffic + birds), sitting UNDER
  // the footsteps mix. Its own AudioContext; woken by the same gesture (below).
  const {
    resume: resumeAmbient,
    start: startAmbient,
    stop: stopAmbient,
  } = useAmbientCity();
  const { emit: emitDust, tick: tickDust } = useFootstepDust(256);
  const { apply: applyCameraFeel } = useCameraFeel();

  const buildingsMeshRef = useRef<Mesh | null>(null);
  const terrainMeshRef = useRef<Mesh | null>(null);
  const walkCtrlRef = useRef<EmbodiedController | null>(null);
  const spawnRef = useRef<{ x: number; z: number } | null>(null);
  const [walkCtrl, setWalkCtrl] = useState<EmbodiedController | null>(null);
  const viewRef = useRef<BikeView>('first'); // first/third-person while on the bike

  // Build the embodied controller once THREE things have arrived: the terrain
  // (floor), the buildings (walls), and the ground SAMPLER.
  //
  // THE SAMPLER IS A GATE, NOT AN OPTIONAL EXTRA (#651, second fix).
  //
  // This used to wait on the two meshes only, while `groundAtRef` was published
  // from a separate effect in WideCity/TwinWorld that waits on the elevation grid
  // (`if (!data || !onGroundReady) return`). Two independent lifecycles, no
  // ordering between them — so `tryBuildWalk` could and did win the race, and the
  // spawn height fell through to `?? 0`.
  //
  // Zero is not sea level here. The sampler is `elevationAt(...) - minElevation`,
  // normalised so the LOWEST point of the terrain is 0. Spawning at 0 anywhere
  // that is not that lowest point puts you underneath the ground — and
  // `parkBike()` was handed the same `sy`, which is why the reported symptom was
  // the player *and the bike* below the terrain, falling.
  //
  // The first #651 fix corrected WHERE horizontally (reprojecting the authored
  // riverfront focus into the wide frame) and that part works. It did nothing
  // about the vertical, because the fallback failed silently and a clean build
  // said nothing.
  const tryBuildWalk = useCallback(() => {
    // WALK ONLY (#718). Building the collision BVH costs ~780 ms of synchronous main-thread
    // work — measured by CPU profile as `_buildNodes` 556 ms, `_nodeBoundsFromRange` 147 ms
    // and `StaticWorld.build` 74 ms — and NOTHING outside walk can use it: `?ortho` maps to
    // rig mode `orbit`, and `Rig.collide` is only ever called inside `Rig._walk()`. Paying
    // it on load froze `?ortho` hard enough that Playwright could not land a click on the
    // HUD, which is #717 and eight straight red E2E runs.
    //
    // A ref rather than a dependency: adding `mode` to the deps below would give this
    // callback a new identity on every camera change, re-running the mesh callbacks that
    // depend on it. The effect further down calls this on entry to walk.
    if (!wantsWalkWorldRef.current) return;
    const buildings = buildingsMeshRef.current;
    const terrain = terrainMeshRef.current;
    const groundAt = groundAtRef.current;
    if (!buildings || !terrain || !groundAt) return;

    // IDEMPOTENT (#703). Three callbacks call this — terrain mesh, buildings
    // mesh, ground sampler — and any of them can fire more than once. Without
    // this guard every extra call disposed the live controller and built a new
    // one, which re-ran `parkBike(spawn)` and teleported the player. Reported as
    // "sometimes my bike just randomly gets pulled somewhere else": it was being
    // re-parked at the spawn point from wherever you had left it.
    //
    // Identity, not a boolean: a genuinely NEW terrain or buildings mesh (a
    // different site, a remount) still has to rebuild the collision world. Only a
    // repeat call with the same three inputs is skipped.
    const built = builtFromRef.current;
    if (
      built &&
      built.terrain === terrain &&
      built.buildings === buildings &&
      built.groundAt === groundAt
    ) {
      return;
    }
    builtFromRef.current = { terrain, buildings, groundAt };

    walkCtrlRef.current?.dispose();
    const ctrl = EmbodiedController.fromMeshes(
      [
        { mesh: terrain, surface: 'dirt' },
        { mesh: buildings, surface: 'concrete' },
      ],
      {
        onStanceChange: (s) => bus.emit('player:stance', { stance: s }),
        // Landmark GLBs are registered SINGLE_SIDED by `addCollider`, so a face the
        // FrontSide renderer culls stops being an invisible wall (#713). Terrain and the
        // merged massing boxes are added here WITHOUT that bit and stay double-sided.
        cullBackfaces: true,
      }
    );
    // Spawn among the RIVERFRONT LANDMARKS, not the embedded twin. The twin
    // (east-main-street) reprojects ~5 km from the downtown landmark cluster, so
    // spawning there leaves every landmark fogged out (walk Fog near 1500 / far
    // 6000) and unseeable — the "I can't see these buildings" bug. The wide path
    // drops site.framing (so framing.homeFocus is the atlasBox origin here), so
    // instead reproject the AUTHORED narrow homeFocus ([-100,-2000], the
    // riverfront) into the wide frame the SAME way the landmark anchors are
    // (narrow enu → lon/lat → wide enu). That lands ~300-470 m from the cluster,
    // well inside the fog. Narrow sites (no atlasBox) keep the twin/home spawn.
    const authored = manifest.site.framing?.homeFocus;
    let sx: number;
    let sz: number;
    // `?at=lat,lon` wins: it is how you return to a spot you marked (#706). Malformed
    // values parse to null and fall through to the normal spawn rather than becoming a
    // NaN position — see `parseAtParam`.
    const at =
      typeof window !== 'undefined'
        ? parseAtParam(window.location.search)
        : null;
    if (at) {
      const proj = createProjection(
        manifest.atlasBox ?? manifest.box,
        manifest.vectorOffsetM
      );
      [sx, sz] = proj.lonLatToEnu(at.lon, at.lat);
    } else if (authored && manifest.atlasBox) {
      const nProj = createProjection(manifest.box, manifest.vectorOffsetM);
      const wProj = createProjection(manifest.atlasBox, manifest.vectorOffsetM);
      const [lon, lat] = nProj.enuToLonLat(authored[0], authored[2]);
      [sx, sz] = wProj.lonLatToEnu(lon, lat);
    } else {
      sx = spawnRef.current?.x ?? framing.homeFocus[0];
      sz = spawnRef.current?.z ?? framing.homeFocus[2];
    }
    // No `?? 0` here. `groundAt` is a gate above, so it exists by this line — and
    // defaulting the SPAWN HEIGHT to a magic number is precisely the silent
    // failure that shipped underground twice. If the sampler is ever absent we
    // want no walk mode rather than a walk mode under the map.
    const sy = groundAt(sx, sz);
    ctrl.teleport(sx, sy, sz);
    ctrl.parkBike(sx, sy, sz); // the bike starts parked at your feet
    // Bake any landmark/bridge GLBs that finished loading before walk mode
    // existed (#702). The world was just rebuilt, so previous ids are void.
    colliderIdsRef.current.clear();
    for (const [slug, group] of pendingCollidersRef.current) {
      colliderIdsRef.current.set(slug, ctrl.addCollider(group, 'concrete'));
    }
    // One build for the whole drain, not one per model — see scheduleColliderCommit.
    if (pendingCollidersRef.current.size > 0) ctrl.commitColliders();

    walkCtrlRef.current = ctrl;
    setWalkCtrl(ctrl);
  }, [framing, manifest]);

  // Keep the ref pointing at the current closure so handleGroundReady — declared
  // above, and deliberately dependency-free — always calls the live version.
  tryBuildWalkRef.current = tryBuildWalk;

  // Build the collision world on ENTRY to walk, not on page load (#718). The data
  // callbacks (terrain mesh, buildings mesh, ground sampler) still call `tryBuildWalk`
  // whenever they fire — they simply return early until walk is the live mode, and this
  // effect performs the build the moment it becomes so.
  //
  // Deferring is safe because the pieces were already built for earlier fixes in this arc:
  // `builtFromRef` (#703) makes a later call idempotent, and `pendingCollidersRef` (#702)
  // stashes landmark colliders that arrive before the controller exists and drains them
  // when it is created — so nothing is lost by arriving late.
  //
  // A LATCH, not an assignment. The original `= mode === 'walk'` also TORE THE GATE DOWN on
  // the way out of walk, so a mesh that arrived while you were back in orbit was discarded
  // and the world silently never rebuilt. Once anything in this session has asked for a walk
  // world it keeps wanting one; `builtFromRef` (#703) makes the extra calls free.
  useEffect(() => {
    if (mode === 'walk') wantsWalkWorldRef.current = true;
    // Keyed on the ref, not on `mode`: this is also the deep-link's retry, for the case where
    // all three inputs landed during the child-effect pass before this effect first ran.
    if (wantsWalkWorldRef.current) tryBuildWalkRef.current?.();
  }, [mode]);

  const handleBuildingsMesh = useCallback(
    (mesh: Mesh) => {
      buildingsMeshRef.current = mesh;
      tryBuildWalk();
    },
    [tryBuildWalk]
  );
  const handleTerrainMesh = useCallback(
    (mesh: Mesh) => {
      terrainMeshRef.current = mesh;
      tryBuildWalk();
    },
    [tryBuildWalk]
  );
  // Record the embedded-twin street position as the walk spawn, then lift it up.
  const handleTwinPlaced = useCallback(
    (t: { x: number; z: number; label: string }) => {
      spawnRef.current = { x: t.x, z: t.z };
      onTwinPlaced?.(t);
    },
    [onTwinPlaced]
  );

  // Bind the Rig seams whenever the rig or the built controller changes.
  // groundHeight (analytic sampler) serves follow mode; walkMove + collide serve
  // the embodied walk. Cleared on rebind/unmount; the controller is disposed on
  // rebuild (above) and on unmount (below).
  useEffect(() => {
    rig.groundHeight = (x, z) => groundAtRef.current?.(x, z) ?? 0;
    if (walkCtrl) {
      rig.walkMove = makeWalkMove(walkCtrl, {
        stepAudio,
        emitDust,
        tickDust,
        applyCameraFeel,
        viewRef,
      });
      rig.collide = (pos) => walkCtrl.collide(pos, 0.4); // unboarded-follow reuse
    }
    return () => {
      rig.groundHeight = null;
      rig.walkMove = null;
      rig.collide = null;
    };
  }, [rig, walkCtrl, stepAudio, emitDust, tickDust, applyCameraFeel]);

  // Dispose the physics world on unmount.
  useEffect(
    () => () => {
      walkCtrlRef.current?.dispose();
      walkCtrlRef.current = null;
    },
    []
  );

  // Tell the composition root the embodied controller is live, so a `?walk`
  // deep-link can enter Walk only now (not during the kinematic-glide window).
  useEffect(() => {
    if (walkCtrl) onWalkReady?.();
  }, [walkCtrl, onWalkReady]);

  // Resume Web Audio on the FIRST gesture in Walk — click OR keypress. The
  // `?walk` deep-link ("Play") auto-enters Walk with no canvas click, so keydown
  // (WASD) must also wake the AudioContext or footsteps stay silent. resume() is
  // idempotent.
  useEffect(() => {
    if (mode !== 'walk') return;
    const dom = gl.domElement;
    const kick = () => {
      resumeAudio();
      resumeAmbient();
    };
    dom.addEventListener('click', kick);
    window.addEventListener('keydown', kick);
    return () => {
      dom.removeEventListener('click', kick);
      window.removeEventListener('keydown', kick);
    };
  }, [mode, gl, resumeAudio, resumeAmbient]);

  // Play the ambient city bed only while in Walk mode: build + start the loops on
  // enter (they sound once the gesture above resumes the context), fade + stop on
  // exit/unmount. Separate from the resume effect so the bed's lifecycle is tied
  // to Walk, not to the first gesture.
  useEffect(() => {
    if (mode !== 'walk') return;
    startAmbient();
    return () => stopAmbient();
  }, [mode, startAmbient, stopAmbient]);

  // First-person needs a tiny near plane. The twin's default (framing.cameraNear
  // ≈ 5 m, tuned for the miniature orbit) sits FARTHER than the ground under your
  // feet, so Walk mode clips straight through the terrain. Shrink it while
  // walking; restore on exit.
  useEffect(() => {
    const cam = camera as import('three').PerspectiveCamera;
    const near = mode === 'walk' ? 0.1 : framing.cameraNear;
    if (cam.near !== near) {
      cam.near = near;
      cam.updateProjectionMatrix();
    }
  }, [mode, camera, framing.cameraNear]);
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

  /* ---- Where am I (#706): the half that needs the controller ---------------- */

  // models.json anchors are in the NARROW frame; the wide city reprojects them the same
  // offset-exact way (narrow enu -> lon/lat -> wide enu). The readout must match, or the
  // "near" line names a building 5 km from where you stand.
  const hudLandmarks = useMemo(() => {
    const models = warehouseModels?.models ?? [];
    if (!models.length) return [];
    if (!manifest.atlasBox) {
      return models.map((e) => ({
        slug: e.slug,
        title: e.title,
        x: e.x,
        z: e.z,
      }));
    }
    const nProj = createProjection(manifest.box, manifest.vectorOffsetM);
    const wProj = createProjection(manifest.atlasBox, manifest.vectorOffsetM);
    return models.map((e) => {
      const [lon, lat] = nProj.enuToLonLat(e.x, e.z);
      const [x, z] = wProj.lonLatToEnu(lon, lat);
      return { slug: e.slug, title: e.title, x, z };
    });
  }, [warehouseModels, manifest]);

  // Polled, not per-frame: the readout is for reading, and re-rendering React 60 times a
  // second to move a text label would cost more than the feature is worth.
  useEffect(() => {
    if (!onLocus) return;
    if (!walkCtrl || mode !== 'walk') {
      onLocus(null);
      return;
    }
    const proj = createProjection(
      manifest.atlasBox ?? manifest.box,
      manifest.vectorOffsetM
    );
    const sample = () => {
      const p = walkCtrl.position;
      const [lon, lat] = proj.enuToLonLat(p.x, p.z);
      const n = nearestLandmark(hudLandmarks, p.x, p.z);
      onLocus({ lat, lon, x: p.x, z: p.z, near: n ? n.entry.title : null });
    };
    sample();
    const id = window.setInterval(sample, 250);
    return () => window.clearInterval(id);
  }, [onLocus, walkCtrl, mode, manifest, hudLandmarks]);

  /**
   * Inspect whatever is under the crosshair (#706).
   *
   * A click would be the obvious gesture and is unavailable — in walk mode a click is
   * pointer-lock — so it is a key. The ray goes into the COLLISION world and the hit's
   * object id maps back to a landmark through the same registry that baked it in (#702),
   * so there is no second picking system to drift out of sync with the first. It also
   * means a building you cannot select is a building that is not solid, which is itself
   * the diagnostic.
   */
  useEffect(() => {
    if (!pickRef) return;
    pickRef.current = () => {
      const ctrl = walkCtrlRef.current;
      if (!ctrl || !onSelectModel) return;
      // Negating the chase cam's backward vector reuses the camera's own sign convention
      // instead of re-deriving pitch here and getting it upside down.
      const back = chaseBackDir(rig.yaw, rig.pitch);
      const id = ctrl.lookAt(-back.x, -back.y, -back.z);
      if (id < 0) return;
      for (const [slug, ids] of colliderIdsRef.current) {
        if (ids.includes(id)) {
          onSelectModel(slug);
          return;
        }
      }
    };
    const ref = pickRef;
    return () => {
      ref.current = null;
    };
  }, [pickRef, rig, onSelectModel]);

  return (
    <StageCore
      lens={lens}
      grade={grade}
      ortho={ortho}
      registerHandle={registerHandle}
    >
      {/* First-person Walk gets a real procedural sky dome + IBL (which also
          lifts the buildings); the miniature modes keep the flat colour. */}
      {mode === 'walk' && <ProceduralSky hour={skyHour} />}
      {/* Sky background + atmospheric fog, ranged to the model's extents so
          they add depth without hiding the city. Walk brightens the fill,
          neutralises the brown ground-bounce, and hazes toward the sky. */}
      <color
        attach="background"
        args={[mode === 'walk' ? 0x9fc4e8 : d.skyColor]}
      />
      <fog
        attach="fog"
        args={[
          mode === 'walk' ? 0xbcd2e8 : d.fogColor,
          mode === 'walk' ? 1500 : framing.fogNear,
          mode === 'walk' ? 6000 : framing.fogFar,
        ]}
      />
      {/* Walk mode uses a fixed bright key (independent of the moody day/grade) so
          the street reads in full daylight; miniature modes keep the day cycle.
          Ambient is kept MODERATE (not flooded) so building colours stay saturated
          and the sun/hemisphere still model form — too much flat ambient washes the
          façades pastel. */}
      <ambientLight intensity={mode === 'walk' ? 0.55 : d.ambient} />
      <hemisphereLight
        args={[
          mode === 'walk' ? 0xbfd4ff : d.hemiSky,
          mode === 'walk' ? 0x9aa0a8 : d.hemiGround,
          mode === 'walk' ? 0.7 : d.hemiIntensity,
        ]}
      />
      <directionalLight
        // Sun DIFFUSE only — no shadow map (retired above); the drape + IBL carry
        // the baked shadows. Brighter/neutral in Walk so the street reads on foot.
        position={d.sunPos}
        intensity={mode === 'walk' ? 2.0 : d.sunIntensity}
        color={mode === 'walk' ? 0xfff4e6 : d.sunColor}
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
        registerCollider={registerCollider}
        onHouseGround={onHouseGround}
        onGroundReady={handleGroundReady}
        onError={onWorldError}
        onTwinPlaced={handleTwinPlaced}
        onBuildingsMesh={handleBuildingsMesh}
        onTerrainMesh={handleTerrainMesh}
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
      {/* The rideable bike — parked in the world once the walk controller exists. */}
      {walkCtrl && (
        <Bike ctrlRef={walkCtrlRef} viewRef={viewRef} onNearBike={onNearBike} />
      )}
      {/* Your visible body — a rigged, animated human shown in third-person (V),
          posed by stance/riding. Suspends while the glTF loads. */}
      {walkCtrl && (
        <Suspense fallback={null}>
          <PlayerCharacter ctrlRef={walkCtrlRef} viewRef={viewRef} />
        </Suspense>
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
  // `?walk` drops you straight into first-person Walk mode (the navbar "Play"
  // link), instead of the default orbit/tour — so the game isn't buried behind
  // the ⋯ mode overflow.
  const walkParam = useMemo(
    () =>
      parseWalkParam(
        typeof window !== 'undefined' ? window.location.search : ''
      ),
    []
  );
  const [mode, setMode] = useState<CameraMode>(
    orthoParam.on ? 'ortho' : hasTour ? 'tour' : 'orbit'
  );
  // `?walk` deep-link (the navbar "Play" link): do NOT enter Walk until the
  // embodied controller has been built from the city meshes. Entering early makes
  // the Rig fall back to its kinematic glide — which moves at the orbit
  // move-speed (~1,200 m/s) with no terrain-follow: "running under the city at
  // high speed". So land in orbit while the city loads, then switch once.
  const [walkReady, setWalkReady] = useState(false);
  // Stable identity: an inline arrow re-runs SceneInner's [walkCtrl, onWalkReady] effect on
  // every parent render (same reason registerHandle is a useCallback).
  const handleWalkReady = useCallback(() => setWalkReady(true), []);
  const didAutoWalk = useRef(false);
  useEffect(() => {
    if (walkParam && walkReady && !didAutoWalk.current) {
      didAutoWalk.current = true;
      setMode('walk');
    }
  }, [walkParam, walkReady]);
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
  // Walk-mode stance (#226): the embodied controller (inside <Canvas>) emits
  // `player:stance` across the bus; the badge below (walk only) reflects it.
  const [stance, setStance] = useState<string>('stand');
  useEffect(() => bus.on('player:stance', (e) => setStance(e.stance)), []);
  // Walk mode: true while standing next to the parked bike (drives the prompt).
  const [nearBike, setNearBike] = useState(false);

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
  /* ---- Where am I (#706) --------------------------------------------------
   * A coordinate the player can copy is what turns "the stairs on that building don't
   * work" into something a harness can be pointed at. The SCENE samples the position
   * (it owns the controller); this half owns the readout, the keys and the clipboard. */
  const [locus, setLocus] = useState<TwinLocus | null>(null);
  const locusRef = useRef<TwinLocus | null>(null);
  locusRef.current = locus;
  /** Assigned by the scene, so `E` can raycast from where the camera actually is. */
  const pickRef = useRef<(() => void) | null>(null);

  const [copied, setCopied] = useState(false);
  const copySpot = useCallback(() => {
    const l = locusRef.current;
    if (!l) return;
    // Derive the prefix from the live URL rather than build config — this has to be right
    // on the project site (/ScriptHammer/...) and on the root domain alike.
    const basePath = window.location.pathname.replace(/\/[^/]*\/?$/, '');
    const text = markerBlock({ ...l, basePath, slug });
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    };
    navigator.clipboard?.writeText(text).then(done, () => {
      // Clipboard can be denied (insecure context, permissions). A prompt keeps the
      // coordinate reachable instead of the key silently doing nothing.
      window.prompt('Copy this spot:', text);
    });
  }, [slug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Backquote') setShowFps((v) => !v);
      // M marks where you stand; E inspects what you are looking at (#706).
      if (e.code === 'KeyM') {
        copySpot();
        return;
      }
      if (e.code === 'KeyE') {
        pickRef.current?.();
        return;
      }
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
  }, [modes, editMode, selectedModel, setSelectedModel, copySpot]);

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
        // No real-time shadow map (#perf): a STATIC city on a satellite drape that
        // already carries real baked sun shadows, lit by the sky's IBL environment.
        // A whole-diorama PCF shadow pass re-drew every building every frame for
        // shadows the photo already has (measured: ~half the walk workload) —
        // retired. Movers get a cheap blob shadow instead.
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
          crisp={houseFocused || editMode || mode === 'walk'}
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
          onNearBike={setNearBike}
          onWalkReady={handleWalkReady}
          walkIntent={walkParam}
          onLocus={setLocus}
          pickRef={pickRef}
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
      {mode === 'walk' && (
        <div
          data-stance={stance}
          style={{
            position: 'absolute',
            top: 84,
            left: 16,
            padding: '6px 10px',
            background: 'rgba(12, 16, 24, 0.72)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 8,
            color: '#f0ead8',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            zIndex: 11,
          }}
        >
          {stance.toUpperCase()}
        </div>
      )}
      {mode === 'walk' && nearBike && (
        <div
          style={{
            position: 'absolute',
            top: 116,
            left: 16,
            padding: '6px 10px',
            background: 'rgba(12, 16, 24, 0.72)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 8,
            color: '#f0ead8',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontSize: 12,
            zIndex: 11,
          }}
        >
          🚲 Press B to ride
        </div>
      )}
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
      {locus ? (
        <LocationHud
          lat={locus.lat}
          lon={locus.lon}
          x={locus.x}
          z={locus.z}
          near={locus.near}
          osmHref={osmUrl(locus.lat, locus.lon)}
          onCopy={copySpot}
          copied={copied}
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
