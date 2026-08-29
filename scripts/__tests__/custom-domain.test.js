/**
 * Unit tests for the deploy-time custom-domain gate (#980).
 *
 * WHAT THIS GATE EXISTS FOR. The custom domain and the base path are two halves of one
 * fact: a CNAME in the artifact means an apex, which means assets must be UNPREFIXED; no
 * CNAME means a project site at /<repo>/, which means they must be PREFIXED. Out of step,
 * the deploy is green while every asset 404s and nothing reports it — #961's failure.
 *
 * NO DOMAIN LITERAL APPEARS IN THIS FILE. Writing this repo's own hostname into a test
 * would be rewritten in every fork by #983's `resolve_brand_domain`, which substitutes that
 * hostname across every rewritable tracked file — turning the required `Test (20.x)` red on
 * every fork for a reason no forker could diagnose. Fixtures use reserved `.example` names,
 * and the one test that checks real configuration reads it rather than asserting it.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const MOD = new URL('../ci/check-custom-domain.mjs', `file://${__filename}`)
  .href;

/** An index.html whose absolute asset refs carry `prefix` (use '' for none). */
function html(prefix, extra = '') {
  return `<!doctype html><html><head>
<link rel="stylesheet" href="${prefix}/_next/static/css/a.css"/>
<link rel="icon" href="${prefix}/favicon.ico"/>
${extra}
</head><body><script src="${prefix}/_next/static/chunks/main.js"></script></body></html>`;
}

const OK = {
  domain: 'widget.example',
  cnameBytes: 'widget.example',
  html: html(''),
  name: 'Widget',
  deployUrl: '',
};

async function check(over = {}) {
  const { checkCustomDomain } = await import(MOD);
  return checkCustomDomain({ ...OK, ...over });
}

describe('the custom-domain gate (#980)', () => {
  it('passes a coherent apex artifact, and says what it verified', async () => {
    // Non-vacuity: if the happy path failed, every "must report a problem" test below
    // would pass for the wrong reason.
    const { problems, summary } = await check();
    assert.deepStrictEqual(problems, []);
    assert.match(summary, /asset ref/);
  });

  describe('the configuration and the artifact must agree', () => {
    it('rejects a declared domain with no CNAME in the artifact', async () => {
      const { problems } = await check({ cnameBytes: null });
      assert.match(problems.join('\n'), /no CNAME at its root/);
    });

    it('rejects a CNAME in the artifact when no domain is configured', async () => {
      const { problems } = await check({
        domain: null,
        html: html('/Widget'),
      });
      assert.match(problems.join('\n'), /ships a CNAME/);
    });

    it('rejects a CNAME whose bytes differ from the configured domain', async () => {
      // Byte equality, not "looks similar" — a hostname off by one label is a dead site.
      const { problems } = await check({ cnameBytes: 'www.widget.example' });
      assert.match(problems.join('\n'), /but "widget\.example" is configured/);
    });
  });

  describe('the asset paths must agree with that decision', () => {
    it('CATCHES THE SUBSTRING TRAP: prefixed assets with a domain declared', async () => {
      // `/Widget/_next/static/x` CONTAINS `/_next/`, so a gate built on a substring search
      // passes on exactly this artifact. This is the assertion that must not be weakened
      // into `includes('/_next/')`.
      const { problems } = await check({ html: html('/Widget') });
      assert.match(
        problems.join('\n'),
        /must be unprefixed, but 2 start with \/Widget\//
      );
    });

    it('rejects unprefixed assets on a project site', async () => {
      const { problems } = await check({
        domain: null,
        cnameBytes: null,
        html: html(''),
      });
      assert.match(problems.join('\n'), /must start with \/Widget\//);
    });

    it('accepts prefixed assets on a project site', async () => {
      const { problems } = await check({
        domain: null,
        cnameBytes: null,
        html: html('/Widget'),
      });
      assert.deepStrictEqual(problems, []);
    });

    it('REFUSES TO PASS AN ARTIFACT WITH NO ASSETS — the anti-vacuity floor', async () => {
      // Without this every clause above is trivially true and the gate approves a blank
      // page, which is the "gate that could not fail" shape this repo keeps filing (#396).
      const { problems } = await check({
        html: '<!doctype html><html></html>',
      });
      assert.match(problems.join('\n'), /nothing to check/);
    });

    it('ignores cross-origin and relative references', async () => {
      const { problems } = await check({
        html: html(
          '',
          '<script src="https://cdn.example/x.js"></script><img src="./a.png"/>'
        ),
      });
      assert.deepStrictEqual(problems, []);
    });
  });

  describe('an explicit base path overrides the derived rule', () => {
    it('honours NEXT_PUBLIC_BASE_PATH, because detect-project.js does', async () => {
      const { problems } = await check({
        html: html('/Explicit'),
        envBasePath: '/Explicit',
      });
      assert.deepStrictEqual(problems, []);
    });

    it('honours DISABLE_BASE_PATH over an explicit base path', async () => {
      const { problems } = await check({
        domain: null,
        cnameBytes: null,
        html: html(''),
        envBasePath: '/Explicit',
        basePathDisabled: true,
      });
      assert.deepStrictEqual(problems, []);
    });
  });

  describe('the deploy origin is the one independently-configured fact', () => {
    it('rejects a project-site origin while a custom domain is declared', async () => {
      const { problems } = await check({
        deployUrl: 'https://acme.github.io/Widget',
      });
      assert.match(problems.join('\n'), /a project site/);
    });

    it('rejects a custom origin with no domain declared', async () => {
      const { problems } = await check({
        domain: null,
        cnameBytes: null,
        html: html('/Widget'),
        deployUrl: 'https://widget.example',
      });
      assert.match(problems.join('\n'), /Pages will not serve that host/);
    });

    it('rejects an origin naming a different host', async () => {
      const { problems } = await check({ deployUrl: 'https://other.example' });
      assert.match(problems.join('\n'), /must be the same host/);
    });

    it('tolerates www vs apex, which this project genuinely mixes', async () => {
      const { problems } = await check({
        deployUrl: 'https://www.widget.example',
      });
      assert.deepStrictEqual(problems, []);
    });

    it('skips the origin clause entirely when DEPLOY_URL is unset, and SAYS so', async () => {
      // A silently-skipped assertion is indistinguishable from a passing one. The summary
      // is what stops "green" being read as "all three clauses ran".
      const { problems, summary } = await check({ deployUrl: '' });
      assert.deepStrictEqual(problems, []);
      assert.match(summary, /origin unchecked/);
    });
  });

  describe('the deploy actually runs it, and cannot silently stop', () => {
    // NOTHING GUARDS A GUARD BY DEFAULT. Proving the assertion function rejects drift says
    // nothing about whether deploy.yml still calls it, still calls it on the uploaded
    // directory, still calls it before the upload, or still treats a failure as fatal.
    // `continue-on-error: true` is a construct this workflow already uses, one step below.
    const fs = require('node:fs');
    const path = require('node:path');
    const WF = path.join(
      __dirname,
      '..',
      '..',
      '.github',
      'workflows',
      'deploy.yml'
    );
    const workflow = () => fs.readFileSync(WF, 'utf8');
    const stripped = () =>
      workflow()
        .split('\n')
        .filter((l) => !/^\s*#/.test(l))
        .join('\n');

    it('invokes the gate against the directory that is uploaded', () => {
      // merged-output, NOT out/. Auditing out/ would re-check what three gates already
      // cover and skip the merge, which is the only part nothing else sees.
      assert.match(
        stripped(),
        /check-custom-domain\.mjs merged-output/,
        'deploy.yml must run the gate against merged-output'
      );
      assert.match(
        stripped(),
        /path: \.\/merged-output/,
        'and merged-output must still be what gets uploaded'
      );
    });

    it('runs it BEFORE the upload', () => {
      const src = stripped();
      assert.ok(
        src.indexOf('check-custom-domain.mjs') <
          src.indexOf('upload-pages-artifact'),
        'a gate that runs after the upload has already shipped the bad artifact'
      );
    });

    it('treats a failure as fatal', () => {
      // Scoped to this step: continue-on-error appears legitimately on the retention step.
      const src = stripped();
      const start = src.indexOf('check-custom-domain.mjs');
      const step = src.slice(
        src.lastIndexOf('- name:', start),
        src.indexOf('- name:', start)
      );
      assert.doesNotMatch(
        step,
        /continue-on-error/,
        'the gate must be able to fail the deploy'
      );
    });

    it('passes the origin under a name the NEXT_PUBLIC_ guard cannot mistake for the build env', () => {
      const src = stripped();
      const start = src.indexOf('check-custom-domain.mjs');
      const step = src.slice(
        src.lastIndexOf('- name:', start),
        src.indexOf('- name:', start)
      );
      assert.match(
        step,
        /DEPLOY_URL: \$\{\{ vars\.NEXT_PUBLIC_DEPLOY_URL \}\}/
      );
      assert.doesNotMatch(
        step,
        /^\s+NEXT_PUBLIC_DEPLOY_URL:/m,
        'reusing the NEXT_PUBLIC_ name here would satisfy deploy-passes-what-code-reads.test.js even if the build step dropped it'
      );
    });
  });

  it('reads this repository real configuration rather than assuming it', async () => {
    const { configuredDomain, projectName } = await import(MOD);
    const domain = configuredDomain();
    // Deliberately not asserting WHICH domain — see the header. Only that configuration is
    // discoverable and coherent, so the CLI is not reading undefined.
    assert.ok(
      domain === null || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain),
      `got ${domain}`
    );
    assert.ok(projectName().length > 0);
  });
});
