/**
 * #987: `NEXT_PUBLIC_PAGESPEED_API_KEY` was a MANDATORY deploy secret that nothing
 * consumed. `deploy.yml` exited 1 before `pnpm build` when it was empty — the only
 * hard stop in the whole deploy — and no component, hook, service or script anywhere
 * called the PageSpeed API. A fork could not publish a site without obtaining a Google
 * key, and obtaining one changed nothing.
 *
 * The two halves of that defect are independent, so they are asserted independently:
 *
 *   1. SOMETHING READS THE KEY. This is the assertion that was false for the entire
 *      life of the bug, and no green check anywhere noticed. Grepping the repo would
 *      not have caught it either — the name appeared in five places, all of them
 *      workflows, docs or an allowlist. It has to be a read from APPLICATION source
 *      that also reaches the API.
 *
 *   2. THE DEPLOY DOES NOT REFUSE TO PUBLISH OVER IT. A missing key degrades one panel
 *      on /status to the unauthenticated quota. Environment guards have a direction,
 *      and this one was pointed at the wrong thing: it stopped a site existing.
 *
 * Comment-stripped before matching, because this repo has shipped four guards that
 * passed by matching their own explanatory prose.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const KEY = 'NEXT_PUBLIC_PAGESPEED_API_KEY';
const ENDPOINT_HOST = 'www.googleapis.com';
const PSI_PATH = 'pagespeedonline/v5/runPagespeed';

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Line and block comments, in both `#` and `//` dialects. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(#|\/\/|\*)/.test(line))
    .join('\n');
}

/** The one deploy step that is about this key. */
function pageSpeedStep(workflow) {
  const lines = workflow.split('\n');
  const start = lines.findIndex(
    (l) => /^\s*- name:/.test(l) && /PageSpeed/i.test(l)
  );
  assert.notStrictEqual(start, -1, 'no PageSpeed step in deploy.yml');
  const indent = lines[start].search(/\S/);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(
    (l) => l.trim().startsWith('- ') && l.search(/\S/) <= indent
  );
  return [lines[start], ...(end === -1 ? rest : rest.slice(0, end))].join('\n');
}

describe('the PageSpeed key is load-bearing, and does not block the deploy (#987)', () => {
  it('application source reads the key AND calls the API', () => {
    // Not "the string appears in the repo" — it appeared in five places for months
    // while nothing consumed it, every one of them a workflow, a doc, or an
    // allowlist. The read has to come from src/, and the same module has to reach
    // the endpoint, or this passes on a key that is read and thrown away.
    const source = stripComments(read('src/utils/pagespeed.ts'));
    assert.match(
      source,
      new RegExp(`process\\.env\\.${KEY}`),
      'nothing in src/ reads the key'
    );
    assert.ok(
      source.includes(ENDPOINT_HOST) && source.includes(PSI_PATH),
      'the module that reads the key does not call the PageSpeed API'
    );
  });

  it('the status page actually calls it — a module nobody imports is not consumption', () => {
    const page = stripComments(read('src/app/status/page.tsx'));
    assert.match(page, /from '@\/utils\/pagespeed'/);
    assert.match(page, /fetchPageSpeed\(/);
  });

  it('the deploy does not exit non-zero when the key is missing', () => {
    const step = stripComments(
      pageSpeedStep(read('.github/workflows/deploy.yml'))
    );
    assert.doesNotMatch(
      step,
      /exit 1/,
      'a missing PageSpeed key must not stop a site from being published'
    );
    assert.doesNotMatch(
      step,
      /::error::/,
      'a missing PageSpeed key is a warning, not an error'
    );
  });

  it('the deploy still SAYS something when the key is missing', () => {
    // Removing the gate must not make the absence silent. A forker who never sets it
    // should be told once, at deploy time, what it costs them.
    const step = stripComments(
      pageSpeedStep(read('.github/workflows/deploy.yml'))
    );
    assert.match(step, /::warning::/);
    assert.match(step, new RegExp(KEY));
  });

  it('the whole deploy has no hard stop left', () => {
    // The stated claim in CLAUDE.md, README and FORKING is now "nothing here stops a
    // deploy". This is what makes that claim checkable rather than asserted.
    const deploy = stripComments(read('.github/workflows/deploy.yml'));
    assert.doesNotMatch(
      deploy,
      /exit 1/,
      'deploy.yml regained a hard stop — if that is deliberate, the fork docs saying otherwise must change in the same commit'
    );
  });

  it('the documented CSP allows the endpoint the browser now calls', () => {
    // The call is client-side, so connect-src decides whether it happens at all.
    const security = read('.github/SECURITY.md');
    const connect = security.split('\n').find((l) => l.includes('connect-src'));
    assert.ok(connect, 'SECURITY.md documents no connect-src');
    assert.ok(
      connect.includes(ENDPOINT_HOST),
      `connect-src must allow ${ENDPOINT_HOST}`
    );
  });

  it('no fork doc still calls the key a hard stop', () => {
    // The docs said "the ONLY hard stop" and "the single thing standing between your
    // first push and any site existing". Both were true and are now false; a stale
    // title or sentence is read far more often than the code that contradicts it.
    for (const doc of [
      'README.md',
      'docs/FORKING.md',
      'docs/FORK-CHECKLIST.md',
    ]) {
      const src = read(doc);
      const around = src
        .split('\n')
        .filter((l) => l.includes(KEY))
        .join('\n');
      assert.doesNotMatch(
        around,
        /exits? 1|hard stop|ONLY hard/i,
        `${doc} still describes the PageSpeed key as blocking the deploy`
      );
    }
  });
});
