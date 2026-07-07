// The locked box (WGS-84). Redlines are cheap now, expensive after the first bake.
export const BOX = {
  swLat: 35.034,
  swLon: -85.316,
  neLat: 35.06,
  neLon: -85.3,
  get centerLat() {
    return (this.swLat + this.neLat) / 2;
  },
  get centerLon() {
    return (this.swLon + this.neLon) / 2;
  },
  // One-line tight-core fallback: set the effective south edge here to shrink the box.
  tightCoreSouthLat: 35.042,
} as const;
