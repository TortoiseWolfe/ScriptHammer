/**
 * `Test (20.x)` skips its build steps on an inert diff — and only then (#1218).
 *
 * THE SHAPE THAT WOULD BE CATASTROPHIC. `Test (20.x)` is a REQUIRED context and it is the
 * job itself; there is no always-reporting aggregate wrapping it. A trigger `paths:`
 * filter, or moving the decision into a separate job consumed via `needs:`, would make the
 * required check never report on a docs-only PR — and a required check that never reports
 * is PENDING FOREVER, not skipped. Every markdown PR would become unmergeable. So the
 * gate must live on STEPS, and this file is what keeps it there.
 *
 * THE SHAPE THAT WOULD BE QUIETLY WRONG. Marking build INPUT as inert. In this repo
 * markdown is not automatically inert: `src/lib/docs/registry.ts` names files that
 * `/docs/[slug]` renders during `pnpm build`, and that build runs inside this very job —
 * so skipping it on a change to one of them removes their only coverage. The decider
 * parses the registry rather than copying a list, and the cases below pin both directions.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const CI = fs.readFileSync(
  path.join(ROOT, '.github', 'workflows', 'ci.yml'),
  'utf8'
);
const SCRIPT = path.join(ROOT, 'scripts', 'ci', 'ci-docs-only.mjs');

/** ci.yml with `#` comments removed, so nothing matches its own rationale. */
const ciCode = CI.split('\n')
  .filter((l) => !l.trim().startsWith('#'))
  .join('\n');

/** Everything above `jobs:` — the trigger block. */
const triggers = ciCode.slice(0, ciCode.indexOf('\njobs:'));

const GATE = "if: steps.scope.outputs.docs_only != 'true'";

describe('docs-only gating in ci.yml (#1218)', () => {
  it('has NO trigger paths filter — the required check must always report', () => {
    assert.ok(
      !/^\s*(paths|paths-ignore):/m.test(triggers),
      'ci.yml must not filter its triggers by path. `Test (20.x)` is required and is the ' +
        'job itself, so a filtered trigger means it never reports on a docs PR — pending ' +
        'forever, not skipped, and that PR can never merge (#1218).'
    );
  });

  it('gates exactly the three expensive steps, and no others', () => {
    const gated = (
      ciCode.match(
        new RegExp(GATE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      ) || []
    ).length;
    assert.strictEqual(
      gated,
      3,
      `expected exactly 3 gated steps (coverage, app build, Storybook), found ${gated}. ` +
        'Gating more removes coverage that costs seconds; gating fewer leaves the minutes ' +
        'this ticket is about.'
    );
    for (const cmd of [
      'pnpm test:coverage',
      'pnpm build\n',
      'pnpm build-storybook',
    ]) {
      const at = ciCode.indexOf(`run: ${cmd}`);
      assert.ok(
        at > -1,
        `ci.yml no longer runs \`${cmd.trim()}\` — re-point this guard`
      );
      const before = ciCode.slice(Math.max(0, at - 200), at);
      assert.ok(
        before.includes(GATE),
        `\`${cmd.trim()}\` is not gated on the docs-only decision (#1218)`
      );
    }
  });

  it('keeps the CHEAP steps ungated, especially the one a docs PR breaks', () => {
    for (const cmd of ['pnpm lint', 'pnpm type-check', 'pnpm test:scripts']) {
      const at = ciCode.indexOf(`run: ${cmd}`);
      assert.ok(
        at > -1,
        `ci.yml no longer runs \`${cmd}\` — re-point this guard`
      );
      const before = ciCode.slice(Math.max(0, at - 200), at);
      assert.ok(
        !before.includes(GATE),
        `\`${cmd}\` must keep running on every diff. test:scripts in particular executes ` +
          'required-checks-documented.test.js, whose whole job is failing when CLAUDE.md ' +
          'and branch protection disagree — and a docs PR is exactly the PR that breaks it.'
      );
    }
  });

  it('checks out full history, or the PR diff cannot resolve', () => {
    assert.match(
      ciCode,
      /fetch-depth:\s*0/,
      'the scope step diffs against the PR base sha, which a shallow clone does not have'
    );
  });

  it('the decider is pure and self-tests', () => {
    const res = spawnSync(process.execPath, [SCRIPT, '--selftest'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /selftest ok/);
  });

  it('treats registry-rendered markdown as CODE, not as docs', () => {
    // The carve-out that stops this from removing the only coverage those files have.
    const verdict = (args) =>
      spawnSync(process.execPath, [SCRIPT, '--files', ...args], {
        cwd: ROOT,
        encoding: 'utf8',
      }).stdout;

    assert.match(verdict(['CLAUDE.md']), /docs_only=true/);
    assert.match(
      verdict(['docs/messaging/QUICKSTART.md']),
      /docs_only=false/,
      'that file is rendered by /docs/[slug] at build time, so a change to it must run the build'
    );
    assert.match(
      verdict(['features/x/wireframes/a.svg']),
      /docs_only=false/,
      'features/** feeds prebuild -> public/wireframes -> the /wireframes route'
    );
    assert.match(verdict(['CLAUDE.md', 'src/app/page.tsx']), /docs_only=false/);
  });
});
