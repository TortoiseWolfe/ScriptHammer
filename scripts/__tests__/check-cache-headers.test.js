/**
 * `check-cache-headers.mjs` is the only thing that would notice if the Cloudflare
 * rules behind #635 were deleted, so it has to be able to go RED. A probe that
 * cannot report failure proves nothing — four such probes were written in a single
 * session on this repo and every one of them was wrong.
 *
 * The central case is `max-age=600`: the exact header GitHub Pages sends, and
 * therefore exactly what production looks like the moment the Cloudflare rule stops
 * applying. If that case does not fail, this check is decoration.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer } = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const SCRIPT = path.join(__dirname, '..', 'ci', 'check-cache-headers.mjs');

const ASSET = '/_next/static/chunks/main-abc123.js';
const PAGE = `<!doctype html><html><head>
  <link rel="stylesheet" href="/_next/static/css/deadbeef.css">
  <script src="${ASSET}"></script></head><body>hi</body></html>`;

/**
 * A stand-in for the live site.
 *
 * @param {object} o
 * @param {string} o.docCacheControl  what the HTML document claims
 * @param {string} o.assetCacheControl what a hashed asset claims
 * @param {boolean} [o.edge]          whether to emit `cf-ray` (i.e. "Cloudflare answered")
 * @param {string[]} [o.missing]      paths that should 404
 */
function fixture({
  docCacheControl,
  assetCacheControl,
  edge = true,
  missing = [],
}) {
  return createServer((req, res) => {
    const url = req.url.split('?')[0];
    const headers = {};
    if (edge) headers['cf-ray'] = '8f0000000000abcd-ATL';

    if (missing.includes(url)) {
      res.writeHead(404, headers);
      res.end('nope');
      return;
    }

    if (url.startsWith('/_next/static/')) {
      res.writeHead(200, {
        ...headers,
        'Content-Type': 'application/javascript',
        'Cache-Control': assetCacheControl,
      });
      res.end('console.log(1)');
      return;
    }

    res.writeHead(200, {
      ...headers,
      'Content-Type': 'text/html',
      'Cache-Control': docCacheControl,
    });
    res.end(PAGE);
  });
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function runProbe(baseUrl, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT, baseUrl], {
      env: { ...process.env, CHECK_PATHS: '/', ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.on('data', (c) => (stderr += c));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function withFixture(opts, fn) {
  const server = fixture(opts);
  const port = await listen(server);
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

/**
 * A project-Pages deployment: the site lives under a path prefix, and the page's own
 * asset hrefs carry it. This is what every fork gets, and what this repo would get
 * without a custom domain.
 *
 * @param {object} o
 * @param {string} o.prefix e.g. '/widget'
 */
function prefixedFixture({ prefix, assetCacheControl = 'max-age=31536000' }) {
  const page = `<!doctype html><html><head>
    <link rel="stylesheet" href="${prefix}/_next/static/css/deadbeef.css">
    </head><body>hi</body></html>`;
  return createServer((req, res) => {
    const url = req.url.split('?')[0];
    const headers = { 'cf-ray': '8f0000000000abcd-ATL' };
    // Serve NOTHING outside the prefix, exactly like GitHub Pages: the doubled URL
    // `/widget/widget/_next/…` has to 404, or the test cannot see the bug.
    if (!url.startsWith(`${prefix}/`) && url !== prefix) {
      res.writeHead(404, headers);
      res.end('nope');
      return;
    }
    if (url.startsWith(`${prefix}/_next/static/`)) {
      res.writeHead(200, {
        ...headers,
        'Content-Type': 'text/css',
        'Cache-Control': assetCacheControl,
      });
      res.end('body{}');
      return;
    }
    res.writeHead(200, {
      ...headers,
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache',
    });
    res.end(page);
  });
}

test('resolves assets against the document, not by concatenating the base (#970)', async () => {
  // Before the fix this built `…/widget/widget/_next/static/css/deadbeef.css` and
  // reported a 404 for an asset the fixture serves correctly.
  const server = prefixedFixture({ prefix: '/widget' });
  const port = await listen(server);
  try {
    const { code, stdout, stderr } = await runProbe(
      `http://127.0.0.1:${port}/widget`,
      { CHECK_PATHS: '/' }
    );
    assert.equal(code, 0, `expected pass, got:\n${stdout}\n${stderr}`);
    assert.ok(
      !/widget\/widget/.test(stdout + stderr),
      'the basePath was doubled somewhere in the output'
    );
  } finally {
    server.close();
  }
});

test('a genuinely missing asset is still reported on a prefixed deployment', async () => {
  // The negative control for the test above: the fix must not be "stop checking".
  const server = createServer((req, res) => {
    const url = req.url.split('?')[0];
    const headers = { 'cf-ray': '8f0000000000abcd-ATL' };
    if (url === '/widget/' || url === '/widget') {
      res.writeHead(200, {
        ...headers,
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache',
      });
      res.end(
        `<!doctype html><html><head><link rel="stylesheet" href="/widget/_next/static/css/gone.css"></head><body>hi</body></html>`
      );
      return;
    }
    res.writeHead(404, headers);
    res.end('nope');
  });
  const port = await listen(server);
  try {
    const { code, stdout, stderr } = await runProbe(
      `http://127.0.0.1:${port}/widget`,
      { CHECK_PATHS: '/' }
    );
    assert.equal(code, 1, 'a missing asset must still fail the gate');
    assert.ok(
      /gone\.css/.test(stdout + stderr),
      `expected the missing asset to be named:\n${stdout}\n${stderr}`
    );
  } finally {
    server.close();
  }
});

test('passes when the #635 contract is served', async () => {
  await withFixture(
    {
      docCacheControl: 'no-cache',
      assetCacheControl: 'max-age=31536000',
    },
    async (base) => {
      const { code, stdout } = await runProbe(base);
      assert.equal(code, 0, `expected pass, got:\n${stdout}`);
      assert.match(stdout, /cache contract holds/);
    }
  );
});

test('FAILS on max-age=600 — the exact header that means the Cloudflare rule is gone', async () => {
  await withFixture(
    {
      docCacheControl: 'max-age=600',
      assetCacheControl: 'max-age=31536000',
    },
    async (base) => {
      const { code, stderr } = await runProbe(base);
      assert.equal(code, 1, 'a stale document header must fail the check');
      assert.match(stderr, /does not revalidate/);
      // The message must name the actual cause, or the next person debugging a red
      // run learns nothing from it.
      assert.match(stderr, /Response Header Transform Rule is missing/);
    }
  );
});

test('FAILS when hashed assets are not cached for a year', async () => {
  await withFixture(
    {
      docCacheControl: 'no-cache',
      assetCacheControl: 'max-age=600',
    },
    async (base) => {
      const { code, stderr } = await runProbe(base);
      assert.equal(code, 1, 'a short asset TTL must fail the check');
      assert.match(stderr, /expected max-age >= 31536000/);
    }
  );
});

test('FAILS when Cloudflare did not serve the response (no cf-ray)', async () => {
  await withFixture(
    {
      docCacheControl: 'no-cache',
      assetCacheControl: 'max-age=31536000',
      edge: false,
    },
    async (base) => {
      // REQUIRE_EDGE is opt-in since #970, so this states the condition it is
      // testing rather than relying on a default. smoke.yml passes the same
      // value, and a test below fails if it stops doing so.
      const { code, stderr } = await runProbe(base, { REQUIRE_EDGE: 'true' });
      assert.equal(
        code,
        1,
        'losing the edge must fail: the contract lives there'
      );
      assert.match(stderr, /no `cf-ray`/);
    }
  );
});

test('FAILS loudly rather than passing vacuously when a page yields no assets', async () => {
  const server = createServer((req, res) => {
    res.writeHead(200, {
      'cf-ray': '8f0000000000abcd-ATL',
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache',
    });
    // A rendered page with no /_next/static/ references at all.
    res.end('<!doctype html><html><body>nothing here</body></html>');
  });
  const port = await listen(server);
  try {
    const { code, stderr } = await runProbe(`http://127.0.0.1:${port}`);
    assert.equal(
      code,
      1,
      'no assets found must fail, not silently pass (#396)'
    );
    assert.match(stderr, /no \/_next\/static\/ asset URLs were found/);
  } finally {
    server.close();
  }
});

test('accepts max-age=0 as revalidating, since it is equivalent for this purpose', async () => {
  await withFixture(
    {
      docCacheControl: 'max-age=0',
      assetCacheControl: 'max-age=31536000',
    },
    async (base) => {
      const { code } = await runProbe(base);
      assert.equal(
        code,
        0,
        'max-age=0 forces revalidation just as no-cache does'
      );
    }
  );
});

test('checks EVERY configured path, not just the first', async () => {
  // A rule that applied only to `/` would leave every real page stale. Serve a good
  // root and a stale /blog/, and require the probe to notice the second one.
  const server = createServer((req, res) => {
    const url = req.url.split('?')[0];
    const stale = url === '/blog/';
    res.writeHead(200, {
      'cf-ray': '8f0000000000abcd-ATL',
      'Content-Type': url.startsWith('/_next/')
        ? 'application/javascript'
        : 'text/html',
      'Cache-Control': url.startsWith('/_next/')
        ? 'max-age=31536000'
        : stale
          ? 'max-age=600'
          : 'no-cache',
    });
    res.end(url.startsWith('/_next/') ? 'console.log(1)' : PAGE);
  });
  const port = await listen(server);
  try {
    const { code, stderr } = await runProbe(`http://127.0.0.1:${port}`, {
      CHECK_PATHS: '/,/blog/',
    });
    assert.equal(code, 1, 'a stale nested route must fail even when / is fine');
    assert.match(stderr, /\/blog\//);
  } finally {
    server.close();
  }
});

test('a fork without a Cloudflare edge is not failed for lacking one', async () => {
  // The other half of the same default. `cf-ray` exists here only because Cloudflare
  // fronts this zone (#635); no fork inherits that, and failing every fork's correct
  // deployment teaches people to ignore the check (#970).
  await withFixture(
    {
      docCacheControl: 'no-cache',
      assetCacheControl: 'max-age=31536000',
      edge: false,
    },
    async (base) => {
      const { code, stdout, stderr } = await runProbe(base);
      assert.equal(
        code,
        0,
        `expected pass without an edge:\n${stdout}\n${stderr}`
      );
    }
  );
});

test('smoke.yml still demands the edge for THIS deployment', () => {
  // A flipped default weakens a gate by omission: nothing fails, the check just stops
  // asking. The edge requirement is the only thing that can see the #635 cure, so the
  // workflow has to keep asserting it explicitly, and this fails if that line is lost.
  const workflow = fs.readFileSync(
    path.join(__dirname, '..', '..', '.github', 'workflows', 'smoke.yml'),
    'utf8'
  );
  assert.match(
    workflow,
    /REQUIRE_EDGE:\s*'true'/,
    "smoke.yml must pass REQUIRE_EDGE: 'true' — without it the #635 edge contract is " +
      'no longer checked anywhere, and nothing else would fail'
  );
});

test('refuses to run with no base URL rather than measuring another site', () => {
  // It used to default to this project's own domain, and smoke.yml layered a `:-`
  // fallback on top, so a fork with NEXT_PUBLIC_DEPLOY_URL unset ran a green check
  // against somebody else's site (#970).
  const workflow = fs.readFileSync(
    path.join(__dirname, '..', '..', '.github', 'workflows', 'smoke.yml'),
    'utf8'
  );
  assert.ok(
    !/check-cache-headers\.mjs "\$\{SITE:-/.test(workflow),
    'smoke.yml must not fall back to a hardcoded site'
  );
  // Strip comments before matching: this file DISCUSSES the old default at length, and
  // a guard that matches its own prose passes with the code deleted.
  const script = fs
    .readFileSync(
      path.join(__dirname, '..', 'ci', 'check-cache-headers.mjs'),
      'utf8'
    )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(
    !/scripthammer\.com/i.test(script),
    'no hardcoded upstream host may remain in the executable part of the script'
  );
});
