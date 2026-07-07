// PWA Test Utilities for offline functionality testing
// These utilities help verify PWA features are working correctly

import { createLogger } from '@/lib/logger';

const logger = createLogger('utils:pwa-test');

export interface PWATestResult {
  feature: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: unknown;
}

export class PWATester {
  private results: PWATestResult[] = [];
  private readonly TEST_TIMEOUT = 5000; // 5 second timeout for each test

  // Wrapper to add timeout to any async test
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number = this.TEST_TIMEOUT
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Test timeout')), timeoutMs)
      ),
    ]);
  }

  // Test if service worker is registered
  async testServiceWorker(): Promise<PWATestResult> {
    try {
      return await this.withTimeout(this._testServiceWorker());
    } catch (error) {
      if (error instanceof Error && error.message === 'Test timeout') {
        return {
          feature: 'Service Worker Registration',
          status: 'fail',
          message: 'Test timed out - Service Worker may be unresponsive',
        };
      }
      return {
        feature: 'Service Worker Registration',
        status: 'fail',
        message: `Error: ${error}`,
      };
    }
  }

  private async _testServiceWorker(): Promise<PWATestResult> {
    try {
      if (!('serviceWorker' in navigator)) {
        return {
          feature: 'Service Worker Support',
          status: 'fail',
          message: 'Service Worker API not supported in this browser',
        };
      }

      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        return {
          feature: 'Service Worker Registration',
          status: 'pass',
          message: 'Service Worker is registered and active',
          details: {
            scope: registration.scope,
            active: registration.active?.state,
            waiting: registration.waiting?.state,
            installing: registration.installing?.state,
          },
        };
      } else {
        return {
          feature: 'Service Worker Registration',
          status: 'fail',
          message: 'Service Worker is not registered',
        };
      }
    } catch (error) {
      return {
        feature: 'Service Worker Registration',
        status: 'fail',
        message: `Error checking Service Worker: ${error}`,
      };
    }
  }

  // Test if app is installable
  async testInstallability(): Promise<PWATestResult> {
    try {
      // Check if app is already installed
      const isStandalone = window.matchMedia(
        '(display-mode: standalone)'
      ).matches;
      if (isStandalone) {
        return {
          feature: 'PWA Installation',
          status: 'pass',
          message: 'App is installed and running in standalone mode',
        };
      }

      // Check for manifest
      const manifestLink = document.querySelector('link[rel="manifest"]');
      if (!manifestLink) {
        return {
          feature: 'PWA Installation',
          status: 'fail',
          message: 'No manifest link found in document',
        };
      }

      return {
        feature: 'PWA Installation',
        status: 'pass',
        message: 'App is installable (manifest present)',
        details: {
          manifestUrl: manifestLink.getAttribute('href'),
        },
      };
    } catch (error) {
      return {
        feature: 'PWA Installation',
        status: 'fail',
        message: `Error checking installability: ${error}`,
      };
    }
  }

  // Test offline capability
  async testOfflineCapability(): Promise<PWATestResult> {
    try {
      if (!('caches' in window)) {
        return {
          feature: 'Offline Capability',
          status: 'fail',
          message: 'Cache API not supported',
        };
      }

      const cacheNames = await caches.keys();
      const scripthammerCaches = cacheNames.filter((name) =>
        name.startsWith('scripthammer-')
      );

      if (scripthammerCaches.length === 0) {
        return {
          feature: 'Offline Capability',
          status: 'warning',
          message: 'No caches found - offline mode may not work',
        };
      }

      // Check cache contents
      const cache = await caches.open(scripthammerCaches[0]);
      const keys = await cache.keys();

      return {
        feature: 'Offline Capability',
        status: 'pass',
        message: `Offline cache active with ${keys.length} cached resources`,
        details: {
          cacheNames: scripthammerCaches,
          resourceCount: keys.length,
          sampleResources: keys.slice(0, 5).map((k) => k.url),
        },
      };
    } catch (error) {
      return {
        feature: 'Offline Capability',
        status: 'fail',
        message: `Error checking offline capability: ${error}`,
      };
    }
  }

  // Test background sync capability
  async testBackgroundSync(): Promise<PWATestResult> {
    try {
      return await this.withTimeout(this._testBackgroundSync(), 3000); // Shorter timeout for sync
    } catch (error) {
      if (error instanceof Error && error.message === 'Test timeout') {
        return {
          feature: 'Background Sync',
          status: 'warning',
          message: 'Test timed out - Background Sync may not be available',
        };
      }
      return {
        feature: 'Background Sync',
        status: 'fail',
        message: `Error: ${error}`,
      };
    }
  }

  private async _testBackgroundSync(): Promise<PWATestResult> {
    try {
      if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
        return {
          feature: 'Background Sync',
          status: 'warning',
          message: 'Background Sync API not supported',
        };
      }

      // Use getRegistration instead of ready to avoid hanging
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        return {
          feature: 'Background Sync',
          status: 'fail',
          message: 'No service worker registration found',
        };
      }

      // Try to register a sync event
      try {
        const syncReg = registration as ServiceWorkerRegistration & {
          sync?: { register: (tag: string) => Promise<void> };
        };
        if (syncReg.sync) {
          await syncReg.sync.register('test-sync');
        }
        return {
          feature: 'Background Sync',
          status: 'pass',
          message: 'Background Sync is available and working',
        };
      } catch {
        return {
          feature: 'Background Sync',
          status: 'warning',
          message:
            'Background Sync API present but registration failed (may need HTTPS)',
        };
      }
    } catch (error) {
      return {
        feature: 'Background Sync',
        status: 'fail',
        message: `Error testing background sync: ${error}`,
      };
    }
  }

  // Test push notification capability
  async testPushNotifications(): Promise<PWATestResult> {
    try {
      if (!('Notification' in window)) {
        return {
          feature: 'Push Notifications',
          status: 'fail',
          message: 'Notification API not supported',
        };
      }

      const permission = Notification.permission;

      if (permission === 'granted') {
        return {
          feature: 'Push Notifications',
          status: 'pass',
          message: 'Push notifications are enabled',
        };
      } else if (permission === 'denied') {
        return {
          feature: 'Push Notifications',
          status: 'warning',
          message: 'Push notifications are blocked by user',
        };
      } else {
        return {
          feature: 'Push Notifications',
          status: 'warning',
          message: 'Push notifications permission not yet requested',
          details: { currentPermission: permission },
        };
      }
    } catch (error) {
      return {
        feature: 'Push Notifications',
        status: 'fail',
        message: `Error testing push notifications: ${error}`,
      };
    }
  }

  // Run all tests
  async runAllTests(): Promise<PWATestResult[]> {
    this.results = [];

    this.results.push(await this.testServiceWorker());
    this.results.push(await this.testInstallability());
    this.results.push(await this.testOfflineCapability());
    this.results.push(await this.testBackgroundSync());
    this.results.push(await this.testPushNotifications());

    return this.results;
  }

  // Simulate offline mode
  async simulateOffline(): Promise<void> {
    if ('onLine' in navigator) {
      // Dispatch offline event
      window.dispatchEvent(new Event('offline'));
      logger.info('Simulated offline mode - dispatched offline event');
    }
  }

  // Simulate online mode
  async simulateOnline(): Promise<void> {
    if ('onLine' in navigator) {
      // Dispatch online event
      window.dispatchEvent(new Event('online'));
      logger.info('Simulated online mode - dispatched online event');
    }
  }

  // Clear all caches (useful for testing)
  async clearAllCaches(): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
      logger.info('Cleared caches', { count: cacheNames.length });
    }
  }

  // Get test summary
  getTestSummary(): {
    passed: number;
    failed: number;
    warnings: number;
    total: number;
  } {
    const passed = this.results.filter((r) => r.status === 'pass').length;
    const failed = this.results.filter((r) => r.status === 'fail').length;
    const warnings = this.results.filter((r) => r.status === 'warning').length;

    return {
      passed,
      failed,
      warnings,
      total: this.results.length,
    };
  }
}

// Export singleton instance for easy use
export const pwaTester = new PWATester();
