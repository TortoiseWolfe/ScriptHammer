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
 * Priority order:
 * 1. TEST_EMAIL_DOMAIN (explicit setting)
 * 2. Domain derived from TEST_USER_PRIMARY_EMAIL (recommended)
 * 3. 'example.com' (fallback - will fail with Supabase)
 *
 * @example
 * // .env - Option 1: Use explicit domain
 * TEST_EMAIL_DOMAIN=myname+e2e@gmail.com
 *
 * // .env - Option 2: Derive from primary test user (recommended)
 * TEST_USER_PRIMARY_EMAIL=myname+test@gmail.com
 */
function getDerivedEmailDomain(): string {
  // First check if TEST_EMAIL_DOMAIN is explicitly set
  if (process.env.TEST_EMAIL_DOMAIN) {
    return process.env.TEST_EMAIL_DOMAIN;
  }

  // Try to derive from TEST_USER_PRIMARY_EMAIL
  const primaryEmail = process.env.TEST_USER_PRIMARY_EMAIL || '';
  if (primaryEmail.includes('@gmail.com')) {
    // Extract base user from Gmail (e.g., "user+test@gmail.com" -> "user")
    const baseUser = primaryEmail.split('+')[0] || primaryEmail.split('@')[0];
    return `${baseUser}+e2e@gmail.com`;
  }

  if (primaryEmail.includes('@')) {
    // Use the same domain as primary email
    return primaryEmail.split('@')[1];
  }

  // Fallback - will fail with Supabase
  return 'example.com';
}

export const TEST_EMAIL_DOMAIN = getDerivedEmailDomain();

// Warn if using fallback domain (will fail with Supabase)
if (TEST_EMAIL_DOMAIN === 'example.com') {
  console.warn(
    '\n⚠️  WARNING: No valid email domain configured!\n' +
      '   E2E tests will fail because Supabase rejects @example.com emails.\n' +
      '   Set TEST_USER_PRIMARY_EMAIL or TEST_EMAIL_DOMAIN in .env\n' +
      '   (e.g., TEST_USER_PRIMARY_EMAIL=yourname+test@gmail.com)\n'
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

      // CRITICAL: Wait for consent to persist to localStorage
      // React's useEffect saves consent asynchronously after state update.
      // Without this wait, navigating away before save completes loses consent.
      await page.waitForFunction(
        () => {
          try {
            const consent = localStorage.getItem('cookie-consent');
            if (!consent) return false;
            const parsed = JSON.parse(consent);
            return parsed.functional === true;
          } catch {
            return false;
          }
        },
        { timeout: 3000 }
      );
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

/**
 * Handle ReAuthModal that appears when accessing /messages after session restore.
 * Enters the messaging password to unlock encryption keys.
 *
 * The ReAuthModal appears when:
 * - User navigates to /messages after session restore
 * - Session is valid but encryption keys are not in memory
 *
 * @param page - Playwright page object
 * @param password - Password to enter (defaults to TEST_USER_PRIMARY_PASSWORD)
 * @returns true if modal was handled, false if modal was not present
 *
 * @example
 * await page.goto('/messages');
 * await handleReAuthModal(page);
 * // Now messaging UI is accessible
 */
export async function handleReAuthModal(
  page: Page,
  password?: string
): Promise<boolean> {
  const testPassword =
    password || process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!';

  // Wait for ReAuthModal to potentially appear (give it time to load)
  const modal = page.locator('[role="dialog"]').first();

  // Try to wait for the modal to be visible, but don't fail if it doesn't appear
  try {
    await modal.waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    // Modal didn't appear within timeout - that's fine
    return false;
  }

  // Verify it's the ReAuthModal by checking content
  const modalText = await modal.textContent();
  if (
    !modalText?.toLowerCase().includes('password') &&
    !modalText?.toLowerCase().includes('encryption') &&
    !modalText?.toLowerCase().includes('messaging')
  ) {
    return false;
  }

  // Fill password and submit
  const passwordInput = modal.locator('input[type="password"]').first();
  await passwordInput.fill(testPassword);

  const submitBtn = modal.locator('button[type="submit"]').first();
  await submitBtn.click();

  // Wait for modal to close
  await modal.waitFor({ state: 'hidden', timeout: 10000 });
  return true;
}

/**
 * Click the Sign Out button in GlobalNav dropdown.
 *
 * The Sign Out button is inside the user avatar dropdown menu.
 * This helper opens the dropdown and clicks Sign Out.
 *
 * @param page - Playwright page object
 *
 * @example
 * await signOutViaDropdown(page);
 * // User is now signed out
 */
export async function signOutViaDropdown(page: Page): Promise<void> {
  // Click the avatar to open dropdown (has aria-label="User account menu")
  const avatarButton = page.getByLabel('User account menu');
  await avatarButton.click();

  // Wait for dropdown to open and click Sign Out
  const signOutButton = page.getByRole('button', { name: 'Sign Out' });
  await signOutButton.waitFor({ state: 'visible', timeout: 5000 });
  await signOutButton.click();

  // Wait for sign-out to complete (redirects to home page)
  await page.waitForURL('/', { timeout: 10000 });

  // Wait for Sign In link to appear (indicates signed out state)
  const signInLink = page.getByRole('link', { name: 'Sign In' });
  await signInLink.waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Wait for authenticated state to fully hydrate.
 * Waits for Messages link to be visible in GlobalNav (indicates user is logged in).
 *
 * This addresses the race condition where:
 * 1. Sign-in completes and URL redirects
 * 2. But AuthContext hasn't updated yet
 * 3. GlobalNav still shows Sign In/Sign Up buttons
 *
 * Note: Sign Out button is inside a dropdown menu and not directly visible,
 * so we check for the Messages link which only appears for authenticated users.
 *
 * @param page - Playwright page object
 * @param timeout - Max time to wait (default: 15000ms)
 *
 * @example
 * await page.getByRole('button', { name: 'Sign In' }).click();
 * await waitForAuthenticatedState(page);
 * // Now user is authenticated and Messages link is visible
 */
export async function waitForAuthenticatedState(
  page: Page,
  timeout = 15000
): Promise<void> {
  // Wait for URL to not be sign-in
  await page.waitForURL((url) => !url.pathname.includes('/sign-in'), {
    timeout,
  });

  // Wait for Messages link (indicates GlobalNav has user context)
  // Messages link only appears for authenticated users
  const messagesLink = page.getByRole('link', { name: /messages/i });
  await messagesLink.waitFor({ state: 'visible', timeout });
}

/**
 * Perform sign-in with proper error detection.
 *
 * Unlike just filling forms and clicking, this helper:
 * 1. Fills credentials
 * 2. Clicks sign-in
 * 3. Waits for EITHER success OR failure
 * 4. Returns detailed error if sign-in failed
 *
 * @param page - Playwright page object
 * @param email - User email
 * @param password - User password
 * @param options - Configuration options
 * @returns Object with success boolean and optional error message
 *
 * @example
 * const result = await performSignIn(page, 'test@example.com', 'password');
 * if (!result.success) {
 *   throw new Error(`Sign-in failed: ${result.error}`);
 * }
 */
export async function performSignIn(
  page: Page,
  email: string,
  password: string,
  options: { rememberMe?: boolean; timeout?: number } = {}
): Promise<{ success: boolean; error?: string }> {
  const { rememberMe = false, timeout = 15000 } = options;

  // Dismiss cookie banner first - it can block form interactions
  await dismissCookieBanner(page);

  // Fill credentials
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);

  if (rememberMe) {
    await page.getByLabel('Remember Me').check();
  }

  // Click sign in
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for EITHER redirect (success) OR error message (failure)
  try {
    // Race between success redirect and error appearance
    const result = await Promise.race([
      // Success: URL changes away from /sign-in
      page
        .waitForURL((url) => !url.pathname.includes('/sign-in'), { timeout })
        .then(() => ({ success: true as const })),

      // Failure: Alert with error message appears
      page
        .locator('[role="alert"]')
        .filter({ hasText: /./i }) // Has any text
        .first()
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(async () => {
          const alertText = await page
            .locator('[role="alert"]')
            .first()
            .textContent();
          return {
            success: false as const,
            error: alertText || 'Unknown error',
          };
        }),
    ]);

    if (result.success) {
      // Wait for full auth hydration
      await waitForAuthenticatedState(page, timeout);
      return { success: true };
    }

    return result;
  } catch (err) {
    // Timeout - check current state
    const currentUrl = page.url();
    if (currentUrl.includes('/sign-in')) {
      // Still on sign-in page - check for error
      const alertText = await page
        .locator('[role="alert"]')
        .first()
        .textContent()
        .catch(() => null);

      return {
        success: false,
        error: alertText || 'Sign-in timed out (still on sign-in page)',
      };
    }

    // Not on sign-in but auth didn't hydrate
    return {
      success: false,
      error: `Auth hydration timeout at ${currentUrl}`,
    };
  }
}
