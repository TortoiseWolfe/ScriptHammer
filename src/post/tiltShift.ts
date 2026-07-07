import { EffectComposer, RenderPass, ShaderPass } from 'postprocessing';
import { ShaderMaterial, WebGLRenderer, Scene, Camera } from 'three';
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

function shaderPass(
  frag: string,
  uniforms: Record<string, { value: unknown }>
) {
  const material = new ShaderMaterial({
    vertexShader: TILT_SHIFT_VERT,
    fragmentShader: frag,
    uniforms,
  });
  // postprocessing's ShaderPass writes the previous buffer into uniforms.inputBuffer
  // (constructor signature verified against postprocessing@6.39.2:
  // `constructor(material: ShaderMaterial, input?: string = "inputBuffer")`).
  const pass = new ShaderPass(material, 'inputBuffer');
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

  const blurH = shaderPass(TILT_SHIFT_FRAG, makeTiltShiftUniforms());
  const blurV = shaderPass(TILT_SHIFT_FRAG, makeTiltShiftUniforms());
  (
    blurH.uniforms.direction.value as { set: (x: number, y: number) => void }
  ).set(1, 0);
  (
    blurV.uniforms.direction.value as { set: (x: number, y: number) => void }
  ).set(0, 1);
  const grade = shaderPass(GRADE_FRAG, makeGradeUniforms());

  composer.addPass(blurH.pass);
  composer.addPass(blurV.pass);
  composer.addPass(grade.pass); // terminal — sole sRGB encode

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
