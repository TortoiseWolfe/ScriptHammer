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

// Floors calibrated against the daylit walk scene (buildings + sky + ground), measured
// on SwiftShader (the renderer every CI chromium uses) over the chrome-free scene strip
// the pixel test crops to. Measured there (#1376):
//   lit scene            mean 0.424  variance 0.0052
//   geometry hidden      mean 0.521  variance 0.0001   (sky + fog only; fails variance)
//   lights+sky removed   mean 0.004  variance 0.0000   (fails mean)
// Whole-frame, the lights-removed control measured mean 0.14 / variance 0.075 and PASSED.
// A dark-void regression drives mean luminance toward 0; a flat single-colour
// frame (no geometry / all fog) drives inter-tile variance toward 0.
const MIN_MEAN_LUMINANCE = 0.1;
const MIN_VARIANCE = 0.0015;

/** The exported CI build serves at /chatt; the dev container serves under a basePath —
 *  set APP_BASE_PATH=/ScriptHammer when pointing at the dev server. */
async function openWalk(page: import('@playwright/test').Page) {
  const base = process.env.APP_BASE_PATH ?? '';
  await page.goto(`${base}/chatt/?diorama&walk`);
  // The canvas element mounts into the DOM immediately (attached), even before
  // the scene draws — wait for that, not visibility (a 0-size/unpainted canvas
  // never becomes "visible" under software GL).
  await page
    .locator('canvas')
    .first()
    .waitFor({ state: 'attached', timeout: 30_000 });
}

// THE WHOLE FILE NEEDS A BIGGER BUDGET THAN THE 30s DEFAULT, and the first version of the
// reachability test did not get one. It asked for a 45s `expect` inside a 30s test, which is
// silently unreachable — the test dies at 30s and the expect timeout never applies. It passed
// on one CI run and failed the next with `Test timeout of 30000ms exceeded`, which reads like
// a product regression and is not one.
//
// The real cost is genuine, not padding: the scene downloads the baked city, builds its
// meshes and bakes the collision BVH before walk can engage — ~15s in the dev container, and
// slower on a CI runner that is simultaneously hosting a full local Supabase stack. The pixel
// test below is budgeted too (a 25s wait plus an 8s settle plus a screenshot already exceeds
// 30s on its own, so it could only ever have passed by skipping).
test.describe.configure({ timeout: 150_000 });

test.describe('walk scene is visible (not a dark void / empty frame)', () => {
  /**
   * SPLIT OUT AND UN-SWALLOWED (#725).
   *
   * This assertion used to live inside the pixel test below, BELOW the software-GL
   * `test.skip` and written as `.waitFor(...).catch(() => {})`. Both halves were wrong:
   *
   *  - swallowed, it could not fail. When walk was dead for a day in production (#723) the
   *    two surviving assertions — mean luminance and inter-tile variance — were satisfied
   *    just as well by an orbiting lit city as by a first-person view, so a spec named
   *    `twin-walk-visible` would have reported green while walk was not visible at all.
   *  - placed after the GPU gate, it was skipped on exactly the runners CI has.
   *
   * Reaching walk needs no GPU: the badge is DOM, and it renders under SwiftShader in the
   * dev container in ~15 s. Only the PIXEL guard below needs a real GPU.
   */
  test('walk mode engages from the ?walk deep link', async ({ page }) => {
    await openWalk(page);

    // GATED ON WEBGL EXISTING — NOT on it being hardware. The distinction is the whole
    // point of splitting this test out, and getting it wrong in either direction costs
    // something:
    //
    //   no WebGL at all  -> SKIP. Reaching walk needs the world to hand over its terrain
    //                       and buildings meshes, which needs a canvas that draws. Headless
    //                       firefox has no WebGL (documented at twins.spec.ts:344), so the
    //                       meshes never arrive and the failure would be about the runner,
    //                       not the product. Found the honest way: this test went red on
    //                       firefox-gen 6/6 on its first fail-capable run, while chromium
    //                       and webkit passed.
    //   software WebGL   -> RUN. SwiftShader draws the scene fine — measured reaching walk
    //                       in ~15 s locally and passing on CI chromium. Skipping here is
    //                       what left this URL with no coverage on any runner CI has, which
    //                       is exactly the hole #723 fell through.
    const hasWebGL = await page.evaluate(() => {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    });
    test.skip(
      !hasWebGL,
      'no WebGL in this browser (see #288) — the scene cannot produce the meshes walk ' +
        'mode is built from, so this would measure the runner rather than the app'
    );

    await expect(
      page.locator('[data-stance]').first(),
      'the ?walk deep link never reached walk mode — the stance badge only renders ' +
        'while mode === "walk", so the player is stuck in the orbit shot (#723)'
    ).toBeVisible({ timeout: 120_000 });
  });

  test('street level renders lit geometry', async ({ page }) => {
    await openWalk(page);

    const gpu = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = (c.getContext('webgl2') ||
        c.getContext('webgl')) as WebGLRenderingContext | null;
      if (!gl) return { webgl: false, renderer: '' };
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        webgl: true,
        renderer: ext
          ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
          : '',
      };
    });

    // GATED ON WEBGL EXISTING, NOT ON IT BEING HARDWARE (#1376). Software GL (SwiftShader,
    // which is what every CI chromium uses) draws this scene fine; only a browser with no
    // WebGL at all (headless firefox, #288) cannot, and that measures the runner.
    test.skip(
      !gpu.webgl,
      'no WebGL in this browser (see #288) — the scene cannot be drawn at all'
    );

    // Say which renderer drew the frame, so the measured numbers are never read
    // against the wrong hardware.
    console.log(`[visual-smoke] WebGL renderer: ${gpu.renderer || 'unknown'}`);

    // Wait for Walk to activate, then settle the first frames. Hard wait —
    // a dark-void check against a scene that never entered walk measures the wrong frame.
    await page.locator('[data-stance]').first().waitFor({ timeout: 25_000 });
    await page.waitForTimeout(8000);

    // CAPTURE ONLY THE STRIP, VIA THE PAGE, WITH A REAL BUDGET (#1376). Under software GL
    // every capture is a synchronous GPU->CPU readback. `locator('canvas').screenshot()`
    // reads back the whole viewport-sized canvas and took ~8 s on SwiftShader locally
    // (10.8 s with the CPU throttled 4x), so on a loaded CI runner it blew through the
    // 15 s actionTimeout on all three attempts. A `page.screenshot({ clip })` of just the
    // strip took ~2.7 s (4.0 s at 4x, 6.1 s at 8x). The explicit timeout is the budget
    // for a readback that is slow by nature; it is not what makes the test pass, the
    // floors below are.
    const vp = page.viewportSize();
    if (!vp) throw new Error('walk pixel guard needs a viewport size');
    const left = Math.round(vp.width * 0.18);
    const top = Math.round(vp.height * 0.12);
    const shot = await page.screenshot({
      clip: {
        x: left,
        y: top,
        width: vp.width - left,
        height: Math.round(vp.height * 0.44) - top,
      },
      timeout: 90_000,
    });

    // The strip is the upper scene area with no page chrome in it: below the nav, right of
    // the left HUD column, above the handlebars and the bottom controls. Measuring the whole
    // frame instead is not an option: the bright, high-contrast DOM chrome alone gave a scene
    // with every light and the sky removed a mean of 0.14 and a variance of 0.075 — both
    // above the floors below — so it could not fail on a dead canvas (the same scene reads
    // 0.004 / 0.0000 over the strip).
    const W = 32;
    const H = 8;
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
    const variance = lum.reduce((a, b) => a + (b - mean) ** 2, 0) / lum.length;

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
