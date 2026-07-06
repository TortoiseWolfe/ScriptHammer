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

interface PrerequisiteError {
  category: string;
  message: string;
  fix: string;
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
    adminClient = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Test connectivity by listing users (requires service role)
    const { error } = await adminClient.auth.admin.listUsers({ perPage: 1 });
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
    const allEmails = new Set<string>();
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error) break;
      const batch = data?.users ?? [];
      for (const u of batch) if (u.email) allEmails.add(u.email.toLowerCase());
      if (batch.length < 1000) break; // last page
    }

    for (const { email, password, name } of testUsers) {
      if (allEmails.has(email.toLowerCase())) {
        console.log(`✓ Test user ${name} exists: ${email}`);
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
    const anonClient = createClient(
      process.env.SUPABASE_ADMIN_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: signInError } = await anonClient.auth.signInWithPassword({
      email: process.env.TEST_USER_PRIMARY_EMAIL!,
      password: process.env.TEST_USER_PRIMARY_PASSWORD!,
    });

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
      await anonClient.auth.signOut();
    }
  }

  // Final check
  if (errors.length > 0) {
    printErrors(errors);
    throw new Error(`E2E prerequisites not met: ${errors.length} issues found`);
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
