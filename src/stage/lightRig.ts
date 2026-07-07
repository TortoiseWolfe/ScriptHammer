function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function smooth(a: number, b: number, x: number) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
function mixHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255,
    ag = (a >> 8) & 255,
    ab = a & 255,
    br = (b >> 16) & 255,
    bg = (b >> 8) & 255,
    bb = b & 255;
  return (
    (((ar + (br - ar) * t) | 0) << 16) |
    (((ag + (bg - ag) * t) | 0) << 8) |
    ((ab + (bb - ab) * t) | 0)
  );
}

export interface DayState {
  sunPos: [number, number, number];
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  ambient: number;
  skyColor: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  /** Reported for reference only — renderer uses NoToneMapping; ACES lives in Grade (Task 11). */
  exposure: number;
  /** Base grade uniforms; a palette profile scales these further (Task 19). */
  gradeBase: {
    saturation: number;
    contrast: number;
    vignette: number;
    lift: number;
  };
  bloom: { threshold: number; strength: number };
}

export function computeDay(t: number): DayState {
  const dayT = clamp(t, 0, 1);
  const elev = Math.sin(dayT * Math.PI);
  const day = clamp(elev, 0, 1);
  const az = (dayT - 0.5) * Math.PI * 1.1;
  const R = 420;
  const warm = 1 - smooth(0.15, 0.85, elev);
  return {
    sunPos: [
      Math.sin(az) * R,
      Math.max(12, elev * R),
      Math.cos(az) * R * 0.4 + 120,
    ],
    sunColor: mixHex(0xfff2df, 0xffa74e, warm),
    sunIntensity: day * 1.05,
    hemiSky: mixHex(0x24304e, 0xbfd4ff, day),
    hemiGround: mixHex(0x1a1712, 0x6b5a44, day),
    hemiIntensity: lerp(0.12, 0.3, day),
    ambient: lerp(0.04, 0.1, day),
    skyColor: mixHex(0x0a1020, 0x8fb2da, day),
    fogColor: mixHex(0x0c1424, 0x93a7bd, day),
    fogNear: 360,
    fogFar: lerp(1000, 1600, day),
    exposure: lerp(0.78, 0.94, day),
    gradeBase: {
      saturation: lerp(1.2, 1.44, day),
      contrast: 1.12,
      vignette: lerp(0.54, 0.34, day),
      lift: lerp(-0.02, 0.0, day),
    },
    bloom: { threshold: lerp(0.18, 0.72, day), strength: lerp(1.15, 0.5, day) },
  };
}
