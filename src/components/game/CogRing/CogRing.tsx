'use client';

import React from 'react';
import { Color as ThreeColor } from 'three';

export interface CogRingProps {
  /** Color of the ring material. Defaults to a silver tone if unset. */
  color?: ThreeColor | string;
  /** Outer rim radius. Default 1.6 (Three.js world units). */
  radius?: number;
  /** Thickness of the rim band. Default 0.06. */
  rimThickness?: number;
  /** Number of gear teeth distributed around the rim. Default 20. */
  teethCount?: number;
}

/**
 * CogRing component (R3F sub-tree)
 *
 * Feature 047 — Three.js Game (T039)
 *
 * Procedural cog ring mirroring `public/scripthammer-logo.svg`. The rim is a
 * `<torusGeometry>`. The 20 trapezoidal gear teeth are individual
 * `<boxGeometry>` meshes rotated around the center via `useMemo`-cached
 * positions. Rivets are small `<sphereGeometry>` instances every 18°.
 *
 * Material is `<meshStandardMaterial>` with high metalness + low roughness
 * for a silver / steampunk feel; theme reactivity via the `color` prop is
 * handled by the parent Scene reading `getDaisyUIColorAsThree`.
 *
 * Must be rendered inside a `<Canvas>` (R3F context required).
 *
 * @category game
 */
export default function CogRing({
  color = '#c0c0c0',
  radius = 1.6,
  rimThickness = 0.06,
  teethCount = 20,
}: CogRingProps = {}) {
  const teeth = React.useMemo(() => {
    const out: Array<{ angle: number; key: number }> = [];
    for (let i = 0; i < teethCount; i += 1) {
      out.push({ angle: (i * Math.PI * 2) / teethCount, key: i });
    }
    return out;
  }, [teethCount]);

  const rivets = React.useMemo(() => {
    // Half as many rivets as teeth, offset between each pair.
    const count = Math.floor(teethCount / 2);
    const out: Array<{ angle: number; key: number }> = [];
    for (let i = 0; i < count; i += 1) {
      out.push({
        angle: (i * Math.PI * 2) / count + Math.PI / count,
        key: i,
      });
    }
    return out;
  }, [teethCount]);

  return (
    <group>
      {/* Rim band */}
      <mesh>
        <torusGeometry args={[radius, rimThickness, 16, 64]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Gear teeth — trapezoidal-ish boxes positioned along the rim */}
      {teeth.map(({ angle, key }) => {
        const x = Math.cos(angle) * (radius + 0.08);
        const y = Math.sin(angle) * (radius + 0.08);
        // Each tooth points radially outward; rotation aligns one face with the rim normal.
        const rotZ = angle + Math.PI / 2;
        return (
          <mesh
            key={`tooth-${key}`}
            position={[x, y, 0]}
            rotation={[0, 0, rotZ]}
          >
            <boxGeometry args={[0.12, 0.16, 0.06]} />
            <meshStandardMaterial
              color={color}
              metalness={0.8}
              roughness={0.3}
            />
          </mesh>
        );
      })}

      {/* Rivets — small spheres between teeth */}
      {rivets.map(({ angle, key }) => {
        const x = Math.cos(angle) * (radius - rimThickness - 0.04);
        const y = Math.sin(angle) * (radius - rimThickness - 0.04);
        return (
          <mesh key={`rivet-${key}`} position={[x, y, rimThickness + 0.01]}>
            <sphereGeometry args={[0.025, 12, 12]} />
            <meshStandardMaterial
              color={color}
              metalness={0.95}
              roughness={0.15}
            />
          </mesh>
        );
      })}
    </group>
  );
}
