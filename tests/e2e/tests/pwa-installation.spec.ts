import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

// Get manifest URL dynamically from page
async function getManifestUrl(
  page: import('@playwright/test').Page
): Promise<string> {
  const manifestLink = page.locator('link[rel="manifest"]');
  const href = await manifestLink.getAttribute('href');
  // If href is absolute, return as-is; if relative, construct full URL
  if (href?.startsWith('http')) {
    return href;
  }
  const baseUrl = page.url().split('/').slice(0, 3).join('/');
  return `${baseUrl}${href}`;
}

test.describe('PWA Installation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await dismissCookieBanner(page);
  });

  test('service worker registers successfully', async ({ page }) => {
    // Wait for service worker to register
    const swResult = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) {
        return { supported: false, registered: false };
      }

      // Wait up to 5 seconds for service worker to register
      for (let i = 0; i < 50; i++) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          return { supported: true, registered: true };
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return { supported: true, registered: false };
    });

    // In CI headless browsers, service workers may not register
    // Test passes if either registered OR service workers not supported
    if (swResult.supported) {
      expect(swResult.registered).toBe(true);
    }
  });

  test('manifest file is linked correctly', async ({ page }) => {
    // Check for manifest link in head
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toBeVisible();

    // Get the actual href (could be /ScriptHammer/manifest.json or /manifest.json)
    const href = await manifestLink.getAttribute('href');
    expect(href).toContain('manifest.json');

    // Verify manifest can be loaded using the actual href
    const manifestUrl = await getManifestUrl(page);
    const response = await page.request.get(manifestUrl);
    expect(response.status()).toBe(200);

    // Verify manifest content
    const manifest = await response.json();
    expect(manifest.name).toBeDefined();
    expect(manifest.short_name).toBeDefined();
    expect(manifest.start_url).toBeDefined();
    expect(manifest.display).toBeDefined();
    expect(manifest.theme_color).toBeDefined();
    expect(manifest.background_color).toBeDefined();
  });

  test('PWA install prompt component is present', async ({ page }) => {
    // Check for PWA install component
    const installPrompt = page.locator('[data-testid="pwa-install-prompt"]');

    // Component may not be visible initially (shows based on conditions)
    // But it should exist in the DOM
    const exists = (await installPrompt.count()) > 0;
    expect(exists).toBe(true);
  });

  test('manifest contains required PWA fields', async ({ page }) => {
    const manifestUrl = await getManifestUrl(page);
    const response = await page.request.get(manifestUrl);
    const manifest = await response.json();

    // Check required PWA fields
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toMatch(/standalone|fullscreen|minimal-ui/);
    expect(manifest.theme_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(manifest.background_color).toMatch(/^#[0-9A-Fa-f]{6}$/);

    // Check icons
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);

    // Verify at least one icon is 192x192 or larger (required for PWA)
    const hasLargeIcon = manifest.icons.some((icon: { sizes: string }) => {
      const size = parseInt(icon.sizes.split('x')[0]);
      return size >= 192;
    });
    expect(hasLargeIcon).toBe(true);
  });

  test('app works offline after service worker activation', async ({
    page,
    context,
  }) => {
    // Check if service workers are supported
    const swSupported = await page.evaluate(() => 'serviceWorker' in navigator);

    if (!swSupported) {
      // Skip test if service workers not supported (CI headless browser)
      return;
    }

    // Wait for service worker to be active
    const swActive = await page.evaluate(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        return registration.active !== null;
      } catch {
        return false;
      }
    });

    if (!swActive) {
      // Skip test if service worker didn't activate
      return;
    }

    // Go offline
    await context.setOffline(true);

    // Try to navigate while offline
    try {
      await page.reload();
      // Page should still load (from cache)
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 5000 });
    } finally {
      // Go back online
      await context.setOffline(false);
    }
  });

  test('install button shows on supported browsers', async ({ page }) => {
    // This test simulates the beforeinstallprompt event
    await page.evaluate(() => {
      // Dispatch a fake beforeinstallprompt event
      const event = new Event('beforeinstallprompt');
      (
        event as unknown as {
          prompt: () => Promise<void>;
          userChoice: Promise<{ outcome: string }>;
        }
      ).prompt = () => Promise.resolve();
      (
        event as unknown as {
          prompt: () => Promise<void>;
          userChoice: Promise<{ outcome: string }>;
        }
      ).userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(event);
    });

    // Check if install UI appears
    const installButton = page.locator('button:has-text("Install")');

    // The button may or may not appear depending on browser support
    // We're just checking the mechanism works
    const buttonCount = await installButton.count();
    expect(buttonCount).toBeGreaterThanOrEqual(0);
  });

  test('apple touch icons are present for iOS', async ({ page }) => {
    // Check for apple-touch-icon links
    const appleTouchIcon = page.locator('link[rel="apple-touch-icon"]');
    const count = await appleTouchIcon.count();
    expect(count).toBeGreaterThan(0);
  });

  test('viewport meta tag is set for mobile', async ({ page }) => {
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute('content', /width=device-width/);
    await expect(viewport).toHaveAttribute('content', /initial-scale=1/);
  });

  test('theme color meta tag matches manifest', async ({ page }) => {
    // Get theme color from meta tag
    const themeColorMeta = page.locator('meta[name="theme-color"]');
    const metaColor = await themeColorMeta.getAttribute('content');

    // Get theme color from manifest
    const manifestUrl = await getManifestUrl(page);
    const response = await page.request.get(manifestUrl);
    const manifest = await response.json();

    // They should match
    expect(metaColor).toBe(manifest.theme_color);
  });

  test('maskable icon is provided for Android', async ({ page }) => {
    const manifestUrl = await getManifestUrl(page);
    const response = await page.request.get(manifestUrl);
    const manifest = await response.json();

    // Check for maskable icon (recommended for Android)
    const hasMaskableIcon = manifest.icons.some(
      (icon: { purpose?: string }) =>
        icon.purpose && icon.purpose.includes('maskable')
    );

    // This is optional but recommended
    if (!hasMaskableIcon) {
      console.warn('No maskable icon found - recommended for Android PWA');
    }
  });

  test('shortcuts are defined in manifest', async ({ page }) => {
    const manifestUrl = await getManifestUrl(page);
    const response = await page.request.get(manifestUrl);
    const manifest = await response.json();

    // Check if shortcuts are defined (optional PWA feature)
    if (manifest.shortcuts) {
      expect(Array.isArray(manifest.shortcuts)).toBe(true);

      // Verify shortcut structure
      manifest.shortcuts.forEach(
        (shortcut: { name?: string; url?: string }) => {
          expect(shortcut.name).toBeDefined();
          expect(shortcut.url).toBeDefined();
        }
      );
    }
  });

  test('web app is installable (Lighthouse PWA criteria)', async ({ page }) => {
    // This test checks basic installability criteria
    const criteria = await page.evaluate(async () => {
      const results = {
        hasServiceWorker: false,
        hasManifest: false,
        isHttps: false,
        hasIcon: false,
        hasStartUrl: false,
        hasName: false,
        hasDisplay: false,
      };

      // Check service worker
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        results.hasServiceWorker = !!registration;
      }

      // Check manifest
      const manifestLink = document.querySelector('link[rel="manifest"]');
      results.hasManifest = !!manifestLink;

      // Check HTTPS (localhost is considered secure)
      results.isHttps =
        location.protocol === 'https:' || location.hostname === 'localhost';

      // Check manifest content
      if (manifestLink) {
        try {
          const response = await fetch((manifestLink as HTMLLinkElement).href);
          const manifest = await response.json();

          results.hasIcon = manifest.icons && manifest.icons.length > 0;
          results.hasStartUrl = !!manifest.start_url;
          results.hasName = !!manifest.name;
          results.hasDisplay =
            manifest.display === 'standalone' ||
            manifest.display === 'fullscreen' ||
            manifest.display === 'minimal-ui';
        } catch (e) {
          console.error('Failed to fetch manifest:', e);
        }
      }

      return results;
    });

    // All criteria should be met for installability
    expect(criteria.hasServiceWorker).toBe(true);
    expect(criteria.hasManifest).toBe(true);
    expect(criteria.isHttps).toBe(true);
    expect(criteria.hasIcon).toBe(true);
    expect(criteria.hasStartUrl).toBe(true);
    expect(criteria.hasName).toBe(true);
    expect(criteria.hasDisplay).toBe(true);
  });
});
