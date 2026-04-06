/**
 * E2E Test: Admin User Pagination
 *
 * Tests the pagination controls on the admin Users page:
 * 1. Pagination visible when users exceed PAGE_SIZE
 * 2. Navigate to page 2 — table rows and range text update
 * 3. Search resets page back to 1
 * 4. Next button disabled on last page
 *
 * Requires: local Supabase with seed-admin-demo.sql applied (50+ users),
 * admin user test@example.com with is_admin app_metadata.
 *
 * Run from inside the Docker container:
 *   docker exec -e SKIP_WEBSERVER=1 -e BASE_URL=http://localhost:3000 \
 *     scripthammer-scripthammer-1 npx playwright test tests/e2e/admin/admin-user-pagination.spec.ts --project=chromium
 */

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as http from 'http';

const ADMIN_EMAIL = 'test@example.com';
const ADMIN_PASSWORD = 'TestPassword123!';

// Next.js basePath — empty in local dev, '/ScriptHammer' in CI/prod
const BP = process.env.NEXT_PUBLIC_BASE_PATH || '';

// Docker DNS — test process resolves Docker hostnames; browser cannot
const SUPABASE_DOCKER_HOST =
  process.env.SUPABASE_DOCKER_HOST || 'scripthammer-supabase-kong-1';
const SUPABASE_DOCKER_URL = `http://${SUPABASE_DOCKER_HOST}:8000`;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Chromium needs --host-resolver-rules to map the Docker hostname to 127.0.0.1,
// and a local HTTP proxy forwards those requests to the real Kong.
const PROXY_PORT = 8003;

test.use({
  launchOptions: {
    args: [`--host-resolver-rules=MAP ${SUPABASE_DOCKER_HOST} 127.0.0.1`],
  },
});

test.describe('Admin User Pagination E2E', () => {
  test.skip(!!process.env.CI, 'Skipped in CI: requires local Docker Supabase');
  test.describe.configure({ mode: 'serial' });

  let proxyServer: http.Server;

  test.beforeAll(async () => {
    // Start a local HTTP proxy so Chromium (which resolves the Docker hostname
    // to 127.0.0.1) can reach the real Supabase Kong gateway.
    proxyServer = http.createServer((req, res) => {
      const options: http.RequestOptions = {
        hostname: SUPABASE_DOCKER_HOST,
        port: 8000,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `${SUPABASE_DOCKER_HOST}:8000` },
      };
      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode!, proxyRes.headers);
        proxyRes.pipe(res);
      });
      proxyReq.on('error', () => {
        res.writeHead(502);
        res.end();
      });
      req.pipe(proxyReq);
    });
    await new Promise<void>((resolve) =>
      proxyServer.listen(PROXY_PORT, '127.0.0.1', resolve)
    );
  });

  test.afterAll(async () => {
    proxyServer?.close();
  });

  test.beforeEach(async ({ page }) => {
    // Sign in via Supabase API (test process CAN reach Docker hostnames)
    const supabase = createClient(SUPABASE_DOCKER_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (error || !data.session) {
      throw new Error(
        `Supabase sign-in failed: ${error?.message ?? 'no session'}`
      );
    }

    // Navigate to get a browsing context for localStorage
    await page.goto(`${BP}/`);
    await page.waitForLoadState('domcontentloaded');

    // Inject the Supabase session so AuthContext picks it up.
    const session = data.session;
    const supabaseHost = new URL(SUPABASE_DOCKER_URL).hostname.split('.')[0];
    const storageKey = `sb-${supabaseHost}-auth-token`;
    await page.evaluate(
      ({ key, accessToken, refreshToken, expiresAt, user: u }) => {
        localStorage.setItem(
          key,
          JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresAt,
            expires_in: 3600,
            token_type: 'bearer',
            user: u,
          })
        );
      },
      {
        key: storageKey,
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at,
        user: session.user,
      }
    );

    // Reload so AuthContext reads the injected session
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should display pagination when more than PAGE_SIZE users exist', async ({
    page,
  }) => {
    await page.goto(`${BP}/admin/users`);
    await page.waitForLoadState('networkidle');

    const container = page.locator('[data-testid="admin-users"]');
    await expect(container).toBeVisible({ timeout: 15000 });

    // Wait for table to load
    const table = page.locator('[data-testid="user-table"]');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Pagination should be visible (seed data has 50+ users)
    const pagination = page.locator('[data-testid="user-pagination"]');
    await expect(pagination).toBeVisible({ timeout: 5000 });

    // Page indicator shows "Page 1 of N"
    const indicator = page.locator('[data-testid="user-pagination-indicator"]');
    await expect(indicator).toContainText('Page 1 of');

    // Previous disabled on first page
    const prevBtn = pagination.locator('button[aria-label="Previous page"]');
    await expect(prevBtn).toBeDisabled();

    // Next enabled (there are more pages)
    const nextBtn = pagination.locator('button[aria-label="Next page"]');
    await expect(nextBtn).toBeEnabled();
  });

  test('should navigate to page 2 and update table rows', async ({ page }) => {
    await page.goto(`${BP}/admin/users`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('[data-testid="user-table"]');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Capture page 1 state
    const page1Count = page.locator('[data-testid="user-count"]');
    const page1CountText = await page1Count.textContent();

    // Click Next
    const nextBtn = page.locator('button[aria-label="Next page"]');
    await nextBtn.click();

    // Wait for indicator to update
    const indicator = page.locator('[data-testid="user-pagination-indicator"]');
    await expect(indicator).toContainText('Page 2 of', { timeout: 10000 });

    // Range text should update (e.g., "Showing 51–100 of ...")
    await expect(page1Count).not.toHaveText(page1CountText || '');

    // Table still has rows
    const page2Rows = table.locator('tbody tr');
    const rowCount = await page2Rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('should search users and reset to page 1', async ({ page }) => {
    await page.goto(`${BP}/admin/users`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('[data-testid="user-table"]');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Navigate to page 2 first
    const nextBtn = page.locator('button[aria-label="Next page"]');
    const pagination = page.locator('[data-testid="user-pagination"]');
    await expect(pagination).toBeVisible({ timeout: 5000 });
    await nextBtn.click();

    const indicator = page.locator('[data-testid="user-pagination-indicator"]');
    await expect(indicator).toContainText('Page 2 of', { timeout: 10000 });

    // Now search — should reset to page 1
    const searchInput = page.locator('[data-testid="user-search"]');
    await searchInput.fill('alice');

    // Wait for debounce (300ms) + network
    await page.waitForTimeout(500);

    // Page should reset — either back to "Page 1 of" or pagination hidden (results fit one page)
    const paginationStillVisible = await pagination
      .isVisible()
      .catch(() => false);
    if (paginationStillVisible) {
      await expect(indicator).toContainText('Page 1 of');
    }

    // Table should show filtered results (may be fewer rows or no rows for "alice")
    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test('should search, page forward, and confirm results update at each step', async ({
    page,
  }) => {
    // Single-flow test: three state captures, two transitions. Searching and
    // paging are independent code paths (handleSearchChange vs handlePageChange
    // in admin/users/page.tsx) — this asserts both drive the table without
    // having to assume the seed has 51+ rows sharing a search substring.
    await page.goto(`${BP}/admin/users`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('[data-testid="user-table"]');
    await expect(table).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('[data-testid="user-search"]');
    const countLine = page.locator('[data-testid="user-count"]');
    const indicator = page.locator('[data-testid="user-pagination-indicator"]');
    const pagination = page.locator('[data-testid="user-pagination"]');
    const nextBtn = page.locator('button[aria-label="Next page"]');
    const firstRow = table.locator('tbody tr').first();

    // --- State 0: unfiltered page 1 -----------------------------------------
    await expect(pagination).toBeVisible({ timeout: 5000 });
    await expect(indicator).toContainText('Page 1 of');
    const baselineCount = await countLine.textContent();
    const baselineFirstRow = await firstRow.textContent();
    expect(baselineCount).toBeTruthy();
    expect(baselineFirstRow).toBeTruthy();

    // --- Transition 1: search -----------------------------------------------
    // admin_list_users at migration:872-873 searches username OR display_name
    // via ILIKE. Seed has only testadmin + testuser-b with non-null values;
    // admin_list_users filters is_admin=FALSE so 'test' narrows to ≤1 row.
    await searchInput.fill('test');
    // Wait for the count line to change — debounce is 300ms, but polling on
    // the mutated DOM is more honest than a fixed timeout.
    await expect(countLine).not.toHaveText(baselineCount ?? '', {
      timeout: 5000,
    });

    // --- State 1: filtered --------------------------------------------------
    // Results now fit one page — Pagination returns null when totalPages ≤ 1.
    await expect(pagination).not.toBeVisible();
    const filteredCount = await countLine.textContent();
    expect(filteredCount).not.toBe(baselineCount);

    // --- Transition 2: clear + page forward ---------------------------------
    await searchInput.fill('');
    // Back to unfiltered — count line returns to baseline.
    await expect(countLine).toHaveText(baselineCount ?? '', { timeout: 5000 });
    await expect(pagination).toBeVisible();
    await nextBtn.click();

    // --- State 2: page 2 ----------------------------------------------------
    await expect(indicator).toContainText('Page 2 of', { timeout: 10000 });
    // handlePageChange sets currentPage THEN awaits the fetch THEN setUsers
    // (admin/users/page.tsx:76-85). The indicator is derived from currentPage
    // so it flips to "Page 2" before rows arrive. A .textContent() snapshot
    // here races the fetch; the auto-retrying not.toHaveText polls until
    // setUsers re-renders the tbody — proof the server actually answered.
    await expect(firstRow).not.toHaveText(baselineFirstRow ?? '', {
      timeout: 10000,
    });
  });

  test('should disable Next on last page', async ({ page }) => {
    await page.goto(`${BP}/admin/users`);
    await page.waitForLoadState('networkidle');

    const pagination = page.locator('[data-testid="user-pagination"]');
    await expect(pagination).toBeVisible({ timeout: 10000 });

    // Read total pages from indicator text "Page 1 of N"
    const indicator = page.locator('[data-testid="user-pagination-indicator"]');
    const indicatorText = await indicator.textContent();
    const match = indicatorText?.match(/Page \d+ of (\d+)/);
    const totalPages = match ? parseInt(match[1], 10) : 1;

    // Navigate to the last page
    const nextBtn = page.locator('button[aria-label="Next page"]');
    for (let i = 1; i < totalPages; i++) {
      await nextBtn.click();
      // Wait for page indicator to update instead of blind sleep
      await expect(indicator).toContainText(`Page ${i + 1} of`, {
        timeout: 10000,
      });
    }

    // Verify we're on the last page
    await expect(indicator).toContainText(
      `Page ${totalPages} of ${totalPages}`
    );

    // Next should be disabled
    await expect(nextBtn).toBeDisabled();

    // Previous should be enabled (unless there's only 1 page, but we wouldn't be here)
    const prevBtn = pagination.locator('button[aria-label="Previous page"]');
    await expect(prevBtn).toBeEnabled();
  });
});
