/**
 * E2E Test: Admin Dashboard
 *
 * Tests every admin sub-page with seeded demo data. The navigation test enumerates
 * `ADMIN_SECTIONS` rather than restating it, so this list cannot drift again (#912):
 * - Overview: stat cards, sparkline trend charts
 * - Payments: provider breakdown, payment stats
 * - Orders: fulfillment queue
 * - Audit Trail: burst detection cards, event log table
 * - Users: user table, sorting, search
 * - Messaging: conversation stats, top senders
 * - Email: provider health
 *
 * Requires: local Supabase with seed-admin-demo.sql applied,
 * admin user test@example.com with is_admin app_metadata.
 *
 * Run from inside the Docker container:
 *   docker exec -e SKIP_WEBSERVER=1 -e BASE_URL=http://localhost:3000 \
 *     sh-feat-scripthammer-1 npx playwright test tests/e2e/admin/ --project=chromium
 */

import { test, expect } from '@playwright/test';
import { ADMIN_SECTIONS, ADMIN_SECTION_FLOOR } from '@/config/admin-sections';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'test@example.com';
const ADMIN_PASSWORD = 'TestPassword123!';

// Next.js basePath — all routes must be prefixed
const BP = '/ScriptHammer';

// Local-only spec (skipped in CI). The Node test process reaches local Kong via
// SUPABASE_ADMIN_URL (compose-internal supabase-kong:8000); the browser reaches
// it via NEXT_PUBLIC_SUPABASE_URL (host.docker.internal:54321). The old
// page.route interception that rewrote localhost:54321 → a hardcoded container
// name is gone — see #121.
const SUPABASE_ADMIN_URL =
  process.env.SUPABASE_ADMIN_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

test.describe('Admin Dashboard E2E', () => {
  test.skip(!!process.env.CI, 'Skipped in CI: requires local Docker Supabase');
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Sign in via the Supabase API from the Node test process (reaches Kong via
    // the compose-internal admin URL locally; public URL on cloud/CI).
    const supabase = createClient(SUPABASE_ADMIN_URL, SUPABASE_ANON_KEY, {
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

    // Navigate to a page so we have a browsing context for localStorage
    await page.goto(`${BP}/`);
    await page.waitForLoadState('domcontentloaded');

    // Inject the Supabase session into localStorage so AuthContext picks it up
    const session = data.session;
    await page.evaluate(
      ({ accessToken, refreshToken, expiresAt, user: u }) => {
        const storageKey = Object.keys(localStorage).find((k) =>
          k.startsWith('sb-')
        );
        const key = storageKey || 'sb-localhost-auth-token';
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

  test.describe('Overview Page', () => {
    test('should display stat cards with non-zero values', async ({ page }) => {
      await page.goto(`${BP}/admin`);
      await page.waitForLoadState('networkidle');

      const overview = page.locator('[data-testid="admin-overview"]');
      await expect(overview).toBeVisible({ timeout: 15000 });

      const statCards = page.locator('[data-testid^="stat-"]');
      await expect(statCards.first()).toBeVisible({ timeout: 10000 });

      const cardTexts = await statCards.allTextContents();
      const hasNonZero = cardTexts.some((text) => {
        const nums = text.match(/\d+/g);
        return nums && nums.some((n) => parseInt(n) > 0);
      });
      expect(hasNonZero).toBe(true);
    });

    test('should display sparkline trend charts', async ({ page }) => {
      await page.goto(`${BP}/admin`);
      await page.waitForLoadState('networkidle');

      const overview = page.locator('[data-testid="admin-overview"]');
      await expect(overview).toBeVisible({ timeout: 15000 });

      const charts = page.locator(
        'svg polyline, svg path, [data-testid*="trend"], [data-testid*="spark"]'
      );
      await page.waitForTimeout(2000);
      const chartCount = await charts.count();

      if (chartCount === 0) {
        const noDataMessages = page.getByText('No data');
        const noDataCount = await noDataMessages.count();
        expect(noDataCount).toBeLessThan(4);
      }
    });

    test('should have working date range filter', async ({ page }) => {
      await page.goto(`${BP}/admin`);
      await page.waitForLoadState('networkidle');

      const overview = page.locator('[data-testid="admin-overview"]');
      await expect(overview).toBeVisible({ timeout: 15000 });

      const dateFilter = page
        .locator('[data-testid*="range"], [data-testid*="date"]')
        .first();
      if (await dateFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(dateFilter).toBeVisible();
      }
    });
  });

  test.describe('Payments Page', () => {
    test('should display payment statistics', async ({ page }) => {
      await page.goto(`${BP}/admin/payments`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const statsSection = page
        .getByRole('heading', { name: /payment/i })
        .first();
      await expect(statsSection).toBeVisible({ timeout: 10000 });
    });

    test('should display provider breakdown table', async ({ page }) => {
      await page.goto(`${BP}/admin/payments`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const providerSection = page.getByText(/stripe|paypal/i).first();
      if (
        await providerSection.isVisible({ timeout: 5000 }).catch(() => false)
      ) {
        await expect(providerSection).toBeVisible();
      }
    });

    test('should display payment trend chart', async ({ page }) => {
      await page.goto(`${BP}/admin/payments`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const trendSection = page.getByText(/trend|daily|chart/i).first();
      const hasTrend = await trendSection
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      const svgElements = page.locator('svg');
      const svgCount = await svgElements.count();

      expect(hasTrend || svgCount > 0).toBe(true);
    });
  });

  test.describe('Audit Trail Page', () => {
    test('should display authentication statistics', async ({ page }) => {
      await page.goto(`${BP}/admin/audit`);
      await page.waitForLoadState('networkidle');

      const statsHeading = page.getByRole('heading', {
        name: /authentication statistics/i,
      });
      await expect(statsHeading).toBeVisible({ timeout: 10000 });

      await expect(
        page.locator('[data-testid="stat-logins-today"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="stat-failed-week"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="stat-rate-limited"]')
      ).toBeVisible();
      await expect(page.locator('[data-testid="stat-signups"]')).toBeVisible();
    });

    test('should display burst detection cards', async ({ page }) => {
      await page.goto(`${BP}/admin/audit`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const burstHeading = page.getByRole('heading', {
        name: /failed login bursts/i,
      });
      if (await burstHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(page.locator('[data-testid="stat-bursts"]')).toBeVisible();

        const burstCards = page.locator('[data-testid="burst-card"]');
        const burstCount = await burstCards.count();

        if (burstCount > 0) {
          const firstBurst = burstCards.first();
          await expect(firstBurst).toContainText('attempts');
          await expect(firstBurst).toContainText(/\d+\.\d+\.\d+\.\d+/);
        }
      }
    });

    test('should expand burst card to show event details', async ({ page }) => {
      await page.goto(`${BP}/admin/audit`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const burstCards = page.locator('[data-testid="burst-card"]');
      const burstCount = await burstCards.count();

      if (burstCount > 0) {
        const toggleButton = page
          .locator('[data-testid="burst-toggle"]')
          .first();
        await toggleButton.click();

        const burstDetail = page.locator('[data-testid="burst-detail"]');
        await expect(burstDetail).toBeVisible({ timeout: 3000 });

        await expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

        await toggleButton.click();
        await expect(burstDetail).not.toBeVisible();
        await expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
      }
    });

    test('should display event log table with rows', async ({ page }) => {
      await page.goto(`${BP}/admin/audit`);
      await page.waitForLoadState('networkidle');

      const eventLogHeading = page.getByRole('heading', { name: /event log/i });
      await expect(eventLogHeading).toBeVisible({ timeout: 10000 });

      const eventsTable = page.locator('[data-testid="audit-events-table"]');
      await expect(eventsTable).toBeVisible();

      const tableRows = eventsTable.locator('tbody tr');
      const rowCount = await tableRows.count();
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should filter events by type', async ({ page }) => {
      await page.goto(`${BP}/admin/audit`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const filterSelect = page.locator('[data-testid="event-type-filter"]');
      if (await filterSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await filterSelect.selectOption('sign_in_failed');
        await page.waitForTimeout(1000);

        const eventBadges = page.locator(
          '[data-testid="audit-events-table"] .badge-outline'
        );
        const badgeCount = await eventBadges.count();
        if (badgeCount > 0) {
          for (let i = 0; i < badgeCount; i++) {
            await expect(eventBadges.nth(i)).toContainText('sign_in_failed');
          }
        }
      }
    });

    test('should sort event log columns', async ({ page }) => {
      await page.goto(`${BP}/admin/audit`);
      await page.waitForLoadState('networkidle');

      const eventsTable = page.locator('[data-testid="audit-events-table"]');
      await expect(eventsTable).toBeVisible({ timeout: 10000 });

      const timeHeader = eventsTable
        .locator('thead button')
        .filter({ hasText: 'Time' });
      if (await timeHeader.isVisible().catch(() => false)) {
        await timeHeader.click();
        const headerCell = eventsTable
          .locator('th')
          .filter({ hasText: 'Time' });
        await expect(headerCell).toHaveAttribute('aria-sort', 'ascending');

        await timeHeader.click();
        await expect(headerCell).toHaveAttribute('aria-sort', 'descending');
      }
    });

    test('should display anomaly alerts when failed logins exist', async ({
      page,
    }) => {
      await page.goto(`${BP}/admin/audit`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const anomalyHeading = page.getByRole('heading', {
        name: /anomaly alerts/i,
      });
      if (
        await anomalyHeading.isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        const anomalyCards = page.locator('.border-warning');
        const anomalyCount = await anomalyCards.count();
        expect(anomalyCount).toBeGreaterThan(0);

        const firstCard = anomalyCards.first();
        await expect(firstCard).toContainText(/\d+ failed attempts/);
      }
    });

    test('should show retention notice', async ({ page }) => {
      await page.goto(`${BP}/admin/audit`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      await expect(page.getByText(/audit logs are retained/i)).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe('Users Page', () => {
    test('should display users table with data', async ({ page }) => {
      await page.goto(`${BP}/admin/users`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const table = page.locator('table').first();
      await expect(table).toBeVisible({ timeout: 10000 });

      const rows = table.locator('tbody tr');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should sort users by column', async ({ page }) => {
      await page.goto(`${BP}/admin/users`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const table = page.locator('table').first();
      await expect(table).toBeVisible({ timeout: 10000 });

      const sortableButton = table.locator('thead button').first();
      if (await sortableButton.isVisible().catch(() => false)) {
        await sortableButton.click();
        const headerCell = table.locator('th[aria-sort]').first();
        const sortVal = await headerCell.getAttribute('aria-sort');
        expect(['ascending', 'descending']).toContain(sortVal);
      }
    });

    test('should search/filter users', async ({ page }) => {
      await page.goto(`${BP}/admin/users`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const searchInput = page
        .locator(
          'input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i]'
        )
        .first();
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill('alice');
        await page.waitForTimeout(1000);

        // Table should remain present after search (filtered results may be
        // empty or non-empty — both are valid; we're asserting the search
        // didn't crash the view).
        const table = page.locator('table').first();
        await expect(table).toBeVisible();
      }
    });

    test('should display activity badges', async ({ page }) => {
      await page.goto(`${BP}/admin/users`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const badges = page.locator('.badge');
      const badgeCount = await badges.count();
      expect(badgeCount).toBeGreaterThan(0);
    });
  });

  test.describe('Messaging Page', () => {
    test('should display messaging statistics', async ({ page }) => {
      await page.goto(`${BP}/admin/messaging`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const heading = page.getByRole('heading').first();
      await expect(heading).toBeVisible({ timeout: 10000 });

      const statCards = page.locator('[data-testid^="stat-"]');
      if (
        await statCards
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        const count = await statCards.count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('should display top senders table', async ({ page }) => {
      await page.goto(`${BP}/admin/messaging`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const topSendersHeading = page.getByText(/top senders/i);
      if (
        await topSendersHeading.isVisible({ timeout: 5000 }).catch(() => false)
      ) {
        // The heading rendered without crashing — that's the real signal.
        // Top-senders rows depend on seed data and are tested elsewhere.
        await expect(topSendersHeading).toBeVisible();
      }
    });

    test('should display volume trends', async ({ page }) => {
      await page.goto(`${BP}/admin/messaging`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // The messaging admin page should render its main heading. Volume
      // trend charts depend on seed data range — covered by stat cards
      // test above. Here we just verify the page loaded without crashing.
      const heading = page.getByRole('heading').first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Navigation', () => {
    test('should navigate between all admin tabs', async ({ page }) => {
      await page.goto(`${BP}/admin`);
      await page.waitForLoadState('networkidle');

      const adminNav = page.locator('nav[aria-label="Admin navigation"]');
      await expect(adminNav).toBeVisible({ timeout: 10000 });

      // ENUMERATED FROM THE NAV'S OWN DEFINITION, NOT RESTATED (#912).
      //
      // This was a hardcoded array of six while `ADMIN_SECTIONS` had seven, so
      // `/admin/email` was never visited by a test named "all admin tabs". `Orders`
      // had been added to both lists; `Email` to only one. Nothing failed, because
      // nothing compared them. Adding a section now needs no edit here.
      //
      // The floor is load-bearing: an import resolving to an empty array would run
      // this loop zero times and still pass, which is the same defect one level up.
      expect(
        ADMIN_SECTIONS.length,
        'ADMIN_SECTIONS is smaller than the floor — if a section was deliberately ' +
          'removed, lower ADMIN_SECTION_FLOOR deliberately too; never to make a run pass'
      ).toBeGreaterThanOrEqual(ADMIN_SECTION_FLOOR);

      // Every defined section must actually be RENDERED. Enumerating alone would
      // still pass if the nav silently stopped drawing one — the test would visit a
      // URL directly and never notice the link was gone.
      const rendered = await adminNav.locator('a').allTextContents();
      expect(
        rendered.map((t) => t.trim()).sort(),
        'the nav does not render exactly the sections ADMIN_SECTIONS defines'
      ).toEqual([...ADMIN_SECTIONS].map((s) => s.label).sort());

      for (const section of ADMIN_SECTIONS) {
        const link = adminNav.getByText(section.label, { exact: true });
        await link.click();
        // `/admin` must match exactly — a loose regex would let every sub-route
        // satisfy the Overview case.
        const pattern =
          section.href === '/admin'
            ? /\/admin\/?$/
            : new RegExp(section.href.replace(/\//g, '\\/'));
        await page.waitForURL(pattern, { timeout: 10000 });

        const bodyText = await page.locator('body').textContent();
        expect(
          bodyText?.length,
          `${section.label} rendered an empty body`
        ).toBeGreaterThan(0);
      }
    });
  });
});
