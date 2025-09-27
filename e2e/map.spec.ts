import { test, expect, type Page } from '@playwright/test';

// Helper to mock geolocation
async function mockGeolocation(
  page: Page,
  latitude = 51.505,
  longitude = -0.09
) {
  await page.addInitScript(
    ({ lat, lng }) => {
      navigator.geolocation.getCurrentPosition = (success) => {
        setTimeout(() => {
          const mockPosition: GeolocationPosition = {
            coords: {
              latitude: lat,
              longitude: lng,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({ latitude: lat, longitude: lng, accuracy: 10 }),
            } as GeolocationCoordinates,
            timestamp: Date.now(),
            toJSON: () => ({
              coords: { latitude: lat, longitude: lng, accuracy: 10 },
              timestamp: Date.now(),
            }),
          };
          success(mockPosition);
        }, 100);
      };

      navigator.permissions.query = async (options: any) => {
        if (options.name === 'geolocation') {
          return { state: 'prompt' } as PermissionStatus;
        }
        throw new Error('Permission not found');
      };
    },
    { lat: latitude, lng: longitude }
  );
}

test.describe('Geolocation Map Page', () => {
  test.beforeEach(async ({ page }) => {
    // Clear all cookies and localStorage
    await page.context().clearCookies();
    await page.goto('/map');
    await page.evaluate(() => localStorage.clear());
  });

  test('should load map page successfully', async ({ page }) => {
    await page.goto('/map');

    // Map container should be visible
    await expect(page.locator('[data-testid="map-container"]')).toBeVisible();

    // Map should have tiles loaded
    await expect(page.locator('.leaflet-tile-container')).toBeVisible();

    // Controls should be present
    await expect(page.locator('.leaflet-control-zoom')).toBeVisible();
  });

  test('should display location button when showUserLocation is enabled', async ({
    page,
  }) => {
    await page.goto('/map');

    // Location button should be visible
    const locationButton = page.getByRole('button', { name: /location/i });
    await expect(locationButton).toBeVisible();
  });

  test('should show consent modal on first location request', async ({
    page,
  }) => {
    await mockGeolocation(page);
    await page.goto('/map');

    // Click location button
    const locationButton = page.getByRole('button', { name: /location/i });
    await locationButton.click();

    // Consent modal should appear
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByText(/would like to use your location/i)
    ).toBeVisible();
  });

  test('should get user location after accepting consent', async ({ page }) => {
    await mockGeolocation(page);
    await page.goto('/map');

    // Request location
    const locationButton = page.getByRole('button', { name: /location/i });
    await locationButton.click();

    // Accept consent
    const acceptButton = page.getByRole('button', { name: /accept/i });
    await acceptButton.click();

    // Wait for location marker
    await expect(
      page.locator('[data-testid="user-location-marker"]')
    ).toBeVisible();

    // Map should center on user location
    await page.waitForTimeout(1000); // Wait for animation
    const mapCenter = await page.evaluate(() => {
      const map = (window as any).leafletMap;
      if (map) {
        const center = map.getCenter();
        return { lat: center.lat, lng: center.lng };
      }
      return null;
    });

    expect(mapCenter).toBeTruthy();
    expect(mapCenter?.lat).toBeCloseTo(51.505, 2);
    expect(mapCenter?.lng).toBeCloseTo(-0.09, 2);
  });

  test('should handle location permission denial', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (success, error) => {
        error?.({
          code: 1,
          message: 'User denied geolocation',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      };

      navigator.permissions.query = async () =>
        ({ state: 'prompt' }) as PermissionStatus;
    });

    await page.goto('/map');

    // Request location
    const locationButton = page.getByRole('button', { name: /location/i });
    await locationButton.click();

    // Accept consent (but browser will deny)
    const acceptButton = page.getByRole('button', { name: /accept/i });
    await acceptButton.click();

    // Should show error state
    await expect(page.getByText(/location blocked/i)).toBeVisible();
    await expect(locationButton).toBeDisabled();
  });

  test('should remember consent decision', async ({ page }) => {
    await mockGeolocation(page);
    await page.goto('/map');

    // First visit - accept consent
    let locationButton = page.getByRole('button', { name: /location/i });
    await locationButton.click();

    const acceptButton = page.getByRole('button', { name: /accept/i });
    await acceptButton.click();

    // Wait for location
    await expect(
      page.locator('[data-testid="user-location-marker"]')
    ).toBeVisible();

    // Refresh page
    await page.reload();

    // Should not show consent modal again
    locationButton = page.getByRole('button', { name: /location/i });
    await locationButton.click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(
      page.locator('[data-testid="user-location-marker"]')
    ).toBeVisible();
  });

  test('should display custom markers', async ({ page }) => {
    await page.goto('/map?markers=true');

    // Custom markers should be visible
    const markers = page.locator('.leaflet-marker-icon');
    await expect(markers).toHaveCount(2); // Assuming 2 test markers
  });

  test('should show marker popups on click', async ({ page }) => {
    await page.goto('/map?markers=true');

    // Click first marker
    const firstMarker = page.locator('.leaflet-marker-icon').first();
    await firstMarker.click();

    // Popup should appear
    await expect(page.locator('.leaflet-popup')).toBeVisible();
    await expect(page.locator('.leaflet-popup-content')).toContainText(
      'Test Marker'
    );
  });

  test('should handle map zoom controls', async ({ page }) => {
    await page.goto('/map');

    // Get initial zoom
    const initialZoom = await page.evaluate(() => {
      const map = (window as any).leafletMap;
      return map?.getZoom();
    });

    // Zoom in
    await page.locator('.leaflet-control-zoom-in').click();
    await page.waitForTimeout(500);

    const zoomedInLevel = await page.evaluate(() => {
      const map = (window as any).leafletMap;
      return map?.getZoom();
    });

    expect(zoomedInLevel).toBe(initialZoom + 1);

    // Zoom out
    await page.locator('.leaflet-control-zoom-out').click();
    await page.waitForTimeout(500);

    const zoomedOutLevel = await page.evaluate(() => {
      const map = (window as any).leafletMap;
      return map?.getZoom();
    });

    expect(zoomedOutLevel).toBe(initialZoom);
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('/map');

    // Focus on map
    await page.locator('[data-testid="map-container"]').focus();

    // Test keyboard shortcuts
    await page.keyboard.press('+'); // Zoom in
    await page.waitForTimeout(500);

    const zoomedIn = await page.evaluate(() => {
      const map = (window as any).leafletMap;
      return map?.getZoom();
    });

    expect(zoomedIn).toBeGreaterThan(13); // Default zoom is 13

    await page.keyboard.press('-'); // Zoom out
    await page.waitForTimeout(500);

    const zoomedOut = await page.evaluate(() => {
      const map = (window as any).leafletMap;
      return map?.getZoom();
    });

    expect(zoomedOut).toBe(13);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/map');

    // Map should be visible
    await expect(page.locator('[data-testid="map-container"]')).toBeVisible();

    // Controls should be accessible
    await expect(page.locator('.leaflet-control-zoom')).toBeVisible();

    // Location button should be visible
    const locationButton = page.getByRole('button', { name: /location/i });
    await expect(locationButton).toBeVisible();
  });

  test('should handle map pan gestures', async ({ page }) => {
    await page.goto('/map');

    // Get initial center
    const initialCenter = await page.evaluate(() => {
      const map = (window as any).leafletMap;
      const center = map?.getCenter();
      return center ? { lat: center.lat, lng: center.lng } : null;
    });

    // Simulate drag gesture
    const mapContainer = page.locator('[data-testid="map-container"]');
    await mapContainer.dragTo(mapContainer, {
      sourcePosition: { x: 200, y: 200 },
      targetPosition: { x: 100, y: 100 },
    });

    await page.waitForTimeout(500);

    // Center should have changed
    const newCenter = await page.evaluate(() => {
      const map = (window as any).leafletMap;
      const center = map?.getCenter();
      return center ? { lat: center.lat, lng: center.lng } : null;
    });

    expect(newCenter).toBeTruthy();
    expect(newCenter?.lat).not.toBe(initialCenter?.lat);
    expect(newCenter?.lng).not.toBe(initialCenter?.lng);
  });

  test('should work offline with cached tiles', async ({ page, context }) => {
    await page.goto('/map');

    // Load some tiles
    await page.locator('.leaflet-control-zoom-in').click();
    await page.waitForTimeout(1000);

    // Go offline
    await context.setOffline(true);

    // Refresh page
    await page.reload();

    // Map should still load
    await expect(page.locator('[data-testid="map-container"]')).toBeVisible();

    // Cached tiles should be visible
    await expect(page.locator('.leaflet-tile')).toBeVisible();
  });

  test('should handle dark mode theme', async ({ page }) => {
    // Set dark theme
    await page.goto('/map');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    // Map should adapt to dark theme
    const controlBackground = await page
      .locator('.leaflet-control')
      .evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

    expect(controlBackground).toContain('rgba(0, 0, 0'); // Dark background
  });

  test('should display accuracy circle when available', async ({ page }) => {
    await mockGeolocation(page);
    await page.goto('/map?showAccuracy=true');

    // Request location
    const locationButton = page.getByRole('button', { name: /location/i });
    await locationButton.click();

    // Accept consent
    const acceptButton = page.getByRole('button', { name: /accept/i });
    await acceptButton.click();

    // Accuracy circle should be visible
    await expect(page.locator('[data-testid="accuracy-circle"]')).toBeVisible();
  });

  test('should handle rapid location updates', async ({ page }) => {
    await page.addInitScript(() => {
      let count = 0;
      navigator.geolocation.watchPosition = (success) => {
        const interval = setInterval(() => {
          count++;
          const mockPosition: GeolocationPosition = {
            coords: {
              latitude: 51.505 + count * 0.001,
              longitude: -0.09 + count * 0.001,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({
                latitude: 51.505 + count * 0.001,
                longitude: -0.09 + count * 0.001,
                accuracy: 10,
              }),
            } as GeolocationCoordinates,
            timestamp: Date.now(),
            toJSON: () => ({
              coords: {
                latitude: 51.505 + count * 0.001,
                longitude: -0.09 + count * 0.001,
                accuracy: 10,
              },
              timestamp: Date.now(),
            }),
          };
          success(mockPosition);

          if (count >= 5) clearInterval(interval);
        }, 500);

        return count;
      };
    });

    await page.goto('/map?watch=true');

    // Start watching location
    const locationButton = page.getByRole('button', { name: /location/i });
    await locationButton.click();

    // Accept consent
    const acceptButton = page.getByRole('button', { name: /accept/i });
    await acceptButton.click();

    // Wait for updates
    await page.waitForTimeout(3000);

    // Location should have updated multiple times
    const finalPosition = await page.evaluate(() => {
      const marker = document.querySelector(
        '[data-testid="user-location-marker"]'
      );
      return marker?.getAttribute('data-position');
    });

    expect(finalPosition).toBeTruthy();
    const parsed = JSON.parse(finalPosition!);
    expect(parsed[0]).toBeGreaterThan(51.505); // Should have moved
  });

  test('should handle accessibility requirements', async ({ page }) => {
    await page.goto('/map');

    // Check ARIA labels
    const mapContainer = page.locator('[data-testid="map-container"]');
    await expect(mapContainer).toHaveAttribute('role', 'application');
    await expect(mapContainer).toHaveAttribute(
      'aria-label',
      /interactive map/i
    );

    // Check keyboard accessibility
    const zoomIn = page.locator('.leaflet-control-zoom-in');
    await expect(zoomIn).toHaveAttribute('aria-label', /zoom in/i);

    const zoomOut = page.locator('.leaflet-control-zoom-out');
    await expect(zoomOut).toHaveAttribute('aria-label', /zoom out/i);

    // Check focus management
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(
      () => document.activeElement?.className
    );
    expect(focusedElement).toBeTruthy();
  });
});
