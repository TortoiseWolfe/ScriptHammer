import { describe, it, expect } from 'vitest';
import { DataTexture, RepeatWrapping } from 'three';
import { groundDetailTexture, materialKit } from '../materialKit';

describe('groundDetailTexture', () => {
  it('builds a cached 256×256 tileable grayscale detail texture', () => {
    const t = groundDetailTexture();
    expect(t).toBeInstanceOf(DataTexture);
    expect(t.image.width).toBe(256);
    expect(t.image.height).toBe(256);
    expect(t.wrapS).toBe(RepeatWrapping);
    expect(t.wrapT).toBe(RepeatWrapping);
    // Grayscale: r == g == b for every texel-ish (check a few).
    const d = t.image.data as Uint8Array;
    for (const i of [0, 400, 40000]) {
      expect(d[i]).toBe(d[i + 1]);
      expect(d[i + 1]).toBe(d[i + 2]);
    }
    // Module-cached (same instance on re-call).
    expect(groundDetailTexture()).toBe(t);
  });
});

describe('materialKit.drapedGround', () => {
  it('maps the aerial + installs the detail-overlay onBeforeCompile', () => {
    const tex = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    const mat = materialKit.drapedGround(tex, 4);
    expect(mat.map).toBe(tex);
    expect(mat.roughness).toBe(1);
    expect(typeof mat.onBeforeCompile).toBe('function');
    // Distinct program key so the injected shader is actually used.
    expect(mat.customProgramCacheKey()).toBe('drapedGround-detail-v1');
  });
});
