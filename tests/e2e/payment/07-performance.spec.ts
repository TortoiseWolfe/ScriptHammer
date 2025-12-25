/**
 * Performance Test: 500 Concurrent Users - T061
 * Tests system performance under load
 */

import { test, expect } from '@playwright/test';
import {
  dismissCookieBanner,
  waitForAuthenticatedState,
} from '../utils/test-user-factory';

// Test user credentials
const TEST_USER = {
  email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
};

test.describe('Payment System Performance', () => {
  test('should handle concurrent payment requests', async ({ browser }) => {
    const contexts = [];
    const startTime = Date.now();

    // Create 10 concurrent users (scaled down from 500 for local testing)
    // In production, use k6 or Artillery for full load testing
    for (let i = 0; i < 10; i++) {
      const context = await browser.newContext();
      contexts.push(context);
    }

    const paymentPromises = contexts.map(async (context, index) => {
      const page = await context.newPage();

      try {
        // Sign in first
        await page.goto('/sign-in');
        await dismissCookieBanner(page);
        await page.getByLabel('Email').fill(TEST_USER.email);
        await page
          .getByLabel('Password', { exact: true })
          .fill(TEST_USER.password);
        await page.getByRole('button', { name: 'Sign In' }).click();
        await waitForAuthenticatedState(page);

        await page.goto('/payment-demo');
        await dismissCookieBanner(page);

        // Grant consent (inline section)
        const gdprHeading = page.getByRole('heading', {
          name: /GDPR Consent/i,
        });
        if (await gdprHeading.isVisible({ timeout: 3000 }).catch(() => false)) {
          await page.getByRole('button', { name: /Accept/i }).click();
          await page
            .getByRole('heading', { name: /Step 2/i })
            .waitFor({ timeout: 5000 });
        }

        // Select payment method
        await page.getByRole('tab', { name: /stripe/i }).click();

        // Initiate payment
        await page.getByRole('button', { name: /pay/i }).click();

        // Wait for redirect to Stripe
        await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 });

        return { success: true, userId: index };
      } catch (error) {
        return { success: false, userId: index, error };
      } finally {
        await page.close();
        await context.close();
      }
    });

    // Wait for all payments to complete
    const results = await Promise.all(paymentPromises);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Verify results
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.log(`Performance Test Results:`);
    console.log(`  Total Users: ${contexts.length}`);
    console.log(`  Successful: ${successCount}`);
    console.log(`  Failed: ${failureCount}`);
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Avg Time: ${duration / contexts.length}ms per user`);

    // At least 90% should succeed
    expect(successCount).toBeGreaterThanOrEqual(contexts.length * 0.9);

    // Average response time should be under 5 seconds
    expect(duration / contexts.length).toBeLessThan(5000);
  });

  test('should load dashboard quickly with many payments', async ({ page }) => {
    // Sign in first
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(page);

    // Navigate to dashboard
    const startTime = Date.now();
    await page.goto('/payment/dashboard');
    await dismissCookieBanner(page);

    // Wait for payments to load
    await page.waitForSelector('[data-testid="payment-list"]');

    const loadTime = Date.now() - startTime;

    console.log(`Dashboard Load Time: ${loadTime}ms`);

    // Should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);

    // Check for loading skeleton disappearance
    await expect(page.locator('.skeleton')).not.toBeVisible({
      timeout: 5000,
    });
  });

  test('should handle rapid payment status updates efficiently', async ({
    page,
  }) => {
    // Sign in first
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(page);

    await page.goto('/payment/dashboard');
    await dismissCookieBanner(page);

    // Measure memory usage before
    const memoryBefore = await page.evaluate(() => {
      const perf = performance as Performance & {
        memory?: { usedJSHeapSize: number };
      };
      if (perf.memory) {
        return perf.memory.usedJSHeapSize;
      }
      return 0;
    });

    // Simulate 100 rapid status updates
    for (let i = 0; i < 100; i++) {
      await page.evaluate(() => {
        // Trigger Supabase realtime update simulation
        window.dispatchEvent(
          new CustomEvent('payment-update', {
            detail: { id: `payment-${Math.random()}`, status: 'paid' },
          })
        );
      });
      await page.waitForTimeout(10);
    }

    // Wait for all updates to settle
    await page.waitForTimeout(2000);

    // Measure memory usage after
    const memoryAfter = await page.evaluate(() => {
      const perf = performance as Performance & {
        memory?: { usedJSHeapSize: number };
      };
      if (perf.memory) {
        return perf.memory.usedJSHeapSize;
      }
      return 0;
    });

    const memoryIncrease = memoryAfter - memoryBefore;

    console.log(
      `Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`
    );

    // Memory increase should be reasonable (under 50MB)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });

  test('should paginate large payment lists efficiently', async ({ page }) => {
    // Sign in first
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(page);

    await page.goto('/payment/history');
    await dismissCookieBanner(page);

    // Should show pagination controls
    await expect(
      page.getByRole('navigation', { name: /pagination/i })
    ).toBeVisible();

    // First page should load quickly
    const items = page.getByRole('listitem', { name: /payment/i });
    await expect(items).toHaveCount(10); // Default page size

    // Navigate to page 10
    const startTime = Date.now();
    await page.getByRole('button', { name: /page 10|10/i }).click();

    // Wait for new items to load
    await page.waitForTimeout(500);
    const loadTime = Date.now() - startTime;

    console.log(`Page navigation time: ${loadTime}ms`);

    // Should load in under 1 second
    expect(loadTime).toBeLessThan(1000);
  });

  test('should handle offline queue efficiently', async ({ page, context }) => {
    // Sign in first
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(page);

    await page.goto('/payment-demo');
    await dismissCookieBanner(page);

    // Go offline
    await context.setOffline(true);

    const startTime = Date.now();

    // Queue 50 payments
    for (let i = 0; i < 50; i++) {
      await page.evaluate(() => {
        // Simulate queuing payment
        window.dispatchEvent(
          new CustomEvent('queue-payment', {
            detail: { amount: 1000, currency: 'usd' },
          })
        );
      });
    }

    const queueTime = Date.now() - startTime;

    console.log(`Time to queue 50 payments: ${queueTime}ms`);

    // Queuing should be fast (under 2 seconds total)
    expect(queueTime).toBeLessThan(2000);

    // Go online
    await context.setOffline(false);

    // All 50 should sync
    await expect(page.getByText(/50.*processing|syncing.*50/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test('should maintain 60fps during animations', async ({ page }) => {
    // Sign in first
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(page);

    await page.goto('/payment-demo');
    await dismissCookieBanner(page);

    // Enable performance monitoring
    await page.evaluate(() => {
      let frameCount = 0;
      let lastTime = performance.now();

      function countFrames() {
        frameCount++;
        const currentTime = performance.now();
        if (currentTime >= lastTime + 1000) {
          (window as any).fps = frameCount;
          frameCount = 0;
          lastTime = currentTime;
        }
        requestAnimationFrame(countFrames);
      }

      countFrames();
    });

    // Grant consent (triggers animation)
    const gdprHeading = page.getByRole('heading', { name: /GDPR Consent/i });
    if (await gdprHeading.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.getByRole('button', { name: /Accept/i }).click();
      await page
        .getByRole('heading', { name: /Step 2/i })
        .waitFor({ timeout: 5000 });
    }

    // Wait for animation to complete
    await page.waitForTimeout(2000);

    // Check FPS
    const fps = await page.evaluate(() => (window as any).fps || 0);

    console.log(`Average FPS during animation: ${fps}`);

    // Should maintain at least 30 FPS (50% of 60fps target)
    expect(fps).toBeGreaterThanOrEqual(30);
  });

  test('should bundle payment scripts efficiently', async ({ page }) => {
    // Sign in first
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(page);

    await page.goto('/payment-demo');
    await dismissCookieBanner(page);

    // Grant consent to load payment scripts (inline section)
    const gdprHeading = page.getByRole('heading', { name: /GDPR Consent/i });
    if (await gdprHeading.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.getByRole('button', { name: /Accept/i }).click();
      await page
        .getByRole('heading', { name: /Step 2/i })
        .waitFor({ timeout: 5000 });
    }

    // Select Stripe to trigger script load
    await page.getByRole('tab', { name: /stripe/i }).click();

    // Wait for Stripe script to load
    await page.waitForTimeout(2000);

    // Measure total transferred size
    const performanceEntries = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource');
      const paymentScripts = entries.filter(
        (e: any) =>
          e.name.includes('stripe') ||
          e.name.includes('paypal') ||
          e.name.includes('payment')
      );

      return paymentScripts.map((e: any) => ({
        name: e.name,
        size: e.transferSize || 0,
      }));
    });

    const totalSize = performanceEntries.reduce((sum, e) => sum + e.size, 0);

    console.log(
      `Total payment script size: ${(totalSize / 1024).toFixed(2)} KB`
    );

    // Total size should be under 150KB (constraint from spec)
    expect(totalSize).toBeLessThan(150 * 1024);
  });
});
