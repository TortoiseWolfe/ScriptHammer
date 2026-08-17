/**
 * Deployed-config validity guard (#288).
 *
 * `scripts/supabase/auth-config.json` is the checked-in desired state for the
 * Supabase auth config (site_url, uri_allow_list, …), applied to the project via
 * `pnpm supabase:auth-config --apply`. #287 shipped a prod where `site_url` was
 * `http://localhost:3000` and `uri_allow_list` was empty — so OAuth/email
 * redirects broke and no human could complete sign-up, while every test stayed
 * green. This test pins the *validity* of the desired state so a localhost /
 * empty regression can't be committed unnoticed.
 *
 * (Whether the LIVE project matches this file is a separate drift check —
 * `pnpm supabase:auth-config:check` — which needs the Management API token and
 * runs in CI once that secret is configured.)
 *
 * @module tests/unit/auth-config-validity.test
 */
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

// Through the shared loader, not `JSON.parse(readFileSync(...))`: the file now
// carries `${VAR:-default}` for the eight values a fork must own (#734), so a raw
// read sees `"${AUTH_SITE_URL:-https://…}"` and every assertion below would fail on
// a correctly-configured repo. Three readers share one loader precisely so the
// pinned file and its consumers cannot disagree about the desired state.
const require_ = createRequire(import.meta.url);
const { loadAuthConfig } = require_(
  resolve(process.cwd(), 'scripts/supabase/auth-config-loader.js')
);

// Resolved against an EMPTY env, so this asserts the pinned DEFAULTS — what a fork
// inherits before it configures anything, and what ScriptHammer's own drift gate
// compares prod against. Reading the ambient environment here would let a stray
// AUTH_* var in a shell make these tests pass on values nobody committed.
const config = loadAuthConfig(
  resolve(process.cwd(), 'scripts/supabase/auth-config.json'),
  {}
) as Record<string, unknown>;

describe('supabase auth-config.json — deployed-config validity (#288)', () => {
  it('site_url is a non-localhost https URL', () => {
    const siteUrl = config.site_url;
    expect(typeof siteUrl).toBe('string');
    expect(siteUrl as string).toMatch(/^https:\/\//);
    expect(siteUrl as string).not.toMatch(/localhost|127\.0\.0\.1|0\.0\.0\.0/);
  });

  it('uri_allow_list is present and non-empty', () => {
    const allowList = config.uri_allow_list;
    expect(typeof allowList).toBe('string');
    expect((allowList as string).trim().length).toBeGreaterThan(0);
  });

  it('every uri_allow_list entry is an absolute URL (no bare paths / empty items)', () => {
    const entries = String(config.uri_allow_list)
      .split(',')
      .map((s) => s.trim());
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry, 'allow-list entry must not be empty').not.toBe('');
      expect(
        entry,
        `allow-list entry "${entry}" must be an absolute URL`
      ).toMatch(/^https?:\/\//);
    }
  });

  /**
   * OAUTH COVERAGE — the reason these keys exist in the desired state at all.
   *
   * `oauth-csrf.spec.ts` is the only thing that has ever asserted prod's OAuth client ids
   * are real rather than placeholders, and it does so from a browser against the HOSTED
   * project. The CI plan moves it to a weekly `@hosted` lane so PRs can run against a local
   * Supabase — which would delete that coverage, because `set-auth-config.ts` compares only
   * `Object.keys(desired)` and this file carried NO `external_*` keys at all.
   *
   * So the ids move into the desired state (they are public — every authorize URL carries
   * them), the daily drift gate starts covering them, and these cases stop a placeholder
   * being committed here in the first place. The shapes deliberately match
   * `tests/e2e/utils/oauth-validity.ts`, so the local guard and the browser guard cannot
   * drift apart in what they consider a real id.
   */
  describe('OAuth providers (the #287 class: configured-looking, unusable)', () => {
    it('the providers the app offers are enabled', () => {
      // If the app stops offering one, delete its row here AND its client id above —
      // do not leave an enabled provider with no id, which is the broken middle state.
      expect(config.external_github_enabled).toBe(true);
      expect(config.external_google_enabled).toBe(true);
      expect(config.external_email_enabled).toBe(true);
    });

    it('every enabled provider carries a client id', () => {
      for (const p of ['github', 'google'] as const) {
        if (config[`external_${p}_enabled`] !== true) continue;
        const id = config[`external_${p}_client_id`];
        expect(
          typeof id === 'string' && id.length > 0,
          `external_${p}_enabled is true but external_${p}_client_id is missing — ` +
            'the provider would be advertised and fail at the provider'
        ).toBe(true);
      }
    });

    it('no client id is a placeholder (#287 shipped exactly this)', () => {
      for (const p of ['github', 'google'] as const) {
        const id = String(config[`external_${p}_client_id`] ?? '');
        expect(
          id,
          `external_${p}_client_id "${id}" looks like an unconfigured placeholder`
        ).not.toMatch(
          /^(placeholder|changeme|your[-_]|example|test[-_]?client)/i
        );
      }
    });

    it('client ids are provider-shaped — same patterns oauth-validity.ts enforces', () => {
      expect(
        String(config.external_google_client_id),
        'Google client_id must be a real *.apps.googleusercontent.com id'
      ).toMatch(/\.apps\.googleusercontent\.com$/);
      expect(
        String(config.external_github_client_id),
        'GitHub client_id must be a real OAuth/App client id'
      ).toMatch(/^(Iv1\.[0-9a-f]+|Ov23[A-Za-z0-9]+|[0-9a-f]{16,})$/i);
    });

    it('no client SECRET is committed here — only ids', () => {
      // The withhold rules in set-auth-config.ts source secrets from env. A secret landing
      // in this file would be committed to a public repo.
      for (const k of Object.keys(config)) {
        expect(
          k,
          `"${k}" looks like a secret and must not live in this file`
        ).not.toMatch(/secret|_pass$/i);
      }
    });
  });
});
