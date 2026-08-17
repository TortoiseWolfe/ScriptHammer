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
      const { code, stderr } = await runProbe(base);
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
