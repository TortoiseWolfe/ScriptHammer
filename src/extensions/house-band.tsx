/**
 * The seam where the house band plugs in.
 *
 * The band's music, art and pages are all rights reserved and live in a private repository, so
 * this public template carries none of them. This file is the empty stand-in: every export does
 * nothing. scripthammer.com's deploy copies a file of the same name from the private repository
 * over this one, which switches the band on. A repository made from the template keeps this
 * version, so it builds and runs with no band at all.
 *
 * Props are deliberately loose here. The real components declare their own, and the call sites
 * pass them either way.
 */

type LooseProps = Record<string, unknown>;

/** True only in a build that has the band files copied over. */
export const HOUSE_BAND_PRESENT = false;

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

/** The credits page section about the band's music and art. */
export function HouseBandCredits(): null {
  return null;
}
