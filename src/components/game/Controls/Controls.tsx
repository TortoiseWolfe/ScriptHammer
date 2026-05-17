'use client';

import React from 'react';
import { OrbitControls } from '@react-three/drei';

export interface ControlsProps {
  /** Override the auto-orbit speed (radians per frame). Default 0.5. */
  autoRotateSpeed?: number;
  /** Whether auto-rotate is active. Owner (Scene) computes this from
   *  useReducedMotion + idle-resume state and passes it down. */
  autoRotate?: boolean;
}

/**
 * Controls component
 *
 * Feature 047 — Three.js Game (T013 → T023)
 *
 * Wraps drei's `<OrbitControls>` with the camera constraints from spec
 * FR-005. Auto-orbit + reduced-motion gating + idle-resume logic lives in
 * the parent Scene (which owns the user-input listeners and the paused
 * state); Controls receives the resolved `autoRotate` boolean as a prop
 * and renders it.
 *
 * @category game
 */
export default function Controls({
  autoRotateSpeed = 0.5,
  autoRotate = true,
}: ControlsProps = {}) {
  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.05}
      enableZoom
      enablePan={false}
      minDistance={2}
      maxDistance={10}
      maxPolarAngle={Math.PI / 2}
      autoRotate={autoRotate}
      autoRotateSpeed={autoRotateSpeed}
    />
  );
}
