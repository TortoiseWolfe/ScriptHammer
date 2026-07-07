'use client';
import type { Hero, TerrainGrid, Manifest } from '@/lib/manifest';
import { elevationAt, minElevation } from './terrainSample';

export const HERO_KEYS = [
  'aquarium',
  'walnut_st_bridge',
  'tivoli',
  'dome_building',
  'courthouse',
  'hunter_museum',
  'choo_choo',
  'republic_centre',
];

export default function Heroes({
  heroes,
  grid,
  manifest,
}: {
  heroes: Hero[];
  grid: TerrainGrid;
  manifest: Manifest;
}) {
  const minE = minElevation(grid);
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
              opacity={0.85}
            />
          </mesh>
        );
      })}
    </>
  );
}
