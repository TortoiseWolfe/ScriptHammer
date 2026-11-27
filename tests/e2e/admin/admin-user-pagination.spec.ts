/**
 * E2E Test: Admin User Pagination
 *
 * Tests the pagination controls on the admin Users page:
 * 1. Pagination visible when users exceed PAGE_SIZE
 * 2. Navigate to page 2 — table rows and range text update
 * 3. Search resets page back to 1
 * 4. Next button disabled on last page
 *
 * Requires a local Supabase with seed-admin-demo.sql applied. `e2e-local.yml`
 * applies it now (#914) — it previously said "50+ users" while the seed provided
 * 8, so the pagination control this file asserts on could never appear. The seed
 * carries 50 filler profiles for that reason.
 *
 * The admin is seeded per-run by seedIsolatedAdmin(); test@example.com is NOT an
 * admin and promoting it would remove it from the very population this file
 * paginates through (admin_list_users counts WHERE is_admin = FALSE).
 *
 * Run from inside the Docker container:
 *   docker exec -e SKIP_WEBSERVER=1 -e BASE_URL=http://localhost:3000 \
 *     scripthammer-scripthammer-1 npx playwright test tests/e2e/admin/admin-user-pagination.spec.ts --project=chromium
 */

import { test, expect } from '@playwright/test';
import {
  seedIsolatedAdmin,
  injectSessionIntoPage,
  deleteTestUser,
  assertLocalBackend,
  type IsolatedAdmin,
} from '../utils/test-user-factory';
// Straight from the guard module rather than via test-user-factory: local-backend
// imports nothing, which is the property that lets anything use it (#944).
import {
  isLocalSupabaseUrl,
  resolveBackendUrl,
} from '../../utils/local-backend';

// ADMIN_EMAIL / ADMIN_PASSWORD are gone with the shared-user sign-in they served (#914).

// Next.js basePath — empty in local dev, '/ScriptHammer' in CI/prod
const BP = process.env.NEXT_PUBLIC_BASE_PATH || '';

// Rows per page on /admin/users (PAGE_SIZE in src/app/admin/users/page.tsx).
const PAGE_SIZE = 50;

// Local-only spec (skipped in CI). The Node test process reaches local Kong via
// SUPABASE_ADMIN_URL (compose-internal supabase-kong:8000); the browser reaches
// it via NEXT_PUBLIC_SUPABASE_URL (host.docker.internal:54321). No proxy /
// --host-resolver-rules hack needed — see #121.
const SUPABASE_ADMIN_URL =
  process.env.SUPABASE_ADMIN_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// KNOWN BROKEN (#1029), and the readout below now says why on every failure.
//
// Measured: the admin nav RENDERS (so AdminGate's bare `is_admin()` returned
// true for this session) while the data call gets a 403 (so the RPC's bare
// `is_admin()` returned false) — in the same page load. AdminGate renders
// children only after its own check resolves, so the session is attached by the
// time this page fetches. Those two facts contradict each other and that
// contradiction is the open question.
//
// fixme, NOT skip: it stays visible, and the afterEach prints the page state and
// console on every failure so the next attempt does not cost a CI round to see.
test.describe('Admin User Pagination E2E', () => {
  // SKIP ON THE CAPABILITY, NOT ON `CI` (#914).
  //
  // This read `test.skip(!!process.env.CI, 'requires local Docker Supabase')`, which
  // outlived its own premise. When it was written, "CI" meant the shared hosted
  // project. It now also means `e2e-local.yml`, which brings up a Supabase PER SHARD
  // (`.env.local-supabase`) and sets `CI: 'true'` — so the spec skipped on the one
  // lane that satisfies the very requirement the message names.
  //
  // The predicate is the requirement itself: a disposable backend this spec may seed
  // and delete from. `assertLocalBackend()` below is the belt-and-braces that throws
  // if anything slips past.
  // Kept skip (#914): fires only on the hosted lane, whose shared backend this spec must not seed or delete.
  test.skip(
    !isLocalSupabaseUrl(resolveBackendUrl()),
    'needs a disposable local Supabase: this spec seeds and deletes data'
  );
  test.describe.configure({ mode: 'serial' });

  // SEED A THROWAWAY ADMIN — never promote the shared fixture user (#914).
  //
  // This used to sign in as `test@example.com`, a constant named ADMIN_EMAIL that is not an
  // admin: `is_admin()` reads the user_profiles.is_admin COLUMN (#240, migration:1218) and
  // seed-test-users.ts sets it only for admin@scripthammer.com. AdminGate therefore
  // redirected to `/` and every assertion here measured the home page.
  //
  // Promoting the shared user would be the cheap fix and is wrong twice over: its session is
  // the storageState for all 24 shards, and `admin_list_users` counts only
  // `WHERE p.is_admin = FALSE` (migration:1605) — so the promotion removes the user from the
  // very population this spec paginates through.
  let admin: IsolatedAdmin | null = null;

  test.beforeAll(async () => {
    // Refuse a non-local backend before seeding anything (#944).
    assertLocalBackend('The admin user-pagination spec');
    admin = await seedIsolatedAdmin();
  });

  test.afterAll(async () => {
    if (admin) await deleteTestUser(admin.user.id);
    admin = null;
  });

  /**
   * On failure, say what the page actually contained (#1029).
   *
   * These specs failed for months as `element(s) not found`, which names the
   * locator and nothing else — not whether the request was refused, not whether
   * the page rendered an error, not whether it was gated out entirely. Three CI
   * rounds could not distinguish those, and the answer only arrived when a
   * throwaway branch printed this once.
   *
   * It runs ONLY on failure, so a green run is unchanged. Keeping it is the
   * difference between a failure that names its cause and one that needs a
   * bespoke branch to interrogate.
   */
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus) return;
    const readout = await page
      .evaluate(() => ({
        url: location.pathname,
        // Distinguishes "gated out" (no container) from "rendered but empty".
        hasAdminNav: !!document.querySelector('[data-testid^="admin-"]'),
        hasTable: !!document.querySelector('table'),
        alerts: [...document.querySelectorAll('[role="alert"], .alert')]
          .map((el) => (el.textContent || '').trim())
          .filter(Boolean)
          .slice(0, 4),
        bodyStart: (document.body.innerText || '')
          .replace(/\s+/g, ' ')
          .slice(0, 300),
      }))
      .catch((e) => ({ evaluateFailed: String(e) }));
    console.log('[admin readout]', JSON.stringify(readout));
    const errs =
      (page as unknown as { __adminErrs?: string[] }).__adminErrs ?? [];
    if (errs.length)
      console.log('[admin console]', JSON.stringify(errs.slice(0, 8)));
  });

  test.beforeEach(async ({ page }) => {
    const errs: string[] = [];
    (page as unknown as { __adminErrs: string[] }).__adminErrs = errs;
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text());
    });
    page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  });

  test.beforeEach(async ({ page }) => {
    // seedIsolatedAdmin() throws in beforeAll when it cannot seed; this only narrows the type.
    if (!admin) throw new Error('admin fixture was not seeded in beforeAll');
    await injectSessionIntoPage(page, admin.session);
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

    // Navigate to page 2 first. handlePageChange sets the page number BEFORE
    // its fetch returns, so "Page 2 of" can show while the page-2 request is
    // still in flight, and whichever answer lands last decides the total. Wait
    // for that response (the only call with offset 50) and for the count line
    // it produces, so the search below starts from a settled page 2.
    const nextBtn = page.locator('button[aria-label="Next page"]');
    const pagination = page.locator('[data-testid="user-pagination"]');
    const countLine = page.locator('[data-testid="user-count"]');
    await expect(pagination).toBeVisible({ timeout: 5000 });
    const page2Response = page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/rpc/admin_list_users') &&
        response.request().postDataJSON()?.p_offset === PAGE_SIZE
    );
    await nextBtn.click();
    await page2Response;

    const indicator = page.locator('[data-testid="user-pagination-indicator"]');
    await expect(indicator).toContainText('Page 2 of', { timeout: 10000 });
    await expect(countLine).toContainText(`Showing ${PAGE_SIZE + 1}`);

    // Now search — should reset to page 1.
    //
    // The page resets to page 1 the moment the search box changes
    // (handleSearchChange sets currentPage to 0 at once), but the user count
    // only changes when the search request comes back. In between, the old
    // pagination bar is still on screen. A fixed wait followed by one
    // "is it visible" look raced that gap (#1523): when the answer arrived
    // after the look and before the check, the bar vanished under the check.
    //
    // So hold the search request for a second so the gap is wide on every
    // run, wait for the response that carries this search, and assert only
    // the end state that the response itself calls for. Nothing here reads
    // the page before that response, so no clock decides the result. Only the
    // search call is held: it is the only admin_list_users call that carries
    // p_search.
    const SEARCH_TERM = 'alice';
    await page.route('**/rest/v1/rpc/admin_list_users', async (route) => {
      if (route.request().postDataJSON()?.p_search === SEARCH_TERM) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      await route.continue();
    });
    const searchResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/rpc/admin_list_users') &&
        response.request().postDataJSON()?.p_search === SEARCH_TERM
    );

    const searchInput = page.locator('[data-testid="user-search"]');
    await searchInput.fill(SEARCH_TERM);

    const searchResult = await (await searchResponse).json();
    expect(typeof searchResult.total).toBe('number');
    // The seed has a user called alice. With no match the count line would
    // read "Showing 0\u20130 of 0" on any page and could not show a reset.
    expect(searchResult.total).toBeGreaterThan(0);

    // The page reset is read from the count line, which is computed from the
    // current page: without the reset it would read "Showing 51\u20131 of 1".
    // (The pagination bar cannot show it when the matches fit on one page,
    // because it is hidden whatever the current page is.)
    await expect(countLine).toHaveText(
      `Showing 1\u2013${Math.min(PAGE_SIZE, searchResult.total)} of ${searchResult.total}`
    );

    // The bar follows the page's own rule: shown, on page 1, when the matches
    // need more than one page; gone when they fit on one.
    if (Math.ceil(searchResult.total / PAGE_SIZE) > 1) {
      await expect(indicator).toContainText('Page 1 of');
    } else {
      await expect(pagination).toBeHidden();
    }

    await expect(table).toBeVisible();
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
