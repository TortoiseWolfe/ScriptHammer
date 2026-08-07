'use client';
import { useEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
  Object3D,
  type InstancedMesh,
} from 'three';
import type { Street, TerrainGrid, Manifest } from '@/lib/manifest';
import { elevationAt, minElevation } from './terrainSample';

/**
 * Zero-asset "city life" for the wide/Walk diorama: instanced procedural street
 * trees + parked cars scattered along the (reprojected) streets, so the city
 * isn't dead-empty. Three InstancedMeshes total (trunk / foliage / car) — a
 * couple thousand instances at three draw calls, deterministic via a seeded RNG.
 * Pedestrians are deferred (a believable crowd needs rigged figures).
 */

// Deterministic scatter (mulberry32) — same layout every load, no per-frame alloc.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROAD_HALF = 4; // matches Roads.tsx ROAD_WIDTH / 2
const MAX_TREES = 1600;
const MAX_CARS = 420;
const CAR_COLORS = [0x3a4b6b, 0x8a2f2f, 0x2f6b45, 0xd9d2c4, 0x30343a, 0xa8863f];

interface Placed {
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
  colorIdx: number;
}

/**
 * Scatter street trees + parked cars along the streets (pure + testable). Trees
 * on both sidewalks, cars along one curb. Placement steps along the WHOLE
 * polyline (cumulative distance) so densely-sampled short segments still get
 * props — per-segment stepping placed almost nothing. Deterministic (seeded RNG).
 */
export function scatterCityProps(
  streets: Street[],
  grid: TerrainGrid,
  manifest: Manifest
): { trees: Placed[]; cars: Placed[] } {
  const minE = minElevation(grid);
  const yAt = (x: number, z: number) =>
    elevationAt(grid, manifest, x, z) - minE;
  const rng = mulberry32(0x5eed01);
  const trees: Placed[] = [];
  const cars: Placed[] = [];
  for (const s of streets) {
    const p = s.pts;
    let acc = 0;
    let nextTree = 5 + rng() * 8;
    let nextCar = 12 + rng() * 12;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const x0 = p[i],
        z0 = p[i + 1],
        x1 = p[i + 2],
        z1 = p[i + 3];
      let dx = x1 - x0,
        dz = z1 - z0;
      const len = Math.hypot(dx, dz);
      if (len < 1e-3) continue;
      dx /= len;
      dz /= len;
      const nx = -dz,
        nz = dx; // street perpendicular
      const along = Math.atan2(dx, dz); // face along the segment
      while (nextTree <= acc + len && trees.length < MAX_TREES) {
        const d = nextTree - acc;
        const cx = x0 + dx * d,
          cz = z0 + dz * d;
        for (const side of [1, -1] as const) {
          if (rng() < 0.3) continue; // gaps
          const off = (ROAD_HALF + 2.2 + rng() * 1.2) * side;
          const tx = cx + nx * off + (rng() - 0.5) * 1.4;
          const tz = cz + nz * off + (rng() - 0.5) * 1.4;
          trees.push({
            x: tx,
            y: yAt(tx, tz),
            z: tz,
            rotY: rng() * Math.PI * 2,
            scale: 0.85 + rng() * 0.7,
            colorIdx: 0,
          });
        }
        nextTree += 11 + rng() * 6;
      }
      while (nextCar <= acc + len && cars.length < MAX_CARS) {
        const d = nextCar - acc;
        const cx = x0 + dx * d,
          cz = z0 + dz * d;
        const off = ROAD_HALF - 0.4;
        const kx = cx + nx * off,
          kz = cz + nz * off;
        cars.push({
          x: kx,
          y: yAt(kx, kz),
          z: kz,
          rotY: along,
          scale: 1,
          colorIdx: (rng() * CAR_COLORS.length) | 0,
        });
        nextCar += 16 + rng() * 14;
      }
      acc += len;
    }
  }
  return { trees, cars };
}

export default function CityProps({
  streets,
  grid,
  manifest,
}: {
  streets: Street[];
  grid: TerrainGrid;
  manifest: Manifest;
}) {
  const { trees, cars } = useMemo(
    () => scatterCityProps(streets, grid, manifest),
    [streets, grid, manifest]
  );

  // Base geometries sit with their base at y=0 (translated up) so an instance
  // placed at ground height rests ON the ground.
  const trunkGeo = useMemo(() => {
    const g = new CylinderGeometry(0.16, 0.24, 2.2, 6);
    g.translate(0, 1.1, 0);
    return g;
  }, []);
  const foliageGeo = useMemo(() => {
    const g = new IcosahedronGeometry(1.5, 0);
    g.translate(0, 3.1, 0);
    return g;
  }, []);
  const carGeo = useMemo(() => {
    const g = new BoxGeometry(4.4, 1.4, 1.9);
    g.translate(0, 0.7, 0);
    return g;
  }, []);
  const trunkMat = useMemo(
    () => new MeshStandardMaterial({ color: 0x5b4432, roughness: 0.95 }),
    []
  );
  const foliageMat = useMemo(
    () => new MeshStandardMaterial({ color: 0x3f6f3a, roughness: 0.9 }),
    []
  );
  const carMat = useMemo(
    // White base so per-instance instanceColor shows; a little metalness reads
    // as painted sheet metal.
    () => new MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.3 }),
    []
  );

  const trunkRef = useRef<InstancedMesh>(null);
  const foliageRef = useRef<InstancedMesh>(null);
  const carRef = useRef<InstancedMesh>(null);

  useEffect(() => {
    const o = new Object3D();
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      o.position.set(t.x, t.y, t.z);
      o.rotation.set(0, t.rotY, 0);
      o.scale.setScalar(t.scale);
      o.updateMatrix();
      trunkRef.current?.setMatrixAt(i, o.matrix);
      foliageRef.current?.setMatrixAt(i, o.matrix);
    }
    if (trunkRef.current) trunkRef.current.instanceMatrix.needsUpdate = true;
    if (foliageRef.current) foliageRef.current.instanceMatrix.needsUpdate = true;
  }, [trees]);

  useEffect(() => {
    const o = new Object3D();
    const c = new Color();
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      o.position.set(car.x, car.y, car.z);
      o.rotation.set(0, car.rotY, 0);
      o.scale.setScalar(1);
      o.updateMatrix();
      carRef.current?.setMatrixAt(i, o.matrix);
      carRef.current?.setColorAt(i, c.setHex(CAR_COLORS[car.colorIdx]));
    }
    if (carRef.current) {
      carRef.current.instanceMatrix.needsUpdate = true;
      if (carRef.current.instanceColor)
        carRef.current.instanceColor.needsUpdate = true;
    }
  }, [cars]);

  if (trees.length === 0 && cars.length === 0) return null;
  return (
    <>
      {/* frustumCulled off: the per-instance bounds aren't tracked, so a
          bounding-sphere cull off instance 0 would wrongly hide the whole set. */}
      <instancedMesh
        ref={trunkRef}
        args={[trunkGeo, trunkMat, Math.max(1, trees.length)]}
        frustumCulled={false}
        receiveShadow
      />
      <instancedMesh
        ref={foliageRef}
        args={[foliageGeo, foliageMat, Math.max(1, trees.length)]}
        frustumCulled={false}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={carRef}
        args={[carGeo, carMat, Math.max(1, cars.length)]}
        frustumCulled={false}
        castShadow
        receiveShadow
      />
    </>
  );
}
