/**
 * The /band page's link to the band stage at Ross's Landing in /chatt (feature 053).
 *
 * The spot matches the audience point in public/twins/chatt/stage.json (the test reads
 * that file, so the two cannot drift). `face=0` arrives looking north, at the stage's
 * front, which faces south toward the city. This module stays free of three.js so the
 * kid-safe /band page never pulls the 3D bundle.
 */
export const STAGE_AUDIENCE = { lat: 35.05666, lon: -85.31144 } as const;

export const STAGE_FACE_DEG = 0;

export const STAGE_LINK_LABEL = 'See them live in Chattanooga';

/** Internal path (no base path; next/link adds it). */
export const STAGE_HREF = `/chatt/?diorama&walk&at=${STAGE_AUDIENCE.lat},${STAGE_AUDIENCE.lon}&face=${STAGE_FACE_DEG}`;
