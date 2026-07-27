/**
 * Playwright Global Setup
 *
 * Runs ONCE before any tests start. Validates prerequisites and fails fast
 * if configuration is invalid, instead of timing out test by test.
 *
 * Checks:
 * 1. Required environment variables are set
 * 2. Supabase is reachable
 * 3. Test users exist in database
 */

import { createClient } from '@supabase/supabase-js';
import {
  createTestUser,
  ensureEncryptionKeys,
} from './utils/test-user-factory';
import { sweepOrphanedE2EUsers } from '../rls/__setup__/cleanup-stale-impl';
import { isTransientAdminError } from './utils/transient-admin-error';

interface PrerequisiteError {
  category: string;
  message: string;
  fix: string;
}

/**
 * Run an admin-API call, retrying only transient failures (#345).
 *
 * Returns the LAST result either way, so callers keep their existing error
 * handling — an error that survives the retries is reported exactly as before,
 * which is what preserves the fail-loudly behaviour #338 introduced.
 *
 * `T` is deliberately unconstrained. Constraining it to `{ error: unknown }`
 * collapses supabase-js's discriminated `{ data, error }` union to `{}` at the
 * call sites, erasing `AuthError`; `error` is read defensively instead so
 * callers keep their types.
 */
async function retryTransient<T>(
  label: string,
  call: () => Promise<T>,
  attempts = 3
): Promise<T> {
  let result = await call();

  for (let attempt = 1; attempt < attempts; attempt++) {
    const err = (result as { error?: unknown } | null)?.error;
    if (!isTransientAdminError(err)) return result;

    const backoffMs = 2000 * attempt; // 2s, then 4s
    const raw = (err as { message?: string })?.message ?? '';
    console.log(
      `  ↻ ${label}: transient admin-API error (attempt ${attempt}/${attempts}, ` +
        `message: ${raw === '' ? '<empty — the #345 signature>' : raw}) — retrying in ${backoffMs}ms`
    );
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
    result = await call();
  }

  return result;
}

async function globalSetup(): Promise<void> {
  console.log('\n🔍 Running E2E prerequisite checks...\n');

  const errors: PrerequisiteError[] = [];

  // 1. Check required environment variables
  const requiredEnvVars = [
    {
      name: 'NEXT_PUBLIC_SUPABASE_URL',
      fix: 'Add NEXT_PUBLIC_SUPABASE_URL to GitHub secrets',
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      fix: 'Add NEXT_PUBLIC_SUPABASE_ANON_KEY to GitHub secrets',
    },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      fix: 'Add SUPABASE_SERVICE_ROLE_KEY to GitHub secrets (required for test user setup)',
    },
    {
      name: 'TEST_USER_PRIMARY_EMAIL',
      fix: 'Add TEST_USER_PRIMARY_EMAIL to GitHub secrets (e.g., yourname+test@gmail.com)',
    },
    {
      name: 'TEST_USER_PRIMARY_PASSWORD',
      fix: 'Add TEST_USER_PRIMARY_PASSWORD to GitHub secrets',
    },
  ];

  for (const { name, fix } of requiredEnvVars) {
    if (!process.env[name]) {
      errors.push({
        category: 'Environment Variable',
        message: `${name} is not set`,
        fix,
      });
    }
  }

  // If critical env vars are missing, fail immediately
  if (errors.length > 0) {
    printErrors(errors);
    throw new Error(
      `E2E prerequisites not met: ${errors.length} missing environment variables`
    );
  }

  // 2. Check Supabase connectivity (in-container admin client — prefer the
  // compose-internal URL for the local sandbox; falls back to the public URL
  // for cloud/CI where SUPABASE_ADMIN_URL is unset). See #121.
  const supabaseUrl =
    process.env.SUPABASE_ADMIN_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  let adminClient;
  try {
    // Bound to a const as well: `let adminClient` is an evolving `any`, which
    // resolves to `unknown` when captured by the retry closures below.
    const client = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    adminClient = client;

    // Test connectivity by listing users (requires service role).
    // Retried: under 28-shard load this is the first call to feel the spike (#345).
    const { error } = await retryTransient('connectivity probe', () =>
      client.auth.admin.listUsers({ perPage: 1 })
    );
    if (error) {
      errors.push({
        category: 'Supabase Connection',
        message: `Failed to connect: ${error.message}`,
        fix: 'Verify SUPABASE_SERVICE_ROLE_KEY is correct and Supabase project is active',
      });
    } else {
      console.log('✓ Supabase connection successful');
    }
  } catch (err) {
    errors.push({
      category: 'Supabase Connection',
      message: `Connection error: ${err instanceof Error ? err.message : String(err)}`,
      fix: 'Check NEXT_PUBLIC_SUPABASE_URL is correct and network is available',
    });
  }

  // 3. Ensure the shared test users exist.
  //
  // ROOT CAUSE of the #197 "test user not found" flake: the old check called
  // adminClient.auth.admin.listUsers() with NO pagination, which returns only
  // the first page (50 users). Once the project accumulates >50 users (throwaway
  // E2E users pile up between cleanups), the shared PRIMARY/TERTIARY users land
  // on page 2+ and the unpaginated check reports them "not found" — failing the
  // whole run even though they exist. It looked like a race because it depended
  // on how many throwaway users existed at check time.
  //
  // Fix: page through ALL users to find them. As a belt-and-suspenders self-heal
  // (covers a genuine mid-run deletion / a --failed rerun that skipped
  // auth-setup), recreate a user that is truly absent, with its encryption keys
  // (ensureEncryptionKeys is idempotent, preserving existing keys → no salt
  // mismatch).
  if (adminClient && errors.length === 0) {
    const testUsers = [
      {
        email: process.env.TEST_USER_PRIMARY_EMAIL!,
        password: process.env.TEST_USER_PRIMARY_PASSWORD!,
        name: 'PRIMARY',
      },
      {
        email: process.env.TEST_USER_TERTIARY_EMAIL,
        password: process.env.TEST_USER_TERTIARY_PASSWORD,
        name: 'TERTIARY',
      },
    ].filter((u) => u.email && u.password) as Array<{
      email: string;
      password: string;
      name: string;
    }>;

    // Page through every user (perPage max 1000) so users past page 1 are seen.
    // A listUsers ERROR must NOT be read as "no users": that makes the shared
    // users look absent and triggers the destructive recreate below against
    // users that actually exist — which is how the shared PRIMARY user got
    // corrupted once (createTestUser → deleteTestUser ran on a live shared user).
    const allEmails = new Set<string>();
    let enumerationError: string | null = null;
    for (let page = 1; page <= 50; page++) {
      // Retried (#345): a transient here becomes `enumerationError`, which
      // correctly refuses to conclude the user is absent — but then reds the
      // shard for a blip. Retrying first keeps that guarantee while removing
      // the false alarm.
      const pageClient = adminClient;
      const { data, error } = await retryTransient(
        `listUsers page ${page}`,
        () => pageClient.auth.admin.listUsers({ page, perPage: 1000 })
      );
      if (error) {
        // Empty-message errors read as "{}" in logs and told nobody anything;
        // name the shape explicitly so the next person can match it to #345.
        enumerationError =
          error.message?.trim() ||
          'empty error from the auth admin API (transient signature, #345) — persisted across retries';
        break;
      }
      const batch = data?.users ?? [];
      for (const u of batch) if (u.email) allEmails.add(u.email.toLowerCase());
      if (batch.length < 1000) break; // last page
    }

    for (const { email, password, name } of testUsers) {
      if (allEmails.has(email.toLowerCase())) {
        console.log(`✓ Test user ${name} exists: ${email}`);
        continue;
      }

      // Not seen — but if the enumeration ERRORED we cannot conclude the user
      // is absent. Recreating (delete+create) a user that actually exists is
      // what orphans the shared user, so fail loudly for a re-run instead of
      // recreating on incomplete data.
      if (enumerationError) {
        errors.push({
          category: 'Test User',
          message: `Could not verify ${name} exists — listUsers error: ${enumerationError}`,
          fix: 'Transient admin API error — re-run the job (do NOT recreate the shared user on incomplete enumeration).',
        });
        continue;
      }

      // Genuinely absent (deleted mid-run / rerun without auth-setup) — recreate.
      console.log(`↻ Test user ${name} missing — recreating: ${email}`);
      const created = await createTestUser(email, password, {
        createProfile: true,
      });
      if (!created) {
        errors.push({
          category: 'Test User',
          message: `${name} test user not found and could not be recreated: ${email}`,
          fix: `Check SUPABASE_SERVICE_ROLE_KEY can create users, or create ${email} manually.`,
        });
        continue;
      }
      await ensureEncryptionKeys(email, password); // idempotent
      console.log(`✓ Recreated test user ${name}: ${email}`);
    }
  }

  // 4. Verify PRIMARY user password is correct
  if (errors.length === 0) {
    console.log('\n🔑 Verifying PRIMARY user credentials...');

    // Runs in the Node test process (in-container), so use the admin URL for
    // local-sandbox reachability; falls back to the public URL on cloud/CI (#121).
    //
    // Signs in with the SERVICE ROLE key, not the anon key. CAPTCHA is enabled
    // on this project (#353) and `SECURITY_CAPTCHA_ENABLED` is global to auth,
    // so an anon-key password grant is refused with `captcha_failed` before the
    // password is ever examined — which broke this check the moment protection
    // went on. GoTrue exempts service-role callers from the captcha, and the
    // key is already required above to create users, so this adds no new secret.
    //
    // This does NOT weaken the check. A wrong password is still rejected with
    // `invalid_credentials`, and the returned JWT is an ordinary
    // `role: authenticated` session for that user, so nothing downstream gains
    // privilege and RLS still applies exactly as before. Both were verified
    // against the live project before this was adopted.
    const credentialCheckClient = createClient(
      process.env.SUPABASE_ADMIN_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Retried (#345). A wrong password reports "Invalid login credentials" and
    // is NOT retried — it fails fast, as it must. Only an unexplained failure
    // (the empty-error signature) gets another attempt.
    const { error: signInError } = await retryTransient(
      'PRIMARY credential check',
      () =>
        credentialCheckClient.auth.signInWithPassword({
          email: process.env.TEST_USER_PRIMARY_EMAIL!,
          password: process.env.TEST_USER_PRIMARY_PASSWORD!,
        })
    );

    if (signInError) {
      errors.push({
        category: 'Test User Password',
        message: `PRIMARY user sign-in failed: ${signInError.message}`,
        fix: signInError.message.includes('Invalid login')
          ? `TEST_USER_PRIMARY_PASSWORD in GitHub secrets does not match the password for ${process.env.TEST_USER_PRIMARY_EMAIL} in Supabase. Update the secret or reset the user's password.`
          : signInError.message.includes('rate')
            ? 'Rate limited - too many sign-in attempts. Wait 15 minutes or increase rate limits in Supabase.'
            : `Check Supabase logs for details: ${signInError.message}`,
      });
    } else {
      console.log('✓ PRIMARY user credentials verified');
      // Sign out to clean up
      await credentialCheckClient.auth.signOut();
    }
  }

  // Final check
  if (errors.length > 0) {
    printErrors(errors);
    throw new Error(`E2E prerequisites not met: ${errors.length} issues found`);
  }

  // Sweep orphaned per-test isolated users (#354).
  //
  // Per-test isolation is what ended the shared-user corruption class
  // (#338/#341/#342), but its per-test `afterAll` cleanup never runs when a
  // shard is cancelled or times out — exactly when it is needed. 381 orphans
  // accumulated on prod between 2026-05-30 and 2026-07-24.
  //
  // This runs at SETUP rather than teardown deliberately: the sweeper's age
  // guard means it only removes users older than 2h, so at run start every
  // in-flight user (this run's or a concurrent suite's) is far too young to
  // touch. A teardown sweep would be racing the very users it should preserve.
  //
  // Best-effort by design — cleaning up yesterday's litter must never be the
  // reason today's suite fails to start.
  try {
    if (!adminClient) throw new Error('no admin client');
    const summary = await sweepOrphanedE2EUsers(adminClient, {
      logger: {
        info: (msg, meta) => console.log(`   ${msg}`, meta ?? ''),
        warn: (msg, meta) => console.warn(`   ⚠️  ${msg}`, meta ?? ''),
      },
    });
    if (summary.usersRemoved > 0 || summary.errorsLogged > 0) {
      console.log(
        `\n🧹 Swept ${summary.usersRemoved} orphaned E2E user(s) ` +
          `(kept ${summary.allowlisted} named fixture(s), ` +
          `${summary.tooRecent} too recent), ${summary.errorsLogged} error(s).`
      );
    }
  } catch (err) {
    console.warn('\n⚠️  Orphan sweep failed (non-fatal):', err);
  }

  console.log('\n✅ All prerequisites met. Starting tests...\n');
}

function printErrors(errors: PrerequisiteError[]): void {
  console.error('\n❌ E2E PREREQUISITE CHECK FAILED\n');
  console.error(
    'The following issues must be resolved before tests can run:\n'
  );

  const byCategory = errors.reduce(
    (acc, err) => {
      if (!acc[err.category]) acc[err.category] = [];
      acc[err.category].push(err);
      return acc;
    },
    {} as Record<string, PrerequisiteError[]>
  );

  for (const [category, categoryErrors] of Object.entries(byCategory)) {
    console.error(`[${category}]`);
    for (const err of categoryErrors) {
      console.error(`  ❌ ${err.message}`);
      console.error(`     Fix: ${err.fix}`);
    }
    console.error('');
  }

  console.error(
    'Tests will NOT run until these issues are fixed.\n' +
      'This prevents wasting 30+ minutes on tests that will fail anyway.\n'
  );
}

export default globalSetup;
