'use client';

import React from 'react';
import { Canvas } from '@react-three/fiber';
import Controls from '@/components/game/Controls';

export interface SceneProps {
  /** Additional CSS classes on the wrapper. */
  className?: string;
}

/**
 * Scene component
 *
 * Feature 047 — Three.js Game (T012)
 *
 * Root R3F `<Canvas>` for the /game/3d route. Mounts the WebGL surface with
 * the constraints from spec NFR-004 (DPR capped at [1, 2]) and NFR-005 (no
 * SSR — this component must be loaded via `dynamic(import(...), { ssr: false })`
 * per the page-level wiring at `src/app/game/3d/page.tsx`).
 *
 * The v1 placeholder geometry is an orange cube — proves the canvas mounts
 * and orbit controls work. The actual brand-asset sculpt (cog ring + golden
 * brackets + printing-mallet) lands in Phase 9 (T039+).
 *
 * Theme reactivity (US-2, T018), reduced-motion gating (US-3, T023), and the
 * WebGL fallback path (FR-008, T036) all land in their own phases.
 *
 * @category game
 */
export default function Scene({ className = '' }: SceneProps = {}) {
  return (
    <div
      className={`aspect-video w-full max-w-full${className ? ` ${className}` : ''}`}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 1.5, 4], fov: 50 }}
        gl={{ preserveDrawingBuffer: false }}
        aria-label="3D scene preview"
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={1.5} />
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#ea580c" />
        </mesh>
        <Controls />
      </Canvas>
    </div>
  );
}
