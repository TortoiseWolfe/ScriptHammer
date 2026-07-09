'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CatmullRomCurve3, Vector3, Group } from 'three';

export default function Trolley({
  polyline,
  onTick,
  groundAt,
}: {
  polyline: number[];
  onTick?: (pos: Vector3, heading: number) => void;
  /** Terrain height sampler (runtime Y at ENU x/z). Without it the trolley
   *  runs at sea level — buried wherever the terrain rises, and any camera
   *  following it (Ride mode) goes underground with it. */
  groundAt?: (x: number, z: number) => number;
}) {
  const ref = useRef<Group>(null);
  const uRef = useRef(0);
  const { curve, len } = useMemo(() => {
    const pts: Vector3[] = [];
    for (let i = 0; i + 1 < polyline.length; i += 2)
      pts.push(new Vector3(polyline[i], 0, polyline[i + 1]));
    const c = new CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    return { curve: c, len: c.getLength() || 1 };
  }, [polyline]);

  const pos = useRef(new Vector3());
  const tan = useRef(new Vector3());
  const heading = useRef(0);
  useFrame((_, dt) => {
    uRef.current = (uRef.current + (15 * dt) / len) % 1;
    curve.getPointAt(uRef.current, pos.current);
    curve.getTangentAt(uRef.current, tan.current);
    const target = Math.atan2(tan.current.x, tan.current.z);
    const d = ((target - heading.current + Math.PI) % (Math.PI * 2)) - Math.PI;
    heading.current += d * (1 - Math.exp(-7 * dt));
    pos.current.y = groundAt?.(pos.current.x, pos.current.z) ?? 0;
    if (ref.current) {
      ref.current.position.set(pos.current.x, pos.current.y, pos.current.z);
      ref.current.rotation.y = heading.current;
    }
    onTick?.(pos.current, heading.current);
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 3.4, 0]} castShadow>
        <boxGeometry args={[6, 5, 13]} />
        <meshStandardMaterial color={0xb23a2e} />
      </mesh>
      <mesh position={[0, 6.4, 0]}>
        <boxGeometry args={[6.6, 0.8, 13.6]} />
        <meshStandardMaterial color={0xf0e6d2} />
      </mesh>
    </group>
  );
}
