/**
 * E2E smoke: digital-twin viewer (#232)
 *
 *   - /twins/chatt/ (canonical) renders the flagship: the HUD wordmark comes
 *     from the baked manifest's site block, so this single assertion proves
 *     route export, basePath asset routing, the manifest fetch, and
 *     validateManifest end-to-end — without needing WebGL (the HUD is a DOM
 *     sibling of the canvas).
 *   - /chatt/ (flagship alias) renders the same twin.
 *   - The R3F canvas mounts when WebGL is available (skipped otherwise: the
 *     twin route has no WebGL fallback panel; headless Firefox/WebKit on CI
 *     occasionally fail the probe).
 *   - No unexpected console.error on load.
 */

import { test, expect, type Page } from '@playwright/test';

const WORDMARK = 'Chattanooga Mini';

async function webglAvailable(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    );
  });
}

test.describe('/twins/[slug] — digital-twin viewer', () => {
  test('/twins/chatt/ loads the baked manifest and shows the HUD wordmark', async ({
    page,
  }) => {
    await page.goto('/twins/chatt/');
    // The wordmark renders only after the manifest fetch + validateManifest
    // succeed — generous timeout for cold static hosting.
    await expect(page.getByText(WORDMARK).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('/chatt/ alias renders the same twin', async ({ page }) => {
    await page.goto('/chatt/');
    await expect(page.getByText(WORDMARK).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('the R3F canvas mounts when WebGL is available', async ({ page }) => {
    await page.goto('/twins/chatt/');
    await expect(page.getByText(WORDMARK).first()).toBeVisible({
      timeout: 15000,
    });
    test.skip(
      !(await webglAvailable(page)),
      'WebGL unavailable in this browser/runner; the twin route has no fallback panel'
    );
    await expect(page.locator('canvas')).toBeAttached({ timeout: 10000 });
  });

  test('no unexpected console.error on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/twins/chatt/');
    await expect(page.getByText(WORDMARK).first()).toBeVisible({
      timeout: 15000,
    });
    // Known-noisy errors unrelated to this route (same allowlist as
    // game-3d.spec.ts): favicon 404s, keyless analytics, extension leaks,
    // Cloudflare bot-management cookie warnings, and WebGL-unavailable
    // noise from headless runners without a GPU.
    const relevant = errors.filter((e) => {
      const lower = e.toLowerCase();
      return (
        !lower.includes('favicon') &&
        !lower.includes('analytics') &&
        !lower.includes('chrome-extension') &&
        !lower.includes('cf_bm') &&
        !lower.includes('cloudflare') &&
        !lower.includes('webgl')
      );
    });
    expect(relevant).toEqual([]);
  });
});
