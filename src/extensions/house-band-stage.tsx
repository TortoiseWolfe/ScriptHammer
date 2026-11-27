/**
 * The seam where the house band's 3D stage plugs in.
 *
 * Kept apart from house-band.tsx on purpose. The real stage pulls in three.js, and
 * house-band.tsx is read by pages that have no 3D at all (the navigation, the credits page).
 * One file for both would put three.js into the first load of every route, and the build's
 * first-load budget check (#291, #638) would refuse the deploy. Only the twin canvas, a 3D
 * route, imports this file.
 *
 * Like house-band.tsx, this is the empty stand-in: every export does nothing. scripthammer.com's
 * deploy copies a file of the same name from the private repository over this one. A repository
 * made from the template keeps this version and builds with no band stage.
 *
 * Props are deliberately loose here. The real components declare their own, and the call sites
 * pass them either way.
 */

type LooseProps = Record<string, unknown>;

/** Whether this twin has a band stage. */
export function hasStage(_slug: string): boolean {
  return false;
}

export function BandStage(_props: LooseProps): null {
  return null;
}

export function BandStageControls(_props: LooseProps): null {
  return null;
}
