const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer } = require('node:http');
const path = require('node:path');

const SCRIPT = path.join(__dirname, '..', 'ci', 'check-retained-assets.mjs');

function retainedEntries(extra = []) {
  return [
    ...extra,
    ...Array.from(
      { length: 20 - extra.length },
      (_, index) => `/_next/static/chunks/asset-${index}.js`
    ),
  ];
}

/**
 * An `ASSET_AGES.txt` body whose oldest entry is `spanDays` old (#751).
 *
 * The probe reads this ledger to judge whether the retention WINDOW is wide enough,
 * which is a separate question from whether the files are reachable — and the one
 * nothing asked on the night production went unstyled an eighth time.
 */
function agesFor(entries, spanDays) {
  const now = Date.now();
  return entries
    .map((rel, i) => {
      const age =
        i === 0 ? spanDays : (spanDays * (entries.length - i)) / entries.length;
      const when = new Date(now - age * 86400000).toISOString();
      return `${i} ${when} ${rel.replace(/^\/+/, '')}`;
    })
    .join('\n');
}

/**
 * Does this request ask for one of the ledger files?
 *
 * The ledger MOVED out of `/_next/static/` (#1061): that prefix is pinned
 * `max-age=31536000` by a Cloudflare rule written for content-hashed assets, and
 * these two files are mutable and at fixed names, so every reader was served an
 * arbitrarily old cached generation. The probe now asks for the new location
 * first and falls back to the legacy one, and it cache-busts with a query string.
 *
 * Real static hosts ignore an unknown query string and serve the file; these
 * fixtures now do the same, which makes them a closer model of production than
 * the exact-match they replace.
 */
function isLedger(url, name) {
  const path = (url ?? '').split('?')[0];
  return path === `/asset-ledger/${name}` || path === `/_next/static/${name}`;
}

function runProbe(baseUrl, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT, baseUrl], {
      env: { ...process.env, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function startServer(handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('accepts a CDN-style 206 ranged GET when HEAD is unavailable', async (t) => {
  const entries = retainedEntries(['/_next/static/css/app.css']);
  const server = await startServer((request, response) => {
    if (isLedger(request.url, 'ASSET_MANIFEST.txt')) {
      response.end(entries.join('\n'));
      return;
    }
    if (isLedger(request.url, 'ASSET_AGES.txt')) {
      response.end(agesFor(entries, 20));
      return;
    }
    if (request.method === 'HEAD') {
      response.writeHead(405).end();
      return;
    }
    assert.equal(request.headers.range, 'bytes=0-0');
    response.writeHead(206, { 'content-range': 'bytes 0-0/1' }).end('x');
  });
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl);

  assert.equal(result.code, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /MISSING   0/);
});

test('fails and names a missing retained stylesheet', async (t) => {
  const missing = '/_next/static/css/removed.css';
  const entries = retainedEntries([missing]);
  const server = await startServer((request, response) => {
    if (isLedger(request.url, 'ASSET_MANIFEST.txt')) {
      response.end(entries.join('\n'));
      return;
    }
    if (isLedger(request.url, 'ASSET_AGES.txt')) {
      response.end(agesFor(entries, 20));
      return;
    }
    if (request.url === missing) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200).end();
  });
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl);
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 1, output);
  assert.match(output, /removed\.css/);
  assert.match(output, /STYLESHEETS/);
});

/**
 * THE WINDOW ASSERTION (#751).
 *
 * Every check above asks whether retained files are REACHABLE. On 2026-08-15 all 13
 * retained stylesheets were reachable and production was unstyled anyway, because
 * the window they represented had shrunk to ~3.5 days while the config claimed a
 * week. Reachability cannot see that; only these can.
 *
 * `RETENTION_RETIMED_AT` is backdated here because the floor is deliberately dormant
 * during the ledger's first fortnight — without the override these would be testing
 * the ramp, not the assertion.
 */
const PAST_RAMP = {
  RETENTION_RETIMED_AT: '2026-01-01T00:00:00Z',
  RETAIN_DAYS: '14',
};

const serveLedger = (entries, spanDays) => (request, response) => {
  if (isLedger(request.url, 'ASSET_MANIFEST.txt')) {
    response.end(entries.join('\n'));
    return;
  }
  if (isLedger(request.url, 'ASSET_AGES.txt')) {
    response.end(agesFor(entries, spanDays));
    return;
  }
  response.writeHead(200).end();
};

test('fails when the retention window has collapsed below RETAIN_DAYS', async (t) => {
  const entries = retainedEntries(['/_next/static/css/app.css']);
  const server = await startServer(serveLedger(entries, 2));
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl, PAST_RAMP);
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 1, output);
  assert.match(output, /covers only 2\.0 day\(s\)/);
});

test('RETAINED_CHECK=reachability passes on a collapsed window — the split works', async (t) => {
  // THE POINT OF THE SPLIT (#1061). This is the exact production state after the
  // ledger cache fix: nothing is stranded (MISSING 0) while coverage rebuilds
  // (11.3 of 14 days). Sharing one exit code made that read as a single red, which
  // is what hid seven other detectors behind this step for three days.
  const entries = retainedEntries(['/_next/static/css/app.css']);
  const server = await startServer(serveLedger(entries, 2));
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl, {
    ...PAST_RAMP,
    RETAINED_CHECK: 'reachability',
  });
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 0, output);
  assert.match(output, /MISSING   0/);
  // It must not silently answer the OTHER question while it is at it.
  assert.doesNotMatch(output, /covers only/);
});

test('RETAINED_CHECK=window still fails on the same data — the split did not weaken it', async (t) => {
  // The counterweight to the case above. If splitting made the window assertion
  // unreachable, the test above would pass for the wrong reason and the #751
  // assertion would be gone — which is the failure it exists to catch.
  const entries = retainedEntries(['/_next/static/css/app.css']);
  const server = await startServer(serveLedger(entries, 2));
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl, {
    ...PAST_RAMP,
    RETAINED_CHECK: 'window',
  });
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 1, output);
  assert.match(output, /covers only 2\.0 day\(s\)/);
});

test('RETAINED_CHECK=reachability still fails on a genuinely missing asset', async (t) => {
  // Splitting must not cost the unstyled-production detector its teeth.
  const missing = '/_next/static/css/removed.css';
  const entries = retainedEntries([missing]);
  const server = await startServer((request, response) => {
    if (isLedger(request.url, 'ASSET_MANIFEST.txt')) {
      response.end(entries.join('\n'));
      return;
    }
    if (isLedger(request.url, 'ASSET_AGES.txt')) {
      response.end(agesFor(entries, 20));
      return;
    }
    if ((request.url ?? '').split('?')[0] === missing) {
      response.writeHead(404).end();
      return;
    }
    response.end('x');
  });
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl, {
    RETAINED_CHECK: 'reachability',
  });
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 1, output);
  assert.match(output, /removed\.css/);
});

test('an unknown RETAINED_CHECK refuses rather than silently checking something', async (t) => {
  const entries = retainedEntries(['/_next/static/css/app.css']);
  const server = await startServer(serveLedger(entries, 20));
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl, { RETAINED_CHECK: 'bogus' });
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 2, output);
  assert.match(output, /must be 'both', 'reachability' or 'window'/);
});

test('passes when the window is at full width — the harness can reach success', async (t) => {
  // Without this the test above passes just as well against a probe that fails on
  // everything, which is the vacuous shape this repo keeps getting bitten by.
  const entries = retainedEntries(['/_next/static/css/app.css']);
  const server = await startServer(serveLedger(entries, 20));
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl, PAST_RAMP);
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 0, output);
  assert.match(output, /full width/);
});

test('stays quiet during the ramp, when a narrow window is correct', async (t) => {
  const entries = retainedEntries(['/_next/static/css/app.css']);
  const server = await startServer(serveLedger(entries, 2));
  t.after(() => server.close());

  // Same 2-day ledger as the failing case; only the retime date differs.
  const result = await runProbe(server.baseUrl, {
    RETENTION_RETIMED_AT: new Date().toISOString(),
    RETAIN_DAYS: '14',
  });
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 0, output);
  assert.match(output, /still ramping/);
});

test('fails when the age ledger is missing entirely', async (t) => {
  const entries = retainedEntries(['/_next/static/css/app.css']);
  const server = await startServer((request, response) => {
    if (isLedger(request.url, 'ASSET_MANIFEST.txt')) {
      response.end(entries.join('\n'));
      return;
    }
    if (isLedger(request.url, 'ASSET_AGES.txt')) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200).end();
  });
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl, PAST_RAMP);
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 1, output);
  assert.match(output, /age ledger/i);
});
