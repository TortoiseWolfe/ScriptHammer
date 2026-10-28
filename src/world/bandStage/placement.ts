/**
 * Where the band stage stands in a twin (#1413). Pure, so it is tested without a canvas.
 *
 * The stage is data: `public/twins/<slug>/stage.json` holds a lat/lon and a compass
 * facing, read off the twin's own aerial drape. This module checks that file and turns it
 * into scene coordinates with the SAME projection the walk spawn and the location readout
 * use (`createProjection(atlasBox ?? box, vectorOffsetM)`), so the stage, `?at=` and the
 * "where am I" readout can never disagree.
 */

import { createProjection, type GeoBox } from '@/lib/enu';

/** Twins that have a stage. Only these request `stage.json`, so every other twin makes
 *  no request that would 404. */
export const STAGE_SLUGS: readonly string[] = ['chatt'];

export function hasStage(slug: string): boolean {
  return STAGE_SLUGS.includes(slug);
}

export interface StageSpot {
  name: string;
  lat: number;
  lon: number;
  /** Compass bearing the stage's FRONT faces: 0 north, 90 east, 180 south. */
  facingDeg: number;
  /** Where a visitor stands to watch. */
  audience: { lat: number; lon: number };
  /** Where the spot was read from. */
  source: string;
}

function isLat(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90;
}
function isLon(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180;
}

/**
 * Check a parsed `stage.json`. Throws with the field that is wrong, because a stage
 * placed from a bad number would sit somewhere in the river with no error at all.
 */
export function parseStageSpot(raw: unknown): StageSpot {
  if (!raw || typeof raw !== 'object') {
    throw new Error('stage.json is not an object');
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== 'string' || !r.name.trim()) {
    throw new Error('stage.json needs a name');
  }
  if (!isLat(r.lat))
    throw new Error('stage.json lat is missing or out of range');
  if (!isLon(r.lon))
    throw new Error('stage.json lon is missing or out of range');
  if (typeof r.facingDeg !== 'number' || !Number.isFinite(r.facingDeg)) {
    throw new Error('stage.json facingDeg must be a number');
  }
  const a = r.audience as Record<string, unknown> | undefined;
  if (!a || !isLat(a.lat) || !isLon(a.lon)) {
    throw new Error('stage.json audience needs lat and lon');
  }
  if (typeof r.source !== 'string' || !r.source.trim()) {
    throw new Error('stage.json needs a source (where the spot was read from)');
  }
  return {
    name: r.name,
    lat: r.lat,
    lon: r.lon,
    facingDeg: ((r.facingDeg % 360) + 360) % 360,
    audience: { lat: a.lat, lon: a.lon },
    source: r.source,
  };
}

export interface StagePlacement {
  /** Scene metres: east = +X, north = -Z. */
  x: number;
  z: number;
  /**
   * Rotation about Y for a deck modelled with its front toward +Z (south). Rotating by
   * `t` turns +Z into (sin t, 0, cos t); a compass bearing b points along
   * (sin b, 0, -cos b); so t = PI - b.
   */
  rotationY: number;
  audience: { x: number; z: number };
}

export interface ProjectionInput {
  box: GeoBox;
  atlasBox?: GeoBox;
  vectorOffsetM?: { x: number; z: number };
}

export function placeStage(
  spot: StageSpot,
  manifest: ProjectionInput
): StagePlacement {
  const proj = createProjection(
    manifest.atlasBox ?? manifest.box,
    manifest.vectorOffsetM
  );
  const [x, z] = proj.lonLatToEnu(spot.lon, spot.lat);
  const [ax, az] = proj.lonLatToEnu(spot.audience.lon, spot.audience.lat);
  return {
    x,
    z,
    rotationY: Math.PI - (spot.facingDeg * Math.PI) / 180,
    audience: { x: ax, z: az },
  };
}

/** Within this many metres of the stage the band's sound loads and the controls show. */
export const NEAR_STAGE_M = 150;

export function isNearStage(
  placement: Pick<StagePlacement, 'x' | 'z'>,
  x: number,
  z: number
): boolean {
  return Math.hypot(x - placement.x, z - placement.z) <= NEAR_STAGE_M;
}

/**
 * Yaw for the VR viewer's origin at the audience spot, so a visitor who enters VR faces
 * the stage. The viewer looks down -Z; rotating by `t` turns -Z into (-sin t, 0, -cos t),
 * and a compass bearing b points along (sin b, 0, -cos b), so facing bearing b needs
 * t = -b. The audience looks back at the stage, opposite the way the stage faces.
 */
export function audienceYaw(facingDeg: number): number {
  const bearing = (((facingDeg + 180) % 360) + 360) % 360;
  return -(bearing * Math.PI) / 180;
}
