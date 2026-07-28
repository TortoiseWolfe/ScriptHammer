/**
 * The 2a "Machine Shop" icon set (#377).
 *
 * Icons are DATA, not components. One `<Icon>` renders all of them, so adding
 * the twentieth costs one line here rather than a five-file component
 * directory, and no icon can drift into its own markup conventions.
 *
 * Hand-drawn rather than pulled from a library, deliberately. The set is small
 * and the design has a specific character; a dependency would also put a React
 * component per icon into the bundle, and this repo has a first-load budget
 * gate (#291) that exists because of exactly that kind of weight.
 *
 * ── THE GRID. Match this when adding one. ────────────────────────────────────
 *
 *   viewBox    0 0 24 24
 *   stroke     2 units, `currentColor`, never a fixed colour
 *   fill       none — these are line icons; a filled shape reads as a blob
 *              next to the rest of the set
 *   caps       round joins and caps (set once on the <svg>, not per path)
 *   geometry   whole or half units only. Off-grid coordinates are what make a
 *              hand-drawn set look uneven once it sits next to real text.
 *
 *   COMMANDS   absolute only — M L H V A Z. No lowercase.
 *
 * That last rule is not style. With absolute commands every number in the
 * string is a coordinate, a radius or an arc flag, all of which belong in the
 * 0–24 space — so `Icon.test.tsx` can check the grid by reading the numbers.
 * Relative commands mix in deltas like `-8`, which makes the same check
 * meaningless. The first draft of this set used them and the bounds test
 * reported fourteen false failures.
 *
 * Anything that cannot be said in 2-unit strokes on a 24-unit grid does not
 * belong here — that is a logo or an illustration, not an icon.
 */

/** Every icon in the set. Adding a key here makes it usable immediately. */
export const ICON_PATHS = {
  // ── Navigation ──────────────────────────────────────────────────────────
  menu: 'M3 6 H21 M3 12 H21 M3 18 H21',
  close: 'M6 6 L18 18 M18 6 L6 18',
  'chevron-down': 'M5 9 L12 16 L19 9',
  'chevron-right': 'M9 5 L16 12 L9 19',
  home: 'M3 11 L12 3 L21 11 M6 9 V20 H18 V9',
  docs: 'M7 3 H14 L19 8 V21 H7 Z M14 3 V8 H19 M10 13 H16 M10 17 H16',
  blog: 'M4 4 H20 V20 H4 Z M8 9 H16 M8 13 H16 M8 17 H12',

  // ── Account ─────────────────────────────────────────────────────────────
  user: 'M8 8 A4 4 0 1 1 16 8 A4 4 0 1 1 8 8 M4 20 A8 8 0 0 1 20 20',
  'sign-in': 'M14 4 H19 V20 H14 M3 12 H14 M10 8 L14 12 L10 16',
  // Sliders, not a gear. A stroked gear at this size collapses into a
  // starburst that is indistinguishable from `sun` — which is exactly what the
  // first draft did, and no test caught it because the path data differed.
  settings: 'M4 7 H20 M4 12 H20 M4 17 H20 M9 5 V9 M15 10 V14 M7 15 V19',
  messages: 'M4 5 H20 V16 H8 L4 20 Z',
  admin: 'M12 3 L20 7 V12 A8 10 0 0 1 12 21 A8 10 0 0 1 4 12 V7 Z',

  // ── Appearance controls ─────────────────────────────────────────────────
  // Contrast circle: full circle plus its vertical diameter. The first draft
  // chained arcs of two different radii and rendered as a spiral.
  theme: 'M3 12 A9 9 0 1 1 21 12 A9 9 0 1 1 3 12 M12 3 V21',
  sun: 'M8 12 A4 4 0 1 1 16 12 A4 4 0 1 1 8 12 M12 2 V4 M12 20 V22 M2 12 H4 M20 12 H22 M5 5 L6.5 6.5 M17.5 17.5 L19 19 M5 19 L6.5 17.5 M17.5 6.5 L19 5',
  moon: 'M20 14 A8 8 0 1 1 10 4 A7 7 0 0 0 20 14 Z',
  type: 'M4 6 V4 H20 V6 M12 4 V20 M9 20 H15',
  accessibility:
    'M12 2 A1.5 1.5 0 1 1 12 5 A1.5 1.5 0 1 1 12 2 M4 8 H20 M12 8 V14 M12 14 L9 21 M12 14 L15 21',

  // ── Concepts ────────────────────────────────────────────────────────────
  // Added for the home page (#379), drawn to the grid rules above.
  rocket:
    'M12 2 A7 7 0 0 1 15.5 8 V15 H8.5 V8 A7 7 0 0 1 12 2 Z M8.5 11 L5.5 14 V18 H8.5 M15.5 11 L18.5 14 V18 H15.5 M10.5 8 A1.5 1.5 0 1 1 13.5 8 A1.5 1.5 0 1 1 10.5 8 M10 15 L12 19 L14 15',
  layout: 'M3 5 H21 V19 H3 Z M9 5 V19 M9 11 H21',

  // ── Chrome (#385) ───────────────────────────────────────────────────────
  // Replacing emoji on the surfaces outside the page children. Emoji cannot
  // take `currentColor` and render differently on every OS, which is the
  // actual problem a monochrome set fixes.
  cookie:
    'M12 3 A9 9 0 1 0 21 12 A3 3 0 0 1 18 9 A3 3 0 0 1 15 6 A3 3 0 0 1 12 3 Z M9 10 H9.5 M14 9 H14.5 M11 15 H11.5 M16 14 H16.5',
  copy: 'M9 3 H19 V17 H9 Z M5 7 V21 H15 V17',
  pin: 'M12 21 A18 18 0 0 1 5 9 A7 7 0 0 1 19 9 A18 18 0 0 1 12 21 Z M9.5 9 A2.5 2.5 0 1 1 14.5 9 A2.5 2.5 0 1 1 9.5 9',
  ban: 'M4 12 A8 8 0 1 1 20 12 A8 8 0 1 1 4 12 M6.5 6.5 L17.5 17.5',
  tip: 'M12 3 A6 6 0 0 1 15 14 V16 H9 V14 A6 6 0 0 1 12 3 Z M9 19 H15 M10 21.5 H14',
  eye: 'M2 12 A12 12 0 0 1 22 12 A12 12 0 0 1 2 12 M9 12 A3 3 0 1 1 15 12 A3 3 0 1 1 9 12',
  'eye-off':
    'M4 4 L20 20 M9.5 9.5 A3 3 0 0 0 14 14 M6 6.5 A12 12 0 0 0 2 12 A12 12 0 0 0 17 18.5 M9.5 4.5 A12 12 0 0 1 22 12 A12 12 0 0 1 19.5 15.5',

  // ── Status and actions ──────────────────────────────────────────────────
  check: 'M4 12 L9 17 L20 6',
  alert: 'M12 3 L21 20 H3 Z M12 10 V14 M12 17 V17.5',
  install: 'M12 3 V14 M8 11 L12 15 L16 11 M4 19 H20',
  'external-link': 'M14 4 H20 V10 M20 4 L11 13 M18 14 V20 H4 V6 H10',
} as const;

export type IconName = keyof typeof ICON_PATHS;

/** Sorted for stable Storybook output and predictable review diffs. */
export const ICON_NAMES = Object.keys(ICON_PATHS).sort() as IconName[];
