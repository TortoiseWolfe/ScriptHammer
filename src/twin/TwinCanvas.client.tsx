'use client';

// Digital-twin composition root (#232). Mounts the generic 3D stage
// (StageCore + Rig) with per-site content (TwinWorld + optional Trolley)
// inside an R3F <Canvas>, plus the generic <Hud> as a DOM sibling. Everything
// site-specific arrives as data: the baked manifest's `site` block plus the
// framing derived from the model's true extents (src/lib/framing.ts).

import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { NoToneMapping, LinearSRGBColorSpace } from 'three';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StageCore, { StageHandle } from '@/stage/StageCore';
import { Rig, RigMode, RigWaypoint } from '@/stage/Rig';
import TwinWorld from '@/world/TwinWorld';
import Trolley from '@/agents/trolley';
import Hud, { HudCaption, HudOption } from '@/stage/Hud';
import { computeDay } from '@/stage/lightRig';
import { PALETTES, applyProfile } from '@/packs/themes';
import { loadManifest } from '@/lib/manifest';
import type { Manifest, PaletteKey } from '@/lib/manifest';
import { deriveFraming, type Framing } from '@/lib/framing';

function SceneInner({
  slug,
  manifest,
  framing,
  paletteKey,
  day,
  mode,
  onCaption,
  onWorldError,
  registerHandle,
}: {
  slug: string;
  manifest: Manifest;
  framing: Framing;
  paletteKey: PaletteKey;
  day: number;
  mode: RigMode;
  onCaption: (c: HudCaption | null) => void;
  onWorldError: (message: string) => void;
  registerHandle: (h: StageHandle) => void;
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
    r.setWaypoints((site.tour ?? []) as RigWaypoint[]);
    r.focus.set(...framing.homeFocus);
    r.radius = framing.homeRadius;
    r.tRadius = framing.homeRadius;
    return r;
  }, [camera, gl, framing, site]);

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
  useEffect(() => {
    if (mode === 'orbit') {
      // Enter Miniature from a clean, guaranteed-good overhead frame rather than
      // syncing from a possibly-buried tour camera: pull up and look down at the
      // home focus so the whole diorama reads as a toy model.
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
    rig.setMode(mode);
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
    () => ({ focus: 0.52, blur: PALETTES[paletteKey].maxBlur }),
    [paletteKey]
  );
  const bricks = useMemo(
    () => ({ bricks: PALETTES[paletteKey].bricks }),
    [paletteKey]
  );

  useFrame((_, dt) => {
    rig.update(dt);
  });

  return (
    <StageCore
      lens={lens}
      grade={grade}
      topdown={framing.topdown}
      registerHandle={registerHandle}
    >
      {/* Sky background + atmospheric fog, ranged to the model's extents so
          they add depth without hiding the city. */}
      <color attach="background" args={[d.skyColor]} />
      <fog attach="fog" args={[d.fogColor, framing.fogNear, framing.fogFar]} />
      <ambientLight intensity={d.ambient} />
      <hemisphereLight args={[d.hemiSky, d.hemiGround, d.hemiIntensity]} />
      <directionalLight
        position={d.sunPos}
        intensity={d.sunIntensity}
        color={d.sunColor}
        castShadow
      />
      <TwinWorld
        slug={slug}
        manifest={manifest}
        palette={bricks}
        onError={onWorldError}
      />
      {site.trolley && <Trolley polyline={site.trolley} />}
    </StageCore>
  );
}

const shellStyle: React.CSSProperties = {
  position: 'fixed',
  top: 64,
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
}: {
  slug: string;
  manifest: Manifest;
}) {
  const site = manifest.site;
  const hasTour = (site.tour?.length ?? 0) > 0;
  const framing = useMemo(() => deriveFraming(manifest), [manifest]);
  const modes = useMemo<HudOption[]>(
    () => [
      ...(hasTour ? [{ key: 'tour', label: 'Tour' }] : []),
      { key: 'orbit', label: 'Miniature' },
      { key: 'follow', label: 'Follow' },
      { key: 'walk', label: 'Walk' },
    ],
    [hasTour]
  );

  const [mode, setMode] = useState<RigMode>(hasTour ? 'tour' : 'orbit');
  const [paletteKey, setPaletteKey] = useState<PaletteKey>(
    site.palette ?? 'toy'
  );
  const [caption, setCaption] = useState<HudCaption | null>(
    hasTour ? { name: site.tour![0].name, blurb: site.tour![0].blurb } : null
  );
  const [showFps, setShowFps] = useState(false);
  const [worldError, setWorldError] = useState<string | null>(null);
  const day = site.day ?? 0.4; // well-lit late-morning by default
  const handleRef = useRef<StageHandle | null>(null);
  // Stable identity — an inline arrow would re-run StageCore's registerHandle
  // effect (whose cleanup disposes the composer) on every re-render.
  const registerHandle = useCallback((h: StageHandle) => {
    handleRef.current = h;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Backquote') setShowFps((v) => !v);
      // Digit keys map by position into the mode dock (so `1` is never a dead
      // key on tour-less sites).
      const m = /^Digit([1-4])$/.exec(e.code);
      if (m) {
        const opt = modes[Number(m[1]) - 1];
        if (opt) setMode(opt.key as RigMode);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modes]);

  // Route-scoped chrome control: hide the global cookie/PWA popups that would
  // overlap the diorama HUD. Keeps ScriptHammer's top nav (the diorama insets
  // below it). Class is removed on unmount so other routes are unaffected.
  useEffect(() => {
    document.body.classList.add('twin-fullscreen');
    return () => document.body.classList.remove('twin-fullscreen');
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
          paletteKey={paletteKey}
          day={day}
          mode={mode}
          onCaption={setCaption}
          onWorldError={setWorldError}
          registerHandle={registerHandle}
        />
      </Canvas>
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

export default function TwinCanvas({ slug }: { slug: string }) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setManifest(null);
    setError(null);
    loadManifest(slug)
      .then((m) => {
        if (alive) setManifest(m);
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
  return <TwinCanvasInner slug={slug} manifest={manifest} />;
}
