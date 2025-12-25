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

  // 2. Check Supabase connectivity
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
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

  // 3. Check test users exist
  if (adminClient && errors.length === 0) {
    const testUsers = [
      { email: process.env.TEST_USER_PRIMARY_EMAIL!, name: 'PRIMARY' },
      { email: process.env.TEST_USER_TERTIARY_EMAIL, name: 'TERTIARY' },
    ].filter((u) => u.email); // Only check users that are configured

    const { data: users } = await adminClient.auth.admin.listUsers();

    for (const { email, name } of testUsers) {
      const exists = users?.users?.some((u) => u.email === email);
      if (exists) {
        console.log(`✓ Test user ${name} exists: ${email}`);
      } else {
        errors.push({
          category: 'Test User',
          message: `${name} test user not found: ${email}`,
          fix: `Create user ${email} in Supabase Auth dashboard or via admin API`,
        });
      }
    }
  }

  // 4. Verify PRIMARY test user password is correct (prevents all sign-in tests from failing)
  if (errors.length === 0) {
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const testEmail = process.env.TEST_USER_PRIMARY_EMAIL!;
    const testPassword = process.env.TEST_USER_PRIMARY_PASSWORD!;

    try {
      const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { error: signInError } = await anonClient.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

      if (signInError) {
        errors.push({
          category: 'Password Verification',
          message: `Cannot sign in as PRIMARY test user: ${signInError.message}`,
          fix: signInError.message.includes('Invalid login credentials')
            ? 'TEST_USER_PRIMARY_PASSWORD in GitHub secrets does not match the password in Supabase'
            : `Check Supabase auth settings: ${signInError.message}`,
        });
      } else {
        console.log(`✓ Password verified for ${testEmail}`);
        // Sign out to clean up
        await anonClient.auth.signOut();
      }
    } catch (err) {
      errors.push({
        category: 'Password Verification',
        message: `Error testing sign-in: ${err instanceof Error ? err.message : String(err)}`,
        fix: 'Check Supabase connection and auth configuration',
      });
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
