'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Color as ThreeColor } from 'three';
import Controls from '@/components/game/Controls';
import FallbackPanel from '@/components/game/FallbackPanel';
import CogRing from '@/components/game/CogRing';
import ScriptTags from '@/components/game/ScriptTags';
import PrintingMallet from '@/components/game/PrintingMallet';
import { getDaisyUIColorAsThree } from '@/utils/theme-utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export interface SceneProps {
  /** Additional CSS classes on the wrapper. */
  className?: string;
  /**
   * Idle window in ms before auto-rotate resumes after user input.
   * Default 3000 (3 seconds). Per spec FR-005 + US-3 acceptance scenario.
   */
  idleResumeMs?: number;
}

interface ThemeTokens {
  primary: ThreeColor;
  secondary: ThreeColor;
  accent: ThreeColor;
  base: ThreeColor;
}

function readThemeTokens(): ThemeTokens {
  return {
    primary: getDaisyUIColorAsThree('p'),
    secondary: getDaisyUIColorAsThree('s'),
    accent: getDaisyUIColorAsThree('a'),
    base: getDaisyUIColorAsThree('b1'),
  };
}

/**
 * Probe WebGL availability synchronously. Returns true if WebGL 1.0 is
 * supported, false otherwise. Cheap (~1ms) — see research.md Decision 2.
 */
function isWebGLAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    const ctx =
      probe.getContext('webgl') ||
      probe.getContext('experimental-webgl' as 'webgl');
    return !!ctx;
  } catch {
    return false;
  }
}

/**
 * Scene component
 *
 * Feature 047 — Three.js Game (T012 → T018 → T023 → T036)
 *
 * Root R3F `<Canvas>` for the /game/3d route.
 *
 * - DPR capped at [1, 2] (NFR-004)
 * - No SSR — must be loaded via `dynamic(import(...), { ssr: false })` (NFR-005)
 * - Theme reactivity via `getDaisyUIColorAsThree` + MutationObserver on
 *   `<html data-theme>` (FR-002, FR-003, US-2)
 * - Auto-orbit gated on `prefers-reduced-motion` + 3-second idle-resume
 *   after user input (FR-004, FR-005, US-3)
 * - WebGL fallback: at mount, probe WebGL availability; if unavailable,
 *   render `<FallbackPanel>` instead of `<Canvas>`. After mount, listen
 *   for `webglcontextlost` and swap to the fallback if the context dies
 *   (FR-008). No silent auto-retry — user clicks Retry.
 *
 * @category game
 */
export default function Scene({
  className = '',
  idleResumeMs = 3000,
}: SceneProps = {}) {
  const [themeTokens, setThemeTokens] = useState<ThemeTokens>(() =>
    readThemeTokens()
  );

  const reducedMotion = useReducedMotion();
  const [pausedFromInput, setPausedFromInput] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // WebGL availability + context-lost tracking. `webglOk` flips false when:
  //   - the initial probe says WebGL isn't available, OR
  //   - the canvas fires `webglcontextlost` at runtime.
  // The Retry button resets it to the initial-probe value.
  const [webglOk, setWebglOk] = useState<boolean>(() => isWebGLAvailable());

  const handleRetry = useCallback(() => {
    setWebglOk(isWebGLAvailable());
  }, []);

  // Theme reactivity.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    setThemeTokens(readThemeTokens());
    const observer = new MutationObserver(() => {
      setThemeTokens(readThemeTokens());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  // User-input detection for auto-orbit pause/resume.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (reducedMotion) return;

    function onUserInput() {
      setPausedFromInput(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setPausedFromInput(false);
      }, idleResumeMs);
    }

    const events = ['pointerdown', 'wheel', 'touchstart'] as const;
    events.forEach((evt) =>
      document.addEventListener(evt, onUserInput, { passive: true })
    );

    return () => {
      events.forEach((evt) => document.removeEventListener(evt, onUserInput));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [reducedMotion, idleResumeMs]);

  const autoRotateActive = !reducedMotion && !pausedFromInput;
  const primaryHex = `#${themeTokens.primary.getHexString()}`;

  // Camera-position debug attribute, written by Controls.onCameraChange.
  // Used by E2E tests to verify SC-004 multi-modality input changes the
  // camera (mouse-drag, wheel-zoom, touch-gestures should each produce a
  // distinct value sequence).
  const [cameraKey, setCameraKey] = useState<string>('0.000,0.000,5.000');
  const handleCameraChange = useCallback((k: string) => {
    setCameraKey(k);
  }, []);

  // Bind webglcontextlost listener to the canvas as soon as R3F creates it.
  const onCanvasCreated = useCallback(
    (state: { gl: { domElement: HTMLCanvasElement } }) => {
      const domEl = state.gl.domElement;
      const handler = (event: Event) => {
        // preventDefault allows the browser to restore the context later;
        // we don't auto-restore (per FR-008 — no silent auto-retry), but
        // we want the option preserved if the user clicks Retry.
        event.preventDefault();
        setWebglOk(false);
      };
      domEl.addEventListener('webglcontextlost', handler, false);
      // R3F doesn't expose an "onDestroyed" hook, but this listener will
      // be torn down when the canvas element is unmounted.
    },
    []
  );

  // If WebGL isn't available at mount, render the fallback directly.
  if (!webglOk) {
    return (
      <div
        className={`aspect-video w-full max-w-full${className ? ` ${className}` : ''}`}
        data-mesh-color={primaryHex}
        data-autorotate-active="false"
        data-webgl-ok="false"
      >
        <FallbackPanel onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <div
      className={`aspect-video w-full max-w-full${className ? ` ${className}` : ''}`}
      data-mesh-color={primaryHex}
      data-autorotate-active={autoRotateActive ? 'true' : 'false'}
      data-webgl-ok="true"
      data-camera-position={cameraKey}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ preserveDrawingBuffer: false }}
        onCreated={onCanvasCreated}
        aria-label="3D scene preview"
      >
        <color attach="background" args={[themeTokens.base]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={1.5} />

        {/* Brand-asset sculpt — composition mirrors src/components/atomic/
            SpinningLogo/LayeredScriptHammerLogo.tsx (mallet BACK, cog MIDDLE,
            brackets FRONT). FR-007. */}
        <group position={[-0.3, -0.2, -0.4]}>
          <PrintingMallet />
        </group>
        <group position={[0, 0, 0]}>
          <CogRing color={themeTokens.primary} />
        </group>
        <group position={[0, 0, 0.4]}>
          <ScriptTags color={themeTokens.accent} />
        </group>

        <Controls
          autoRotate={autoRotateActive}
          onCameraChange={handleCameraChange}
        />
      </Canvas>
    </div>
  );
}
