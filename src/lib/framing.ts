// Camera/scene framing derived from the baked model's true extents (#232).
// The old composition root hard-coded these numbers for the 5772 m Chattanooga
// corridor; every formula below is calibrated to reproduce those hand-tuned
// values within ~4% at chatt's dimensions, so any city gets a sane frame and
// the flagship keeps its approved look. `site.framing` overrides win
// field-by-field for editorial control.

import type { Manifest } from './manifest';

export interface Framing {
  minR: number;
  maxR: number;
  moveSpeed: number;
  panMinX: number;
  panMaxX: number;
  panMinZ: number;
  panMaxZ: number;
  fogNear: number;
  fogFar: number;
  cameraNear: number;
  cameraFar: number;
  homeFocus: [number, number, number];
  homeRadius: number;
  homePhi: number; // style defaults (0.62 / 0); per-site overridable
  homeTheta: number;
  initialCameraPos: [number, number, number];
  topdown: { center: [number, number]; height: number };
}

// ~35° from vertical: the tilted-overhead diorama angle.
const HOME_PHI = 0.62;
const HOME_THETA = 0;
// StageCore's ?topdown diagnostic renders at fov 62.
const TOPDOWN_FOV_DEG = 62;

export function deriveFraming(m: Manifest): Framing {
  const W = m.groundWm;
  const H = m.groundHm;
  const L = Math.max(W, H);
  const f = m.site.framing ?? {};

  const homeFocus: [number, number, number] = f.homeFocus ?? [0, 0, 0];
  const homeRadius = f.homeRadius ?? 0.45 * L;
  const homePhi = f.homePhi ?? HOME_PHI;
  const homeTheta = f.homeTheta ?? HOME_THETA;
  const panMargin = f.panMargin ?? Math.max(150, 0.05 * L);

  const homeOrbitPos: [number, number, number] = [
    homeFocus[0] + homeRadius * Math.sin(homePhi) * Math.sin(homeTheta),
    homeFocus[1] + homeRadius * Math.cos(homePhi),
    homeFocus[2] + homeRadius * Math.sin(homePhi) * Math.cos(homeTheta),
  ];
  const tour = m.site.tour;
  // With a tour, frame 0 IS the first shot (the rig aims pre-paint via
  // setWaypoints); otherwise start at the home orbit position.
  const initialCameraPos = tour && tour.length > 0 ? tour[0].pos : homeOrbitPos;

  return {
    minR: f.minR ?? Math.max(50, L / 30),
    maxR: f.maxR ?? 0.85 * L,
    moveSpeed: f.moveSpeed ?? 0.155 * L,
    panMinX: -(W / 2 + panMargin),
    panMaxX: W / 2 + panMargin,
    panMinZ: -(H / 2 + panMargin),
    panMaxZ: H / 2 + panMargin,
    fogNear: f.fogNear ?? 0.26 * L,
    fogFar: f.fogFar ?? 1.55 * L,
    cameraNear: 1,
    cameraFar: f.cameraFar ?? Math.max(2000, 1.4 * L),
    homeFocus,
    homeRadius,
    homePhi,
    homeTheta,
    initialCameraPos,
    topdown: {
      center: [homeFocus[0], 0],
      // Fit the long extent in the topdown diagnostic's vertical fov, +5%.
      height:
        (1.05 * (L / 2)) / Math.tan(((TOPDOWN_FOV_DEG / 2) * Math.PI) / 180),
    },
  };
}
