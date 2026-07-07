/**
 * Test User Factory
 *
 * Provides utilities for creating and managing test users
 * in RLS policy testing scenarios.
 *
 * @module tests/fixtures/test-users
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

// Test configuration — read without non-null assertion so we can gate
// cleanly when infra is absent rather than failing with an opaque
// "Invalid API key" deep inside the Supabase client.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Reports whether the current environment can run live RLS tests.
 *
 * RLS tests exercise real Postgres row-level-security policies. They need a
 * running Supabase instance AND the service-role key (to create/delete test
 * users via the admin API). CI does not provide these; the local
 * `docker compose --profile supabase` stack does.
 *
 * Usage in test files:
 *   describe.skipIf(!hasRlsTestEnvironment())('RLS: ...', () => { ... })
 *
 * This keeps security tests visible in CI output as "skipped" rather than
 * invisibly excluded, so reviewers know they exist.
 */
export function hasRlsTestEnvironment(): boolean {
  return Boolean(
    SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY
  );
}

/** Human-readable explanation for why RLS tests were skipped. */
export const RLS_SKIP_REASON =
  'RLS tests require a live Supabase instance and SUPABASE_SERVICE_ROLE_KEY. ' +
  'Run `docker compose --profile supabase up` then `pnpm test:rls`.';

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `${name} is not set. ${RLS_SKIP_REASON} ` +
        `(Did you forget to gate with describe.skipIf(!hasRlsTestEnvironment())?)`
    );
  }
  return value;
}

/**
 * Test user credentials
 */
export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/**
 * Test user presets for consistent testing
 */
export const TEST_USERS = {
  userA: {
    email: 'test-user-a@scripthammer.test',
    password: 'TestPassword123!',
  },
  userB: {
    email: 'test-user-b@scripthammer.test',
    password: 'TestPassword456!',
  },
  admin: {
    email: 'test-admin@scripthammer.test',
    password: 'AdminPassword789!',
  },
} as const;

/**
 * Creates a Supabase client with anon key (for unauthenticated tests)
 */
export function createAnonClient() {
  return createClient<Database>(
    requireEnv(SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv(SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
  );
}

/**
 * Creates a Supabase client with service role (bypasses RLS)
 */
export function createServiceClient() {
  return createClient<Database>(
    requireEnv(SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv(SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Creates an authenticated Supabase client for a test user
 *
 * @param email - User email address
 * @param password - User password
 * @returns Authenticated Supabase client
 *
 * @example
 * ```typescript
 * const client = await createAuthenticatedClient('user@test.com', 'password');
 * const { data } = await client.from('profiles').select();
 * ```
 */
export async function createAuthenticatedClient(
  email: string,
  password: string
) {
  const client = createClient<Database>(
    requireEnv(SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv(SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
  );

  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Failed to authenticate test user: ${error.message}`);
  }

  return client;
}

/**
 * Creates a test user via service role client
 *
 * @param email - User email address
 * @param password - User password
 * @returns Created user data
 *
 * @example
 * ```typescript
 * const user = await createTestUser('new@test.com', 'password123');
 * console.log(user.id); // UUID of created user
 * ```
 */
export async function createTestUser(
  email: string,
  password: string
): Promise<TestUser> {
  const serviceClient = createServiceClient();

  // Try to create the user. If they already exist (stale from a prior run),
  // delete and recreate so the password is known and the state is clean.
  let userId: string;

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    if (
      error.message.includes('already been registered') ||
      error.message.includes('Database error')
    ) {
      // Find and delete the stale user, then recreate
      const { data: listData } = await serviceClient.auth.admin.listUsers({
        perPage: 1000,
      });
      const existing = listData?.users?.find((u) => u.email === email);
      if (existing) {
        await serviceClient.auth.admin.deleteUser(existing.id);
      }
      const { data: retryData, error: retryError } =
        await serviceClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
      if (retryError) {
        throw new Error(
          `Failed to recreate test user after cleanup: ${retryError.message}`
        );
      }
      userId = retryData.user.id;
    } else {
      throw new Error(`Failed to create test user: ${error.message}`);
    }
  } else {
    userId = data.user.id;
  }

  // Ensure user_profiles row exists. The on_auth_user_created trigger
  // should create it, but admin API createUser doesn't always fire
  // triggers on Supabase Cloud. Insert idempotently via service role.
  await serviceClient
    .from('user_profiles')
    .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });

  return { id: userId, email, password };
}

/**
 * Deletes a test user via service role client
 *
 * @param userId - User ID to delete
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const serviceClient = createServiceClient();

  const { error } = await serviceClient.auth.admin.deleteUser(userId);

  if (error && !error.message.includes('User not found')) {
    throw new Error(`Failed to delete test user: ${error.message}`);
  }
}

/**
 * Sets up test users before test suite runs
 * Creates all preset test users
 *
 * @returns Array of created test users
 */
export async function setupTestUsers(): Promise<TestUser[]> {
  const users: TestUser[] = [];

  for (const [, preset] of Object.entries(TEST_USERS)) {
    try {
      const user = await createTestUser(preset.email, preset.password);
      users.push(user);
    } catch (error) {
      // User might already exist, try to sign in instead
      console.warn(`Test user might already exist: ${preset.email}`);
    }
  }

  return users;
}

/**
 * Cleans up test users after test suite completes
 *
 * @param users - Array of test users to delete
 */
export async function cleanupTestUsers(users: TestUser[]): Promise<void> {
  for (const user of users) {
    try {
      await deleteTestUser(user.id);
    } catch (error) {
      console.warn(`Failed to cleanup test user ${user.email}:`, error);
    }
  }
}
