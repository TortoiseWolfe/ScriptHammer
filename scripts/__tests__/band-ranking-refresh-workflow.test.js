/**
 * The deploy must refresh the band ranking from the vote table BEFORE it builds (#1527), and the
 * service role key must reach that one step only.
 *
 * Two ways this goes wrong without a check. The step is moved below the build, or deleted: every
 * check stays green and the page goes back to showing 0 site votes, with no error anywhere. Or the
 * key is added to the build step's environment: `pnpm run build` runs project code and every
 * dependency's install scripts, which should never see a service role key.
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

  it('gives the refresh step the service role key and the project URL', () => {
    assert.match(
      refresh.text,
      /SUPABASE_SERVICE_ROLE_KEY: \$\{\{ secrets\.SUPABASE_SERVICE_ROLE_KEY \}\}/
    );
    assert.match(
      refresh.text,
      /NEXT_PUBLIC_SUPABASE_URL: \$\{\{ vars\.NEXT_PUBLIC_SUPABASE_URL \}\}/
    );
  });

  it('keeps the service role key out of every other step', () => {
    const holders = lines.filter((l) =>
      l.includes('SUPABASE_SERVICE_ROLE_KEY')
    );
    assert.strictEqual(
      holders.length,
      1,
      'only the refresh step may name the service role key'
    );
    assert.ok(!build.text.includes('SUPABASE_SERVICE_ROLE_KEY'));
  });
});
