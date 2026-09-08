/**
 * `check-captcha.mjs` must not double-prefix chunk URLs, and must not advertise a check it
 * never runs (#1058).
 *
 * TWO DEFECTS, ONE THEME. Both are the script telling the operator something untrue about
 * itself.
 *
 * 1. It resolved chunk hrefs by CONCATENATING the site origin: `${BASE}${c}`. On a
 *    project-Pages deploy the HTML lives at `${BASE}/sign-in/` and its hrefs already carry
 *    the base path, so the result was `/myfork/myfork/_next/...` — a 404. The script then
 *    reported "the site key is NOT in the deployed bundle", blaming `deploy.yml` for a build
 *    that was perfectly correct. A fork's operator would go looking in the wrong place.
 *
 * 2. Its header listed domain allowlisting as a check it performs, with a specific error code.
 *    It never ran it. `docs/AUTH-SETUP.md` has described the situation correctly the whole
 *    time — the script's own header was the only thing lying.
 *
 * WHY AN END-TO-END TEST FOR THE FIRST. The bug is entirely in how a URL is built from two
 * pieces, and any assertion that reads the source for `new URL` would pass on a broken
 * rewrite. So this serves a real project-Pages layout over loopback and asserts the script
 * FINDS a key that is genuinely there — which is exactly what it failed to do.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { createServer } = require('node:http');
const { execFile } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '..', 'check-captcha.mjs');
const SITE_KEY = '0x4AAAAAAATestSiteKey';
const BASE_PATH = '/myfork';

function listen(server) {
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  );
}

/**
 * A project-Pages deploy: the page lives under a base path, and its chunk hrefs already
 * include that base path. Requests to a doubled path 404, exactly as GitHub Pages does.
 */
function fixtureSite() {
  const chunk = `${BASE_PATH}/_next/static/chunks/main-abc.js`;
  return createServer((req, res) => {
    if (req.url === `${BASE_PATH}/sign-in/`) {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(
        `<!doctype html><html><body><script src="${chunk}"></script></body></html>`
      );
      return;
    }
    if (req.url === chunk) {
      res.writeHead(200, { 'content-type': 'application/javascript' });
      res.end(`const k="${SITE_KEY}";export default k;`);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  });
}

/**
 * MUST be async. `spawnSync` blocks this process's event loop, and the fixture server runs in
 * THIS process — so the child's fetch would never be answered and both sides would hang. That
 * deadlock is not hypothetical; it is what the first draft of this file did.
 */
function runScript(base) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [SCRIPT, '--base', base, '--site-key', SITE_KEY],
      {
        encoding: 'utf8',
        timeout: 20000,
        env: { ...process.env, TURNSTILE_SECRET: '' },
      },
      (_err, stdout, stderr) => resolve({ stdout, stderr })
    );
  });
}

describe('check-captcha honesty (#1058)', () => {
  it('finds a site key that is genuinely there on a base-path deploy', async () => {
    const server = fixtureSite();
    const port = await listen(server);
    try {
      const out = await runScript(`http://127.0.0.1:${port}${BASE_PATH}`);
      const all = `${out.stdout}${out.stderr}`;
      assert.ok(
        /site key is in the deployed build/.test(all),
        `the script never reported on the site key at all:\n${all}`
      );
      assert.ok(
        !/is NOT in the deployed bundle/.test(all),
        'the script says the key is missing, but the fixture serves it in the chunk the ' +
          'page references. That is the #1058 double-prefix: the chunk href already carries ' +
          `the base path, so concatenating the origin requests ${BASE_PATH}${BASE_PATH}/… ` +
          `and 404s.\n${all}`
      );
    } finally {
      server.close();
    }
  });

  it('ANTI-VACUITY: the same harness reports a key that is genuinely absent', async () => {
    // Counterweight. Without this, the assertion above could pass against a script that never
    // checks anything — which is the very species of defect this file is about.
    const server = createServer((req, res) => {
      if (req.url === `${BASE_PATH}/sign-in/`) {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<!doctype html><html><body>no chunks here</body></html>');
        return;
      }
      res.writeHead(404);
      res.end('nope');
    });
    const port = await listen(server);
    try {
      const out = await runScript(`http://127.0.0.1:${port}${BASE_PATH}`);
      const all = `${out.stdout}${out.stderr}`;
      assert.ok(
        /is NOT in the deployed bundle/.test(all),
        `the harness cannot produce a failure, so the test above proves nothing:\n${all}`
      );
    } finally {
      server.close();
    }
  });

  it('advertises exactly as many checks as it performs', () => {
    // The doc-truth guard. The header listed three checks; only two `record()` names exist.
    // Comparing the counts is what makes a fourth claim impossible to add silently.
    const src = fs.readFileSync(SCRIPT, 'utf8');

    const checksBlock =
      /\/\/ WHAT IT CHECKS\n([\s\S]*?)\n\/\/ WHAT IT DELIBERATELY DOES NOT CHECK/.exec(
        src
      );
    assert.ok(
      checksBlock,
      'the WHAT IT CHECKS block is gone — this guard is now vacuous'
    );
    const advertised = (checksBlock[1].match(/^\/\/\s+\d+\. /gm) || []).length;

    const performed = new Set(
      [...src.matchAll(/record\(\s*\n?\s*'([^']+)'/g)].map((m) => m[1])
    ).size;

    assert.strictEqual(
      advertised,
      performed,
      `The header advertises ${advertised} check(s) but the script performs ${performed}. ` +
        'A check named in WHAT IT CHECKS and never run is worse than a missing check: the ' +
        'operator reads a green run as covering it. Move it to WHAT IT DELIBERATELY DOES ' +
        'NOT CHECK, as domain allowlisting now is (#1058).'
    );
  });

  it('does not claim to verify domain allowlisting', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    const checksBlock =
      /\/\/ WHAT IT CHECKS\n([\s\S]*?)\n\/\/ WHAT IT DELIBERATELY DOES NOT CHECK/.exec(
        src
      );
    assert.ok(checksBlock, 'the WHAT IT CHECKS block is gone');
    assert.ok(
      !/110200|allowed-domains|allowlist/i.test(checksBlock[1]),
      'domain allowlisting is back in WHAT IT CHECKS. It needs a browser and a differential ' +
        '(bogus origin must return 110200, real origin must not); this script cannot do it, ' +
        'and docs/AUTH-SETUP.md says so.'
    );
  });
});
