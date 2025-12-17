/**
 * Test User Factory - Dynamic user creation for E2E tests
 * Feature: 027-signup-e2e-tests
 *
 * Uses Supabase admin API to:
 * - Create users dynamically in tests
 * - Auto-confirm email addresses
 * - Clean up users after tests
 *
 * This enables self-contained E2E tests that don't rely on pre-seeded users.
 */

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';

/**
 * Email domain for test users.
 *
 * IMPORTANT: Supabase validates email domains for MX (mail exchange) records.
 * - `@example.com` is BLOCKED (reserved domain)
 * - Custom domains without email infrastructure are BLOCKED
 * - Gmail with plus aliases WORKS: `yourname+tag@gmail.com`
 *
 * Set TEST_EMAIL_DOMAIN in .env to override the default.
 * For Gmail plus aliases, use format: `yourname+e2e@gmail.com`
 *
 * @example
 * // .env
 * TEST_EMAIL_DOMAIN=myname+e2e@gmail.com
 */
export const TEST_EMAIL_DOMAIN = process.env.TEST_EMAIL_DOMAIN || 'example.com';

// Warn if using default domain (will fail with Supabase)
if (!process.env.TEST_EMAIL_DOMAIN) {
  console.warn(
    '\n⚠️  WARNING: TEST_EMAIL_DOMAIN not set!\n' +
      '   E2E tests will fail because Supabase rejects @example.com emails.\n' +
      '   Set TEST_EMAIL_DOMAIN in .env (e.g., TEST_EMAIL_DOMAIN=yourname+e2e@gmail.com)\n'
  );
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

let adminClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase admin client
 * Uses SUPABASE_SERVICE_ROLE_KEY for admin operations
 */
export function getAdminClient(): SupabaseClient | null {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn(
      'Test User Factory: SUPABASE_SERVICE_ROLE_KEY not configured. ' +
        'Dynamic user creation will not work.'
    );
    return null;
  }

  adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

/**
 * Create a test user with auto-confirmed email
 *
 * @param email - User email address
 * @param password - User password (must meet Supabase requirements)
 * @param options - Optional: username for user_profiles, additional metadata
 * @returns TestUser object with id, email, password
 *
 * @example
 * const user = await createTestUser('test@example.com', 'Password123!');
 * // user is now created and email-confirmed
 * await deleteTestUser(user.id);
 */
export async function createTestUser(
  email: string,
  password: string,
  options?: {
    username?: string;
    createProfile?: boolean;
    metadata?: Record<string, unknown>;
  }
): Promise<TestUser | null> {
  const client = getAdminClient();
  if (!client) {
    console.error('createTestUser: Admin client not available');
    return null;
  }

  // Check if user already exists
  const { data: existingUsers } = await client.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find((u) => u.email === email);

  if (existingUser) {
    console.log(`createTestUser: User ${email} already exists, deleting first`);
    await deleteTestUser(existingUser.id);
  }

  // Create user with email confirmed
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email
    user_metadata: options?.metadata,
  });

  if (error) {
    console.error(
      `createTestUser: Failed to create user ${email}:`,
      error.message
    );
    return null;
  }

  if (!data.user) {
    console.error(`createTestUser: No user returned for ${email}`);
    return null;
  }

  console.log(`createTestUser: Created user ${email} with id ${data.user.id}`);

  // Create user_profiles record if requested
  if (options?.createProfile !== false) {
    const username = options?.username || email.split('@')[0];
    await createUserProfile(data.user.id, username);
  }

  return {
    id: data.user.id,
    email,
    password,
  };
}

/**
 * Create a user_profiles record for a user
 *
 * Required for messaging/connection features to work properly.
 */
export async function createUserProfile(
  userId: string,
  username: string
): Promise<boolean> {
  const client = getAdminClient();
  if (!client) return false;

  // Check if profile already exists
  const { data: existing } = await client
    .from('user_profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (existing) {
    console.log(`createUserProfile: Profile already exists for ${userId}`);
    return true;
  }

  const { error } = await client.from('user_profiles').insert({
    id: userId,
    username,
    display_name: username,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error(`createUserProfile: Failed for ${userId}:`, error.message);
    return false;
  }

  console.log(
    `createUserProfile: Created profile for ${userId} with username ${username}`
  );
  return true;
}

/**
 * Delete a test user and their associated data
 *
 * Cleans up in order:
 * 1. Messages sent by user
 * 2. Conversations involving user
 * 3. User connections
 * 4. User profile
 * 5. Auth user
 */
export async function deleteTestUser(userId: string): Promise<boolean> {
  const client = getAdminClient();
  if (!client) return false;

  try {
    // Clean up messaging data
    await client.from('messages').delete().eq('sender_id', userId);

    await client
      .from('conversations')
      .delete()
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`);

    await client
      .from('user_connections')
      .delete()
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    // Clean up user profile
    await client.from('user_profiles').delete().eq('id', userId);

    // Delete auth user
    const { error } = await client.auth.admin.deleteUser(userId);

    if (error) {
      console.error(
        `deleteTestUser: Failed to delete auth user ${userId}:`,
        error.message
      );
      return false;
    }

    console.log(`deleteTestUser: Successfully deleted user ${userId}`);
    return true;
  } catch (err) {
    console.error(`deleteTestUser: Error deleting user ${userId}:`, err);
    return false;
  }
}

/**
 * Delete a test user by email address
 */
export async function deleteTestUserByEmail(email: string): Promise<boolean> {
  const client = getAdminClient();
  if (!client) return false;

  const { data: users } = await client.auth.admin.listUsers();
  const user = users?.users?.find((u) => u.email === email);

  if (!user) {
    console.log(`deleteTestUserByEmail: User ${email} not found`);
    return true; // Already doesn't exist
  }

  return deleteTestUser(user.id);
}

/**
 * Get user by email address
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const client = getAdminClient();
  if (!client) return null;

  const { data: users } = await client.auth.admin.listUsers();
  return users?.users?.find((u) => u.email === email) || null;
}

/**
 * Check if admin client is available
 */
export function isAdminClientAvailable(): boolean {
  return getAdminClient() !== null;
}

/**
 * Generate a unique test email using TEST_EMAIL_DOMAIN
 *
 * Supports Gmail plus aliases (e.g., myname+test@gmail.com)
 * When using Gmail, the prefix is added as a plus-alias tag.
 *
 * @param prefix - Prefix for the email (default: 'e2e-test')
 * @returns Unique email address
 *
 * @example
 * // With TEST_EMAIL_DOMAIN=example.com (default)
 * generateTestEmail('signup') // => 'signup-1234567890-abc123@example.com'
 *
 * // With TEST_EMAIL_DOMAIN=myname+e2e@gmail.com
 * generateTestEmail('signup') // => 'myname+signup-1234567890-abc123@gmail.com'
 */
export function generateTestEmail(prefix = 'e2e-test'): string {
  const domain = TEST_EMAIL_DOMAIN;
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Handle Gmail plus alias format (e.g., myname+e2e@gmail.com)
  if (domain.includes('@gmail.com')) {
    const [baseUser] = domain.split('@');
    // Append prefix to the existing plus alias or create new one
    if (baseUser.includes('+')) {
      const [user, existingTag] = baseUser.split('+');
      return `${user}+${existingTag}-${prefix}-${uniqueSuffix}@gmail.com`;
    }
    return `${baseUser}+${prefix}-${uniqueSuffix}@gmail.com`;
  }

  // Standard domain format
  return `${prefix}-${uniqueSuffix}@${domain}`;
}

/**
 * Default test password that meets Supabase requirements
 */
export const DEFAULT_TEST_PASSWORD = 'TestPassword123!';

/**
 * Dismiss cookie consent banner and promotional banners if visible.
 *
 * Call this after page.goto() and before interacting with forms.
 * These banners overlay the page and can intercept button clicks.
 *
 * Dismisses:
 * - Cookie consent banner ("Accept All" button)
 * - Promotional countdown banner ("Dismiss countdown banner" button)
 *
 * @param page - Playwright page object
 * @param options - Configuration options
 * @param options.timeout - Max time to wait for banner (default: 2000ms)
 *
 * @example
 * await page.goto('/sign-up');
 * await dismissCookieBanner(page);
 * // Now safe to interact with the sign-up form
 */
export async function dismissCookieBanner(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 2000 } = options;

  // Wait for page to stabilize first
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  // Dismiss cookie consent banner using force click
  try {
    const acceptButton = page
      .getByRole('button', { name: /accept all/i })
      .first();
    if (await acceptButton.isVisible({ timeout }).catch(() => false)) {
      await acceptButton.click({ force: true });
      await page.waitForTimeout(500);
    }
  } catch {
    // Banner not present or already dismissed - continue silently
  }

  // Dismiss promotional countdown banner using force click
  try {
    const countdownDismiss = page.getByRole('button', {
      name: /dismiss countdown banner/i,
    });
    if (await countdownDismiss.isVisible({ timeout }).catch(() => false)) {
      await countdownDismiss.click({ force: true });
      await page.waitForTimeout(500);
    }
  } catch {
    // Banner not present or already dismissed - continue silently
  }
}
