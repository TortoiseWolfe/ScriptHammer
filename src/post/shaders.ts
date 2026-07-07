import { Vector2 } from 'three';

export const TILT_SHIFT_VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

// Directional 9-tap gaussian keyed to a horizontal focus band (Scheimpflug tilt).
// Ported verbatim from cm-shaders.js TiltShiftBlur; tDiffuse -> tDiffuse.
export const TILT_SHIFT_FRAG = `
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 texel;
uniform vec2 direction;
uniform float focus, band, gradient, tilt, maxBlur;
void main(){
  float focusY = focus + tilt * (vUv.x - 0.5);
  float d = abs(vUv.y - focusY);
  float amt = smoothstep(band, band + gradient, d);
  amt = amt * amt;
  float r = amt * maxBlur;
  vec2 dir = direction * texel * r;
  vec4 c = texture2D(tDiffuse, vUv) * 0.1964825501511404;
  c += texture2D(tDiffuse, vUv + dir * 1.0) * 0.2969069646728344 * 0.5;
  c += texture2D(tDiffuse, vUv - dir * 1.0) * 0.2969069646728344 * 0.5;
  c += texture2D(tDiffuse, vUv + dir * 2.0) * 0.09447039785044732;
  c += texture2D(tDiffuse, vUv - dir * 2.0) * 0.09447039785044732;
  c += texture2D(tDiffuse, vUv + dir * 3.0) * 0.010381362401148057;
  c += texture2D(tDiffuse, vUv - dir * 3.0) * 0.010381362401148057;
  c += texture2D(tDiffuse, vUv + dir * 4.0) * 0.002214997443481223;
  c += texture2D(tDiffuse, vUv - dir * 4.0) * 0.002214997443481223;
  gl_FragColor = c;
}`;

// Grade: ported from cm-shaders.js Grade. This pass is the SOLE color owner —
// the renderer stays linear (NoToneMapping + linear outputColorSpace) and the
// composer buffers are linear, so the Grade does its color grading on linear
// values then the single final lin2srgb encode. We do NOT apply ACES: the scene
// is LDR (standard materials, no HDR lighting), and an ACES filmic tonemap
// (which expects linear HDR) hue-shifts the LDR values toward magenta and
// crushes darks — verified by screenshot (it turned brick-red buildings magenta
// and hid the terrain drape).
export const GRADE_FRAG = `
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform float saturation, contrast, exposure, vignette, warmth, lift, grain, time;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
vec3 lin2srgb(vec3 c){ return mix(1.055*pow(max(c,0.0),vec3(1.0/2.4))-0.055, c*12.92, step(c,vec3(0.0031308))); }
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  c *= exposure;
  c = max(c + lift * (1.0 - c), 0.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, saturation);
  c = (c - 0.5) * contrast + 0.5;
  c += vec3(warmth, warmth * 0.1, -warmth) * 0.6;
  float dv = distance(vUv, vec2(0.5)) * 1.414;
  c *= 1.0 - vignette * smoothstep(0.55, 1.05, dv);
  c = clamp(c, 0.0, 1.0);
  c = lin2srgb(c);        // single, final sRGB encode (Grade is the sole owner)
  c += (hash(vUv * vec2(1920.0,1080.0) + time) - 0.5) * grain;
  gl_FragColor = vec4(c, 1.0);
}`;

export function makeTiltShiftUniforms() {
  return {
    tDiffuse: { value: null },
    texel: { value: new Vector2(1 / 1024, 1 / 1024) },
    direction: { value: new Vector2(1, 0) },
    focus: { value: 0.52 },
    band: { value: 0.1 },
    gradient: { value: 0.34 },
    tilt: { value: 0.06 },
    maxBlur: { value: 3.2 },
  };
}
export function makeGradeUniforms() {
  return {
    tDiffuse: { value: null },
    saturation: { value: 1.34 },
    contrast: { value: 1.07 },
    exposure: { value: 1.03 },
    vignette: { value: 0.34 },
    warmth: { value: 0.05 },
    lift: { value: 0.0 },
    grain: { value: 0.025 },
    time: { value: 0 },
  };
}
