'use client';

import React from 'react';
import { Color as ThreeColor, Shape } from 'three';

export interface ScriptTagsProps {
  /** Color of the bracket material. Defaults to a golden tone if unset. */
  color?: ThreeColor | string;
  /** Horizontal separation between the < and > brackets. Default 1.4. */
  separation?: number;
  /** Vertical half-extent of each bracket (top/bottom reach). Default 0.7. */
  height?: number;
}

/**
 * ScriptTags component (R3F sub-tree)
 *
 * Feature 047 — Three.js Game (T040)
 *
 * Procedural < > code brackets mirroring `public/script-tags.svg`. Each
 * bracket is an extruded 2D shape (chevron stroke). Centered around the
 * origin; horizontal separation controls how wide the brackets sit.
 *
 * Material is metallic gold with a slight emissive glow per spec FR-007.
 * Three.js renders the metallic highlight via `metalness` + lighting, not a
 * stroke gradient — verbal-equivalent to the SVG source at scene scale (per
 * the /speckit.analyze remediation that fixed the gradient/metallic wording).
 *
 * Must be rendered inside a `<Canvas>` (R3F context required).
 *
 * @category game
 */
export default function ScriptTags({
  color = '#cd853f',
  separation = 1.4,
  height = 0.7,
}: ScriptTagsProps = {}) {
  // Build a single chevron `<` as an extruded shape, centered at origin.
  // The shape traces the outline of a stroked V-rotated-90 path.
  const bracketShape = React.useMemo(() => {
    const s = new Shape();
    const w = 0.45; // half-width of the bracket
    const t = 0.12; // stroke thickness
    // Outline traced clockwise: top-right, tip, bottom-right, bottom-inner,
    // tip-inner, top-inner, back to start.
    s.moveTo(w, height);
    s.lineTo(-w, 0);
    s.lineTo(w, -height);
    s.lineTo(w, -height + t * 1.5);
    s.lineTo(-w + t * 1.5, 0);
    s.lineTo(w, height - t * 1.5);
    s.lineTo(w, height);
    return s;
  }, [height]);

  return (
    <group>
      {/* Left bracket < (extruded shape pointing left) */}
      <mesh position={[-separation / 2, 0, 0]}>
        <extrudeGeometry
          args={[bracketShape, { depth: 0.12, bevelEnabled: false }]}
        />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.2}
          metalness={0.7}
          roughness={0.4}
        />
      </mesh>

      {/* Right bracket > (same geometry, flipped horizontally) */}
      <mesh position={[separation / 2, 0, 0]} rotation={[0, Math.PI, 0]}>
        <extrudeGeometry
          args={[bracketShape, { depth: 0.12, bevelEnabled: false }]}
        />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.2}
          metalness={0.7}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}
