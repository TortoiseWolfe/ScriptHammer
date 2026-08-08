'use client';

// A procedural bicycle — the rideable world object for Walk mode (#226). Zero
// asset (mirrors src/agents/trolley.tsx + src/world/Avatar.tsx). It reads the
// embodied controller each frame FROM A REF (no React re-render, exactly like the
// trolley), and shows itself in the right place for each state:
//   parked (not riding)        → visible at the controller's parked bikePosition/yaw
//   riding + third-person      → visible under the player (you see yourself ride)
//   riding + first-person      → hidden (you're on it)
// It also reports near/far transitions so the HUD can prompt "press B to ride".
//
// The model is built pointing −Z (like the player's forward at yaw 0) so
// `rotation.y = yaw` faces it the way you're going. Wheel radius seats it on the
// ground (group y=0 = tyre contact), so `position.y = feet` sits it on terrain.

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import type { EmbodiedController } from '@/lib/cod';
import type { BikeView } from '@/stage/embodiedWalk';
import { GroundBlob } from './blobShadow';

const FRAME_COLOR = 0x2a6f97; // teal frame
const TIRE_COLOR = 0x141414;
const BAR_COLOR = 0x222222;

export default function Bike({
  ctrlRef,
  viewRef,
  onNearBike,
}: {
  ctrlRef: { current: EmbodiedController | null };
  viewRef: { current: BikeView };
  onNearBike?: (near: boolean) => void;
}) {
  const ref = useRef<Group>(null);
  const wasNear = useRef(false);

  useFrame(() => {
    const g = ref.current;
    const ctrl = ctrlRef.current;
    if (!g || !ctrl) return;

    if (!ctrl.riding) {
      // Parked where it was left.
      const p = ctrl.bikePosition;
      g.visible = true;
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = ctrl.bikeYaw;
    } else if (viewRef.current === 'third') {
      // Ridden, third-person: seat it under the player, facing travel.
      const p = ctrl.position;
      g.visible = true;
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = ctrl.facingYaw;
    } else {
      // Ridden, first-person: you're on it — hide it.
      g.visible = false;
    }

    // Prompt hook (only meaningful on foot).
    const near = ctrl.nearBike;
    if (near !== wasNear.current) {
      wasNear.current = near;
      onNearBike?.(near);
    }
  });

  return (
    // Real-world scale: the base model (~1.7 m long / ~1 m tall) IS a real bike, so
    // keep it near 1× next to the ~1.8 m rider (a hair up for presence). Origin at
    // tyre-contact so uniform scale keeps the wheels grounded.
    <group ref={ref} visible={false} scale={1.05}>
      {/* Wheels: axle along X (discs in the YZ plane), tyre contact at y=0. */}
      <mesh position={[0, 0.34, -0.5]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <torusGeometry args={[0.34, 0.03, 8, 20]} />
        <meshStandardMaterial color={TIRE_COLOR} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.34, 0.5]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <torusGeometry args={[0.34, 0.03, 8, 20]} />
        <meshStandardMaterial color={TIRE_COLOR} roughness={0.9} />
      </mesh>
      {/* Top tube (runs front↔back along Z). */}
      <mesh position={[0, 0.62, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.92, 8]} />
        <meshStandardMaterial color={FRAME_COLOR} metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Seat tube (up to the saddle). */}
      <mesh position={[0, 0.72, 0.34]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.5, 8]} />
        <meshStandardMaterial color={FRAME_COLOR} metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Head tube (up to the handlebars). */}
      <mesh position={[0, 0.72, -0.46]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.62, 8]} />
        <meshStandardMaterial color={FRAME_COLOR} metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Handlebars (along X). */}
      <mesh
        position={[0, 1.0, -0.46]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.02, 0.02, 0.48, 8]} />
        <meshStandardMaterial color={BAR_COLOR} roughness={0.7} />
      </mesh>
      {/* Saddle. */}
      <mesh position={[0, 0.98, 0.34]} castShadow>
        <boxGeometry args={[0.12, 0.06, 0.28]} />
        <meshStandardMaterial color={0x111111} roughness={0.85} />
      </mesh>
      {/* Fake ground shadow — a child, so it follows the bike and hides with it
          (parked / ridden-third show it; ridden-first hides). Real-time shadow
          map was retired; only movers get a blob. */}
      <GroundBlob size={2} opacity={0.45} />
    </group>
  );
}
