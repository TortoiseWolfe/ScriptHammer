/**
 * E2E (basePath project): /band under the GitHub Pages prefix (#1408).
 *
 * Runs only under the `basepath` project, which serves a
 * NEXT_PUBLIC_BASE_PATH=/ScriptHammer build. Every portrait, cover and MP3 URL
 * is built with getAssetUrl, and this is where a missing prefix would show up
 * as a 404 that the root build can never produce.
 */
import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';
import { expectPlayableMp3, watchTrackers } from '../utils/band-assertions';

const BASE_PATH = '/ScriptHammer';

test.describe('/band under the base path (#1408)', () => {
  test('every /band asset carries the prefix and loads', async ({
    page,
    browserName,
  }) => {
    const failures: string[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/band/') && res.status() >= 400) {
        failures.push(`${res.status()} ${res.url()}`);
      }
    });
    await page.goto(`${BASE_PATH}/band/`);
    await expect(page.getByTestId('band-member-card')).toHaveCount(7);
    // Lazy portraits: ask for all of them so a bad prefix cannot hide below the fold.
    await page
      .locator('img')
      .evaluateAll((imgs) =>
        (imgs as HTMLImageElement[]).forEach((i) => (i.loading = 'eager'))
      );
    await page.waitForFunction(() =>
      Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0)
    );
    for (const src of await page
      .locator('img')
      .evaluateAll((imgs) =>
        (imgs as HTMLImageElement[]).map((i) => i.getAttribute('src'))
      )) {
      expect(src, 'img src').toContain(`${BASE_PATH}/band/`);
    }
    for (const el of await page.locator('audio').all()) {
      const src = await el.getAttribute('src');
      expect(src).toContain(`${BASE_PATH}/band/audio/`);
      await expectPlayableMp3(page, src!, browserName);
    }
    expect(failures).toEqual([]);
  });

  test('/HouseBand leads to /band under the prefix (#1416)', async ({
    page,
  }) => {
    await page.goto(`${BASE_PATH}/HouseBand/`);
    await page.waitForURL(/\/ScriptHammer\/band\/?$/);
    await expect(page.getByTestId('band-page')).toBeVisible();
  });

  test('consent given elsewhere still sends nothing to a tracker on /band', async ({
    page,
  }) => {
    await page.goto(`${BASE_PATH}/`);
    await dismissCookieBanner(page);
    await page.goto(`${BASE_PATH}/credits/`);
    const seen = watchTrackers(page);
    await page.getByRole('link', { name: 'band page' }).click();
    await page.waitForURL(/\/ScriptHammer\/band\/?$/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    expect(seen).toEqual([]);
  });
});
