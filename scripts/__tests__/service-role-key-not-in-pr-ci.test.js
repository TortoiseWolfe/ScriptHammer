/**
 * The production service-role key must not spread further into PR-triggered CI (#575).
 *
 * WHY. `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS on the production project. A workflow that
 * injects it and then runs `pnpm install` hands that credential to an arbitrary third-party
 * dependency graph — on every code PR, from every contributor's branch. #577 already removed
 * it from `ci.yml` and `accessibility.yml`; `e2e.yml` is the last PR-triggered holdout, and
 * retiring it is #575's stated exit criterion.
 *
 * WHY A TEST RATHER THAN THE EPIC'S GREP. #575 phrases the gate as
 *
 *     grep -l 'secrets.SUPABASE_SERVICE_ROLE_KEY' .github/workflows/*.yml   # must be empty
 *
 * which **can never pass**, because `intake-orphan-sweep.yml` legitimately uses the key: it
 * is a scheduled maintenance job against the hosted project, it is not triggered by a PR, and
 * no dependency graph from a contributor branch ever runs alongside it. A gate that cannot
 * return the passing answer is not a gate — it is a note that everyone learns to ignore. The
 * distinction that actually matters is **trigger**, not presence, so that is what is checked.
 *
 * WHAT THIS PREVENTS TODAY. It does not remove the exposure — that is the epic's job, and it
 * is a policy decision about the hosted lane. It stops the exposure GROWING: a new PR-triggered
 * workflow that wants the key, or an eighth injection site in `e2e.yml`, fails here instead of
 * landing unnoticed.
 *
 * IT ALSO FAILS WHEN THE EPIC IS FINISHED, ON PURPOSE. If `e2e.yml` stops referencing the key,
 * the equality below breaks and says so. That is the point: the alternative is an exit
 * criterion that is quietly satisfied and an epic that stays open for months because nobody
 * re-ran a grep from an issue body.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const WF_DIR = path.join(REPO_ROOT, '.github', 'workflows');
const KEY = 'secrets.SUPABASE_SERVICE_ROLE_KEY';

/**
 * PR-triggered workflows still permitted to inject the production key, and the number of
 * sites each is allowed. A ratchet: lower it as sites go, never raise it.
 */
const ALLOWED = { 'e2e.yml': 7 };

/** The `on:` block only — a `pull_request:` mentioned inside a job step is not a trigger. */
function triggerBlock(text) {
  const start = text.search(/^on:\s*$/m);
  if (start === -1) return '';
  const rest = text.slice(start);
  const end = rest.search(/^jobs:\s*$/m);
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * `push` counts as PR-triggered for this purpose. It runs the same dependency graph on the
 * same contributor code, just after the merge rather than before.
 */
function runsOnContributorCode(text) {
  return /^\s{2}(pull_request|pull_request_target|push):/m.test(
    triggerBlock(text)
  );
}

function scan() {
  return fs
    .readdirSync(WF_DIR)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => {
      const text = fs.readFileSync(path.join(WF_DIR, f), 'utf8');
      return {
        file: f,
        sites: (text.match(new RegExp(KEY.replace('.', '\\.'), 'g')) ?? [])
          .length,
        prTriggered: runsOnContributorCode(text),
      };
    });
}

describe('the production service-role key stays out of PR-triggered CI (#575)', () => {
  it('the scan found the workflows it is asserting about', () => {
    // Anti-vacuity. A wrong directory, a renamed key, or a broken trigger parser would
    // otherwise make every assertion below pass while checking nothing — which is the
    // failure mode this repo catalogues under #396.
    const all = scan();
    assert.ok(
      all.length >= 10,
      `only ${all.length} workflows scanned — WF_DIR looks wrong`
    );
    assert.ok(
      all.some((w) => w.prTriggered),
      'no workflow parsed as PR-triggered — the trigger parser is broken, so the ' +
        'exposure check below is inspecting an empty set'
    );
    assert.ok(
      all.some((w) => w.sites > 0),
      `no workflow references ${KEY} — either the epic is finished (update ALLOWED ` +
        'and close #575) or the key was renamed and this test now guards nothing'
    );
  });

  it('only the documented workflows inject it, and only on non-PR triggers', () => {
    const offenders = scan()
      .filter((w) => w.sites > 0 && w.prTriggered)
      .map((w) => w.file)
      .sort();

    // Say which direction it moved. A message that explains both leaves the reader to
    // work out which half applies, and the two mean opposite things: one is a new
    // production-credential exposure, the other is the epic being finished.
    const expected = Object.keys(ALLOWED).sort();
    const added = offenders.filter((f) => !expected.includes(f));
    const gone = expected.filter((f) => !offenders.includes(f));

    const why = added.length
      ? `${added.join(', ')} now injects it on a PR trigger, handing an RLS-bypassing ` +
        "production credential to that workflow's dependency graph on every code PR. " +
        'Use the local stack instead — conformance.yml and signup-mailer.yml both copy ' +
        'the tracked, PUBLIC .env.local-supabase and need no secret at all.'
      : `${gone.join(', ')} no longer injects it, so #575's exit criterion is met. ` +
        'Remove the entry from ALLOWED, rotate the key once in coordination with the 14 ' +
        'edge functions that consume it (#574), and close the epic.';

    assert.deepStrictEqual(
      offenders,
      expected,
      `PR-triggered workflows injecting ${KEY} changed. ${why}`
    );
  });

  it('no new injection sites in the workflows that still have them', () => {
    for (const w of scan().filter((x) => ALLOWED[x.file] !== undefined)) {
      assert.ok(
        w.sites <= ALLOWED[w.file],
        `${w.file} injects ${KEY} at ${w.sites} sites, up from ${ALLOWED[w.file]}. ` +
          'This number only goes down.'
      );
    }
  });

  it('scheduled maintenance jobs may use it — that is not the risk', () => {
    // Stated so a future reader does not "tidy up" intake-orphan-sweep.yml and think they
    // have advanced #575. Nothing from a contributor branch runs beside a scheduled job.
    const sweep = scan().find((w) => w.file === 'intake-orphan-sweep.yml');
    assert.ok(
      sweep,
      'intake-orphan-sweep.yml is gone — re-check this exemption'
    );
    assert.ok(
      !sweep.prTriggered,
      'intake-orphan-sweep.yml became PR-triggered while holding the production ' +
        'service-role key. It is a scheduled maintenance job; it must not run on PRs.'
    );
  });
});
