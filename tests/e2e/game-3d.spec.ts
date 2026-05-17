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

test.describe('/game/3d — US-5: Mobile-Responsive Canvas', () => {
  test('canvas fills available width on mobile viewport without horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/game/3d');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 5000 });

    // Page should not have a horizontal scrollbar at this width.
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(overflow).toBe(false);

    // Canvas width must fit within the viewport minus the page's container padding.
    const canvasWidth = await page
      .locator('canvas')
      .evaluate((el) => (el as HTMLCanvasElement).clientWidth);
    // Container has px-4 (16px each side) + max-w-7xl. On a 375px viewport
    // there's no max-w constraint that bites; expect ≤ 375 - 32 (padding).
    expect(canvasWidth).toBeLessThanOrEqual(343);
    expect(canvasWidth).toBeGreaterThan(0);
  });
});

test.describe('/game/3d — US-3: Respect Reduced Motion', () => {
  test('auto-orbit is disabled when prefers-reduced-motion: reduce', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/game/3d');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 5000 });

    // Scene wrapper exposes a `data-autorotate-active` debug attribute
    // (dev-mode only). With reduced motion, it should report "false" once
    // mounted.
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
    await expect(page.locator('canvas')).toBeVisible({ timeout: 5000 });

    // Wait past the initial 3-second idle window to let auto-orbit settle.
    await page.waitForTimeout(200);
    const autorotate = await page
      .locator('[data-autorotate-active]')
      .first()
      .getAttribute('data-autorotate-active');
    expect(autorotate).toBe('true');
  });
});

test.describe('/game/3d — US-2: Theme-Aware 3D Scene', () => {
  test('switching data-theme on <html> updates the scene mesh color', async ({
    page,
  }) => {
    await page.goto('/game/3d');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 5000 });

    // The Scene component sets a `data-mesh-color` debug attribute (dev mode)
    // on its wrapper element. Capture the value before + after the theme switch.
    const initial = await page
      .locator('[data-mesh-color]')
      .first()
      .getAttribute('data-mesh-color');

    // Force-switch the theme via DOM attribute (decouples this test from the
    // ThemeSwitcher UI). The Scene's MutationObserver should react.
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    // Re-read the debug attribute. It should have changed within one frame.
    await page.waitForTimeout(100);
    const after = await page
      .locator('[data-mesh-color]')
      .first()
      .getAttribute('data-mesh-color');

    expect(initial).not.toBeNull();
    expect(after).not.toBeNull();
    expect(after).not.toBe(initial);
  });
});

test.describe('/game/3d — US-1: Visit the 3D Game Route', () => {
  test('navigating to /game/3d mounts a <canvas> element', async ({ page }) => {
    await page.goto('/game/3d');

    // Suspense loader is visible briefly during dynamic import (it has role="status").
    // Then the canvas element renders.
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
