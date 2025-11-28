import { test, devices } from '@playwright/test';

test('mobile status check', async ({ browser }) => {
  const context = await browser.newContext({
    ...devices['iPhone 12'],
  });
  const page = await context.newPage();
  await page.goto('http://localhost:3000/status');
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: 'mobile-check.png',
    fullPage: true,
  });
  await context.close();
});
