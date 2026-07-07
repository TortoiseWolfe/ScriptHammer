'use client';
import { useMemo } from 'react';
import {
  Shape,
  ExtrudeGeometry,
  BufferGeometry,
  BufferAttribute,
  Color,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Building } from '@/lib/manifest';
import { ringToShape } from './geometry';

export interface BuildingPalette {
  bricks: number[];
}

function extrude(b: Building): BufferGeometry {
  const { center, localRing } = ringToShape(b.ring);
  const shape = new Shape();
  localRing.forEach(([x, z], i) =>
    i === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z)
  );
  shape.closePath();
  // Extrude along +Z by default: build in the shape's local XY then rotate
  // so the extrusion depth maps to world +Y (buildings stand upright).
  const geo = new ExtrudeGeometry(shape, {
    depth: b.height,
    bevelEnabled: false,
  });
  geo.rotateX(-Math.PI / 2); // shape's Y -> world Z; extrude depth -> world +Y
  geo.translate(center[0], 0, center[1]);
  return geo;
}

export default function Buildings({
  buildings,
  palette,
}: {
  buildings: Building[];
  palette: BuildingPalette;
}) {
  const { geometry } = useMemo(() => {
    const nonHero = buildings.filter((b) => !b.swap);
    const geos = nonHero.map((b) => {
      const g = extrude(b);
      const c = new Color(palette.bricks[b.id % palette.bricks.length]);
      const count = g.attributes.position.count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new BufferAttribute(colors, 3));
      return g;
    });
    return {
      geometry: geos.length
        ? mergeGeometries(geos, false)
        : new BufferGeometry(),
    };
  }, [buildings, palette]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.92} metalness={0} />
    </mesh>
  );
}
