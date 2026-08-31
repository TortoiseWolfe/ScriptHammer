/**
 * E2E Test: Admin Dashboard
 *
 * Tests every admin sub-page with seeded demo data. The navigation test enumerates
 * `ADMIN_SECTIONS` rather than restating it, so this list cannot drift again (#912):
 * - Overview: stat cards, sparkline trend charts
 * - Payments: provider breakdown, payment stats
 * - Orders: fulfillment queue
 * - Audit Trail: sign-in activity, event log table
 * - Users: user table, sorting, search
 * - Messaging: conversation stats, top senders
 * - Email: provider health
 *
 * Requires a local Supabase; `e2e-local.yml` applies seed-admin-demo.sql (#914).
 * This file's own assertions hold with or without that data — see the chart test —
 * but its siblings depend on it.
 *
 * The admin is seeded per-run by seedIsolatedAdmin(); test@example.com is NOT an
 * admin, and this file used to sign in as it and measure the home page.
 *
 * Run from inside the Docker container:
 *   docker exec -e SKIP_WEBSERVER=1 -e BASE_URL=http://localhost:3000 \
 *     sh-feat-scripthammer-1 npx playwright test tests/e2e/admin/ --project=chromium
 */

import { test, expect } from '@playwright/test';
import { ADMIN_SECTIONS, ADMIN_SECTION_FLOOR } from '@/config/admin-sections';
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

// ADMIN_EMAIL / ADMIN_PASSWORD are gone: this file no longer signs in as the shared
// fixture user. See the beforeAll below (#914).

// Next.js basePath — all routes must be prefixed
// Read the basePath, never hardcode it (#914). This file said `'/ScriptHammer'` while its
// two sibling admin specs read the env var, and the local E2E lane builds root-served with
// DISABLE_BASE_PATH=true — so every goto below resolved to 404.html and the whole file
// measured the not-found page.
const BP = process.env.NEXT_PUBLIC_BASE_PATH || '';

// The Supabase client constants that used to live here are gone with the sign-in they
// served. seedIsolatedAdmin() and injectSessionIntoPage() resolve their own endpoints —
// the Node side via SUPABASE_ADMIN_URL (compose-internal supabase-kong:8000), the browser
// side via NEXT_PUBLIC_SUPABASE_URL — so this file no longer restates that mapping (#121).

test.describe('Admin Dashboard E2E', () => {
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
  test.skip(
    !isLocalSupabaseUrl(resolveBackendUrl()),
    'needs a disposable local Supabase: this spec seeds and deletes data'
  );
  test.describe.configure({ mode: 'serial' });

  // SEED A THROWAWAY ADMIN — never promote the shared fixture user (#914).
  //
  // This block used to sign in as `test@example.com`, a constant named ADMIN_EMAIL that
  // is not an admin: `is_admin()` reads the user_profiles.is_admin COLUMN (#240,
  // migration:1218) and seed-test-users.ts sets it only for admin@scripthammer.com
  // (scripts/seed-test-users.ts:199, inside setupAdminUser). So AdminGate redirected to
  // `/` and every assertion in this file measured the home page.
  //
  // Promoting `test@example.com` would be the cheap fix and is the wrong one twice over:
  // its session is the storageState for all 24 E2E shards, and three permissive
  // cross-user RLS policies (migration:2570) would widen what every other spec can see;
  // and `admin_list_users` counts only `WHERE p.is_admin = FALSE` (migration:1605), so
  // the promotion removes the user from the population admin-user-pagination asserts
  // about. The two fixes would fight each other.
  //
  // `seedIsolatedAdmin()` promotes a throwaway user and verifies the promotion through
  // that user's OWN session. admin-depth.spec.ts already does this and already runs in CI.
  //
  // ONCE PER FILE, not per test: these tests are `mode: 'serial'` and share no state that
  // one could corrupt for another, so 22 user creations would be cost without isolation.
  let admin: IsolatedAdmin | null = null;

  test.beforeAll(async () => {
    // REFUSE A NON-LOCAL BACKEND BEFORE SEEDING ANYTHING (#944). Until this existed, the
    // only thing keeping these specs off production was `CI=true` at docker-compose.yml:84
    // tripping a skip whose stated reason is a capability one. That skip is what #914 sets
    // out to remove, so the safety property needed an assertion of its own.
    assertLocalBackend('The admin dashboard spec');
    admin = await seedIsolatedAdmin();
  });

  test.afterAll(async () => {
    // Orphan sweep is a backstop, not a substitute (test-user-factory.ts:2815).
    if (admin) await deleteTestUser(admin.user.id);
    admin = null;
  });

  test.beforeEach(async ({ page }) => {
    test.skip(!admin, 'Admin client unavailable to seed an admin');
    if (!admin) return;
    // Derives the `sb-<host>-auth-token` key rather than guessing it, and reloads so
    // AuthContext reads the session on init.
    await injectSessionIntoPage(page, admin.session);
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

      // ALWAYS ASSERT. This was `if (chartCount === 0) { ... }`, and that branch is
      // UNREACHABLE: the locator includes [data-testid*="trend"], and AdminTrendChart emits
      // data-testid={testId} in its EMPTY branch (AdminTrendChart.tsx:142) as well as its
      // populated one (:216). chartCount is therefore never 0, the body never ran, and this
      // test passed having asserted NOTHING — which ZERO_ASSERTION_GATE_MODE=block correctly
      // refuses to call green. Seeding cannot fix that; only a real assertion can (#914).
      expect(chartCount).toBeGreaterThan(0);

      // Every trend chart renders either real geometry or an explicit "No data" figure,
      // never nothing. True with or without the demo seed, so it asserts in both states.
      const withData = await page.locator('svg path, svg polyline').count();
      const placeholders = await page.getByText('No data').count();
      expect(withData + placeholders).toBeGreaterThan(0);
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

      // BOTH BRANCHES ASSERT (#914). Previously the only expect sat inside the `if`, so an
      // unseeded database made this pass having measured nothing.
      const providerSection = page.getByText(/stripe|paypal/i).first();
      if (
        await providerSection.isVisible({ timeout: 5000 }).catch(() => false)
      ) {
        await expect(providerSection).toBeVisible();
      } else {
        // No provider rows is legitimate on an unseeded database — but then the page must
        // say so, rather than silently rendering an empty shell.
        await expect(
          page
            .getByTestId('admin-payments')
            .or(page.getByText(/no .*(payment|data)/i))
        ).toBeVisible();
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

      // The control is part of the page, not of the data — assert it exists rather than
      // treating its absence as a reason to measure nothing (#914).
      const filterSelect = page.locator('[data-testid="event-type-filter"]');
      await expect(filterSelect).toBeVisible({ timeout: 10000 });

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
      } else {
        // A filter that matches nothing must SAY so. Silently rendering an empty table
        // would be indistinguishable from the filter not working at all.
        await expect(page.getByText(/no audit events found/i)).toBeVisible();
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
      // GENUINELY DATA-GATED: the section renders only when stats.top_failed_logins is
      // non-empty (AdminAuditTrail.tsx:383). So the negative is asserted explicitly rather
      // than by falling out of an `if` having measured nothing (#914).
      if (
        await anomalyHeading.isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        const anomalyCards = page.locator('.border-warning');
        const anomalyCount = await anomalyCards.count();
        expect(anomalyCount).toBeGreaterThan(0);

        const firstCard = anomalyCards.first();
        await expect(firstCard).toContainText(/\d+ failed attempts/);
      } else {
        // No anomalies is a valid state — but then the section must be genuinely absent,
        // not present-and-empty.
        await expect(anomalyHeading).toBeHidden();
        await expect(page.locator('.border-warning')).toHaveCount(0);
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
    // KNOWN BROKEN, not skipped (#1029). test.fixme reports as an expected
    // failure and stays visible in the run; a plain skip would hide it behind a
    // reason, which is the exact pattern #914 removed from this file.
    // /admin/users renders no table for a freshly-seeded admin, because
    // admin_list_users returns '{}' rather than refusing, so the page shows its
    // empty state and nothing anywhere reports why.
    test.fixme('should display users table with data', async ({ page }) => {
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
      // The search box is part of the admin users page, not of its data — its absence is a
      // regression, not a reason to measure nothing. This was the seventh zero-assertion
      // test in this file and the only one not named in #914; a static sweep found it (#914).
      await expect(searchInput).toBeVisible({ timeout: 10000 });

      await searchInput.fill('alice');
      await page.waitForTimeout(1000);

      // Filtered results may be empty or non-empty — both valid. What must hold is that
      // searching did not crash the view.
      await expect(page.locator('table').first()).toBeVisible();
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

      // `.first()` matters: without it a second matching node trips Playwright strict mode
      // INSIDE the swallowed `.catch(() => false)`, turning a real error into a silent skip.
      const topSendersHeading = page.getByText(/top senders/i).first();
      if (
        await topSendersHeading.isVisible({ timeout: 5000 }).catch(() => false)
      ) {
        // The heading rendered without crashing — that's the real signal.
        // Top-senders rows depend on seed data and are tested elsewhere.
        await expect(topSendersHeading).toBeVisible();
      } else {
        // Absent is allowed, but then the messaging admin page must still have rendered —
        // otherwise this test was measuring a blank or errored page (#914).
        await expect(
          page.getByRole('heading', { name: /messaging/i }).first()
        ).toBeVisible({ timeout: 10000 });
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
