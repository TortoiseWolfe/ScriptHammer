'use client';

// Chattanooga Mini — composition root. Mounts the generic 3D stage
// (StageCore + Rig) with the Chattanooga-specific content (ChattWorld +
// Trolley) inside an R3F <Canvas>, plus the generic <Hud> as a DOM
// sibling. This is the FIRST VISIBLE RENDER (Task 20).

import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { NoToneMapping } from 'three';
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
  const rig = useMemo(
    () => new Rig(camera as import('three').PerspectiveCamera, gl.domElement),
    [camera, gl]
  );

  useEffect(() => {
    rig.bind();
    rig.setWaypoints(RIVERFRONT_TOUR as RigWaypoint[]);
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
  const day = 0.28;
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

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#070a12' }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{
          toneMapping: NoToneMapping,
          antialias: true,
          powerPreference: 'high-performance',
        }}
        camera={{
          fov: PALETTES[paletteKey].fov,
          position: [-30, 150, 250],
          near: 1,
          far: 2400,
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
