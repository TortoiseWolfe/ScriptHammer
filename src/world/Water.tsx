'use client';
import { useMemo } from 'react';
import { PlaneGeometry } from 'three';
import type { Manifest } from '@/lib/manifest';

/**
 * Lit water surface for the river (#225).
 *
 * The bake carves the river channel down to the corridor's minimum elevation,
 * which — like every other layer — is normalized so the lowest ground sits at
 * Y=0 (Terrain/Buildings/Streets all subtract the same minElevation). So the
 * water surface is a flat plane at Y=0. A full-ground-extent plane shows THROUGH
 * only where the terrain is carved to/below 0 (the river channel); everywhere
 * else the terrain sits above it and occludes it. That means one plane paints
 * exactly the river with no masking needed.
 *
 * Without this the river was a black void: a dark aerial drape on a flat mesh
 * reflects almost no light at grazing angles, so the channel read as an abyss
 * and riverfront buildings looked like they floated over nothing (the visible
 * half of #225). A lit, faintly-reflective surface makes the water read as
 * water, which is also what finally lets the registration be verified by eye.
 */
export default function Water({ manifest }: { manifest: Manifest }) {
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(manifest.groundWm, manifest.groundHm);
    g.rotateX(-Math.PI / 2); // lay flat in the XZ plane like the terrain
    return g;
  }, [manifest]);

  return (
    // A hair above the carved channel floor (Y=0) so it doesn't z-fight the
    // terrain bed but stays below the banks. Standard water look: teal, low
    // roughness for a sheen off the sun/hemisphere lights, slightly translucent.
    <mesh geometry={geometry} position={[0, 0.15, 0]} receiveShadow>
      <meshStandardMaterial
        // Diorama water reads as water only if it's largely self-lit: a flat
        // horizontal plane catches almost no direct sun at the grazing tour
        // angles, and the tilt-shift/grade post darkens it further, so a
        // lighting-dependent material renders as the black void this replaces.
        // A strong teal emissive makes the river legible from every camera.
        color={0x2b5c6b}
        emissive={0x1f7a94}
        emissiveIntensity={0.9}
        roughness={0.35}
        metalness={0.1}
      />
    </mesh>
  );
}
