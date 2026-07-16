/**
 * E2E smoke: digital-twin viewer (#232), retargeted for the atlas flip (#292)
 *
 *   - TWO RENDERERS, ONE ROUTE. /chatt/ and /twins/[slug]/ now default to the
 *     Cesium ATLAS (panel heading "Atlas — {slug}", a live building count,
 *     and data-testid="atlas-tour"). The R3F DIORAMA — the wordmark
 *     "Chattanooga Mini" and the Tour | Miniature | Ride | Directory | Edit |
 *     As-built demo dock — is now reached only via ?diorama (or one of its
 *     diorama-only implying params: ?ortho, ?house, ?edit). See
 *     src/twin/renderer-select.ts.
 *   - Diorama specs below assert the DOCK, never the wordmark. Verified live:
 *     the wordmark renders underneath the sticky global nav (its rect sits at
 *     z-10 vs the nav's z-50, top ≈ 27px) and elementFromPoint at its own
 *     centre hits the nav's logo, not the wordmark. Playwright's
 *     toBeVisible() is CSS-only, so it would pass on an element no human can
 *     see — the same failure mode that hid a tour caption behind the cookie
 *     banner through four rounds of "green" probes. A dock button (e.g.
 *     "Miniature") is confirmed unoccluded — elementFromPoint at its centre
 *     hits the button itself — and, like the wordmark before it, is a DOM
 *     sibling of the canvas, rendered only once the manifest fetch +
 *     validateManifest succeed, so it proves the same thing without needing
 *     WebGL.
 *   - The R3F canvas mounts when WebGL is available (skipped otherwise: the
 *     twin route has no WebGL fallback panel; headless Firefox/WebKit on CI
 *     occasionally fail the probe).
 *   - No unexpected console.error on load.
 *   - Atlas coverage (new, #292): the atlas took prod down for five hours
 *     (#294) and had never had a single E2E test before this file
 *     (`grep -riE "atlas|cesium" tests/e2e/` returned zero hits).
 */

import { test, expect, type Page } from '@playwright/test';

// The diorama's "it rendered" signal — a dock button, not the (occluded)
// wordmark. 'Miniature' is unconditional: modesForSite() always includes it,
// unlike 'Tour', which only renders when the site manifest has tour stops.
const DIORAMA_SIGNAL = 'Miniature';

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

test.describe('/twins/[slug]?diorama — the R3F exhibit (opt-in since #292)', () => {
  test('/twins/chatt/?diorama loads the baked manifest and shows the camera dock', async ({
    page,
  }) => {
    await page.goto('/twins/chatt/?diorama');
    // The dock renders only after the manifest fetch + validateManifest
    // succeed — generous timeout for cold static hosting.
    await expect(
      page.getByRole('button', { name: DIORAMA_SIGNAL })
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test('/chatt/?diorama alias renders the same twin', async ({ page }) => {
    await page.goto('/chatt/?diorama');
    await expect(
      page.getByRole('button', { name: DIORAMA_SIGNAL })
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test('the twin is reachable from normal navigation (homepage demo card)', async ({
    page,
  }) => {
    // The twin used to be URL-only — no homepage card, no nav item. A user
    // landing on the site must be able to FIND it. That link (href: /chatt,
    // no params) now lands on the atlas, the default since #292 — so assert
    // atlas chrome, not the diorama dock.
    await page.goto('/');
    await page
      .getByRole('link', { name: /Digital Twin/i })
      .first()
      .click();
    await expect(page.getByText('Atlas —').first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('the R3F canvas mounts when WebGL is available', async ({ page }) => {
    await page.goto('/twins/chatt/?diorama');
    await expect(
      page.getByRole('button', { name: DIORAMA_SIGNAL })
    ).toBeVisible({
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
    // This is the heaviest twin spec: it loads the ?ortho WebGL compare route
    // (scene compile + drape texture + the full baked city) AND drives a
    // seven-step overflow round-trip (open ⋯ → Top-down → canvas → Miniature →
    // reopen ⋯ → Top-down). The config allows a single navigation up to 60s
    // (navigationTimeout), which alone can exceed the default 30s TEST cap on a
    // cold CI chromium runner — the exact cause of the chromium-gen 6/6 flake
    // (timed out at the 30s wall while the UI itself rendered correctly). Triple
    // the budget so the wall-clock matches the route's real cost. `test.slow()`
    // is the idiomatic Playwright marker, used across the rest of this suite.
    test.slow();
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error')
        errors.push(`${msg.text()} [${msg.location()?.url ?? ''}]`);
    });
    // ?ortho already implies the diorama (renderer-select.ts DIORAMA_ONLY) and
    // opens straight into the orthographic compare view — no ?diorama needed.
    await page.goto('/twins/chatt/?ortho');
    await expect(
      page.getByRole('button', { name: DIORAMA_SIGNAL })
    ).toBeVisible({
      timeout: 15000,
    });
    // Top-down is a secondary mode — it lives in the HUD's ⋯ overflow (#259
    // iter 7). The ⋯ button TOGGLES, so an idempotent open (click only when
    // collapsed, then wait for the expanded state) avoids racing the popover's
    // click-outside listener and double-toggling it shut.
    const overflow = page.getByRole('button', { name: 'More controls' });
    const openOverflow = async () => {
      if ((await overflow.getAttribute('aria-expanded')) !== 'true') {
        await overflow.click();
      }
      await expect(overflow).toHaveAttribute('aria-expanded', 'true');
    };
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
    // as console errors below. Miniature is in the primary bar; clicking it
    // also dismisses the overflow (click-outside), so re-enter Top-down by
    // reopening the overflow, waited on its expanded state.
    await page.getByRole('button', { name: 'Miniature' }).click();
    await expect(overflow).toHaveAttribute('aria-expanded', 'false');
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
    await page.goto('/twins/chatt/?diorama');
    await expect(
      page.getByRole('button', { name: DIORAMA_SIGNAL })
    ).toBeVisible({
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

test.describe('/chatt — the atlas is the default (#292)', () => {
  // DOM chrome, never the canvas: CI has no guaranteed WebGL, so a canvas
  // assertion test.skip()s into a false green — the #288 failure mode. The
  // panel is a DOM sibling of the canvas and renders without a GPU.
  test('/chatt/ renders the atlas by default', async ({ page }) => {
    await page.goto('/chatt/');
    await expect(page.getByText('Atlas —').first()).toBeVisible({
      timeout: 20000,
    });
  });

  test('the atlas reports a real building count, not an empty scene', async ({
    page,
  }) => {
    await page.goto('/chatt/');
    await expect(page.getByText(/\d[\d,]* buildings/).first()).toBeVisible({
      timeout: 20000,
    });
  });

  test('?diorama still reaches the exhibit', async ({ page }) => {
    // Not getByText('Chattanooga Mini') — that wordmark renders underneath
    // the sticky global nav (z-10 vs the nav's z-50) and is occluded on every
    // real viewport, even though toBeVisible() is CSS-only and reports it
    // visible. The dock button is confirmed unoccluded; see the header
    // comment and DIORAMA_SIGNAL above.
    await page.goto('/chatt/?diorama');
    await expect(
      page.getByRole('button', { name: DIORAMA_SIGNAL })
    ).toBeVisible({
      timeout: 20000,
    });
  });

  test('?atlas remains a working alias for links shared before the flip', async ({
    page,
  }) => {
    await page.goto('/chatt/?atlas');
    await expect(page.getByText('Atlas —').first()).toBeVisible({
      timeout: 20000,
    });
  });
});
