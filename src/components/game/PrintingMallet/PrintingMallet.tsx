'use client';

import React from 'react';
import { Color as ThreeColor } from 'three';

export interface PrintingMalletProps {
  /** Wood color of the head + handle. Defaults to beech tone. */
  woodColor?: ThreeColor | string;
  /** Tilt angle around the Z-axis in radians. Default 42 degrees (per canonical pose). */
  tilt?: number;
}

/**
 * PrintingMallet component (R3F sub-tree)
 *
 * Feature 047 — Three.js Game (T041)
 *
 * Procedural compositor's mallet mirroring `public/printing-mallet.svg`:
 * - Squat boxy head (per A. A. Stewart's "Typesetting": almost-square,
 *   5" × 4" × 3" — thicker than tall in the world-coord proportions used here)
 * - Thin cylindrical handle (~1" diameter, 7-8" long)
 * - Small locking wedge visible on the top face
 *
 * Tilted 42° clockwise around Z to match the canonical brand pose. Wood
 * tone is a fixed warm beech (`#c9a876`) — wood doesn't recolor per
 * DaisyUI theme.
 *
 * Must be rendered inside a `<Canvas>` (R3F context required).
 *
 * @category game
 */
export default function PrintingMallet({
  woodColor = '#c9a876',
  tilt = (42 * Math.PI) / 180,
}: PrintingMalletProps = {}) {
  return (
    <group rotation={[0, 0, tilt]}>
      {/* Head — squat box ~1.4×0.8×0.6 world units (wide-flat-short proportions) */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[1.4, 0.8, 0.6]} />
        <meshStandardMaterial
          color={woodColor}
          roughness={0.8}
          metalness={0.0}
        />
      </mesh>

      {/* Locking wedge — small lighter-wood box on top of the head */}
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[0.18, 0.06, 0.28]} />
        <meshStandardMaterial color="#d8c49a" roughness={0.7} metalness={0.0} />
      </mesh>

      {/* Handle — thin cylinder, 1.6 units long, extending down from the head */}
      <mesh position={[0, -0.8, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 1.6, 16]} />
        <meshStandardMaterial
          color={woodColor}
          roughness={0.7}
          metalness={0.0}
        />
      </mesh>
    </group>
  );
}
