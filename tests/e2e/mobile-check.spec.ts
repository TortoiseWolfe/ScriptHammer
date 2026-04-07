import { test, devices } from '@playwright/test';
import { dismissCookieBanner } from './utils/test-user-factory';

// Strip defaultBrowserType + isMobile (Firefox doesn't support isMobile)
const {
  defaultBrowserType: _dbt,
  isMobile: _im,
  ...iPhone12Config
} = devices['iPhone 12'];

test('mobile status check', async ({ browser }) => {
  const context = await browser.newContext(iPhone12Config);
  const page = await context.newPage();
  await page.goto('http://localhost:3000/status');
  await dismissCookieBanner(page);
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: 'mobile-check.png',
    fullPage: true,
  });
  await context.close();
});
