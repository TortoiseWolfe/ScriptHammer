import { describe, it, expect } from 'vitest';
import {
  TILT_SHIFT_FRAG,
  GRADE_FRAG,
  makeTiltShiftUniforms,
  makeGradeUniforms,
} from '../shaders';

describe('ported shaders', () => {
  it('uses inputBuffer (postprocessing convention), not tDiffuse', () => {
    expect(TILT_SHIFT_FRAG).toContain('inputBuffer');
    expect(TILT_SHIFT_FRAG).not.toContain('tDiffuse');
    expect(GRADE_FRAG).not.toContain('tDiffuse');
  });
  it('Grade folds ACES in before the single sRGB encode', () => {
    const acesIdx = GRADE_FRAG.indexOf('aces');
    const srgbIdx = GRADE_FRAG.indexOf('lin2srgb');
    expect(acesIdx).toBeGreaterThanOrEqual(0);
    expect(srgbIdx).toBeGreaterThan(acesIdx); // sRGB is the LAST step
  });
  it('exposes the tilt-shift focus/band/maxBlur uniforms', () => {
    const u = makeTiltShiftUniforms();
    expect(u.focus.value).toBeCloseTo(0.52, 2);
    expect(u.maxBlur.value).toBeCloseTo(3.2, 2);
    expect(makeGradeUniforms().saturation.value).toBeCloseTo(1.34, 2);
  });
});
