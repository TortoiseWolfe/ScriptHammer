/**
 * The deploy must refresh the band ranking from the vote totals BEFORE it builds (#1527), and it
 * must do so without any service role key.
 *
 * Two ways this goes wrong without a check. The step is moved below the build, or deleted: every
 * check stays green and the page goes back to showing 0 site votes, with no error anywhere. Or a
 * service role key creeps back into the deploy: the totals come from the read-only database
 * function get_band_vote_totals, which the public anon key may call, so no such key is needed.
 *
 * Comments are stripped before matching, because the step's own comment names the script.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEPLOY = path.join(ROOT, '.github', 'workflows', 'deploy.yml');

const lines = fs
  .readFileSync(DEPLOY, 'utf8')
  .split('\n')
  .map((l) => l.replace(/^(\s*)#.*$/, '$1').replace(/\s+#\s.*$/, ''));

/** The text of one step, from its `- name:` line to the next step. */
function step(name) {
  const start = lines.findIndex((l) => l.includes(`- name: ${name}`));
  assert.ok(start >= 0, `deploy.yml has no step named "${name}"`);
  let end = lines.findIndex((l, i) => i > start && /^\s*- name:/.test(l));
  if (end < 0) end = lines.length;
  return { start, text: lines.slice(start, end).join('\n') };
}

describe('deploy.yml refreshes the band ranking', () => {
  const refresh = step('Refresh band ranking from site votes');
  const build = step('Build Next.js app');

  it('runs the script, and runs it before the build', () => {
    assert.match(refresh.text, /node scripts\/ci\/refresh-band-ranking\.mjs/);
    assert.ok(
      refresh.start < build.start,
      'the refresh step must come before the build step'
    );
  });

  it('brings the band files in first, and only when the script has arrived', () => {
    // The band is all rights reserved and lives in a private repository. The refresh script ships
    // with it, so the overlay step must precede the refresh step, and the refresh step must skip
    // itself when the script is absent (a fork or a template has no band and no key).
    const overlay = step('Bring in the house band');
    assert.match(overlay.text, /bash scripts\/ci\/band-overlay\.sh/);
    assert.match(
      overlay.text,
      /BAND_DEPLOY_KEY: \$\{\{ secrets\.BAND_DEPLOY_KEY \}\}/
    );
    assert.ok(
      overlay.start < refresh.start,
      'the overlay step must come before the refresh step'
    );
    assert.match(
      refresh.text,
      /if: hashFiles\('scripts\/ci\/refresh-band-ranking\.mjs'\) != ''/
    );
  });

  it('gives the refresh step the project URL and the public anon key', () => {
    assert.match(
      refresh.text,
      /NEXT_PUBLIC_SUPABASE_URL: \$\{\{ vars\.NEXT_PUBLIC_SUPABASE_URL \}\}/
    );
    assert.match(
      refresh.text,
      /NEXT_PUBLIC_SUPABASE_ANON_KEY: \$\{\{ vars\.NEXT_PUBLIC_SUPABASE_ANON_KEY \}\}/
    );
  });

  it('names no service role key anywhere in the deploy', () => {
    const holders = lines.filter((l) => /SERVICE_ROLE/i.test(l));
    assert.deepStrictEqual(
      holders,
      [],
      'the deploy reads totals through get_band_vote_totals and needs no service role key'
    );
  });
});
