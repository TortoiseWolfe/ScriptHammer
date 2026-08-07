import { defineConfig, devices } from '@playwright/test';

/**
 * Standalone visual-smoke config for the diorama Walk scene.
 *
 * Every scene regression in the walk-realism arc (dark void, buildings vanished,
 * over-sepia) passed console checks because nothing THREW — only the pixels were
 * wrong. This config runs `tests/e2e/twin-walk-visible.spec.ts`, which reads the
 * composited frame and fails if it's too dark or too uniform.
 *
 * It is deliberately self-contained (no auth/setup deps — the guard hits a public
 * route) and forces SOFTWARE WebGL, because headless Chromium has no GPU. Where
 * WebGL is still unavailable the spec `test.skip()`s rather than false-greening on
 * a blank canvas (same #288 limitation the twin-contrast specs document).
 *
 * Run against the running dev server (basePath /ScriptHammer):
 *   docker exec sh-cod-scripthammer-1 pnpm exec playwright test \
 *     --config playwright.visual.config.ts
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/twin-walk-visible.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  timeout: 90_000,
  use: {
    // Root origin; the spec prepends APP_BASE_PATH (the dev container serves the
    // app under the /ScriptHammer basePath, CI's exported build serves at root).
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    // Headless Chromium has no GPU — force ANGLE/SwiftShader so the WebGL scene
    // actually renders instead of a blank canvas.
    launchOptions: {
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-swiftshader',
      ],
    },
  },
  projects: [{ name: 'visual', use: { ...devices['Desktop Chrome'] } }],
  // Reuse the already-running dev server; don't spawn one.
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : {
        command: 'pnpm run dev',
        url: 'http://localhost:3000/ScriptHammer',
        reuseExistingServer: true,
        timeout: 120_000,
      },
  outputDir: 'test-results/visual',
});
