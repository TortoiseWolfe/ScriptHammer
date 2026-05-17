'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Color as ThreeColor } from 'three';
import Controls from '@/components/game/Controls';
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
 * Scene component
 *
 * Feature 047 — Three.js Game (T012 → T018+T019 → T023+T024)
 *
 * Root R3F `<Canvas>` for the /game/3d route.
 *
 * - DPR capped at [1, 2] (NFR-004)
 * - No SSR — must be loaded via `dynamic(import(...), { ssr: false })` (NFR-005)
 * - Theme reactivity via `getDaisyUIColorAsThree` + MutationObserver on
 *   `<html data-theme>` (FR-002, FR-003, US-2)
 * - Auto-orbit gated on `prefers-reduced-motion` + 3-second idle-resume
 *   after user input (FR-004, FR-005, US-3)
 *
 * The v1 placeholder geometry is a cube in the primary theme color. The
 * brand-asset sculpt (cog ring + golden brackets + printing-mallet) lands
 * in Phase 9 (T039+). The WebGL fallback path (FR-008) lands at T036.
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

  // Theme reactivity: re-extract DaisyUI tokens on data-theme change.
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

  // User-input detection: pause auto-orbit on input, resume after idle window.
  // Listen on the document so any pointer/wheel/touch event over the canvas
  // (or anywhere else, since the canvas captures most pointer events) counts
  // as user input.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (reducedMotion) return; // no auto-orbit to pause when reduced-motion is on

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

  return (
    <div
      className={`aspect-video w-full max-w-full${className ? ` ${className}` : ''}`}
      data-mesh-color={primaryHex}
      data-autorotate-active={autoRotateActive ? 'true' : 'false'}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 1.5, 4], fov: 50 }}
        gl={{ preserveDrawingBuffer: false }}
        aria-label="3D scene preview"
      >
        <color attach="background" args={[themeTokens.base]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={1.5} />
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={themeTokens.primary} />
        </mesh>
        <Controls autoRotate={autoRotateActive} />
      </Canvas>
    </div>
  );
}
