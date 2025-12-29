import { test, expect } from '@playwright/test';
import * as path from 'path';

// Wireframes array - update this when wireframes are added/removed
// Currently empty - wireframes will be added by /wireframe command
const wireframes: { path: string; title: string }[] = [];

test.describe('Wireframe Viewer', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to viewer
    const indexPath = path.resolve(__dirname, 'index.html');
    await page.goto(`file://${indexPath}`);
  });

  test('loads without console errors', async ({ page }) => {
    // Wait for viewer to load
    await page.waitForSelector('#viewer');
    await page.waitForTimeout(500);

    // Check no errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('displays correct initial state (empty)', async ({ page }) => {
    // Check empty state
    await expect(page.locator('#current-info .title')).toHaveText('No wireframes yet');
    await expect(page.locator('#current-info .counter')).toHaveText('0 / 0');
  });

  // Navigation tests are skipped when no wireframes exist
  // They will be re-enabled when wireframes are added via /wireframe command
  test.describe('Navigation (requires wireframes)', () => {
    test.skip(wireframes.length === 0, 'No wireframes to test navigation');

    test('next button navigates forward', async ({ page }) => {
      const nextBtn = page.locator('#next');
      await nextBtn.click();
      await expect(page.locator('#current-info .counter')).toContainText('2 /');
      await expect(page.locator('#prev')).toBeEnabled();
    });

    test('previous button navigates backward', async ({ page }) => {
      await page.locator('#next').click();
      await page.locator('#prev').click();
      await expect(page.locator('#current-info .counter')).toContainText('1 /');
    });

    test('keyboard navigation works', async ({ page }) => {
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#current-info .counter')).toContainText('2 /');
      await page.keyboard.press('ArrowLeft');
      await expect(page.locator('#current-info .counter')).toContainText('1 /');
    });
  });
});

test.describe('Wireframe Screenshots', () => {
  test.skip(wireframes.length === 0, 'No wireframes to capture');

  test('captures all wireframes for visual review', async ({ page }) => {
    const indexPath = path.resolve(__dirname, 'index.html');
    await page.goto(`file://${indexPath}`);

    for (let i = 0; i < wireframes.length; i++) {
      const wf = wireframes[i];

      // Navigate via sidebar
      await page.click(`a[data-svg="${wf.path}"]`);

      // Wait for SVG to load
      await page.waitForTimeout(300);

      // Take screenshot
      const safeName = wf.path.replace(/\//g, '-').replace('.svg', '');
      await page.screenshot({
        path: `./screenshots/${safeName}.png`,
        fullPage: false,
      });
    }
  });
});

test.describe('SVG XML Validation', () => {
  test.skip(wireframes.length === 0, 'No wireframes to validate');

  test('all SVGs load without XML parsing errors', async ({ page }) => {
    const errors: string[] = [];

    // Listen for errors
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('XML')) {
        errors.push(msg.text());
      }
    });

    const indexPath = path.resolve(__dirname, 'index.html');
    await page.goto(`file://${indexPath}`);

    // Navigate through all wireframes
    for (let i = 0; i < wireframes.length; i++) {
      const wf = wireframes[i];
      await page.click(`a[data-svg="${wf.path}"]`);
      await page.waitForTimeout(200);
    }

    // No XML errors should have occurred
    expect(errors).toHaveLength(0);
  });
});
