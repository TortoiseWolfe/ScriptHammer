'use client';

import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Color as ThreeColor } from 'three';
import Controls from '@/components/game/Controls';
import { getDaisyUIColorAsThree } from '@/utils/theme-utils';

export interface SceneProps {
  /** Additional CSS classes on the wrapper. */
  className?: string;
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
 * Feature 047 — Three.js Game (T012 → T018+T019)
 *
 * Root R3F `<Canvas>` for the /game/3d route. Mounts the WebGL surface with
 * the constraints from spec NFR-004 (DPR capped at [1, 2]) and NFR-005 (no
 * SSR — this component must be loaded via `dynamic(import(...), { ssr: false })`
 * per the page-level wiring at `src/app/game/3d/page.tsx`).
 *
 * Theme reactivity (US-2, T018+T019): reads DaisyUI CSS custom props
 * (`--p`, `--s`, `--a`, `--b1`) via `getDaisyUIColorAsThree` on mount, and
 * re-extracts on every `data-theme` attribute change via `MutationObserver`
 * on `<html>` — mirrors the `useMapTheme` precedent. The canvas background
 * and material colors track the active theme without a page reload.
 *
 * The v1 placeholder geometry is an orange cube — proves the canvas mounts
 * and orbit controls work. The actual brand-asset sculpt (cog ring + golden
 * brackets + printing-mallet) lands in Phase 9 (T039+).
 *
 * Reduced-motion gating (US-3, T023) and the WebGL fallback path (FR-008,
 * T036) land in their own phases.
 *
 * @category game
 */
export default function Scene({ className = '' }: SceneProps = {}) {
  const [themeTokens, setThemeTokens] = useState<ThemeTokens>(() =>
    readThemeTokens()
  );

  // Re-extract theme tokens when <html data-theme> changes. Mirrors the
  // useMapTheme MutationObserver pattern from src/hooks/useMapTheme.ts.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Refresh once on mount (in case the SSR fallback returned defaults).
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

  // Hex of the primary color — used both as the placeholder cube's material
  // color AND exposed as a dev-mode debug attribute on the wrapper for E2E
  // assertions (per T024 in tasks.md).
  const primaryHex = `#${themeTokens.primary.getHexString()}`;

  return (
    <div
      className={`aspect-video w-full max-w-full${className ? ` ${className}` : ''}`}
      data-mesh-color={primaryHex}
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
        <Controls />
      </Canvas>
    </div>
  );
}
