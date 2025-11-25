/**
 * Test user credentials for contract tests
 *
 * Primary user: Pre-created in production Supabase with email confirmed.
 * Used for: sign-in, profile operations, most contract tests.
 *
 * Secondary user: Optional, configurable via .env for email verification tests.
 * Used for: sign-up flow, password reset, email confirmation.
 * MUST be a real email address you control if running those tests.
 */

/**
 * Primary test user - pre-confirmed in Supabase
 */
export const TEST_EMAIL =
  process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com';
export const TEST_PASSWORD =
  process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!';

/**
 * Secondary test user - configurable for email verification tests
 */
export const TEST_EMAIL_SECONDARY = process.env.TEST_USER_SECONDARY_EMAIL;
export const TEST_PASSWORD_SECONDARY = process.env.TEST_USER_SECONDARY_PASSWORD;

/**
 * Tertiary test user - for messaging E2E tests (Feature 024)
 * Pre-confirmed in Supabase with username 'testuser-b'
 */
export const TEST_EMAIL_TERTIARY =
  process.env.TEST_USER_TERTIARY_EMAIL || 'test-user-b@example.com';
export const TEST_PASSWORD_TERTIARY =
  process.env.TEST_USER_TERTIARY_PASSWORD || 'TestPassword456!';
export const TEST_USERNAME_TERTIARY = 'testuser-b';

/**
 * Check if secondary test user is configured
 * @returns true if both email and password are set
 */
export function hasSecondaryUser(): boolean {
  return !!(TEST_EMAIL_SECONDARY && TEST_PASSWORD_SECONDARY);
}

/**
 * Check if tertiary test user is configured
 * @returns true if both email and password are set
 */
export function hasTertiaryUser(): boolean {
  return !!(TEST_EMAIL_TERTIARY && TEST_PASSWORD_TERTIARY);
}
