export interface PaletteProfile {
  label: string;
  gradeSat: number;
  gradeContrast: number;
  gradeVignette: number;
  fov: number;
  maxBlur: number;
  bricks: number[];
}

export const PALETTES: Record<'trueToLife' | 'toy', PaletteProfile> = {
  trueToLife: {
    label: 'True to life',
    gradeSat: 1.0,
    gradeContrast: 1.0,
    gradeVignette: 0.9,
    fov: 42,
    maxBlur: 2.2,
    bricks: [0xb0a89c, 0x9a9188, 0xc2b6a4, 0x8f8a86, 0xa89e90],
  },
  toy: {
    label: 'Toy',
    gradeSat: 1.15,
    gradeContrast: 1.05,
    gradeVignette: 1.0,
    fov: 34,
    maxBlur: 3.2,
    bricks: [
      0xc98b5a, 0xb5623f, 0xcab196, 0x8f8a86, 0xd8c2a0, 0xa66b52, 0x9aa0a6,
      0xbf9b6b,
    ],
  },
};

// Single owner: day/night base * profile => the grade uniforms actually applied.
export function applyProfile(
  base: { saturation: number; contrast: number; vignette: number },
  p: PaletteProfile
): Record<string, number> {
  return {
    saturation: base.saturation * p.gradeSat,
    contrast: base.contrast * p.gradeContrast,
    vignette: base.vignette * p.gradeVignette,
  };
}
