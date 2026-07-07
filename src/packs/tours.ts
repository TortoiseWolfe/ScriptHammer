export interface Waypoint {
  pos: [number, number, number];
  look: [number, number, number];
  dwell: number;
  name: string;
  blurb: string;
}

// Positions are ENU metres, nudged toward the real hero coordinates in
// public/chatt/heroes.json (north = -Z; aquarium ~x=-274,z=-2424;
// walnut_st_bridge ~x=68,z=-2726).
//
// CAMERA HEIGHT: the terrain relief is ~55 m and buildings rise to ~50 m, so a
// tour camera at y=40 sits INSIDE the terrain/building geometry and renders the
// dark undersides — the "buried in a red-brown wall" bug. Each waypoint is an
// ELEVATED, pulled-back diorama shot: camera ~200–320 m up and set BACK from its
// look target (offset toward +Z/south and out in x) so it looks DOWN at each
// landmark like a flythrough of a toy model, never into the side of a hill.
export const RIVERFRONT_TOUR: Waypoint[] = [
  {
    pos: [-40, 240, -1980],
    look: [-220, 20, -2340],
    dwell: 5,
    name: "Ross's Landing",
    blurb: 'The 1815 riverfront landing where Chattanooga began.',
  },
  {
    pos: [-120, 230, -2120],
    look: [-273, 20, -2424],
    dwell: 5,
    name: 'Tennessee Aquarium',
    blurb: "Opened 1992 — the world's largest freshwater aquarium at the time.",
  },
  {
    pos: [-40, 240, -2360],
    look: [68, 18, -2726],
    dwell: 5,
    name: 'Walnut Street Bridge',
    blurb:
      '1890 truss bridge, 2,376 ft — one of the longest pedestrian bridges in the world.',
  },
  {
    pos: [20, 250, -2560],
    look: [80, 20, -2960],
    dwell: 5,
    name: 'Coolidge Park',
    blurb:
      'North Shore park with a 1894 Dentzel carousel and a climbable fountain.',
  },
  // --- turn south, down the Broad/Market spine toward the Choo Choo ---
  {
    pos: [-220, 300, -1120],
    look: [-382, 30, -1614],
    dwell: 5,
    name: 'Republic Centre',
    blurb:
      "At 300 ft / 21 floors, Chattanooga's tallest building — the downtown skyline's anchor.",
  },
  {
    pos: [120, 300, 120],
    look: [40, 20, -600],
    dwell: 4.5,
    name: 'Downtown Core',
    blurb:
      'The Broad & Market Street grid — the dense heart of downtown, laid out in 1839.',
  },
  {
    pos: [40, 320, 2900],
    look: [-55, 20, 2720],
    dwell: 6,
    name: 'Chattanooga Choo Choo',
    blurb:
      'Historic Terminal Station (1909), immortalized by the 1941 Glenn Miller hit. Now a hotel + gardens on the Southside.',
  },
];
