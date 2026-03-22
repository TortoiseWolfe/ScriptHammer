/**
 * E2E Test: Admin Conversation List
 *
 * Asserts the per-conversation metadata table on /admin/messaging:
 *   1. Column headers render (Conversation, Participants, Messages,
 *      Last activity, Created).
 *   2. Rows with last_activity older than STALE_THRESHOLD_MS carry the
 *      stale badge; fresh rows do not.
 *
 * The stale case is guaranteed by seeding a conversation with
 * last_message_at = now() - 45 days in beforeAll. The demo seed
 * (88888888-... rows) has nothing older than ~12 days, so without
 * this insert the stale assertion would be dead weight.
 *
 * Run from inside the Docker container:
 *   docker compose exec -T -e SKIP_WEBSERVER=1 -e CI= scripthammer \
 *     pnpm exec playwright test tests/e2e/admin/admin-conversation-list.spec.ts --project=chromium
 */

import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as http from 'http';
import { STALE_THRESHOLD_MS } from '../../../src/components/organisms/AdminConversationList/AdminConversationList';

const ADMIN_EMAIL = 'test@example.com';
const ADMIN_PASSWORD = 'TestPassword123!';

const BP = process.env.NEXT_PUBLIC_BASE_PATH || '';

// Same proxy harness as admin-user-pagination.spec.ts — Chromium resolves
// the Docker hostname to 127.0.0.1 via --host-resolver-rules, and this
// process proxies 127.0.0.1:8000 → the real Kong gateway.
const SUPABASE_DOCKER_HOST =
  process.env.SUPABASE_DOCKER_HOST || 'scripthammer-supabase-kong-1';
const SUPABASE_DOCKER_URL = `http://${SUPABASE_DOCKER_HOST}:8000`;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PROXY_PORT = 8004;

// Seed placed safely past the threshold. Using STALE_THRESHOLD_MS * 1.5
// rather than a hardcoded "45 days" means raising the threshold in the
// component can't silently turn this spec into a no-op.
const STALE_LAST_MESSAGE = new Date(
  Date.now() - STALE_THRESHOLD_MS * 1.5
).toISOString();

// Stable UUID so reruns clean up their own mess. v4-shaped (version nibble
// = 4, variant nibble = a) in case anything downstream validates format.
const STALE_CONV_ID = 'eeeeeeee-eeee-4eee-aeee-000000000e2e';

test.use({
  launchOptions: {
    args: [`--host-resolver-rules=MAP ${SUPABASE_DOCKER_HOST} 127.0.0.1`],
  },
});

test.describe('Admin Conversation List E2E', () => {
  test.skip(!!process.env.CI, 'Skipped in CI: requires local Docker Supabase');
  test.describe.configure({ mode: 'serial' });

  let proxyServer: http.Server;
  let serviceClient: SupabaseClient;

  test.beforeAll(async () => {
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

    // Seed the stale conversation. service_role bypasses RLS; conversations
    // RLS is participant-only and the test process is neither participant.
    serviceClient = createClient(SUPABASE_DOCKER_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Borrow two existing profile IDs — the check_group_participants
    // constraint (migration:1253) requires both participant columns NOT NULL
    // for is_group=FALSE. Which two doesn't matter; admin_conversation_list
    // never selects participant columns.
    //
    // canonical_ordering (migration:1607) enforces p1 < p2. .limit(2) alone
    // returns insertion order which may violate that, and .order('id') on a
    // UUID column sorts lexically not by bytea — so sort client-side where
    // string comparison matches what Postgres's uuid < does.
    const { data: profiles, error: profileErr } = await serviceClient
      .from('user_profiles')
      .select('id')
      .limit(2);
    if (profileErr || !profiles || profiles.length < 2) {
      throw new Error(
        `Need ≥2 user_profiles to satisfy the participant constraint: ${profileErr?.message ?? 'not enough rows'}`
      );
    }
    const [p1, p2] = [profiles[0].id, profiles[1].id].sort();

    // Delete-then-insert: upsert would need a conflict target and there's no
    // unique constraint on id alone to name. A prior run that crashed before
    // afterAll would otherwise 23505 here.
    await serviceClient.from('conversations').delete().eq('id', STALE_CONV_ID);
    const { error: insertErr } = await serviceClient
      .from('conversations')
      .insert({
        id: STALE_CONV_ID,
        participant_1_id: p1,
        participant_2_id: p2,
        is_group: false,
        last_message_at: STALE_LAST_MESSAGE,
        // created_at must predate last_message_at or the row is nonsensical
        // (and admin_conversation_list's COALESCE would pick created_at for
        // a NULL last_message_at, making the seed order-sensitive).
        created_at: STALE_LAST_MESSAGE,
      });
    if (insertErr) {
      throw new Error(
        `Failed to seed stale conversation: ${insertErr.message}`
      );
    }
  });

  test.afterAll(async () => {
    await serviceClient?.from('conversations').delete().eq('id', STALE_CONV_ID);
    proxyServer?.close();
  });

  test.beforeEach(async ({ page }) => {
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

    await page.goto(`${BP}/`);
    await page.waitForLoadState('domcontentloaded');

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

    await page.goto(`${BP}/admin/messaging`);
    await page.waitForLoadState('networkidle');
  });

  test('renders all five metadata column headers', async ({ page }) => {
    const list = page.locator('[data-testid="admin-conversation-list"]');
    await expect(list).toBeVisible({ timeout: 15000 });

    const table = page.locator('[data-testid="admin-conversation-list-table"]');
    await expect(table).toBeVisible({ timeout: 10000 });

    // AdminDataTable renders column labels as <th>. Querying by role is more
    // resilient than by text — if a label changes the failure points at the
    // table, not at a stale string match.
    const headers = table.getByRole('columnheader');
    await expect(headers).toHaveCount(5);

    // Spot-check the labels. These are the column defs at
    // AdminConversationList.tsx:85-137 — if someone reorders or renames,
    // this is where they find out.
    await expect(
      table.getByRole('columnheader', { name: /^Conversation$/ })
    ).toBeVisible();
    await expect(
      table.getByRole('columnheader', { name: /Participants/ })
    ).toBeVisible();
    await expect(
      table.getByRole('columnheader', { name: /Messages/ })
    ).toBeVisible();
    await expect(
      table.getByRole('columnheader', { name: /Last activity/ })
    ).toBeVisible();
    await expect(
      table.getByRole('columnheader', { name: /Created/ })
    ).toBeVisible();
  });

  test('flags the seeded >30d conversation as stale, leaves fresh rows unflagged', async ({
    page,
  }) => {
    const table = page.locator('[data-testid="admin-conversation-list-table"]');
    await expect(table).toBeVisible({ timeout: 15000 });

    // admin_conversation_list sorts by last_activity DESC, so the 45-day-old
    // seed lands at the bottom. CONVERSATION_PAGE_SIZE is 50 and the DB has
    // ~6 conversations total — everything fits on page 1.
    const staleCell = table
      .locator(`[data-stale="true"]`)
      .filter({ has: page.getByText('stale') });
    await expect(staleCell).toHaveCount(1);

    // The stale cell's row contains the seeded ID's truncation. This ties
    // the badge to the specific row we planted, not just "some row has it".
    const staleRow = staleCell.locator('xpath=ancestor::tr');
    await expect(staleRow).toContainText(STALE_CONV_ID.slice(0, 8));

    // And the converse — the demo seed's freshest row (88888888-...801 at
    // ~yesterday) carries data-stale=false and NO badge. If the component
    // ever flips to >= or the threshold math drifts, one of these two
    // assertions catches it.
    const freshCells = table.locator(`[data-stale="false"]`);
    const freshCount = await freshCells.count();
    expect(freshCount).toBeGreaterThan(0);
    for (let i = 0; i < freshCount; i++) {
      await expect(freshCells.nth(i).getByText('stale')).toHaveCount(0);
    }
  });
});
