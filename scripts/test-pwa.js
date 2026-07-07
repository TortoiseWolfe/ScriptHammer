#!/usr/bin/env node

/**
 * PWA Test Runner
 * Runs PWA tests using Playwright to verify service worker, caching, and offline functionality
 * This script runs INSIDE the Docker container
 */

const { chromium } = require('@playwright/test');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Parse command line arguments
const args = process.argv.slice(2);
const isProduction = args.includes('--production');
const verbose = args.includes('--verbose');

// Configuration
const testPort = process.env.TEST_PORT || '3000';
const config = {
  url: isProduction ? `http://localhost:${testPort}` : 'http://localhost:3000',
  timeout: 30000,
  headless: true,
};

/**
 * Format test result with color and icon
 */
function formatResult(result) {
  const icons = {
    pass: '✅',
    fail: '❌',
    warning: '⚠️',
  };

  const statusColors = {
    pass: colors.green,
    fail: colors.red,
    warning: colors.yellow,
  };

  const icon = icons[result.status] || '❓';
  const color = statusColors[result.status] || colors.reset;

  return `${icon} ${color}${result.feature}${colors.reset}: ${result.message}`;
}

/**
 * Print test summary
 */
function printSummary(summary, duration) {
  console.log('\n' + '='.repeat(50));
  console.log(`${colors.bright}PWA Test Summary${colors.reset}`);
  console.log('='.repeat(50));

  console.log(`${colors.green}✅ Passed: ${summary.passed}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${summary.failed}${colors.reset}`);
  console.log(
    `${colors.yellow}⚠️  Warnings: ${summary.warnings}${colors.reset}`
  );
  console.log(`${colors.cyan}📊 Total: ${summary.total}${colors.reset}`);
  console.log(`${colors.blue}⏱️  Duration: ${duration}ms${colors.reset}`);
  console.log('='.repeat(50));
}

/**
 * Main test runner
 */
async function runPWATests() {
  console.log(
    `${colors.bright}${colors.cyan}🚀 Starting PWA Tests${colors.reset}`
  );
  console.log(`Mode: ${isProduction ? 'Production Build' : 'Development'}`);
  console.log(`URL: ${config.url}\n`);

  let browser;
  let exitCode = 0;
  const startTime = Date.now();

  try {
    // Launch browser
    if (verbose) {
      console.log(`${colors.blue}Launching browser...${colors.reset}`);
    }

    browser = await chromium.launch({
      headless: config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // Required for Docker
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Set up console logging from the page
    if (verbose) {
      page.on('console', (msg) => {
        const type = msg.type();
        if (type === 'error') {
          console.error(
            `${colors.red}[Browser Console Error]${colors.reset}`,
            msg.text()
          );
        } else if (verbose) {
          console.log(`[Browser Console]`, msg.text());
        }
      });
    }

    // Navigate to the app
    if (verbose) {
      console.log(
        `${colors.blue}Navigating to ${config.url}...${colors.reset}`
      );
    }

    try {
      await page.goto(config.url, {
        waitUntil: 'networkidle',
        timeout: config.timeout,
      });
    } catch (error) {
      console.error(
        `${colors.red}❌ Failed to load application${colors.reset}`
      );
      console.error(`Error: ${error.message}`);
      console.error('\nMake sure the dev server is running:');
      console.error('  docker compose exec scripthammer pnpm run dev');
      process.exit(1);
    }

    // Wait longer for service worker to register (especially in dev mode)
    if (verbose) {
      console.log(
        `${colors.blue}Waiting for Service Worker registration...${colors.reset}`
      );
    }
    await page.waitForTimeout(5000); // Increased wait time

    // Execute PWA tests in the browser context
    if (verbose) {
      console.log(`${colors.blue}Running PWA tests...${colors.reset}\n`);
    }

    const results = await page.evaluate(async () => {
      // Check if pwaTester is available
      if (typeof window === 'undefined') {
        throw new Error('Window object not available');
      }

      // Import the PWA tester (it should be available via the app)
      // We'll execute the tests directly using the same logic
      const testResults = [];

      // Test 1: Service Worker (with retry logic)
      try {
        if (!('serviceWorker' in navigator)) {
          testResults.push({
            feature: 'Service Worker Support',
            status: 'fail',
            message: 'Service Worker API not supported',
          });
        } else {
          // Try multiple times to get registration (it may take time to register)
          let registration = null;
          let attempts = 0;
          const maxAttempts = 3;

          while (!registration && attempts < maxAttempts) {
            registration = await navigator.serviceWorker.getRegistration();
            if (!registration && attempts < maxAttempts - 1) {
              // Wait a bit before retrying
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
            attempts++;
          }

          if (registration) {
            testResults.push({
              feature: 'Service Worker Registration',
              status: 'pass',
              message: 'Service Worker is registered and active',
              details: {
                scope: registration.scope,
                active: registration.active?.state,
                attempts: attempts,
              },
            });
          } else {
            testResults.push({
              feature: 'Service Worker Registration',
              status: 'fail',
              message:
                'Service Worker is not registered after ' +
                attempts +
                ' attempts',
            });
          }
        }
      } catch (error) {
        testResults.push({
          feature: 'Service Worker Registration',
          status: 'fail',
          message: `Error: ${error.message}`,
        });
      }

      // Test 2: Installability
      try {
        const isStandalone = window.matchMedia(
          '(display-mode: standalone)'
        ).matches;
        const manifestLink = document.querySelector('link[rel="manifest"]');

        if (isStandalone) {
          testResults.push({
            feature: 'PWA Installation',
            status: 'pass',
            message: 'App is running in standalone mode',
          });
        } else if (manifestLink) {
          testResults.push({
            feature: 'PWA Installation',
            status: 'pass',
            message: 'App is installable (manifest present)',
            details: { manifestUrl: manifestLink.getAttribute('href') },
          });
        } else {
          testResults.push({
            feature: 'PWA Installation',
            status: 'fail',
            message: 'No manifest link found',
          });
        }
      } catch (error) {
        testResults.push({
          feature: 'PWA Installation',
          status: 'fail',
          message: `Error: ${error.message}`,
        });
      }

      // Test 3: Offline Capability
      try {
        if (!('caches' in window)) {
          testResults.push({
            feature: 'Offline Capability',
            status: 'fail',
            message: 'Cache API not supported',
          });
        } else {
          const cacheNames = await caches.keys();
          const scripthammerCaches = cacheNames.filter((name) =>
            name.startsWith('scripthammer-')
          );

          if (scripthammerCaches.length === 0) {
            testResults.push({
              feature: 'Offline Capability',
              status: 'warning',
              message: 'No caches found - offline mode may not work',
            });
          } else {
            const cache = await caches.open(scripthammerCaches[0]);
            const keys = await cache.keys();
            testResults.push({
              feature: 'Offline Capability',
              status: 'pass',
              message: `Offline cache active with ${keys.length} cached resources`,
              details: {
                cacheNames: scripthammerCaches,
                resourceCount: keys.length,
              },
            });
          }
        }
      } catch (error) {
        testResults.push({
          feature: 'Offline Capability',
          status: 'fail',
          message: `Error: ${error.message}`,
        });
      }

      // Test 4: Background Sync
      try {
        if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
          testResults.push({
            feature: 'Background Sync',
            status: 'warning',
            message: 'Background Sync API not supported',
          });
        } else {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration && registration.sync) {
            testResults.push({
              feature: 'Background Sync',
              status: 'pass',
              message: 'Background Sync is available',
            });
          } else {
            testResults.push({
              feature: 'Background Sync',
              status: 'warning',
              message: 'Background Sync not available (may need HTTPS)',
            });
          }
        }
      } catch (error) {
        testResults.push({
          feature: 'Background Sync',
          status: 'warning',
          message: `Background Sync check failed: ${error.message}`,
        });
      }

      // Test 5: Push Notifications
      try {
        if (!('Notification' in window)) {
          testResults.push({
            feature: 'Push Notifications',
            status: 'fail',
            message: 'Notification API not supported',
          });
        } else {
          const permission = Notification.permission;
          if (permission === 'granted') {
            testResults.push({
              feature: 'Push Notifications',
              status: 'pass',
              message: 'Push notifications are enabled',
            });
          } else if (permission === 'denied') {
            testResults.push({
              feature: 'Push Notifications',
              status: 'warning',
              message: 'Push notifications blocked by user',
            });
          } else {
            testResults.push({
              feature: 'Push Notifications',
              status: 'warning',
              message: 'Push notifications permission not requested',
            });
          }
        }
      } catch (error) {
        testResults.push({
          feature: 'Push Notifications',
          status: 'fail',
          message: `Error: ${error.message}`,
        });
      }

      return testResults;
    });

    // Display results
    console.log(`${colors.bright}Test Results:${colors.reset}\n`);
    results.forEach((result) => {
      console.log(formatResult(result));
      if (verbose && result.details) {
        console.log(
          `  ${colors.cyan}Details:${colors.reset}`,
          JSON.stringify(result.details, null, 2)
        );
      }
    });

    // Calculate summary
    const summary = {
      passed: results.filter((r) => r.status === 'pass').length,
      failed: results.filter((r) => r.status === 'fail').length,
      warnings: results.filter((r) => r.status === 'warning').length,
      total: results.length,
    };

    const duration = Date.now() - startTime;
    printSummary(summary, duration);

    // Set exit code based on failures
    if (summary.failed > 0) {
      exitCode = 1;
    }
  } catch (error) {
    console.error(`${colors.red}❌ Test execution failed${colors.reset}`);
    console.error(error);
    exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  process.exit(exitCode);
}

// Check if Playwright is available
try {
  require('@playwright/test');
} catch (error) {
  console.error(
    `${colors.red}❌ @playwright/test is not installed${colors.reset}`
  );
  console.error(
    'Please ensure @playwright/test is installed in the Docker container'
  );
  process.exit(1);
}

// Run tests
runPWATests().catch((error) => {
  console.error(`${colors.red}❌ Unhandled error:${colors.reset}`, error);
  process.exit(1);
});
