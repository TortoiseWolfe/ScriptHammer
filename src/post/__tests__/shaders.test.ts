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
  it('Grade is the sole color owner: single lin2srgb, NO ACES', () => {
    // Renderer stays linear; Grade does the one final sRGB encode. ACES was
    // removed — it expects linear HDR and hue-shifted the LDR scene to magenta
    // + hid the terrain drape (verified by screenshot).
    expect(GRADE_FRAG).not.toContain('aces');
    expect(GRADE_FRAG).toContain('lin2srgb'); // the single, final encode
    expect(GRADE_FRAG).toContain('saturation');
    expect(GRADE_FRAG).toContain('vignette');
  });
  it('exposes the tilt-shift focus/band/maxBlur uniforms', () => {
    const u = makeTiltShiftUniforms();
    expect(u.focus.value).toBeCloseTo(0.52, 2);
    expect(u.maxBlur.value).toBeCloseTo(3.2, 2);
    expect(makeGradeUniforms().saturation.value).toBeCloseTo(1.34, 2);
  });
});
