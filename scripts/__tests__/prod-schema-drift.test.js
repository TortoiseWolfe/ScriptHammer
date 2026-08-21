/**
 * The production schema-drift comparator must be able to report failure (#903).
 *
 * A drift check that has only ever been run against a correct production reports "no
 * drift" and tells you nothing — you have observed that it does not crash, not that it
 * can see. So `evaluate()` is pure and driven here in both directions.
 *
 * The centrepiece is `would have caught #897`: the comparator is fed the ACTUAL
 * production state as measured on 2026-08-21, before the fix, and must report both the
 * excess grants and the missing admin policy. A guard built in response to an incident
 * that cannot detect that incident is theatre.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const MODULE = path.resolve(
  __dirname,
  '..',
  'ci',
  'check-prod-schema-drift.mjs'
);

/** The module is ESM; node:test runs CJS here, so import it dynamically. */
async function load() {
  return import(`file://${MODULE}`);
}

/** Production as it should be — the fixture every mutation below starts from. */
function healthy(INTENDED) {
  const out = {};
  for (const [table, want] of Object.entries(INTENDED.tables)) {
    out[table] = {
      rls: want.rls,
      grants: Object.fromEntries(
        Object.entries(want.grants).map(([r, p]) => [r, [...p].sort()])
      ),
      policies: [...want.policies].sort(),
    };
  }
  return out;
}

describe('production schema-drift comparator (#903)', () => {
  it('reports nothing when production matches INTENDED', async () => {
    // The control that proves the comparator can PASS. Without it every assertion below
    // is satisfied by a function that always returns problems.
    const { evaluate, INTENDED } = await load();
    assert.deepStrictEqual(evaluate(healthy(INTENDED), INTENDED), []);
  });

  it('WOULD HAVE CAUGHT #897 — the real pre-fix production state', async () => {
    // Measured live on 2026-08-21 before the fix: both roles held everything, and the
    // admin policy was absent while the other nine "Admin can view%" policies existed.
    // This sat undetected for three weeks.
    const { evaluate, INTENDED } = await load();
    const asItWas = {
      payment_intents: {
        rls: true,
        grants: {
          anon: [
            'DELETE',
            'INSERT',
            'REFERENCES',
            'SELECT',
            'TRIGGER',
            'TRUNCATE',
            'UPDATE',
          ],
          authenticated: [
            'DELETE',
            'INSERT',
            'REFERENCES',
            'SELECT',
            'TRIGGER',
            'TRUNCATE',
            'UPDATE',
          ],
        },
        policies: [
          'Payment intents are immutable',
          'Payment intents cannot be deleted by users',
          'Users can create own payment intents',
          'Users can view own payment intents',
        ],
      },
    };
    const problems = evaluate(asItWas, INTENDED).join('\n');

    assert.match(problems, /anon holds .*UPDATE/, 'missed anon holding UPDATE');
    assert.match(
      problems,
      /authenticated holds .*UPDATE/,
      'missed authenticated holding UPDATE — the #565 revoke that never reached prod'
    );
    assert.match(
      problems,
      /WIDER/,
      'did not name the direction of the grant drift'
    );
    assert.match(
      problems,
      /MISSING "Admin can view all payment intents"/,
      'missed the policy production was missing'
    );
  });

  it('a table absent from production is a FAILURE, not a pass', async () => {
    // The anti-vacuity case, and the most dangerous one: a wrong project ref or an
    // expired token yields an empty observation. Reporting "no drift" there is worse
    // than no check at all, because it reports reassurance.
    const { evaluate, INTENDED } = await load();
    const problems = evaluate({}, INTENDED);
    assert.ok(problems.length > 0, 'an empty observation reported no drift');
    assert.match(problems.join('\n'), /NOT FOUND in production/);
  });

  it('names the direction: WIDER when production has extra privileges', async () => {
    const { evaluate, INTENDED } = await load();
    const obs = healthy(INTENDED);
    obs.payment_intents.grants.authenticated = ['DELETE', 'INSERT', 'SELECT'];
    const problems = evaluate(obs, INTENDED).join('\n');
    assert.match(problems, /WIDER by DELETE/);
    assert.doesNotMatch(problems, /NARROWER/);
  });

  it('names the direction: NARROWER when a privilege is gone', async () => {
    // Not a security problem, but a real signal — most likely #559 T025 landed and
    // INTENDED here was not updated. Opposite meaning, so it must read differently.
    const { evaluate, INTENDED } = await load();
    const obs = healthy(INTENDED);
    obs.payment_intents.grants.authenticated = ['SELECT'];
    const problems = evaluate(obs, INTENDED).join('\n');
    assert.match(problems, /NARROWER, missing INSERT/);
    assert.doesNotMatch(problems, /WIDER/);
  });

  it('catches a policy that exists in production but is not declared here', async () => {
    const { evaluate, INTENDED } = await load();
    const obs = healthy(INTENDED);
    obs.payment_intents.policies = [
      ...obs.payment_intents.policies,
      'Something nobody declared',
    ].sort();
    assert.match(
      evaluate(obs, INTENDED).join('\n'),
      /UNDECLARED "Something nobody declared"/
    );
  });

  it('catches RLS being turned off', async () => {
    const { evaluate, INTENDED } = await load();
    const obs = healthy(INTENDED);
    obs.payment_intents.rls = false;
    assert.match(evaluate(obs, INTENDED).join('\n'), /RLS is DISABLED/);
  });

  it('treats an unreadable RLS state as a failed observation', async () => {
    const { evaluate, INTENDED } = await load();
    const obs = healthy(INTENDED);
    obs.payment_intents.rls = null;
    assert.match(
      evaluate(obs, INTENDED).join('\n'),
      /could not read RLS state/
    );
  });

  it('INTENDED actually declares something', async () => {
    // If INTENDED were emptied, every test above would pass vacuously — including the
    // healthy-case control, which would compare nothing to nothing.
    const { INTENDED } = await load();
    const tables = Object.keys(INTENDED.tables);
    assert.ok(tables.length > 0, 'INTENDED declares no tables');
    for (const [t, want] of Object.entries(INTENDED.tables)) {
      assert.ok(want.policies.length > 0, `${t} declares no policies`);
      assert.ok(Object.keys(want.grants).length > 0, `${t} declares no grants`);
    }
  });
});

describe('the drift workflow keeps the production token out of PR jobs (#903)', () => {
  const fs = require('node:fs');
  const WF = path.resolve(
    __dirname,
    '..',
    '..',
    '.github',
    'workflows',
    'prod-schema-drift.yml'
  );

  /** The `on:` block only — `pull_request` inside a comment or a job is not a trigger. */
  function triggers() {
    const text = fs.readFileSync(WF, 'utf8');
    const start = text.search(/^on:\s*$/m);
    assert.notStrictEqual(start, -1, 'no on: block found — this test is stale');
    const rest = text.slice(start);
    const end = rest.search(/^jobs:\s*$/m);
    const block = end === -1 ? rest : rest.slice(0, end);
    // Strip comments: this workflow's header explains WHY it is not PR-triggered and
    // says "pull_request" while doing so. Matching that prose would make the assertion
    // below fail on a correct file, or pass on a broken one after a reword.
    return block.replace(/^\s*#.*$/gm, '');
  }

  it('the workflow exists and its triggers were parsed', () => {
    assert.ok(fs.existsSync(WF), `${WF} is gone`);
    assert.ok(triggers().length > 0, 'parsed an empty on: block');
  });

  it('is never triggered by a pull request', () => {
    // This job holds SUPABASE_ACCESS_TOKEN. #575 and #897 are both about keeping
    // production credentials away from PR jobs, which then run an arbitrary third-party
    // dependency graph from a contributor branch.
    assert.doesNotMatch(
      triggers(),
      /^\s{2}(pull_request|pull_request_target):/m,
      'prod-schema-drift.yml became PR-triggered while holding a production credential. ' +
        'Use the schedule and push-to-main triggers; the comparator itself is already ' +
        'gated on every PR by the tests above.'
    );
  });

  it('still runs on a schedule — the cron is the whole point', () => {
    // Out-of-band production changes have no repo event behind them. #897's drift
    // arrived with no commit, so a workflow that only ran on push would have missed it
    // exactly as everything else did.
    assert.match(triggers(), /^\s{2}schedule:/m, 'the daily cron was removed');
  });
});
