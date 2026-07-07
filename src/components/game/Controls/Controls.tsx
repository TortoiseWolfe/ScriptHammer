'use client';

import React from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';

export interface ControlsProps {
  /** Override the auto-orbit speed (radians per frame). Default 0.5. */
  autoRotateSpeed?: number;
  /** Whether auto-rotate is active. Owner (Scene) computes this from
   *  useReducedMotion + idle-resume state and passes it down. */
  autoRotate?: boolean;
  /** Fires after each OrbitControls `change` event with a stable camera
   *  position string `"x,y,z"`. Used by Scene to write a debug attribute
   *  for E2E multi-modality testing (SC-004). Drops sub-pixel jitter to
   *  the third decimal to avoid attribute thrash. */
  onCameraChange?: (positionKey: string) => void;
}

/**
 * Controls component
 *
 * Feature 047 — Three.js Game (T013 → T023 → T049c)
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
  onCameraChange,
}: ControlsProps = {}) {
  const camera = useThree((state) => state.camera);

  const handleChange = React.useCallback(() => {
    if (!onCameraChange) return;
    // Quantize to 3 decimal places so micro-jitter doesn't churn the React state.
    const k = `${camera.position.x.toFixed(3)},${camera.position.y.toFixed(
      3
    )},${camera.position.z.toFixed(3)}`;
    onCameraChange(k);
  }, [camera, onCameraChange]);

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
      onChange={handleChange}
    />
  );
}
