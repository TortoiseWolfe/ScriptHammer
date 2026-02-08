/**
 * Test User Factory
 *
 * Provides utilities for creating and managing test users
 * in RLS policy testing scenarios.
 *
 * @module tests/fixtures/test-users
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Test configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Creates a Supabase client with service role (bypasses RLS)
 */
export function createServiceClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
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
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

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

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Skip email confirmation for tests
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  return {
    id: data.user.id,
    email,
    password,
  };
}

/**
 * Deletes a test user via service role client
 *
 * @param userId - User ID to delete
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const serviceClient = createServiceClient();

  const { error } = await serviceClient.auth.admin.deleteUser(userId);

  if (error) {
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
