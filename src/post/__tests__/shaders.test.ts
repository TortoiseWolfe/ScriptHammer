import { describe, it, expect } from 'vitest';
import {
  TILT_SHIFT_FRAG,
  GRADE_FRAG,
  makeTiltShiftUniforms,
  makeGradeUniforms,
} from '../shaders';

describe('ported shaders', () => {
  it("uses tDiffuse (three's ShaderPass convention), not inputBuffer", () => {
    // three's ShaderPass builds a FullScreenQuad whose ortho camera makes the
    // ported `projectionMatrix*modelViewMatrix*position` vertex shader correct,
    // and writes the read-buffer into the `tDiffuse` uniform. The pmndrs
    // `postprocessing` lib expected `inputBuffer` + a different vertex stage,
    // which rendered a degenerate fullscreen quad → black. We use three's composer.
    expect(TILT_SHIFT_FRAG).toContain('tDiffuse');
    expect(TILT_SHIFT_FRAG).not.toContain('inputBuffer');
    expect(GRADE_FRAG).toContain('tDiffuse');
    expect(GRADE_FRAG).not.toContain('inputBuffer');
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
