import {
  DataTexture,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from 'three';

/**
 * A tileable grayscale "tooth" texture (seamless fractal value-noise). Multiplied
 * over the aerial drape at close range it gives the blurry ~1.5 m/texel imagery
 * high-frequency surface detail underfoot, without recolouring it (grayscale,
 * centered ~0.5 so a ×2 multiply averages to 1). Built once, module-cached.
 */
let _detailTex: DataTexture | null = null;
export function groundDetailTexture(): DataTexture {
  if (_detailTex) return _detailTex;
  const S = 256;
  const data = new Uint8Array(S * S * 4);
  const hash = (x: number, y: number) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let v = 0;
      let amp = 0.5;
      // 4 seamless octaves — each octave's grid period divides S so it tiles.
      for (let o = 0; o < 4; o++) {
        const G = 4 * (1 << o);
        const fx = (x / S) * G,
          fy = (y / S) * G;
        const ix = Math.floor(fx),
          iy = Math.floor(fy);
        const tx = fx - ix,
          ty = fy - iy;
        const sx = tx * tx * (3 - 2 * tx),
          sy = ty * ty * (3 - 2 * ty);
        const h = (cx: number, cy: number) =>
          hash(((cx % G) + G) % G, ((cy % G) + G) % G);
        const v00 = h(ix, iy),
          v10 = h(ix + 1, iy),
          v01 = h(ix, iy + 1),
          v11 = h(ix + 1, iy + 1);
        const vx0 = v00 + (v10 - v00) * sx;
        const vx1 = v01 + (v11 - v01) * sx;
        v += amp * (vx0 + (vx1 - vx0) * sy);
        amp *= 0.5;
      }
      // v ~ [0, 0.94); remap to center ~0.5 with moderate spread.
      const c = Math.max(0, Math.min(255, Math.round((0.15 + v * 0.72) * 255)));
      const i = (y * S + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = c;
      data[i + 3] = 255;
    }
  }
  const t = new DataTexture(data, S, S);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.needsUpdate = true;
  _detailTex = t;
  return t;
}

export const materialKit = {
  standard(color: number, opts: Partial<MeshStandardMaterial> = {}) {
    return new MeshStandardMaterial({
      color,
      roughness: 0.92,
      metalness: 0,
      ...opts,
    });
  },
  drapedGround(texture: Texture, anisotropy = 1) {
    texture.colorSpace = SRGBColorSpace;
    // Anisotropic filtering keeps the aerial imagery sharp at the grazing angles
    // you see at street level (default 1 = a smeared mip). Caller passes the
    // renderer's max.
    texture.anisotropy = Math.max(texture.anisotropy, anisotropy);
    texture.needsUpdate = true;

    const detail = groundDetailTexture();
    detail.anisotropy = Math.max(detail.anisotropy, anisotropy);

    const mat = new MeshStandardMaterial({
      map: texture,
      roughness: 1,
      metalness: 0,
    });

    // Detail overlay: multiply a tiling grayscale tooth over the aerial, at FULL
    // strength up close and fading to nothing by ~220 m — so street level gains
    // high-frequency detail while the distant/miniature view is untouched. The
    // multiply is centered on 1 (t*2, t~0.5) so it adds contrast, not darkness.
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uDetail = { value: detail };
      shader.uniforms.uDetailScale = { value: 1400 }; // ~tiles across the aerial UV
      shader.uniforms.uDetailNear = { value: 8 };
      shader.uniforms.uDetailFar = { value: 220 };
      shader.uniforms.uDetailStrength = { value: 0.8 };
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform sampler2D uDetail;
uniform float uDetailScale;
uniform float uDetailNear;
uniform float uDetailFar;
uniform float uDetailStrength;`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
{
  float _dd = length(vViewPosition);
  float _fade = (1.0 - smoothstep(uDetailNear, uDetailFar, _dd)) * uDetailStrength;
  float _t = texture2D(uDetail, vMapUv * uDetailScale).r;
  diffuseColor.rgb *= mix(1.0, _t * 2.0, _fade);
}`
        );
    };
    // Distinct program so the injected shader is used (not the cached base one).
    mat.customProgramCacheKey = () => 'drapedGround-detail-v1';
    return mat;
  },
};
