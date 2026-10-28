import { test, expect } from '@playwright/test';

/**
 * The band stage at Ross's Landing (feature 053, #1413).
 *
 * The /band page links into the Chattanooga twin at the audience spot, facing the stage.
 * Arriving there must put the player in walk mode next to the stage, which shows the
 * band's play controls. Those controls render only while the player is within
 * NEAR_STAGE_M of the deck, so seeing them proves the stage was placed and the deep
 * link spawned the walker beside it.
 *
 * Budget and WebGL gate follow tests/e2e/twin-walk-visible.spec.ts: reaching walk needs
 * the baked city to load and the collision mesh to build, which takes ~15 s in the dev
 * container and longer on a loaded CI runner.
 */
const WALK_ENGAGE_MS = 120_000;
const STAGE_PATH = '/chatt/?diorama&walk&at=35.05666,-85.31144&face=0';
test.describe.configure({ timeout: 150_000 });

test.describe("band stage at Ross's Landing", () => {
  test('/band links to the stage in walk mode', async ({ page }) => {
    const base = process.env.APP_BASE_PATH ?? '';
    await page.goto(`${base}/band/`);
    const link = page.getByRole('link', {
      name: 'See them live in Chattanooga',
    });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', `${base}${STAGE_PATH}`);
  });

  test('the deep link arrives beside the stage with its controls', async ({
    page,
  }) => {
    const base = process.env.APP_BASE_PATH ?? '';
    await page.goto(`${base}${STAGE_PATH}`);
    await page
      .locator('canvas')
      .first()
      .waitFor({ state: 'attached', timeout: 30_000 });

    const hasWebGL = await page.evaluate(() => {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    });
    // Kept skip (#792): Firefox's Playwright build has no WebGL on CI; chromium and webkit run this.
    test.skip(
      !hasWebGL,
      'no WebGL in this browser (see #288) — the scene cannot produce the meshes walk ' +
        'mode is built from, so this would measure the runner rather than the app'
    );

    await expect(
      page.locator('[data-stance]').first(),
      'the stage deep link never reached walk mode (#723)'
    ).toBeVisible({ timeout: WALK_ENGAGE_MS });

    const play = page.getByRole('button', { name: 'Play the set' });
    await expect(
      play,
      'walk mode engaged but the stage controls never showed: the stage was not ' +
        'placed, or the walker spawned more than NEAR_STAGE_M from it'
    ).toBeVisible({ timeout: 30_000 });

    await play.click();
    await expect(
      page.getByRole('button', { name: 'Pause the set' })
    ).toBeVisible();
    const mute = page.getByRole('button', { name: 'Mute band' });
    await expect(mute).toHaveAttribute('aria-pressed', 'false');
    await mute.click();
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
  });
});
