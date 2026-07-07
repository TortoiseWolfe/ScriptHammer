import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { WebGLRenderer, Scene, Camera } from 'three';
import {
  TILT_SHIFT_VERT,
  TILT_SHIFT_FRAG,
  GRADE_FRAG,
  makeTiltShiftUniforms,
  makeGradeUniforms,
} from './shaders';

export function texelFor(w: number, h: number) {
  return { x: 1 / w, y: 1 / h };
}
export function lensClamp(focus: number, blur: number) {
  return {
    focus: Math.min(0.8, Math.max(0.2, focus)),
    blur: Math.min(6, Math.max(0, blur)),
  };
}

// three's ShaderPass takes a plain shader object {uniforms, vertexShader,
// fragmentShader} and builds a FullScreenQuad internally. Its ortho-camera
// fullscreen quad makes the ported `projectionMatrix*modelViewMatrix*position`
// vertex shader correct, and it writes the previous render target into the
// `tDiffuse` uniform each frame. (The pmndrs `postprocessing` lib used a
// different vertex convention + `inputBuffer` uniform, which rendered a
// degenerate fullscreen quad → black. three's composer is the right fit for
// these verbatim-ported cm-shaders.)
function makePass(frag: string, uniforms: Record<string, { value: unknown }>) {
  const pass = new ShaderPass({
    uniforms,
    vertexShader: TILT_SHIFT_VERT,
    fragmentShader: frag,
  });
  return { pass, uniforms };
}

export function buildComposer(
  gl: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  size: { width: number; height: number }
) {
  const composer = new EffectComposer(gl);
  composer.addPass(new RenderPass(scene, camera));

  const blurH = makePass(TILT_SHIFT_FRAG, makeTiltShiftUniforms());
  const blurV = makePass(TILT_SHIFT_FRAG, makeTiltShiftUniforms());
  (
    blurH.uniforms.direction.value as { set: (x: number, y: number) => void }
  ).set(1, 0);
  (
    blurV.uniforms.direction.value as { set: (x: number, y: number) => void }
  ).set(0, 1);
  const grade = makePass(GRADE_FRAG, makeGradeUniforms());

  composer.addPass(blurH.pass);
  composer.addPass(blurV.pass);
  composer.addPass(grade.pass); // terminal — EffectComposer auto-renders it to screen

  function setSize(w: number, h: number) {
    composer.setSize(w, h);
    const t = texelFor(w, h);
    for (const b of [blurH, blurV])
      (b.uniforms.texel.value as { set: (x: number, y: number) => void }).set(
        t.x,
        t.y
      );
  }
  setSize(size.width, size.height);

  return {
    composer,
    setLens(focus: number, blur: number) {
      const c = lensClamp(focus, blur);
      for (const b of [blurH, blurV]) {
        (b.uniforms.focus as { value: number }).value = c.focus;
        (b.uniforms.maxBlur as { value: number }).value = c.blur;
      }
    },
    setGrade(partial: Record<string, number>) {
      for (const [k, v] of Object.entries(partial)) {
        const u = grade.uniforms[k] as { value: number } | undefined;
        if (u) u.value = v;
      }
    },
    setTime(t: number) {
      (grade.uniforms.time as { value: number }).value = t;
    },
    setSize,
    dispose() {
      composer.dispose();
    },
  };
}
