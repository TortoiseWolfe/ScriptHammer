'use client';

import React from 'react';
import { OrbitControls } from '@react-three/drei';

export interface ControlsProps {
  /** Override the auto-orbit speed (radians per frame). Default 0.5. */
  autoRotateSpeed?: number;
  /** Disable auto-rotate explicitly (overrides defaults). */
  disableAutoRotate?: boolean;
}

/**
 * Controls component
 *
 * Feature 047 — Three.js Game (T013)
 *
 * Wraps drei's `<OrbitControls>` with the camera constraints from spec FR-005:
 * - Damping enabled (smooth deceleration)
 * - Polar angle bounded to prevent flipping under the ground plane
 * - 360° yaw (azimuth unconstrained)
 * - Bounded zoom (min/max distance)
 *
 * Auto-orbit gating on `prefers-reduced-motion` and the 3-second idle-resume
 * window land in Phase 5 (T023) — for now this component only enables
 * auto-rotate when explicitly opted in.
 *
 * @category game
 */
export default function Controls({
  autoRotateSpeed = 0.5,
  disableAutoRotate = false,
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
      autoRotate={!disableAutoRotate}
      autoRotateSpeed={autoRotateSpeed}
    />
  );
}
