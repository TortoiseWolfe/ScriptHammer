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

  test('the twin is reachable from normal navigation (homepage demo card)', async ({
    page,
  }) => {
    // The twin used to be URL-only — no homepage card, no nav item. A user
    // landing on the site must be able to FIND it.
    await page.goto('/');
    await page
      .getByRole('link', { name: /Digital Twin/i })
      .first()
      .click();
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

  test('Top-down compare mode (#233): dock button + ?ortho render without errors', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error')
        errors.push(`${msg.text()} [${msg.location()?.url ?? ''}]`);
    });
    // ?ortho opens straight into the orthographic compare view
    await page.goto('/twins/chatt/?ortho');
    await expect(page.getByText(WORDMARK).first()).toBeVisible({
      timeout: 15000,
    });
    // Top-down is a secondary mode — it lives in the HUD's ⋯ overflow (#259
    // iter 7). Open the overflow, then assert Top-down is reachable there.
    const openOverflow = () =>
      page.getByRole('button', { name: 'More controls' }).click();
    await openOverflow();
    await expect(page.getByRole('button', { name: 'Top-down' })).toBeVisible();
    test.skip(
      !(await webglAvailable(page)),
      'WebGL unavailable in this browser/runner; the twin route has no fallback panel'
    );
    await expect(page.locator('canvas')).toBeAttached({ timeout: 10000 });
    // Round-trip through the dock: leave and re-enter Top-down. This drives
    // the ortho render branch (frustum, colorspace flip, fog restore) and the
    // rig re-frame on exit — a NaN frustum or render-loop throw would surface
    // as console errors below. Miniature is in the primary bar; re-entering
    // Top-down means reopening the overflow (picking a mode closes it).
    await page.getByRole('button', { name: 'Miniature' }).click();
    await openOverflow();
    await page.getByRole('button', { name: 'Top-down' }).click();
    await page.waitForTimeout(1500);
    const relevant = errors.filter((e) => {
      const lower = e.toLowerCase();
      return (
        !lower.includes('favicon') &&
        !lower.includes('analytics') &&
        !lower.includes('chrome-extension') &&
        !lower.includes('cf_bm') &&
        !lower.includes('cloudflare') &&
        !lower.includes('webgl') &&
        !lower.includes('links.local.json') &&
        !lower.includes('house/house.json') &&
        !lower.includes('models/models.json') &&
        !lower.includes('127.0.0.1:3099')
      );
    });
    expect(relevant).toEqual([]);
  });

  test('no unexpected console.error on load', async ({ page }) => {
    // Record the failing resource URL alongside the message: Chromium logs a
    // generic "Failed to load resource ... 404" with the URL only in
    // msg.location(), and some 404s here are EXPECTED (see below).
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error')
        errors.push(`${msg.text()} [${msg.location()?.url ?? ''}]`);
    });
    await page.goto('/twins/chatt/');
    await expect(page.getByText(WORDMARK).first()).toBeVisible({
      timeout: 15000,
    });
    // Allowlists:
    //  - the game-3d.spec.ts noise set (favicon, keyless analytics, extension
    //    leaks, Cloudflare cookie warnings, GPU-less WebGL noise), plus
    //  - the twin's OPTIONAL per-site assets (#234): links.local.json and
    //    house/house.json, and models/models.json (#259 sampled buildings)
    //    are absence-probed by design on static hosting, and
    //    the browser logs each 404 as a console error. Those two paths 404ing
    //    is the NORMAL state for any twin without a private demo link or an
    //    as-built capture (i.e. every committed twin), and
    //  - 127.0.0.1:3099 is the dev-only overrides sidecar (#259 iter 6). The
    //    editor probes it on localhost; when it's absent (CI, live site, any
    //    machine not running `pnpm run overrides-server`) the browser logs an
    //    ERR_CONNECTION_REFUSED. That absence is the normal case — the Save
    //    button simply stays hidden.
    const relevant = errors.filter((e) => {
      const lower = e.toLowerCase();
      return (
        !lower.includes('favicon') &&
        !lower.includes('analytics') &&
        !lower.includes('chrome-extension') &&
        !lower.includes('cf_bm') &&
        !lower.includes('cloudflare') &&
        !lower.includes('webgl') &&
        !lower.includes('links.local.json') &&
        !lower.includes('house/house.json') &&
        !lower.includes('models/models.json') &&
        !lower.includes('127.0.0.1:3099')
      );
    });
    expect(relevant).toEqual([]);
  });
});
