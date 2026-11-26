/**
 * The seam where the house band plugs in.
 *
 * The band's music, art and pages are all rights reserved and live in a private repository, so
 * this public template carries none of them. This file is the empty stand-in: every export does
 * nothing. scripthammer.com's deploy copies a file of the same name from the private repository
 * over this one, which switches the band on. A repository made from the template keeps this
 * version, so it builds and runs with no band at all.
 *
 * Nothing 3D belongs in this file: pages with no 3D read it. The stage lives in
 * house-band-stage.tsx, which only the twin canvas imports.
 */

/** True only in a build that has the band files copied over. */
export const HOUSE_BAND_PRESENT = false;

/** The credits page section about the band's music and art. */
export function HouseBandCredits(): null {
  return null;
}
