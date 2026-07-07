'use client';
import type { Hero } from '@/lib/manifest';

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

export default function Heroes({ heroes }: { heroes: Hero[] }) {
  return (
    <>
      {heroes.map((h, i) => (
        <mesh
          key={`${h.swap}-${i}`}
          position={[h.x, 8, h.z]}
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
      ))}
    </>
  );
}
