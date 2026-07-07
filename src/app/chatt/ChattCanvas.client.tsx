'use client';

// Chattanooga Mini — composition root. Mounts the generic 3D stage
// (StageCore + Rig) with the Chattanooga-specific content (ChattWorld +
// Trolley) inside an R3F <Canvas>, plus the generic <Hud> as a DOM
// sibling. This is the FIRST VISIBLE RENDER (Task 20).

import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { NoToneMapping, LinearSRGBColorSpace } from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import StageCore, { StageHandle } from '@/stage/StageCore';
import { Rig, RigMode, RigWaypoint } from '@/stage/Rig';
import ChattWorld from '@/world/ChattWorld';
import Trolley from '@/agents/trolley';
import Hud, { HudCaption } from '@/stage/Hud';
import { computeDay } from '@/stage/lightRig';
import { PALETTES, applyProfile } from '@/packs/themes';
import { RIVERFRONT_TOUR } from '@/packs/tours';

type PaletteKey = 'trueToLife' | 'toy';

// Downtown riverfront loop the trolley circles (Ross's Landing -> Aquarium
// plaza -> Walnut St Bridge approach -> back), in ENU metres matching the
// hero/building coordinate frame baked in T4-T8.
const TROLLEY_POLYLINE: number[] = [
  -180, -2180, -220, -2320, -180, -2460, 10, -2600, 60, -2860, 60, -2700, -60,
  -2400, -180, -2180,
];

function SceneInner({
  paletteKey,
  day,
  onCaption,
  registerHandle,
}: {
  paletteKey: PaletteKey;
  day: number;
  onCaption: (c: HudCaption | null) => void;
  registerHandle: (h: StageHandle) => void;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const rig = useMemo(() => {
    // Orbit/walk ranges scaled for the 5772m Chattanooga corridor. The Rig's
    // defaults (maxR 240, moveSpeed 12) came from a tiny procedural city; the
    // real box is ~24x longer, so miniature-orbit needs to pull back to a few
    // thousand metres and walk needs to move faster. Set here (not Rig.ts) to
    // keep the Rig generic/liftable.
    const r = new Rig(
      camera as import('three').PerspectiveCamera,
      gl.domElement,
      {
        minR: 200,
        maxR: 5000,
        moveSpeed: 900, // WASD-pan speed across the ~5.8km corridor in orbit
        // Clamp WASD-pan to the corridor extent (buildings span x[-842,807],
        // z[-2912,2908]) with a little margin, so you can reach both the north
        // (downtown/river) and south (Choo Choo) ends but not fly off into void.
        panMinX: -1000,
        panMaxX: 1000,
        panMinZ: -3100,
        panMaxZ: 3100,
      }
    );
    // Aim BEFORE first paint (not in a post-paint effect) so the tour is
    // pointed at the city from frame 0 — no empty-void first frames.
    r.setWaypoints(RIVERFRONT_TOUR as RigWaypoint[]);
    // Miniature mode starts framed on the downtown/riverfront (north) end but
    // WASD pans the pivot the full length of the corridor to the Choo Choo (south).
    r.focus.set(-100, 0, -2000);
    r.radius = 2600;
    r.tRadius = 2600;
    return r;
  }, [camera, gl]);

  useEffect(() => {
    rig.bind();
    rig.onCaption = (cap) => {
      onCaption(cap ? { name: cap.name, blurb: cap.blurb } : null);
    };
    return () => rig.dispose();
  }, [rig, onCaption]);

  const d = useMemo(() => computeDay(day), [day]);
  const grade = useMemo(
    () => applyProfile(d.gradeBase, PALETTES[paletteKey]),
    [d, paletteKey]
  );

  useFrame((_, dt) => {
    rig.update(dt);
  });

  return (
    <StageCore
      lens={{ focus: 0.52, blur: PALETTES[paletteKey].maxBlur }}
      grade={grade}
      registerHandle={registerHandle}
    >
      {/* Sky background + atmospheric fog (computeDay computes these; they were
          previously unused, so distance faded to pure black). Fog range scaled
          for the 5772m corridor so it adds depth without hiding the city. */}
      <color attach="background" args={[d.skyColor]} />
      <fog attach="fog" args={[d.fogColor, 1500, 9000]} />
      <ambientLight intensity={d.ambient} />
      <hemisphereLight args={[d.hemiSky, d.hemiGround, d.hemiIntensity]} />
      <directionalLight
        position={d.sunPos}
        intensity={d.sunIntensity}
        color={d.sunColor}
        castShadow
      />
      <ChattWorld palette={{ bricks: PALETTES[paletteKey].bricks }} />
      <Trolley polyline={TROLLEY_POLYLINE} />
    </StageCore>
  );
}

export default function ChattCanvas() {
  const [mode, setMode] = useState<RigMode>('tour');
  const [paletteKey, setPaletteKey] = useState<PaletteKey>('toy');
  const [caption, setCaption] = useState<HudCaption | null>(
    RIVERFRONT_TOUR[0]
      ? { name: RIVERFRONT_TOUR[0].name, blurb: RIVERFRONT_TOUR[0].blurb }
      : null
  );
  const [showFps, setShowFps] = useState(false);
  const day = 0.4; // well-lit late-morning; sun elevation ~0.95
  const handleRef = useRef<StageHandle | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Backquote') setShowFps((v) => !v);
      if (e.code === 'Digit1') setMode('tour');
      if (e.code === 'Digit2') setMode('orbit');
      if (e.code === 'Digit3') setMode('follow');
      if (e.code === 'Digit4') setMode('walk');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Route-scoped chrome control: hide the global cookie/PWA popups that would
  // overlap the diorama HUD. Keeps ScriptHammer's top nav (the diorama insets
  // below it). Class is removed on unmount so other routes are unaffected.
  useEffect(() => {
    document.body.classList.add('chatt-fullscreen');
    return () => document.body.classList.remove('chatt-fullscreen');
  }, []);

  return (
    // Inset below the 64px sticky GlobalNav (h-16) so the diorama + HUD sit
    // under the nav rather than behind it.
    <div
      style={{
        position: 'fixed',
        top: 64,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#070a12',
      }}
    >
      <Canvas
        shadows
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
          // Above/near the downtown cluster (city geometry is at z ≈ -1600..-2900
          // in the 5772m corridor), looking at it — so frame 0 shows the city,
          // not the origin void. far=8000 covers the whole corridor + orbit pull-back
          // (the old far=2400 clipped the city ~2400-3160m away → black scene).
          position: [-140, 260, -1500],
          near: 1,
          far: 8000,
        }}
      >
        <SceneInner
          paletteKey={paletteKey}
          day={day}
          onCaption={setCaption}
          registerHandle={(h) => {
            handleRef.current = h;
          }}
        />
      </Canvas>
      <Hud
        title="Chattanooga Mini"
        subtitle="a living tilt-shift diorama"
        provenance="© OpenStreetMap · USGS 3DEP · USGS NAIP"
        modes={[
          { key: 'tour', label: 'Tour' },
          { key: 'orbit', label: 'Miniature' },
          { key: 'follow', label: 'Follow' },
          { key: 'walk', label: 'Walk' },
        ]}
        activeMode={mode}
        onMode={(m) => setMode(m as RigMode)}
        palettes={[
          { key: 'trueToLife', label: 'True to life' },
          { key: 'toy', label: 'Toy' },
        ]}
        activePalette={paletteKey}
        onPalette={(p) => setPaletteKey(p as PaletteKey)}
        caption={mode === 'tour' ? caption : null}
        showFps={showFps}
      />
    </div>
  );
}
