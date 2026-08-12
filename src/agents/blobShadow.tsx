'use client';

// Fake ground shadow for the MOVING things (player, bike, later cars) after the
// real-time shadow map was retired (#perf). A flat, soft, dark disc laid on the
// ground under an object — no shadow pass, just one transparent quad. The static
// city gets its shadows from the satellite drape + baked AO instead; only the
// movers need a dynamic one, and a blob is the cheapest honest version.

import { forwardRef } from 'react';
import { DataTexture, Mesh, RGBAFormat } from 'three';

let sharedTex: DataTexture | null = null;

/** Soft round black-alpha texture — a disc that fades to nothing at the rim.
 *  Built once and shared by every blob. RGB stays 0 (black); only alpha varies.
 *  Adapted from the fx dust `roundSprite` (src/lib/cod/fx/useFootstepDust.ts). */
function blobTexture(): DataTexture {
  if (sharedTex) return sharedTex;
  const S = 64;
  const d = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const r = Math.hypot((x / (S - 1)) * 2 - 1, (y / (S - 1)) * 2 - 1);
      const a = Math.max(0, 1 - r);
      d[i + 3] = a * a * a * 255; // soft, darkest at the centre
    }
  }
  const t = new DataTexture(d, S, S, RGBAFormat);
  t.needsUpdate = true;
  sharedTex = t;
  return t;
}

/** A flat dark disc on the ground. The parent positions it (feet/bike Y is
 *  already ground-contact); a small built-in lift + `polygonOffset` + no depth
 *  write keep it from z-fighting the terrain. */
export const GroundBlob = forwardRef<Mesh, { size?: number; opacity?: number }>(
  function GroundBlob({ size = 1.4, opacity = 0.5 }, ref) {
    return (
      <mesh
        ref={ref}
        position={[0, 0.03, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={2}
      >
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          map={blobTexture()}
          transparent
          opacity={opacity}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>
    );
  }
);
