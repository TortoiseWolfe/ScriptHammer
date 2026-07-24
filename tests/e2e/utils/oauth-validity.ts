import { expect } from '@playwright/test';

/**
 * Assert an OAuth authorize URL carries a REAL, valid-shaped `client_id` — not a
 * placeholder. This is the #287 detector: production shipped
 * `client_id=placeholder_google_client_id` and EVERY test passed, because they
 * only checked *presence* (`toBeTruthy()`) — and a literal placeholder string is
 * non-empty. Presence ≠ configured. See #288 (config-validity, not presence).
 *
 * Provider is detected from the authorize host so the same helper works for the
 * GitHub and Google flows. Shared by the pre-merge E2E (`oauth-csrf.spec.ts`,
 * which captures the authorize URL via the browser) and the post-deploy @smoke
 * suite (`tests/e2e/smoke/`, which reads it from the live Supabase
 * `/auth/v1/authorize` redirect) — one source of truth for the #287 regexes.
 *
 * @module tests/e2e/utils/oauth-validity
 */
export function assertValidOAuthClientId(oauthUrl: string): void {
  expect(oauthUrl, 'OAuth authorize URL was never captured').toBeTruthy();
  const url = new URL(oauthUrl);
  const clientId = url.searchParams.get('client_id');
  expect(clientId, 'OAuth authorize URL must carry a client_id').toBeTruthy();
  // Reject the literal placeholders that shipped to prod in #287.
  expect(
    clientId,
    `client_id "${clientId}" looks like an unconfigured placeholder (#287)`
  ).not.toMatch(/^(placeholder|changeme|your[-_]|example|test[-_]?client)/i);
  // Valid-shaped per provider.
  if (url.hostname.includes('google')) {
    expect(
      clientId,
      'Google client_id must be a real *.apps.googleusercontent.com id'
    ).toMatch(/\.apps\.googleusercontent\.com$/);
  } else if (url.hostname.includes('github')) {
    // Classic 20-hex OAuth app id, or GitHub App client ids (Iv1.<hex> / Ov23…).
    expect(
      clientId,
      'GitHub client_id must be a real OAuth/App client id, not a placeholder'
    ).toMatch(/^(Iv1\.[0-9a-f]+|Ov23[A-Za-z0-9]+|[0-9a-f]{16,})$/i);
  }
}
