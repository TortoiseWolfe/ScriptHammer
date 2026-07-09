'use client';
import type { Hero, TerrainGrid, Manifest } from '@/lib/manifest';
import { elevationAt, minElevation } from './terrainSample';

export default function Heroes({
  heroes,
  grid,
  manifest,
  opacity = 1,
}: {
  heroes: Hero[];
  grid: TerrainGrid;
  manifest: Manifest;
  /** Follows the buildings layer fade (heroes sit on the same layer). */
  opacity?: number;
}) {
  const minE = minElevation(grid);
  if (opacity <= 0) return null;
  return (
    <>
      {heroes.map((h, i) => {
        // Sit the hero placeholder on the terrain at its (x,z), + half its box
        // height (16/2=8) so the cube rests ON the ground rather than sinking in.
        const groundY = elevationAt(grid, manifest, h.x, h.z) - minE;
        return (
          <mesh
            key={`${h.swap}-${i}`}
            position={[h.x, groundY + 8, h.z]}
            castShadow
            onUpdate={(self) => {
              self.userData.swap = h.swap;
            }}
          >
            <boxGeometry args={[16, 16, 16]} />
            <meshStandardMaterial
              color={0x8fd0d8}
              roughness={0.3}
              metalness={0.1}
              transparent
              opacity={0.85 * opacity}
            />
          </mesh>
        );
      })}
    </>
  );
}
