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
import { expect, type Page } from '@playwright/test';
import { KeyDerivationService } from '@/lib/messaging/key-derivation';

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
 * Ensure a test user has valid encryption keys in the database.
 *
 * Uses the admin API to directly insert password-derived keys,
 * bypassing the browser-based setup flow (ReAuthModal, /messages/setup)
 * which is unreliable on Supabase free tier due to timeouts.
 *
 * This follows the same pattern as scripts/initialize-test-keys.ts.
 *
 * @param email - User email address
 * @param password - Password to derive encryption keys from
 * @returns true if keys exist (or were created), false on failure
 */
export async function ensureEncryptionKeys(
  email: string,
  password: string
): Promise<boolean> {
  const admin = getAdminClient();
  if (!admin) {
    console.error(`ensureEncryptionKeys: Admin client not available`);
    return false;
  }

  const user = await getUserByEmail(email);
  if (!user) {
    console.error(`ensureEncryptionKeys: User ${email} not found`);
    return false;
  }

  // Always delete and recreate keys. Stale keys from previous CI runs
  // have a different salt, causing ECDH shared secret mismatch: the
  // browser derives keys with the DB salt, but the stored public key
  // was derived with a different salt. This breaks sendMessage() because
  // ECDH(sender_private_new, recipient_public_old) ≠ shared secret.
  await admin.from('user_encryption_keys').delete().eq('user_id', user.id);

  // Derive new keys from password (same pattern as scripts/initialize-test-keys.ts)
  const kds = new KeyDerivationService();
  const salt = kds.generateSalt();
  const keyPair = await kds.deriveKeyPair({ password, salt });

  const { error } = await admin.from('user_encryption_keys').insert({
    user_id: user.id,
    public_key: keyPair.publicKeyJwk,
    encryption_salt: keyPair.salt,
    device_id: null,
    expires_at: null,
    revoked: false,
  });

  if (error) {
    console.error(`ensureEncryptionKeys: Failed for ${email}:`, error.message);
    return false;
  }

  console.log(`✓ Encryption keys created for ${email} via admin API`);
  return true;
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

  // Check if the CURRENT user's keys are cached. The key format is
  // sh_keys_{userId} — we need to verify the cached key belongs to the
  // authenticated user, not a different user from storageState.
  // Extract the Supabase user ID from the session to check.
  const currentUserKeyExists = await page.evaluate(() => {
    // Find the Supabase session to get the current user ID
    const sessionKey = Object.keys(localStorage).find(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
    );
    if (!sessionKey) return false;
    try {
      const session = JSON.parse(localStorage.getItem(sessionKey) || '{}');
      const userId = session?.user?.id;
      if (!userId) return false;
      return localStorage.getItem(`sh_keys_${userId}`) !== null;
    } catch {
      return false;
    }
  });
  if (currentUserKeyExists) {
    console.log(
      `[handleReAuthModal] Current user's keys cached — skipping modal. URL: ${page.url()}`
    );
    await page.waitForTimeout(1000);
    return false;
  }

  // EncryptionKeyGate has two paths when keys aren't in memory:
  // 1. Keys exist in DB → shows ReAuthModal overlay
  // 2. Keys missing from DB (race/slow query) → redirects to /messages/setup
  // Handle both: wait for the gate to finish checking, then react.

  // Capture browser console for CI debugging (EncryptionKeyGate logs hasKeys result)
  const consoleHandler = (msg: import('@playwright/test').ConsoleMessage) => {
    const text = msg.text();
    if (text.includes('EncryptionKeyGate') || text.includes('hasKeys')) {
      console.log(`[browser] ${text}`);
    }
  };
  page.on('console', consoleHandler);

  // Wait for EncryptionKeyGate to finish its async check (auth hydration +
  // hasKeysForUser() Supabase query). The gate renders a loading overlay
  // with data-testid="encryption-key-gate-loading" while checking. Once it
  // disappears, the gate has decided: show ReAuthModal, redirect to setup,
  // or keys are already unlocked.
  const loadingOverlay = page.locator(
    '[data-testid="encryption-key-gate-loading"]'
  );
  try {
    // First wait for the overlay to appear (page may still be loading)
    await loadingOverlay
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => {});
    // Then wait for it to disappear (gate finished checking)
    await loadingOverlay.waitFor({ state: 'hidden', timeout: 30000 });
    console.log(`[handleReAuthModal] Gate loading finished`);
  } catch {
    // Overlay may never appear if keys were already in memory
    console.log(
      `[handleReAuthModal] Gate overlay not detected (keys may be in memory)`
    );
  }

  console.log(`[handleReAuthModal] URL after gate: ${page.url()}`);

  if (page.url().includes('/messages/setup')) {
    // Path 2: Full setup page — fill form and submit
    const setupPassword = page.locator('#setup-password');
    const setupVisible = await setupPassword
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (setupVisible) {
      await setupPassword.fill(testPassword);
      await page.locator('#setup-confirm').fill(testPassword);
      const setupBtn = page.getByRole('button', {
        name: /Set Up Encrypted Messaging/i,
      });
      await setupBtn.click();
      await page.waitForURL(/\/messages(?!\/setup)/, { timeout: 60000 });
      await page.waitForLoadState('domcontentloaded');
      return true;
    }
  }

  // Path 1: ReAuthModal overlay on /messages page
  const modal = page.locator('[role="dialog"]').first();

  // Wait for the modal to appear. The gate loading overlay already
  // finished above, so if the modal is going to appear, it shows within
  // 3s (React re-render after checkKeys resolves). 15s was too long and
  // wasted time in tests where keys are already unlocked.
  try {
    await modal.waitFor({ state: 'visible', timeout: 3000 });
    console.log(`[handleReAuthModal] Modal found at URL: ${page.url()}`);
  } catch {
    // Modal didn't appear — encryption keys already unlocked
    console.log(`[handleReAuthModal] No modal needed. URL: ${page.url()}`);
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

  // Wait for modal to close (Argon2id key derivation can take 20s+ on CI)
  await modal.waitFor({ state: 'hidden', timeout: 30000 });
  console.log(`[handleReAuthModal] ✓ Modal closed. URL: ${page.url()}`);
  return true;
}

/**
 * Handle the initial Encrypted Messaging Setup page.
 *
 * When a user navigates to /messages without encryption keys,
 * they are redirected to /messages/setup. This helper fills in
 * the messaging password and submits the form.
 *
 * @param page - Playwright page object
 * @param messagingPassword - Password for messaging encryption (min 8 chars)
 * @returns true if setup was handled, false if not on setup page
 */
export async function handleEncryptionSetup(
  page: Page,
  messagingPassword = 'TestMessaging123!'
): Promise<boolean> {
  // Check if we're on the setup page
  const url = page.url();
  if (!url.includes('/messages/setup')) {
    // Also check if the setup page heading is visible (in case URL check is too early)
    const heading = page.getByRole('heading', {
      name: /Set Up Encrypted Messaging/i,
    });
    const isSetupVisible = await heading
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (!isSetupVisible) {
      return false;
    }
  }

  // Wait for the form to be ready
  const passwordInput = page.locator('#setup-password');
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });

  // Fill password fields
  await passwordInput.fill(messagingPassword);
  await page.locator('#setup-confirm').fill(messagingPassword);

  // Submit the form
  const submitBtn = page.getByRole('button', {
    name: /Set Up Encrypted Messaging/i,
  });
  await submitBtn.click();

  // Wait for redirect to /messages (setup complete)
  await page.waitForURL(/\/messages(?!\/setup)/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');

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
  // Click the avatar to open dropdown
  // Try multiple selectors since AvatarDisplay may override parent aria-label
  const avatarButton = page
    .getByLabel('User account menu')
    .or(page.locator('[aria-label*="avatar"]'));
  await avatarButton.first().click();

  // Wait for dropdown to open and click Sign Out
  const signOutButton = page.getByRole('button', { name: 'Sign Out' });
  await signOutButton.waitFor({ state: 'visible', timeout: 5000 });
  await signOutButton.click();

  // Wait for sign-out to complete (redirects to home or sign-in page).
  // Use callback: waitForURL matches full URL, not pathname.
  // Firefox may redirect to /sign-in/?returnUrl=... before settling on /.
  await page.waitForURL(
    (url) => url.pathname === '/' || url.pathname.startsWith('/sign-in'),
    { timeout: 15000 }
  );

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

  // Wait for authenticated navbar indicators
  // Try multiple indicators since layout can vary
  const authIndicators = [
    page.getByRole('link', { name: /messages/i }),
    page.getByLabel('User account menu'),
    page.locator('img[alt*="avatar"]'),
  ];

  // Wait for auth indicators first - give AuthContext time to hydrate
  // Don't race with Sign In link because SSR may briefly show unauthenticated state
  try {
    await Promise.any(
      authIndicators.map((indicator) =>
        indicator.waitFor({ state: 'visible', timeout })
      )
    );
    // Auth indicator found - we're authenticated
    return;
  } catch {
    // All auth indicators timed out - now check if we're definitively unauthenticated
    // Wait a bit for any hydration to complete
    await page.waitForLoadState('networkidle').catch(() => {});

    // Check for Sign In link AFTER page has settled
    const signInLink = page.getByRole('link', { name: 'Sign In' });
    const isSignInVisible = await signInLink.isVisible().catch(() => false);

    if (isSignInVisible) {
      throw new Error(
        `Auth failed: Sign In link visible on ${page.url()}. User not authenticated.`
      );
    }

    // Neither auth indicators nor sign-in visible - log warning but don't fail
    // This can happen on pages that don't have GlobalNav
    console.warn(
      `waitForAuthenticatedState: No auth indicators found on ${page.url()}, but Sign In link also not visible. Assuming authenticated.`
    );
  }

  // Brief stabilization delay
  await page.waitForLoadState('domcontentloaded');
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
  const { rememberMe = false, timeout = 30000 } = options; // Increased from 15s to 30s for CI

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

      // Failure: Alert with actual error message appears
      // Filter out page title alerts (e.g., "Sign In - ScriptHammer")
      page
        .locator('[role="alert"]')
        .filter({
          hasText: /(invalid|error|failed|incorrect|wrong|denied|locked)/i,
        })
        .first()
        .waitFor({ state: 'visible', timeout })
        .then(async () => {
          const alertText = await page
            .locator('[role="alert"]')
            .filter({
              hasText: /(invalid|error|failed|incorrect|wrong|denied|locked)/i,
            })
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

/**
 * Fill a MessageInput textarea and wait for React to process the value.
 *
 * MessageInput is a controlled component (value={message}, onChange).
 * Playwright's fill() dispatches an input event, but React batches state
 * updates asynchronously. Without waiting, clicking Send immediately after
 * fill reads stale state ("") and triggers "Message cannot be empty".
 *
 * Waits for the #char-count element to reflect the new message length,
 * which proves React has processed the fill and updated component state.
 */
export async function fillMessageInput(
  page: Page,
  text: string
): Promise<void> {
  const messageInput = page.getByRole('textbox', { name: /Message input/i });
  await expect(messageInput).toBeEnabled({ timeout: 15000 });
  await messageInput.fill(text);

  // WebKit sometimes doesn't trigger React's onChange from fill().
  // Dispatch an input event manually to ensure React processes the value.
  await messageInput.dispatchEvent('input', { bubbles: true });

  // Wait for React to process the fill — char count updates when state changes
  await page.waitForFunction(
    (expectedLen) => {
      const counter = document.getElementById('char-count');
      if (!counter) return false;
      return counter.textContent?.includes(String(expectedLen));
    },
    text.length,
    { timeout: 10000 }
  );
}

/**
 * Delete old messages between two users via admin API.
 *
 * Conversations accumulate messages across CI runs. At 100+ messages,
 * MessageThread enables virtual scrolling and newly-sent messages are
 * appended outside the virtual viewport — Playwright's getByText()
 * can't find them because they're not rendered in the DOM.
 *
 * Call this in test.beforeAll() before any messaging tests.
 */
export async function cleanupOldMessages(
  userAEmail: string,
  userBEmail: string
): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;
  const userA = await getUserByEmail(userAEmail);
  const userB = await getUserByEmail(userBEmail);
  if (!userA || !userB) return;
  const { error } = await admin
    .from('messages')
    .delete()
    .or(`sender_id.eq.${userA.id},sender_id.eq.${userB.id}`);
  if (error) {
    console.warn('cleanupOldMessages: failed:', error.message);
  } else {
    console.log('✓ Old messages cleaned up');
  }
}

/**
 * Scroll a message thread to the bottom so virtual-scrolled messages
 * at the end of the list are rendered in the DOM.
 */
export async function scrollThreadToBottom(page: Page): Promise<void> {
  const thread = page.locator('[data-testid="message-thread"]');
  if (await thread.isVisible().catch(() => false)) {
    // Scroll multiple times — WebKit's rendering pipeline may not update
    // the virtualizer on a single scrollTo call. Each iteration scrolls
    // to the new scrollHeight (which may increase as items render).
    for (let i = 0; i < 3; i++) {
      await thread.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await page.waitForTimeout(500);
    }
  }
}

/**
 * Navigate to a URL with retry logic for transient server failures.
 *
 * The static server (npx serve) can become temporarily unresponsive
 * under load, causing page.goto to timeout. This wrapper retries
 * with a shorter per-attempt timeout so tests don't burn their full
 * 60s budget on a single navigation.
 */
export async function gotoWithRetry(
  page: Page,
  url: string,
  options?: { maxRetries?: number; timeout?: number }
): Promise<void> {
  const maxRetries = options?.maxRetries ?? 2;
  const timeout = options?.timeout ?? 30000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      return;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      console.warn(
        `gotoWithRetry: attempt ${attempt + 1} failed for ${url}, retrying...`
      );
      await page.waitForTimeout(2000);
    }
  }
}

/**
 * Reset encryption keys for a user after performSignIn().
 *
 * SignInForm.tsx calls hasKeys() which races with Supabase session
 * persistence — getSession() returns null, hasKeys() returns false,
 * and initializeKeys() creates a SECOND key row with a different salt.
 * This breaks ECDH because encrypt and decrypt use different key pairs.
 *
 * This helper:
 * 1. Deletes ALL encryption keys for the user via admin API
 * 2. Re-creates exactly ONE key via ensureEncryptionKeys
 * 3. Clears sh_keys_* from the page's localStorage so EncryptionKeyGate
 *    shows the ReAuthModal and deriveKeys() runs with the correct salt
 */
export async function resetEncryptionKeys(
  page: Page,
  email: string,
  _password: string
): Promise<void> {
  // Delete DUPLICATE keys created by SignInForm's hasKeys() race condition,
  // keeping only the ORIGINAL key (created by auth.setup.ts with the correct
  // salt). All 18 CI shards share the same Supabase DB — deleting+recreating
  // with a new random salt would break any other shard mid-encryption.
  const admin = getAdminClient();
  if (admin) {
    const user = await getUserByEmail(email);
    if (user) {
      // Keep only the OLDEST key (the one auth.setup.ts created)
      const { data: keys } = await admin
        .from('user_encryption_keys')
        .select('id, created_at')
        .eq('user_id', user.id)
        .eq('revoked', false)
        .order('created_at', { ascending: true });

      if (keys && keys.length > 1) {
        // Delete all but the oldest (auth.setup.ts) key
        const idsToDelete = keys.slice(1).map((k) => k.id);
        await admin.from('user_encryption_keys').delete().in('id', idsToDelete);
        console.log(
          `[resetEncryptionKeys] Deleted ${idsToDelete.length} duplicate keys for ${email}`
        );
      }
    }
  }

  // Clear stale cached keys from localStorage so EncryptionKeyGate
  // shows ReAuthModal → deriveKeys() with the correct salt from DB
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sh_keys_'))
      .forEach((k) => localStorage.removeItem(k));
  });
  console.log(`[resetEncryptionKeys] Reset keys for ${email}`);
}
