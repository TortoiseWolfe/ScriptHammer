/**
 * E2E: /band, the house band's free page (#1408).
 *
 * Also run under the `basepath` project (tests/e2e/basepath/band.spec.ts) so
 * every asset URL is proven to carry the GitHub Pages prefix.
 */
import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from './utils/test-user-factory';
import {
  expectPlayableMp3,
  watchTrackers,
  TRACKER_HOSTS,
} from './utils/band-assertions';

test.describe('/band (#1408)', () => {
  test('shows the band: seven cards, two players, no form', async ({
    page,
  }) => {
    await page.goto('/band/');
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /ScriptHammer, the house band/,
      })
    ).toBeVisible();
    await expect(page.getByTestId('band-member-card')).toHaveCount(7);
    await expect(page.getByTestId('song-player')).toHaveCount(4);
    // Every portrait actually loaded (a 404 leaves naturalWidth at 0). They are
    // lazy, so ask for them all first.
    await page
      .locator('[data-testid="band-member-card"] img')
      .evaluateAll((imgs) =>
        (imgs as HTMLImageElement[]).forEach((i) => (i.loading = 'eager'))
      );
    await page.waitForFunction(() =>
      Array.from(
        document.querySelectorAll<HTMLImageElement>(
          '[data-testid="band-member-card"] img'
        )
      ).every((i) => i.complete && i.naturalWidth > 0)
    );
    // Kid-safe: nothing a child could type into or leave the page through.
    await expect(
      page.locator('main form, main input, main textarea')
    ).toHaveCount(0);
    await expect(page.locator('main iframe')).toHaveCount(0);
  });

  test('the Halloween duet is up, with both singers named', async ({
    page,
  }) => {
    await page.goto('/band/');
    await expect(
      page.getByRole('heading', { level: 2, name: 'New for Halloween' })
    ).toBeVisible();
    const section = page.locator('section[aria-labelledby="halloween"]');
    await expect(section.getByTestId('song-player')).toHaveCount(2);
    await expect(section).toContainText('Ivory sings for the machines');
    await expect(section).toContainText('Chops sings against');
  });

  test('plays nothing until asked: audio does not autoplay or preload', async ({
    page,
  }) => {
    await page.goto('/band/');
    const audios = page.locator('audio');
    await expect(audios).toHaveCount(4);
    for (const el of await audios.all()) {
      await expect(el).toHaveAttribute('preload', 'none');
      await expect(el).not.toHaveAttribute('autoplay', /.*/);
      await expect(el).toHaveAttribute('controls', '');
      expect(await el.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
    }
  });

  test('every MP3 answers 200 as audio/mpeg and load', async ({
    page,
    browserName,
  }) => {
    await page.goto('/band/');
    for (const el of await page.locator('audio').all()) {
      const src = await el.getAttribute('src');
      expect(src, 'src goes through getAssetUrl').toMatch(
        /\/band\/audio\/band-wagon-(theme|hook|duet-1|duet-2)\.mp3$/
      );
      await expectPlayableMp3(page, src!, browserName);
    }
  });

  test('names the show, links the channel, ships the calendar file and the social text', async ({
    page,
    request,
  }) => {
    await page.goto('/band');
    const show = page.getByTestId('band-show');
    await expect(
      show.getByRole('heading', {
        level: 2,
        name: 'The Band Wagon: One Night Only, Every City on Earth',
      })
    ).toBeVisible();
    await expect(show).toContainText('LIVE Thursday 29 October');
    await expect(show).toContainText('REPLAY Saturday 31 October');
    await expect(
      show.getByRole('link', { name: 'twitch.tv/scripthammer' })
    ).toHaveAttribute('href', 'https://twitch.tv/scripthammer');
    await expect(show.getByTestId('show-city')).toHaveCount(8);

    const icsHref = await show
      .getByRole('link', { name: /calendar/i })
      .getAttribute('href');
    expect(icsHref).not.toBeNull();
    const ics = await request.get(icsHref as string);
    expect(ics.status()).toBe(200);
    expect(await ics.text()).toContain('DTSTART:20261029T220000Z');

    for (const name of ['og:description', 'twitter:description']) {
      const content = await page
        .locator(`meta[property="${name}"], meta[name="${name}"]`)
        .getAttribute('content');
      expect(content).toContain('The Band Wagon');
      expect(content).toContain('Thursday 29 October');
    }
  });

  test('says nothing is coming up once the replay is over', async ({
    page,
  }) => {
    // 2 Nov 2026, noon UTC: after the replay, before any real clock could matter.
    await page.clock.install({ time: new Date('2026-11-02T12:00:00Z') });
    await page.goto('/band');
    await expect(page.getByTestId('band-show')).toHaveAttribute(
      'data-state',
      'over'
    );
    await expect(page.getByTestId('band-show')).not.toContainText(
      /coming up|upcoming/i
    );
  });

  test('the two calls to action are plain links to /schedule and /pricing', async ({
    page,
  }) => {
    await page.goto('/band/');
    await expect(
      page.getByRole('link', { name: 'Book the band' })
    ).toHaveAttribute('href', /\/schedule\/?$/);
    await expect(
      page.getByRole('link', { name: 'Keep your site playing' })
    ).toHaveAttribute('href', /\/pricing\/?$/);
  });

  test('after accepting consent, a client-side arrival sends nothing to a tracker', async ({
    page,
  }) => {
    // Consent given on an ordinary page...
    await page.goto('/');
    await dismissCookieBanner(page);
    await page.goto('/credits/');
    // ...then a CLIENT-SIDE navigation (the credits page links to /band with a
    // Link) is the arrival that could carry a loaded tracker across.
    const seen = watchTrackers(page);
    await page.getByRole('link', { name: 'band page' }).click();
    await page.waitForURL(/\/band\/?$/);
    await expect(page.getByTestId('band-page')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    expect(seen, 'tracker requests on /band').toEqual([]);
    await expect(
      page.locator(
        'script[src*="googletagmanager"], script[src*="google-analytics"], script[src*="bzrcdn.openai.com"]'
      )
    ).toHaveCount(0);
  });

  test('a full-document load from the nav sends nothing either', async ({
    page,
  }) => {
    await page.goto('/');
    await dismissCookieBanner(page);
    const seen = watchTrackers(page);
    await page.getByRole('button', { name: 'Demos' }).click();
    await page.getByRole('menuitem', { name: 'Band' }).click();
    await page.waitForURL(/\/band\/?$/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    expect(seen.filter((u) => TRACKER_HOSTS.test(u))).toEqual([]);
  });
});
