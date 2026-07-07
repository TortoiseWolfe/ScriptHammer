// The locked box (WGS-84). Redlines are cheap now, expensive after the first bake.
// v2 (session 2026-07-06): south edge extended 35.034 -> 35.0078 to include the
// Chattanooga Choo Choo / Terminal Station (~35.0093). This makes the box a
// downtown->Southside corridor: 1.46 km (E-W) x 5.77 km (N-S), aspect ~0.25.
// The miniature camera framing favors the downtown (north) end.
export const BOX = {
  swLat: 35.0078,
  swLon: -85.316,
  neLat: 35.06,
  neLon: -85.3,
  get centerLat() {
    return (this.swLat + this.neLat) / 2;
  },
  get centerLon() {
    return (this.swLon + this.neLon) / 2;
  },
  // One-line tight-core fallback: set the effective south edge here to shrink
  // the box back to the compact downtown core (pre-Choo-Choo extent).
  tightCoreSouthLat: 35.034,
} as const;
