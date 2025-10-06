/**
 * Static test user credentials for contract tests
 *
 * This user is pre-created in production Supabase with email confirmed.
 * Contract tests should use these static credentials instead of creating
 * dynamic users, since email confirmation is enabled in production.
 */

export const TEST_EMAIL = 'test@example.com';
export const TEST_PASSWORD = 'TestPassword123!';
