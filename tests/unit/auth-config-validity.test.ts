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
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const config = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'scripts/supabase/auth-config.json'),
    'utf8'
  )
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
});
