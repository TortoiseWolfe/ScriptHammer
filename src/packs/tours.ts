export interface Waypoint {
  pos: [number, number, number];
  look: [number, number, number];
  dwell: number;
  name: string;
  blurb: string;
}

// Positions are ENU metres, nudged toward the real hero coordinates in
// public/chatt/heroes.json (north = -Z; aquarium ~x=-274,z=-2424;
// walnut_st_bridge ~x=68,z=-2726). Refine with manifest-derived coords in Task 20.
export const RIVERFRONT_TOUR: Waypoint[] = [
  {
    pos: [-180, 40, -2180],
    look: [-220, 4, -2320],
    dwell: 5,
    name: "Ross's Landing",
    blurb: 'The 1815 riverfront landing where Chattanooga began.',
  },
  {
    pos: [-220, 46, -2320],
    look: [-273, 14, -2424],
    dwell: 5,
    name: 'Tennessee Aquarium',
    blurb: "Opened 1992 — the world's largest freshwater aquarium at the time.",
  },
  {
    pos: [10, 40, -2600],
    look: [68, 8, -2726],
    dwell: 5,
    name: 'Walnut Street Bridge',
    blurb:
      '1890 truss bridge, 2,376 ft — one of the longest pedestrian bridges in the world.',
  },
  {
    pos: [60, 52, -2860],
    look: [80, 12, -2960],
    dwell: 5,
    name: 'Coolidge Park',
    blurb:
      'North Shore park with a 1894 Dentzel carousel and a climbable fountain.',
  },
  // --- turn south, down the Broad/Market spine toward the Choo Choo ---
  {
    pos: [-320, 120, -1500],
    look: [-382, 20, -1614],
    dwell: 5,
    name: 'Republic Centre',
    blurb:
      "At 300 ft / 21 floors, Chattanooga's tallest building — the downtown skyline's anchor.",
  },
  {
    pos: [80, 90, -200],
    look: [40, 6, -600],
    dwell: 4.5,
    name: 'Downtown Core',
    blurb:
      'The Broad & Market Street grid — the dense heart of downtown, laid out in 1839.',
  },
  {
    pos: [-40, 80, 2200],
    look: [-55, 6, 2720],
    dwell: 6,
    name: 'Chattanooga Choo Choo',
    blurb:
      'Historic Terminal Station (1909), immortalized by the 1941 Glenn Miller hit. Now a hotel + gardens on the Southside.',
  },
];
