/**
 * A FRESH FORK'S FIRST PUSH MUST NOT BE RED FOR ASKING ABOUT INFRASTRUCTURE IT
 * DOES NOT HAVE (#985).
 *
 * Measured on a real fork — `TortoiseWolfe/grand-daze`, created from the template and
 * rebranded with nothing else configured: 7 of 13 workflows failed before the forker
 * had typed anything. Two were template defects and are fixed. The rest interrogated a
 * live Supabase project, a Resend account and a metered E2E backend that a new project
 * does not have yet.
 *
 * Failing is the wrong signal for "not configured yet". It teaches a new forker that
 * red checks are normal, which is the state in which the next real failure is ignored.
 *
 * WHAT THIS PINS, and the shape matters more than any one line:
 *
 *   1. Each gate exists and is wired to the job or step it gates.
 *   2. HALF-CONFIGURED STILL FAILS wherever a credential comes in a pair. Skipping on
 *      "anything missing" would mean deleting a token silently retires a daily gate —
 *      a protection going quiet is precisely what these workflows exist to catch.
 *      Environment guards have a direction; these are protections, not conveniences.
 *   3. No workflow carries a hardcoded fallback to this project's Supabase ref, which
 *      pointed every fork's CI at somebody else's database.
 *   4. Every skip says what to set, and the hosted E2E lane says out loud that it
 *      skipped — a lane that quietly does nothing is a different bad signal, not a fix.
 *
 * WHY THE SOURCE IS COMMENT-STRIPPED FIRST. A guard that greps a file matches its own
 * explanatory prose and passes with the code deleted. This file would do exactly that:
 * the assertion that no hardcoded project ref survives is checked against a body from
 * which the paragraph explaining the removed hardcoded project ref has been stripped.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');

/** Full-line `#` comments only — an inline one is attached to real syntax. */
function stripComments(src) {
  return src
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

function body(name) {
  return stripComments(fs.readFileSync(path.join(WORKFLOWS, name), 'utf8'));
}

/** The lines of one job, from its key to the next key at the same indent. */
function job(src, name) {
  const start = src.search(new RegExp(`^  ${name}:$`, 'm'));
  assert.notStrictEqual(start, -1, `no job "${name}"`);
  const rest = src.slice(start).split('\n').slice(1);
  const end = rest.findIndex((line) => /^  \S/.test(line));
  return [`  ${name}:`, ...(end === -1 ? rest : rest.slice(0, end))].join('\n');
}

/** The lines of one `- name:` step, from its dash to the next step at that indent. */
function step(src, name) {
  const lines = src.split('\n');
  const start = lines.findIndex((line) =>
    line.trim().startsWith(`- name: ${name}`)
  );
  assert.notStrictEqual(start, -1, `no step "${name}"`);
  const indent = lines[start].search(/\S/);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(
    (line) => line.trim().startsWith('- ') && line.search(/\S/) <= indent
  );
  return [lines[start], ...(end === -1 ? rest : rest.slice(0, end))].join('\n');
}

describe('a fresh fork skips what it has not configured (#985)', () => {
  // NON-VACUITY. Every assertion below is over text these helpers return. If the
  // slicing breaks they all pass against nothing, which is the shape this file exists
  // to prevent — and the shape #934 shipped as a green required check.
  it('reads all four workflows and finds the jobs it is about', () => {
    assert.match(job(body('auth-config-drift.yml'), 'drift'), /runs-on:/);
    assert.match(job(body('prod-schema-drift.yml'), 'drift'), /runs-on:/);
    assert.match(job(body('email-health.yml'), 'bounce-rate'), /runs-on:/);
    assert.match(job(body('e2e.yml'), 'budget'), /runs-on:/);
  });

  describe('Auth Config Drift', () => {
    const src = () => body('auth-config-drift.yml');

    it('the preflight publishes an output, because a secret cannot be read in a job-level if:', () => {
      const changes = job(src(), 'changes');
      assert.match(
        changes,
        /configured:\s*\$\{\{\s*steps\.configured\.outputs\.configured\s*\}\}/
      );
      const preflight = step(changes, 'Is a Supabase project configured?');
      assert.match(
        preflight,
        /SUPABASE_ACCESS_TOKEN:\s*\$\{\{\s*secrets\.SUPABASE_ACCESS_TOKEN/
      );
      assert.match(
        preflight,
        /SUPABASE_PROJECT_REF:\s*\$\{\{\s*vars\.SUPABASE_PROJECT_REF/
      );
    });

    it('the drift job runs only when a project is configured', () => {
      assert.match(
        job(src(), 'drift'),
        /needs\.changes\.outputs\.configured\s*==\s*'true'/
      );
    });

    it('half-configured FAILS rather than skipping', () => {
      const preflight = step(
        job(src(), 'changes'),
        'Is a Supabase project configured?'
      );
      assert.match(preflight, /exit 1/, 'the half-configured branch must fail');
      assert.match(preflight, /missing repository VARIABLE/);
      assert.match(preflight, /missing repository SECRET/);
    });

    it('the required aggregate reports green when unconfigured, and red when the preflight failed', () => {
      const result = job(src(), 'result');
      assert.match(result, /if:\s*always\(\)/);
      assert.match(result, /CONFIGURED.*!=.*true/s);
      assert.match(
        result,
        /needs\.changes\.result\s*\}\}"\s*!=\s*"success"/,
        'a failed preflight must not be laundered into green by the skip branch'
      );
    });
  });

  describe('Prod Schema Drift', () => {
    const src = () => body('prod-schema-drift.yml');

    it('carries no hardcoded fallback to this project', () => {
      // Checked against the comment-stripped body on purpose: the paragraph that
      // explains the removal is still in the file, and would satisfy a naive grep.
      assert.doesNotMatch(
        src(),
        /vars\.SUPABASE_PROJECT_REF\s*\|\|/,
        'a fork must not interrogate the template owner’s database'
      );
    });

    it('EVERY step that reaches production is gated on the preflight', () => {
      // This asserted ONE named step. A list of one, kept in step with the workflow by
      // memory -- and it went stale the moment #1062 added a second detector, which is the
      // #1038 defect in miniature. Derived from the workflow now: any step carrying the
      // production token must carry the gate, so a third cannot be added ungated.
      const text = src();
      const named = [...text.matchAll(/^\s*- name:\s*(.+)$/gm)].map((m) =>
        m[1].trim()
      );
      const reaching = named.filter((n) => {
        const body_ = step(text, n);
        // The preflight reads the token too -- that is how it decides. It DEFINES the gate,
        // so it cannot consume it; excluded by the id it sets rather than by its name.
        return (
          /SUPABASE_ACCESS_TOKEN/.test(body_) &&
          !/id:\s*configured\b/.test(body_)
        );
      });
      assert.ok(
        reaching.length >= 2,
        `expected at least two steps reading production, found ${reaching.length}`
      );
      for (const n of reaching) {
        assert.match(
          step(text, n),
          /if:.*steps\.configured\.outputs\.configured\s*==\s*'true'/,
          `"${n}" reads production but is not gated on the preflight`
        );
      }
    });

    it('half-configured FAILS rather than skipping', () => {
      assert.match(step(src(), 'Is a Supabase project configured?'), /exit 1/);
    });
  });

  describe('Email Health', () => {
    const src = () => body('email-health.yml');

    it('the bounce-rate check is gated on a configured sender', () => {
      assert.match(
        step(src(), 'Check bounce rate against Resend'),
        /if:\s*steps\.configured\.outputs\.configured\s*==\s*'true'/
      );
      assert.match(
        step(src(), 'Is a sending account configured?'),
        /RESEND_API_KEY:\s*\$\{\{\s*secrets\.RESEND_API_KEY/
      );
    });
  });

  describe('the hosted E2E lane', () => {
    const src = () => body('e2e.yml');

    it('skips when there is no backend to meter, which is stronger than #949 blocking', () => {
      assert.match(
        job(src(), 'budget'),
        /if:\s*vars\.SUPABASE_PROJECT_REF\s*!=\s*''/
      );
    });

    it('every other job still traces back to the budget gate', () => {
      // The gate is only a cap because `build` needs it and everything needs `build`.
      // If that chain were broken the skip would leave the expensive lane running.
      assert.match(job(src(), 'build'), /needs:\s*budget/);
    });

    it('says out loud that it skipped, rather than doing nothing quietly', () => {
      // THE RULE HERE IS "IT ALWAYS RUNS", AND THAT HAS NOT CHANGED.
      //
      // It used to be enforced structurally — no `needs:`, no `if:`, so the job was
      // unskippable by construction. That also made it blind: with no dependency it could
      // only read `vars.SUPABASE_PROJECT_REF`, so it reported PASS whenever a backend was
      // CONFIGURED, including on 2026-09-04 when the daily budget was exhausted and not one
      // test ran. A check named "Hosted E2E lane" reporting green over a blocked lane is the
      // defect #1069 is about.
      //
      // So it now depends on `budget` and is held unskippable by the ONE expression that
      // survives a dependency which was skipped (fork, no backend) or failed (over budget).
      // That expression is pinned exactly, because this is the weaker form of the guarantee
      // and a wrong condition here restores the silence the rule exists to prevent.
      const status = job(src(), 'hosted-lane-status');
      assert.match(
        status,
        /^\s{4}needs:\s*budget\s*$/m,
        'it must depend on the budget job, or it cannot report whether the lane ran'
      );
      const cond = status.match(/^\s{4}if:\s*(.+)$/m);
      assert.ok(
        cond,
        'the status job needs an explicit condition to survive `needs:`'
      );
      assert.match(
        cond[1].trim(),
        /^\$\{\{\s*!cancelled\(\)\s*\}\}$/,
        'only `!cancelled()` runs when the dependency was skipped OR failed; `success()` ' +
          'and a bare `needs.*` comparison both reintroduce the silent skip'
      );
      assert.match(status, /::notice::/);
      assert.match(status, /SUPABASE_PROJECT_REF/);
      // And it must actually consult the gate's outcome, not just depend on it.
      assert.match(
        status,
        /needs\.budget\.result/,
        'it depends on the budget job but never reads its result'
      );
    });
  });

  it('every skip names what to set', () => {
    const notices = [
      [
        'auth-config-drift.yml',
        /SUPABASE_PROJECT_REF[\s\S]*SUPABASE_ACCESS_TOKEN/,
      ],
      [
        'prod-schema-drift.yml',
        /SUPABASE_PROJECT_REF[\s\S]*SUPABASE_ACCESS_TOKEN/,
      ],
      ['email-health.yml', /RESEND_API_KEY/],
      ['e2e.yml', /SUPABASE_PROJECT_REF/],
    ];
    for (const [file, names] of notices) {
      const src = body(file);
      const notice = src
        .split('\n')
        .filter((line) => line.includes('::notice::'))
        .join('\n');
      assert.ok(notice, `${file} has no ::notice:: explaining the skip`);
      assert.match(notice, names, `${file}'s notice does not name what to set`);
    }
  });
});
