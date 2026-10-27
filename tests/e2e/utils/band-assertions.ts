/**
 * Shared checks for the /band page (#1408), used by the root spec and the
 * basePath spec so the two cannot drift apart.
 */
import { expect, type Page } from '@playwright/test';

/** Every host a tracker on this site talks to. */
export const TRACKER_HOSTS =
  /googletagmanager\.com|google-analytics\.com|analytics\.google\.com|bzrcdn\.openai\.com|sentry\.io|sentry-cdn\.com/i;

/** Collects request URLs to tracker hosts from now on. */
export function watchTrackers(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (req) => {
    if (TRACKER_HOSTS.test(req.url())) seen.push(req.url());
  });
  return seen;
}

/** The MP3 answers 200 as audio/mpeg, starts like an MP3, and (Chromium) loads metadata. */
export async function expectPlayableMp3(
  page: Page,
  path: string,
  browserName: string
): Promise<void> {
  const res = await page.request.get(path);
  expect(res.status(), path).toBe(200);
  expect(res.headers()['content-type'], path).toMatch(/audio\/mpeg/);
  const body = await res.body();
  expect(body.length, 'a real file, not a stub').toBeGreaterThan(100_000);
  // An MP3 begins with an ID3 tag ("ID3") or a frame sync (0xFF 0xEx/0xFx).
  const isId3 = body.subarray(0, 3).toString('latin1') === 'ID3';
  const isFrame = body[0] === 0xff && (body[1] & 0xe0) === 0xe0;
  expect(isId3 || isFrame, 'MP3 header').toBe(true);

  // Decoding is a browser capability: Chromium's bundled build plays MP3 on
  // every runner, while a Linux Firefox/WebKit may lack the codec. Asserted
  // where it is guaranteed rather than skipped elsewhere.
  if (browserName === 'chromium') {
    const duration = await page.evaluate(
      (url) =>
        new Promise<number>((resolve, reject) => {
          const a = new Audio();
          a.preload = 'metadata';
          a.onloadedmetadata = () => resolve(a.duration);
          a.onerror = () => reject(new Error('audio failed to load'));
          a.src = url;
        }),
      path
    );
    expect(duration, `${path} duration`).toBeGreaterThan(5);
  }
}
