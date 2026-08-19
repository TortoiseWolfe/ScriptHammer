/**
 * A failed Playwright install must FAIL THE JOB, everywhere (#795).
 *
 * Every install in this repo sits in a `for i in 1 2 3` retry loop. If all three
 * attempts fail the loop simply ends, and the job carries on to launch browsers that
 * were never installed — so the shard dies somewhere unrelated and an infrastructure
 * outage gets diagnosed as a test bug.
 *
 * #762 is the worked example: eight jobs died in the install step, and the visible
 * symptom was a required check going red with no failing test. It was fixed in
 * `e2e-local.yml` only; the other nine call sites kept falling through. #819 then
 * showed the failure mode is live rather than theoretical — Azure's Ubuntu mirror
 * went dark and three retries hit the same dead host.
 *
 * WHAT THIS ASSERTS: every retry loop that installs Playwright records success and
 * exits non-zero when it never came. Not the wording, not the retry count — those are
 * free to change. Only that a silent fall-through is impossible.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOWS = path.join(__dirname, '..', '..', '.github', 'workflows');

/** Every `for i in 1 2 3; do … done` block that installs Playwright. */
function installLoops() {
  const found = [];
  for (const file of fs.readdirSync(WORKFLOWS)) {
    if (!/\.ya?ml$/.test(file)) continue;
    const body = fs.readFileSync(path.join(WORKFLOWS, file), 'utf8');
    const re = /^([ \t]*)for i in 1 2 3; do\n([\s\S]*?)^\1done\n/gm;
    for (const m of body.matchAll(re)) {
      if (!m[2].includes('playwright install')) continue;
      // Bound to the rest of THIS STEP, not a fixed character count. The reference
      // implementation in e2e-local.yml puts a six-line comment between `done` and
      // the check, which overran a 400-char window and made the guard report its
      // own exemplar as unguarded.
      // Slice the remainder from the SOURCE rather than capturing it. A greedy
      // trailing group swallows the rest of the file, so matchAll returns only the
      // FIRST loop per workflow — the scan silently found 4 of 10.
      const rest = body.slice(m.index + m[0].length);
      found.push({ file, loop: m[2], after: rest.split(/^\s*- name:/m)[0] });
    }
  }
  return found;
}

describe('a failed playwright install fails the job (#795)', () => {
  it('finds the install loops, so the assertion below is not vacuous', () => {
    const loops = installLoops();
    assert.ok(
      loops.length >= 9,
      `only ${loops.length} playwright-install retry loops found; the scan is broken ` +
        `(there were 10 across e2e.yml, e2e-local.yml, smoke.yml and signup-mailer.yml)`
    );
  });

  it('every loop records success and exits when it never came', () => {
    const offenders = installLoops()
      .filter(({ loop, after }) => {
        const records = /ok=1/.test(loop);
        const exits =
          /\$ok"?\s*-ne\s*1|\$ok"?\s*!=\s*1/.test(after) &&
          /exit 1/.test(after);
        return !(records && exits);
      })
      .map(({ file }) => file);

    assert.deepEqual(
      [...new Set(offenders)],
      [],
      `These workflows retry a Playwright install three times and then CARRY ON if all ` +
        `three failed:\n${[...new Set(offenders)].map((f) => `  - ${f}`).join('\n')}\n\n` +
        `The next step launches browsers that were never installed, so the job dies ` +
        `somewhere unrelated and an install outage is diagnosed as a test bug (#762). ` +
        `Set ok=1 on success and \`exit 1\` when it is still 0.`
    );
  });

  it('the detector can actually fail', () => {
    // Controls. A scanner that matched nothing would report the repo clean, and one
    // that ignored the trailing check would accept a loop that still falls through.
    const guarded =
      '        for i in 1 2 3; do\n' +
      '          pnpm exec playwright install chromium && { ok=1; break; }\n' +
      '        done\n' +
      '        if [ "$ok" -ne 1 ]; then\n          exit 1\n        fi\n';
    const fallsThrough =
      '        for i in 1 2 3; do\n' +
      '          pnpm exec playwright install chromium && break\n' +
      '        done\n' +
      '        echo "carrying on regardless"\n';

    const judge = (text) => {
      const m = /^([ \t]*)for i in 1 2 3; do\n([\s\S]*?)^\1done\n/m.exec(text);
      if (!m) return 'no-loop-found';
      const records = /ok=1/.test(m[2]);
      const after = text.slice(m.index + m[0].length).split(/^\s*- name:/m)[0];
      const exits = /\$ok"?\s*-ne\s*1/.test(after) && /exit 1/.test(after);
      return records && exits ? 'guarded' : 'falls-through';
    };

    assert.equal(judge(guarded), 'guarded');
    assert.equal(judge(fallsThrough), 'falls-through');
    assert.equal(judge('no loops here'), 'no-loop-found');

    // The shape that defeated a fixed-size window: a long comment between `done`
    // and the check. It must still read as guarded.
    const chatty =
      '        for i in 1 2 3; do\n' +
      '          pnpm exec playwright install chromium && { ok=1; break; }\n' +
      '        done\n' +
      '        # ' +
      'x'.repeat(500) +
      '\n' +
      '        if [ "$ok" -ne 1 ]; then\n          exit 1\n        fi\n';
    assert.equal(judge(chatty), 'guarded');
  });
});
