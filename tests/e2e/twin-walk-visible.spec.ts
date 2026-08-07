import { test, expect } from '@playwright/test';
import sharp from 'sharp';

/**
 * Visual regression guard for first-person Walk (`/chatt?diorama&walk`).
 *
 * WHY THIS EXISTS: every scene regression in the walk-realism arc — the unlit
 * "dark void", the buildings vanishing into the ground, the over-sepia grade —
 * sailed through console/error checks because nothing threw. Only the *pixels*
 * were wrong. This spec reads the composited frame (a real screenshot, so it
 * captures WebGL via the compositor regardless of preserveDrawingBuffer) and
 * fails if the street level is too dark or too uniform to be the city.
 *
 * WebGL honesty (see tests/e2e/twin-glass-contrast.spec.ts + #288): headless
 * Chromium needs software GL (playwright.visual.config.ts forces SwiftShader). If
 * WebGL is still unavailable we SKIP rather than false-green on a blank canvas.
 *
 * Run: docker exec sh-cod-scripthammer-1 pnpm exec playwright test \
 *        --config playwright.visual.config.ts
 */

// Floors calibrated against the daylit walk scene (buildings + sky + ground).
// A dark-void regression drives mean luminance toward 0; a flat single-colour
// frame (no geometry / all fog) drives inter-tile variance toward 0.
const MIN_MEAN_LUMINANCE = 0.1;
const MIN_VARIANCE = 0.0015;

test.describe('walk scene is visible (not a dark void / empty frame)', () => {
  test('street level renders lit geometry', async ({ page }) => {
    // The exported CI build serves at /chatt; the dev container serves under a
    // basePath — set APP_BASE_PATH=/ScriptHammer when pointing at the dev server.
    const base = process.env.APP_BASE_PATH ?? '';
    await page.goto(`${base}/chatt/?diorama&walk`);
    // The canvas element mounts into the DOM immediately (attached), even before
    // the scene draws — wait for that, not visibility (a 0-size/unpainted canvas
    // never becomes "visible" under software GL).
    await page
      .locator('canvas')
      .first()
      .waitFor({ state: 'attached', timeout: 30_000 });

    // Gate on a REAL GPU. Software renderers (SwiftShader / llvmpipe — headless
    // CI and this dev container) can't render the heavy R3F scene, so a pixel
    // guard there cannot tell "the app is dark" from "the env can't draw" (the
    // #288 limitation the twin-contrast specs document). Skip cleanly rather than
    // false-fail; the guard still runs on real-GPU dev machines / GPU CI runners.
    const gpu = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = (c.getContext('webgl2') ||
        c.getContext('webgl')) as WebGLRenderingContext | null;
      if (!gl) return { webgl: false, renderer: '' };
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = ext
        ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
        : '';
      return { webgl: true, renderer };
    });
    test.skip(!gpu.webgl, 'no WebGL (see #288) — the visual guard needs a GPU');
    test.skip(
      /swiftshader|llvmpipe|softwarerasterizer|swrast|software/i.test(
        gpu.renderer
      ),
      `software WebGL (${gpu.renderer}) — the visual guard needs a real GPU (see #288); it runs on dev machines / GPU CI`
    );

    // Real GPU: wait for Walk to activate, then settle the first frames.
    await page
      .locator('[data-stance]')
      .first()
      .waitFor({ timeout: 25_000 })
      .catch(() => {});
    await page.waitForTimeout(8000);

    const shot = await page.locator('canvas').first().screenshot();

    // Downsample to a coarse grid and measure mean luminance + inter-tile
    // variance. sharp decodes the PNG the compositor produced.
    const W = 32;
    const H = 18;
    const { data, info } = await sharp(shot)
      .resize(W, H, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const ch = info.channels;
    const lum: number[] = [];
    for (let i = 0; i < W * H; i++) {
      const r = data[i * ch];
      const g = data[i * ch + 1];
      const b = data[i * ch + 2];
      lum.push((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255);
    }
    const mean = lum.reduce((a, b) => a + b, 0) / lum.length;
    const variance =
      lum.reduce((a, b) => a + (b - mean) ** 2, 0) / lum.length;

    // eslint-disable-next-line no-console
    console.log(
      `[visual-smoke] mean=${mean.toFixed(4)} variance=${variance.toFixed(5)}`
    );

    expect(
      mean,
      `frame too dark (mean luminance ${mean.toFixed(3)}) — likely an unlit / dark-void regression`
    ).toBeGreaterThan(MIN_MEAN_LUMINANCE);
    expect(
      variance,
      `frame too uniform (variance ${variance.toFixed(4)}) — likely no geometry on screen (buildings gone / flat fog)`
    ).toBeGreaterThan(MIN_VARIANCE);
  });
});
