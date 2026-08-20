import { test, expect, devices } from '@playwright/test';
import { dismissCookieBanner } from './utils/test-user-factory';

// Strip defaultBrowserType + isMobile (Firefox doesn't support isMobile)
const {
  defaultBrowserType: _dbt,
  isMobile: _im,
  ...iPhone12Config
} = devices['iPhone 12'];

test('mobile status check', async ({ browser, baseURL }) => {
  const context = await browser.newContext(iPhone12Config);
  const page = await context.newPage();

  // `baseURL`, not a hardcoded `http://localhost:3000` (#396). The literal URL
  // happens to match CI today, so this never broke — but it silently ignores
  // BASE_URL, so the spec would screenshot the wrong origin anywhere else, and a
  // basePath deployment would hand it a 404 without complaining.
  const response = await page.goto(
    `${baseURL ?? 'http://localhost:3000'}/status`
  );
  await dismissCookieBanner(page);
  await page.waitForLoadState('networkidle');

  await page.screenshot({
    path: 'mobile-check.png',
    fullPage: true,
  });

  // ASSERT SOMETHING (#396). This spec navigated, screenshotted and returned — it
  // could not fail, and the screenshot it writes is gitignored and read by nobody,
  // so a shot of a 404 or a blank page looked exactly like success. It runs on all
  // three engines on every shard.
  expect(response?.status(), 'the status page did not load').toBeLessThan(400);
  await expect(
    page.getByRole('heading', { level: 1 }),
    'no <h1> rendered — the screenshot would be of an error page'
  ).toBeVisible();

  await context.close();
});
