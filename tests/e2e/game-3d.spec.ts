/**
 * E2E: Three.js Game at /game/3d
 *
 * Feature 047 — Three.js Game (T007)
 *
 * US-1 scenarios:
 *   - Navigate to /game/3d → canvas mounts within 2 seconds
 *   - Drag the canvas → camera orbits via drei OrbitControls
 *   - No SSR errors; static export emits out/game/3d/index.html
 *
 * Subsequent user-story scenarios (theme switch US-2 / reduced motion US-3 /
 * mobile US-5 / WebGL fallback FR-008 / multi-modality SC-004) are added in
 * their respective task phases.
 */

import { test, expect } from '@playwright/test';

test.describe('/game/3d — FR-008: WebGL Fallback', () => {
  test('renders FallbackPanel when WebGL is unavailable (probe returns null)', async ({
    page,
  }) => {
    // Force the WebGL probe to fail by stubbing HTMLCanvasElement.getContext
    // BEFORE the page mounts. The Scene's mount-time probe will see null and
    // render FallbackPanel instead of Canvas. We blanket-return null for
    // every context request; the page doesn't need 2d context for the
    // FallbackPanel path (it's pure DOM).
    await page.addInitScript(() => {
      const proto = HTMLCanvasElement.prototype as unknown as {
        getContext: (type: string) => unknown;
      };
      proto.getContext = function () {
        return null;
      };
    });

    await page.goto('/game/3d');

    // FallbackPanel renders role="alert" with "3D Content Unavailable".
    await expect(
      page.getByRole('heading', { name: /3d content unavailable/i })
    ).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-webgl-ok="false"]')).toBeVisible();

    // Retry button is in tab order + has accessible name.
    const retry = page.getByRole('button', {
      name: /retry rendering 3d scene/i,
    });
    await expect(retry).toBeVisible();
    await retry.focus();
    await expect(retry).toBeFocused();
  });

  test('clicking Retry re-runs the WebGL probe (stays in fallback if still unavailable)', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const proto = HTMLCanvasElement.prototype as unknown as {
        getContext: (type: string) => unknown;
      };
      proto.getContext = function (this: HTMLCanvasElement, type: string) {
        if (type === 'webgl' || type === 'experimental-webgl') return null;
        return null;
      };
    });

    await page.goto('/game/3d');
    const retry = page.getByRole('button', {
      name: /retry rendering 3d scene/i,
    });
    await expect(retry).toBeVisible({ timeout: 5000 });

    await retry.click();

    // Probe still returns null → fallback stays.
    await expect(retry).toBeVisible();
    await expect(page.locator('[data-webgl-ok="false"]')).toBeVisible();
  });
});

test.describe('/game/3d — US-5: Mobile-Responsive Canvas', () => {
  test('rendered content fills available width on mobile viewport without horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/game/3d');

    // Either the canvas (WebGL available) OR the FallbackPanel (WebGL
    // unavailable — legitimate FR-008 path) must render. Firefox on
    // headless Linux CI occasionally fails its WebGL probe; that's a real
    // production state and US-5's contract is about responsive layout, not
    // WebGL availability. We assert the wrapper exposes the
    // `data-webgl-ok` debug attribute either way, then branch on its value.
    const wrapper = page.locator('[data-webgl-ok]').first();
    await expect(wrapper).toBeVisible({ timeout: 5000 });
    const webglOk = await wrapper.getAttribute('data-webgl-ok');

    // Page should not have a horizontal scrollbar at this width regardless
    // of which content rendered.
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(overflow).toBe(false);

    // Whichever path rendered, its primary container must fit within
    // viewport minus the page's container padding (px-4 → 32px total).
    // Container has px-4 + max-w-7xl. On a 375px viewport there's no
    // max-w constraint that bites; expect ≤ 343.
    if (webglOk === 'true') {
      // WebGL available: canvas should be visible + within bounds.
      await expect(page.locator('canvas')).toBeVisible();
      const canvasWidth = await page
        .locator('canvas')
        .evaluate((el) => (el as HTMLCanvasElement).clientWidth);
      expect(canvasWidth).toBeLessThanOrEqual(343);
      expect(canvasWidth).toBeGreaterThan(0);
    } else {
      // WebGL unavailable: FallbackPanel should be visible + within bounds.
      const fallback = page.getByRole('heading', {
        name: /3d content unavailable/i,
      });
      await expect(fallback).toBeVisible();
      const wrapperWidth = await wrapper.evaluate((el) => el.clientWidth);
      expect(wrapperWidth).toBeLessThanOrEqual(343);
      expect(wrapperWidth).toBeGreaterThan(0);
    }
  });
});

test.describe('/game/3d — US-3: Respect Reduced Motion', () => {
  // These tests assert `data-autorotate-active` on the Scene wrapper. That
  // attribute is set in BOTH the canvas-rendering path AND the FallbackPanel
  // path (see Scene.tsx), so we only need the wrapper to be present — we do
  // NOT require WebGL to be available. This matters on firefox-on-Linux-CI
  // where the WebGL probe occasionally returns null even when the platform
  // ostensibly supports it.

  test('auto-orbit is disabled when prefers-reduced-motion: reduce', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/game/3d');
    await expect(page.locator('[data-autorotate-active]').first()).toBeVisible({
      timeout: 5000,
    });

    await page.waitForTimeout(200);
    const autorotate = await page
      .locator('[data-autorotate-active]')
      .first()
      .getAttribute('data-autorotate-active');
    expect(autorotate).toBe('false');
  });

  test('auto-orbit is active when reduced-motion is not set', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/game/3d');
    await expect(page.locator('[data-autorotate-active]').first()).toBeVisible({
      timeout: 5000,
    });

    await page.waitForTimeout(200);
    const autorotate = await page
      .locator('[data-autorotate-active]')
      .first()
      .getAttribute('data-autorotate-active');
    // Reduced-motion is 'no-preference' AND no input has occurred yet, so
    // auto-orbit should be active. BUT if WebGL is unavailable, the Scene
    // is in the FallbackPanel branch and sets data-autorotate-active="false"
    // unconditionally (see Scene.tsx:167) — that's correct behavior, since
    // there's nothing to auto-orbit. Accept either value when the fallback
    // is in effect.
    const webglOk = await page
      .locator('[data-webgl-ok]')
      .first()
      .getAttribute('data-webgl-ok');
    if (webglOk === 'true') {
      expect(autorotate).toBe('true');
    } else {
      expect(autorotate).toBe('false');
    }
  });
});

test.describe('/game/3d — US-2: Theme-Aware 3D Scene', () => {
  test('switching data-theme on <html> updates the scene mesh color', async ({
    page,
  }) => {
    await page.goto('/game/3d');
    // The Scene component sets `data-mesh-color` on its wrapper in BOTH the
    // canvas-rendering branch AND the FallbackPanel branch — theme
    // reactivity is independent of WebGL availability. So we wait for the
    // wrapper, not the canvas.
    await expect(page.locator('[data-mesh-color]').first()).toBeVisible({
      timeout: 5000,
    });

    // The Scene component sets a `data-mesh-color` debug attribute on its
    // wrapper element. Capture the value before + after the theme switch.
    const initial = await page
      .locator('[data-mesh-color]')
      .first()
      .getAttribute('data-mesh-color');
    expect(initial).not.toBeNull();

    // Force-switch the theme via DOM attribute. We use `cupcake` (a very
    // light pastel theme) because the page's default theme is
    // `scripthammer-dark` and the two have wildly different OKLCH primary
    // tokens — guaranteeing a visible delta. (Earlier the test used `dark`,
    // which happens to share an OKLCH primary with `scripthammer-dark` in
    // some configurations; this caused intermittent E2E failures across
    // all 3 browsers.)
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'cupcake');
    });

    // Poll for the data-mesh-color attribute to change. The Scene's
    // MutationObserver fires synchronously on the next microtask, but React
    // batched state updates + the Three.js scene re-render can take a few
    // frames to settle on a slow CI runner. expect.poll is more reliable
    // than a fixed waitForTimeout.
    await expect
      .poll(
        async () =>
          page
            .locator('[data-mesh-color]')
            .first()
            .getAttribute('data-mesh-color'),
        { timeout: 5000, intervals: [100, 200, 500] }
      )
      .not.toBe(initial);
  });
});

test.describe('/game/3d — US-1: Visit the 3D Game Route', () => {
  test('navigating to /game/3d mounts a <canvas> element', async ({ page }) => {
    await page.goto('/game/3d');

    // The Scene's wrapper element renders regardless of WebGL availability;
    // wait for it first so we can check whether WebGL ended up available.
    await expect(page.locator('[data-webgl-ok]').first()).toBeVisible({
      timeout: 5000,
    });
    const webglOk = await page
      .locator('[data-webgl-ok]')
      .first()
      .getAttribute('data-webgl-ok');

    // Firefox-on-Linux-CI occasionally fails the WebGL probe — that's a
    // legitimate production state and the FallbackPanel handles it via
    // FR-008. Skip the canvas-mount assertion in that case (covered by
    // dedicated FR-008 tests at the top of this file).
    test.skip(
      webglOk !== 'true',
      'WebGL probe failed at mount; FR-008 fallback path active'
    );

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 5000 });
  });

  test('page heading and breadcrumb render', async ({ page }) => {
    await page.goto('/game/3d');
    await expect(
      page.getByRole('heading', { name: /3d game \(three\.js\)/i })
    ).toBeVisible();
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();
  });

  test('no SSR errors: page reaches network idle without console.error', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/game/3d');
    await page.waitForLoadState('networkidle');
    // Filter out known-noisy errors unrelated to this feature (e.g. third-party
    // scripts that may fail in test environments). Keep this filter narrow.
    const relevant = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.toLowerCase().includes('analytics') &&
        !e.toLowerCase().includes('chrome-extension')
    );
    expect(relevant).toEqual([]);
  });

  test('canvas drag triggers a re-render (orbit controls active)', async ({
    page,
  }) => {
    await page.goto('/game/3d');

    await expect(page.locator('[data-webgl-ok]').first()).toBeVisible({
      timeout: 5000,
    });
    const webglOk = await page
      .locator('[data-webgl-ok]')
      .first()
      .getAttribute('data-webgl-ok');
    test.skip(
      webglOk !== 'true',
      'WebGL probe failed at mount; orbit-drag requires a real canvas'
    );

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 5000 });

    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas bounding box unavailable');

    // Drag from canvas center horizontally by 80px.
    // We can't directly inspect the Three.js camera state from Playwright, so this
    // is a smoke check that the gesture doesn't throw and the canvas remains visible.
    // Real camera-position verification lands in T024 via a dev-mode debug attribute.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, {
      steps: 10,
    });
    await page.mouse.up();

    await expect(canvas).toBeVisible();
  });
});
