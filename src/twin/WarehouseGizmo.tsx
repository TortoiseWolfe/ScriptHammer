'use client';
// #259 iteration 4 — the "streamlined SketchUp" layer: a drei
// TransformControls attached to the selected sampled building's placed
// group. Move is constrained to the ground plane (XZ), Rotate to the yaw
// ring (Y); vertical/scale stay on the panel's precision buttons.
//
// The gizmo drags the group DIRECTLY for live feedback, then commits the
// resulting transform as a placement override on release — the exact same
// state the buttons and hotkeys write (one source of truth; Export
// unchanged). Committing dx/dz re-runs the grounding memo, so a building
// dragged across sloped terrain re-seats on its new footprint at drag end.
//
// Snaps match the panel's button grain (0.5 m / 1°), so gizmo output stays
// as clean in the exported JSON as hand-typed values.

import { TransformControls } from '@react-three/drei';
import type { Group } from 'three';
import type { TwinPlacementOverride } from '@/lib/manifest';

/** Wrap to (-180, 180] so exported yaw never accumulates full turns. */
export function normalizeDeg(deg: number): number {
  const d = ((((deg + 180) % 360) + 360) % 360) - 180;
  return d === -180 ? 180 : d;
}

export default function WarehouseGizmo({
  target,
  base,
  mode,
  onCommit,
  onDragging,
}: {
  /** The selected building's placed group (registered by WarehouseModels). */
  target: Group;
  /** The UN-overridden emitted anchor — dx/dz are deltas from this. */
  base: { x: number; z: number };
  mode: 'translate' | 'rotate';
  onCommit: (patch: TwinPlacementOverride) => void;
  /** Camera guard: the Rig ignores pointer input while the gizmo drags. */
  onDragging: (dragging: boolean) => void;
}) {
  return (
    <TransformControls
      object={target}
      mode={mode}
      showX={mode === 'translate'}
      showZ={mode === 'translate'}
      showY={mode === 'rotate'}
      translationSnap={0.5}
      rotationSnap={Math.PI / 180}
      size={0.7}
      onMouseDown={() => onDragging(true)}
      onMouseUp={() => {
        onDragging(false);
        if (mode === 'translate') {
          onCommit({
            dx: Math.round((target.position.x - base.x) * 10) / 10,
            dz: Math.round((target.position.z - base.z) * 10) / 10,
          });
        } else {
          const deg = (target.rotation.y * 180) / Math.PI;
          onCommit({ yawDeg: Math.round(normalizeDeg(deg) * 10) / 10 });
        }
      }}
    />
  );
}
