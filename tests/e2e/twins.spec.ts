/**
 * E2E smoke: digital-twin viewer (#232), retargeted for the atlas flip (#292)
 *
 *   - TWO RENDERERS, ONE ROUTE. /chatt/ and /twins/[slug]/ now default to the
 *     Cesium ATLAS (panel heading "Atlas — {slug}", a live building count,
 *     and data-testid="atlas-tour"). The R3F DIORAMA — the wordmark
 *     "Chattanooga Mini", the Tour | Miniature | Ride | Directory | Edit
 *     <button> dock, and (for twins with a per-site link) an "As-built demo"
 *     <a href> rendered alongside it (src/stage/Hud.tsx:487-499 — an anchor,
 *     not a button; don't reach for getByRole('button', ...) on it) — is now
 *     reached only via ?diorama (or one of its diorama-only implying params:
 *     ?ortho, ?house, ?edit). See src/twin/renderer-select.ts.
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
import { FOOTER_LINKS } from '@/config/footer-links';

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

/**
 * Is WebGL backed by real hardware, or by a software rasteriser? (#716/#719)
 *
 * "WebGL exists" and "WebGL is fast enough to assert an interaction against" are different
 * claims, and conflating them is what kept this spec red for eight consecutive runs on
 * `main`. GitHub-hosted runners have no GPU, so Chromium falls back to SwiftShader, and a
 * CDP category trace of `/twins/chatt/?ortho` shows where the time goes:
 *
 *   GLES2::ReadPixels                        10,702 ms
 *   CommandBufferHelper::Finish              10,909 ms
 *   CommandBufferProxyImpl::WaitForGetOffset 10,906 ms
 *
 * Compositing a WebGL canvas without a GPU goes through a synchronous GPU->CPU readback, so
 * the main thread stalls for seconds and a click cannot be processed. Nothing in `src/`
 * calls `readPixels`; three application-level fixes were tried against it and moved nothing
 * (see #719). The UI is fine — verified by hand on hardware: the overflow opens, aria flips,
 * Top-down appears.
 *
 * So the timing-sensitive half of this spec is skipped on software renderers, LOUDLY, while
 * everything measurable there still runs. Raising `actionTimeout` instead was rejected: it
 * would blind every other test in the suite to make one route pass.
 */
async function hardwareAccelerated(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ||
      canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (!dbg) return true; // cannot tell; assume real and let the test run
    const renderer = String(
      gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? ''
    ).toLowerCase();
    return !/swiftshader|llvmpipe|softpipe|software|microsoft basic render/.test(
      renderer
    );
  });
}

/** Report the renderer once, so a skip is never silent. */
async function announceRenderer(page: Page): Promise<string> {
  const name = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ||
      canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'none';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      : 'unknown (WEBGL_debug_renderer_info unavailable)';
  });
  console.log(`[twins] WebGL renderer: ${name}`);
  return name;
}

/**
 * Console noise this suite has always tolerated, hoisted out of the two inline copies so a
 * third caller cannot drift from them. Optional twin payloads (`house.json`, `links.local`)
 * are gitignored and absent in a fresh checkout by design (#392).
 */
function isBenignConsoleError(e: string): boolean {
  const lower = e.toLowerCase();
  return (
    lower.includes('favicon') ||
    lower.includes('analytics') ||
    lower.includes('chrome-extension') ||
    lower.includes('cf_bm') ||
    lower.includes('cloudflare') ||
    lower.includes('webgl') ||
    lower.includes('links.local.json') ||
    lower.includes('house/house.json') ||
    lower.includes('models/models.json') ||
    lower.includes('127.0.0.1:3099')
  );
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

  test('?ortho renders and mounts its canvas — runs on software renderers too (#716)', async ({
    page,
  }) => {
    // The coverage that survives when the interaction test above is skipped. Everything
    // here is true regardless of how fast the GPU is: the route resolves, the HUD renders,
    // a canvas is created, and nothing throws. Skipping the timing-sensitive half must not
    // mean `?ortho` goes completely unwatched in CI — that would trade one blind spot for
    // another.
    test.slow();
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error')
        errors.push(`${msg.text()} [${msg.location()?.url ?? ''}]`);
    });
    await page.goto('/twins/chatt/?ortho');
    test.skip(
      !(await webglAvailable(page)),
      'WebGL unavailable in this browser/runner; the twin route has no fallback panel'
    );
    await expect(
      page.getByRole('button', { name: DIORAMA_SIGNAL })
    ).toBeVisible({ timeout: 30000 });
    await expect(page.locator('canvas')).toBeAttached({ timeout: 30000 });
    const real = errors.filter((e) => !isBenignConsoleError(e));
    expect(real, `console errors on ?ortho:\n${real.join('\n')}`).toEqual([]);
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

    // GUARD FIRST, THEN EXERCISE (#716). These two checks used to sit ~15 lines BELOW,
    // after the assertions and the click they are meant to guard — so on a runner that
    // could not satisfy them the test failed instead of skipping. A precondition checked
    // after the fact is not a precondition.
    await announceRenderer(page);
    test.skip(
      !(await webglAvailable(page)),
      'WebGL unavailable in this browser/runner; the twin route has no fallback panel'
    );
    test.skip(
      !(await hardwareAccelerated(page)),
      'Software-rendered WebGL (SwiftShader/llvmpipe): compositing this canvas goes through ' +
        'a synchronous GPU readback — traced at 10.7s of ReadPixels — so the main thread ' +
        'cannot service a click. The UI is verified working on hardware; see #719.'
    );

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
  // TWO TESTS, NOT ONE, AND THE SPLIT IS THE POINT (#310).
  //
  // This used to be a single `/chatt/ renders the atlas by default` asserting
  // `Atlas —` is visible. But `Atlas — {slug}` renders UNCONDITIONALLY — the
  // status line beside it is a ternary whose first branch is `error: ${error}`.
  // Probed on headless firefox, which has no WebGL:
  //
  //   hudText: "Atlas — chatt   error: The browser supports WebGL, but
  //             initialization failed."
  //
  // So the test whose whole job was proving the atlas renders was GREEN over a
  // completely dead atlas. Same family as toBeVisible() ignoring occlusion
  // (#299) and the placeholder client_id a test asserted toBeTruthy() on
  // (#288): a green assertion above a broken product.
  //
  // The mount and the scene are different claims, so they are different tests.
  test('the atlas MODULE mounts on /chatt (no WebGL needed)', async ({
    page,
  }) => {
    // Deliberately unconditional and deliberately weak: it proves the Cesium
    // chunk loaded and AtlasViewer evaluated and mounted. That is exactly what
    // catches a #294-class dead vendor chunk (which took prod down for five
    // hours), and it catches it on EVERY browser, including ones with no WebGL.
    // It does NOT prove the scene works — see the next test for that.
    await page.goto('/chatt/');
    await expect(page.getByText('Atlas —').first()).toBeVisible({
      timeout: 20000,
    });
  });

  test('the atlas SCENE initialises without erroring', async ({ page }) => {
    // The claim the test above cannot make. Gated on WebGL because headless
    // firefox/webkit on CI have none, and Cesium's Viewer ctor throws there —
    // the same gate `the R3F canvas mounts when WebGL is available` already
    // uses. Chromium has swiftshader, so this assertion really runs on every PR
    // rather than skipping everywhere (skipping into a false green is #288's
    // failure mode, so the gate must stay narrow: only tests that need `ready`).
    await page.goto('/chatt/');
    await expect(page.getByText('Atlas —').first()).toBeVisible({
      timeout: 20000,
    });
    test.skip(
      !(await webglAvailable(page)),
      'WebGL unavailable in this browser/runner; Cesium cannot initialise'
    );

    // The status line IS the error surface — `error: ${e.message}` is its first
    // ternary branch. Asserting on it is what makes this test unable to pass on
    // the dead atlas the old one passed on.
    const hud = page.getByTestId('atlas-hud');
    await expect(hud).not.toContainText('error:', { timeout: 20000 });
    // And the positive signal: the chips only render behind `{ready && …}`.
    await expect(
      page.getByRole('button', { name: 'type', exact: true })
    ).toBeVisible({ timeout: 20000 });
  });

  // ── #301 ──────────────────────────────────────────────────────────────────
  // The HUD used to hide under the sticky nav. NOT because of z-index: because
  // the page SCROLLED. `relative h-screen` below a 65px nav, plus pb-14 and a
  // footer, made the body 871 tall against a 630 viewport, and 100px of scroll
  // put the `type` chip behind the nav. It looked perfect at scroll 0, which is
  // why it read as "renders fine now, randomly glitches later" and why every
  // screenshot taken without scrolling looked fine.
  //
  // These two tests are deliberately different in kind:
  //   1. STRUCTURAL — the page cannot scroll, so the bug cannot occur. This is
  //      stronger than any visual assertion and cannot flake.
  //   2. BEHAVIOURAL — drive the real gesture and hit-test. toBeVisible() is
  //      useless here: it checks CSS, not occlusion, and passed for months on a
  //      wordmark buried under this very nav (#299).
  test('the page cannot scroll, so the HUD cannot hide (#301)', async ({
    page,
  }) => {
    await page.goto('/chatt/?notour');
    await expect(page.getByText('Atlas —').first()).toBeVisible({
      timeout: 20000,
    });

    const m = await page.evaluate(() => {
      window.scrollTo(0, 500); // must be a no-op
      return {
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        scrollY: Math.round(window.scrollY),
      };
    });
    expect(m.scrollHeight).toBeLessThanOrEqual(m.innerHeight);
    expect(m.scrollY).toBe(0);
  });

  test('the type chip is reachable, even after trying to scroll (#301)', async ({
    page,
  }) => {
    await page.goto('/chatt/?notour');
    // The chip lives behind `{ready && …}`, so it needs a live Cesium scene
    // (#310). Headless firefox/webkit have no WebGL; the atlas correctly shows
    // its error state there and no chip exists to be occluded.
    await expect(page.getByText('Atlas —').first()).toBeVisible({
      timeout: 20000,
    });
    test.skip(
      !(await webglAvailable(page)),
      'WebGL unavailable in this browser/runner; the type chip renders only behind `ready`'
    );
    const chip = page.getByRole('button', { name: 'type', exact: true });
    await expect(chip).toBeVisible({ timeout: 20000 });

    const hit = await page.evaluate(() => {
      window.scrollTo(0, 500);
      const el = [...document.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'type'
      );
      if (!el) return { found: false };
      const b = el.getBoundingClientRect();
      // elementFromPoint at the element's OWN centre — "is it actually on
      // top?", which is the only question that matters to a user's finger.
      const top = document.elementFromPoint(
        Math.round(b.left + b.width / 2),
        Math.round(b.top + b.height / 2)
      );
      return {
        found: true,
        ownHit: top ? el === top || el.contains(top) : false,
        hitInNav: top ? !!top.closest('[data-global-nav]') : false,
      };
    });
    expect(hit.found).toBe(true);
    expect(hit.hitInNav, 'the nav must not eat the type chip').toBe(false);
    expect(
      hit.ownHit,
      'the type chip must be the topmost element at its centre'
    ).toBe(true);
  });

  test('the HUD is capped in width and wraps rather than clips (#307)', async ({
    page,
  }) => {
    // The panel is intrinsically sized, so before #307 its width was set by its
    // single longest line — 383px of `8031 buildings · baked OSM + baked lidar ·
    // 3DEP · no token` — while every other row needed <=222px. ~40% of the panel
    // was empty, held open by one string of pipeline provenance.
    //
    // A width cap's real hazard is CLIPPING, so that is what this asserts, and
    // it asserts it at the accessibility system's maximum font scale (2.125,
    // AccessibilityContext.tsx) where the wrap is under the most pressure. A
    // test that only checked the width at default scale would pass while the
    // legend ran off the edge for anyone using large type.
    await page.goto('/chatt/?notour');
    await expect(page.getByText('Atlas —').first()).toBeVisible({
      timeout: 20000,
    });

    const measure = () =>
      page.evaluate(() => {
        const panel = document.querySelector(
          '[data-testid="atlas-hud"]'
        )?.firstElementChild;
        if (!panel) return null;
        const clipped = [...panel.querySelectorAll('*')].filter(
          (e) =>
            e.scrollWidth > e.clientWidth + 1 &&
            getComputedStyle(e).overflow !== 'visible'
        ).length;
        return { w: Math.round(panel.getBoundingClientRect().width), clipped };
      });

    const atDefault = await measure();
    expect(atDefault).not.toBeNull();
    // 256 = max-w-64. Allow a little slack for font metrics across runners.
    expect(
      atDefault!.w,
      'the HUD must not be as wide as its longest line'
    ).toBeLessThanOrEqual(264);
    expect(atDefault!.clipped, 'nothing in the HUD may be clipped').toBe(0);

    await page.evaluate(() =>
      document.documentElement.style.setProperty('--font-scale-factor', '2.125')
    );
    const atMaxScale = await measure();
    expect(
      atMaxScale!.clipped,
      'the HUD must wrap, not clip, at the max accessibility font scale'
    ).toBe(0);
  });

  test('the atlas keeps its cookie banner and drops the PWA popup (#301)', async ({
    page,
  }) => {
    // Deliberate split: /chatt is the shared link, so a first-time visitor must
    // still be able to consent. Only the diorama hides the banner (its dock sits
    // at bottom:16 and the banner buries it).
    await page.goto('/chatt/?notour');
    await expect(page.getByText('Atlas —').first()).toBeVisible({
      timeout: 20000,
    });

    const chrome = await page.evaluate(() => {
      const disp = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).display : 'absent';
      };
      return {
        body: document.body.className,
        pwa: disp('[aria-label="Install Progressive Web App"]'),
        banner: disp('[aria-label="Cookie consent banner"]'),
      };
    });
    expect(chrome.body).toContain('twin-fullscreen');
    expect(chrome.body).not.toContain('twin-diorama');
    expect(chrome.pwa, 'PWA popup collides with the target card').not.toBe(
      'block'
    );
    // 'absent' is legitimate: the banner does not render once consent is
    // stored. What must never happen is our CSS hiding it on the atlas.
    expect(chrome.banner).not.toBe('none');
  });

  test('exactly one contentinfo landmark, and it carries the real links (#301)', async ({
    page,
  }) => {
    await page.goto('/chatt/?notour');
    await expect(page.getByText('Atlas —').first()).toBeVisible({
      timeout: 20000,
    });

    const footers = await page.evaluate(() => {
      const all = [
        ...document.querySelectorAll('footer, [role="contentinfo"]'),
      ];
      const shown = all.filter((f) => getComputedStyle(f).display !== 'none');
      return {
        shownCount: shown.length,
        // Which one survived matters: the site footer hidden and the strip
        // shown, never the reverse and never both.
        shownIsStrip: shown[0]?.hasAttribute('data-twin-footer') ?? false,
        hrefs: shown[0]
          ? [...shown[0].querySelectorAll('a')].map((a) =>
              a.getAttribute('href')
            )
          : [],
      };
    });
    expect(
      footers.shownCount,
      'two contentinfo landmarks is an a11y defect'
    ).toBe(1);
    expect(footers.shownIsStrip).toBe(true);
    // Driven by the shared config, so the strip cannot silently drift from the
    // site footer's links.
    expect(footers.hrefs).toEqual(FOOTER_LINKS.map((l) => l.href));
  });

  test('the atlas reports a real building count, not an empty scene', async ({
    page,
  }) => {
    // /\d[\d,]* buildings/ would ALSO match "0 buildings" — \d takes the
    // leading 0 and [\d,]* matches empty. AtlasViewer.client.tsx:518-519
    // documents that exact bug shipping once already ("a second count source
    // is what made the headline read '0 buildings' over a correct
    // 8031-building legend"). So find the element with the loose pattern
    // (still fails loudly if no count renders at all), then parse the number
    // out and assert it's actually > 0 — that states the intent plainly and
    // is driven by the real numeric value rather than string shape (e.g. a
    // hypothetical "01 buildings" parses to 1, a legitimate nonzero count,
    // and correctly passes here).
    //
    // The trailing " · " is load-bearing (#292 review, fix-now minor #3), NOT
    // decorative: the SAME status div's ternary sibling renders
    // `projecting ${buildings.length} buildings…` while still loading
    // (AtlasViewer.client.tsx's setStatus call before `ready`), which also
    // matches a bare /\d[\d,]* buildings/. Today this test only passes on the
    // READY state because React batches both setStatus calls with no `await`
    // between them — an innocuous-looking added `await` would make it start
    // passing on the LOADING text instead, silently. Requiring the middot
    // that only the ready-state string has (`${total} buildings · ${...}`)
    // makes the assertion correct regardless of that timing.
    await page.goto('/chatt/');
    // Needs a live scene (#310): the ready-state headline only exists once
    // Cesium initialises, and headless firefox/webkit have no WebGL — which is
    // why this test, not the atlas, was red on main for four runs after #297.
    // Do NOT "fix" that by loosening the assertion: this is the test that
    // catches "0 buildings" over a correct 8031-building legend.
    await expect(page.getByText('Atlas —').first()).toBeVisible({
      timeout: 20000,
    });
    test.skip(
      !(await webglAvailable(page)),
      'WebGL unavailable in this browser/runner; the count renders only behind `ready`'
    );
    const headline = page.getByText(/\d[\d,]* buildings · /).first();
    await expect(headline).toBeVisible({ timeout: 20000 });
    const text = await headline.textContent();
    const count = Number(text?.match(/\d[\d,]*/)?.[0].replace(/,/g, ''));
    expect(count).toBeGreaterThan(0);
  });

  test('?diorama still reaches the exhibit', async ({ page }) => {
    // The dock, not the wordmark, is the "did it render?" signal — see the
    // header comment and DIORAMA_SIGNAL above. (The wordmark WAS occluded for
    // months; #301 fixed that, and the test below now guards it. The dock stays
    // the signal here because it is what a user actually reaches for.)
    await page.goto('/chatt/?diorama');
    await expect(
      page.getByRole('button', { name: DIORAMA_SIGNAL })
    ).toBeVisible({
      timeout: 20000,
    });
  });

  test('the diorama wordmark is finally out from under the nav (#299)', async ({
    page,
  }) => {
    // This is the EXACT probe that proved #299 — elementFromPoint at the
    // wordmark's own centre once returned the nav's logo — now run as the fix's
    // assertion. toBeVisible() asserted this element was visible for months
    // while no human had ever seen it: it checks CSS, not occlusion.
    await page.goto('/chatt/?diorama');
    await expect(
      page.getByRole('button', { name: DIORAMA_SIGNAL })
    ).toBeVisible({ timeout: 20000 });

    const hit = await page.evaluate(() => {
      const el = [...document.querySelectorAll('div')].find(
        (d) => d.textContent?.trim() === 'Chattanooga Mini'
      );
      if (!el) return { found: false };
      const b = el.getBoundingClientRect();
      const top = document.elementFromPoint(
        Math.round(b.left + b.width / 2),
        Math.round(b.top + b.height / 2)
      );
      return {
        found: true,
        rectTop: Math.round(b.top),
        ownHit: top ? el === top || el.contains(top) : false,
        hitInNav: top ? !!top.closest('[data-global-nav]') : false,
      };
    });
    expect(hit.found).toBe(true);
    expect(hit.hitInNav, 'the nav must not bury the page title').toBe(false);
    expect(
      hit.ownHit,
      'the wordmark must be the topmost element at its centre'
    ).toBe(true);
  });

  test('the diorama hides the cookie banner its dock sits under (#301)', async ({
    page,
  }) => {
    // The inverse of the atlas's rule, and the reason one class could not serve
    // both renderers: the dock is absolute bottom:16 and the ~66px banner
    // buries it.
    await page.goto('/chatt/?diorama');
    await expect(
      page.getByRole('button', { name: DIORAMA_SIGNAL })
    ).toBeVisible({ timeout: 20000 });

    const chrome = await page.evaluate(() => {
      const el = document.querySelector('[aria-label="Cookie consent banner"]');
      return {
        body: document.body.className,
        bannerDisplay: el ? getComputedStyle(el).display : 'absent',
      };
    });
    expect(chrome.body).toContain('twin-diorama');
    expect(chrome.bannerDisplay).not.toBe('block');
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
