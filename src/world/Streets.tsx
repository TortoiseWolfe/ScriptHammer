'use client';
import { useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { Street } from '@/lib/manifest';

export default function Streets({ streets }: { streets: Street[] }) {
  const geometry = useMemo(() => {
    const verts: number[] = [];
    for (const s of streets) {
      for (let i = 0; i + 3 < s.pts.length; i += 2) {
        verts.push(
          s.pts[i],
          0.15,
          s.pts[i + 1],
          s.pts[i + 2],
          0.15,
          s.pts[i + 3]
        );
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(verts, 3));
    return g;
  }, [streets]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={0x9c9384} />
    </lineSegments>
  );
}
