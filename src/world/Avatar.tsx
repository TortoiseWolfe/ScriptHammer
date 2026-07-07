'use client';
import { forwardRef } from 'react';
import { Group } from 'three';

const Avatar = forwardRef<Group>(function Avatar(_, ref) {
  return (
    <group ref={ref}>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.9, 2, 10]} />
        <meshStandardMaterial color={0x3d6ea5} />
      </mesh>
      <mesh position={[0, 2.5, 0]} castShadow>
        <sphereGeometry args={[0.95, 14, 12]} />
        <meshStandardMaterial color={0xf0c9a0} />
      </mesh>
    </group>
  );
});
export default Avatar;
