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
];
