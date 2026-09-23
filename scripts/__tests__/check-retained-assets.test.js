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

test('RETAINED_CHECK=window passes ON the tolerance boundary, and does not overstate it', async (t) => {
  // 13 days against RETAIN_DAYS=14. The pass condition is `spanDays + 1 >= RETAIN_DAYS`
  // (check-retained-assets.mjs:320) -- a deliberate day of slack, because the oldest asset
  // ages out mid-window and a healthy ledger oscillates just under the target. Nothing
  // tested that boundary, and nothing tested what the success line CLAIMS at it.
  //
  // It used to claim the target: "the ledger spans at least 14 day(s)" while spanDays was
  // 13.0. That sentence is exactly what would persuade a reader the retention window had
  // recovered when it is a day short and still resting on pre-fix history -- the misreading
  // #1061 exists to prevent, printed by the check itself.
  const entries = retainedEntries(['/_next/static/css/app.css']);
  const server = await startServer(serveLedger(entries, 13));
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl, {
    ...PAST_RAMP,
    RETAINED_CHECK: 'window',
  });
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 0, output);
  assert.match(output, /full width/);
  assert.doesNotMatch(
    output,
    /spans at least 14 day\(s\)/,
    'the success line claims the target was met when only target - 1 was verified'
  );
  assert.match(output, /spans at least 13 day\(s\)/);
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

/**
 * A 503 IS NOT A DELETION (#1239).
 *
 * `Production Smoke` run 35803250426 failed with
 * `503 _next/static/chunks/3065.1400581724a7477a.js` under the headline
 * "1 retained asset(s) are gone". The asset was not gone — it served 200 at 22,582
 * bytes with `cf-cache-status: HIT` minutes later, and the runs either side passed.
 *
 * The danger is not the false red. It is the CSS branch: had that 503 landed on a
 * stylesheet, the gate would have announced "anyone holding HTML that references them
 * is seeing an unstyled page right now" — the #548/#635 production incident, in the
 * words that make people act on it at one in the morning.
 *
 * `NO_RETRY` keeps these fast. The retry exists for real edge weather, not for a
 * fixture that has already decided what it will answer.
 */
const NO_RETRY = {
  RETAINED_RETRY_DELAY_MS: '0',
  RETAINED_CHECK: 'reachability',
};

/** Serve the ledgers, and hand every asset request to `assetHandler`. */
const serveAssets = (entries, assetHandler) => (request, response) => {
  if (isLedger(request.url, 'ASSET_MANIFEST.txt')) {
    response.end(entries.join('\n'));
    return;
  }
  if (isLedger(request.url, 'ASSET_AGES.txt')) {
    response.end(agesFor(entries, 20));
    return;
  }
  assetHandler(request, response);
};

test('a persistent 503 fails, but is NOT reported as gone or as an unstyled page', async (t) => {
  const flaky = '/_next/static/css/app.css';
  const entries = retainedEntries([flaky]);
  const server = await startServer(
    serveAssets(entries, (request, response) => {
      if (request.url.split('?')[0] === flaky) {
        response.writeHead(503).end();
        return;
      }
      response.writeHead(200).end();
    })
  );
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl, NO_RETRY);
  const output = result.stdout + result.stderr;

  // Still a failure: production serving 503 for a retained asset is a real problem.
  assert.equal(result.code, 1, output);
  assert.match(output, /app\.css/);
  // But NOT these two claims, both of which would be false.
  assert.doesNotMatch(output, /are gone/i);
  assert.doesNotMatch(output, /unstyled page right now/i);
});

test('a 503 that recovers on retry passes — edge weather is not a deleted file', async (t) => {
  const flaky = '/_next/static/chunks/flaky.js';
  const entries = retainedEntries([flaky]);
  let attempts = 0;
  const server = await startServer(
    serveAssets(entries, (request, response) => {
      if (request.url.split('?')[0] === flaky) {
        attempts += 1;
        // 503 for the FIRST TWO requests, because `status()` already tries HEAD and
        // then a ranged GET. Failing only the first would be satisfied by that
        // existing fallback and would pass with no retry implemented at all — which
        // is exactly how this test was wrong when first written.
        response.writeHead(attempts <= 2 ? 503 : 200).end();
        return;
      }
      response.writeHead(200).end();
    })
  );
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl, {
    RETAINED_RETRY_DELAY_MS: '0',
    RETAINED_CHECK: 'reachability',
  });
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 0, output);
  assert.match(output, /MISSING   0/);
  assert.ok(
    attempts >= 3,
    `expected a retry beyond the HEAD/GET fallback, saw ${attempts} attempt(s)`
  );
});

test('CONTROL: a real 404 on a stylesheet still says gone AND still says unstyled', async (t) => {
  // The floor. Every assertion above is about NOT crying wolf, and the cheapest way
  // to satisfy those is a check that never fires. This is the case that must stay loud.
  const removed = '/_next/static/css/deleted.css';
  const entries = retainedEntries([removed]);
  const server = await startServer(
    serveAssets(entries, (request, response) => {
      if (request.url.split('?')[0] === removed) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200).end();
    })
  );
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl, NO_RETRY);
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 1, output);
  assert.match(output, /deleted\.css/);
  assert.match(output, /are gone/i);
  assert.match(output, /unstyled page right now/i);
});

test('a 404 and a 503 in one run are counted and described separately', async (t) => {
  const removed = '/_next/static/chunks/removed.js';
  const wobbling = '/_next/static/chunks/wobbling.js';
  const entries = retainedEntries([removed, wobbling]);
  const server = await startServer(
    serveAssets(entries, (request, response) => {
      const path = request.url.split('?')[0];
      if (path === removed) {
        response.writeHead(404).end();
        return;
      }
      if (path === wobbling) {
        response.writeHead(503).end();
        return;
      }
      response.writeHead(200).end();
    })
  );
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl, NO_RETRY);
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 1, output);
  // One of each, not two of the same — the distinction this change exists to make.
  assert.match(output, /GONE +1/);
  assert.match(output, /UNAVAILABLE +1/);
  assert.match(output, /removed\.js/);
  assert.match(output, /wobbling\.js/);
});

test('the unstyled claim counts only DELETED stylesheets, not unavailable ones', async (t) => {
  // Found by mutation: `goneCss` computed from `missing` instead of `gone` survived
  // every test above, because it is only read inside `if (gone.length)`. It becomes
  // visible the moment one run has both — the sentence then inflates a real incident
  // with a file that is still published.
  const deleted = '/_next/static/css/deleted.css';
  const wobbling = '/_next/static/css/wobbling.css';
  const entries = retainedEntries([deleted, wobbling]);
  const server = await startServer(
    serveAssets(entries, (request, response) => {
      const path = request.url.split('?')[0];
      if (path === deleted) {
        response.writeHead(404).end();
        return;
      }
      if (path === wobbling) {
        response.writeHead(503).end();
        return;
      }
      response.writeHead(200).end();
    })
  );
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl, NO_RETRY);
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 1, output);
  assert.match(output, /1 of them STYLESHEETS/);
  assert.doesNotMatch(output, /2 of them STYLESHEETS/);
});

test('a 404 is not retried — only the edge gets a second chance', async (t) => {
  // Found by mutation: dropping the `!== 'unavailable'` early return changed no
  // verdict, so nothing failed. It triples the wall-clock of a real deletion across
  // a 300-entry manifest, which is when this check is most urgently being read.
  const removed = '/_next/static/chunks/removed.js';
  const entries = retainedEntries([removed]);
  let requests = 0;
  const server = await startServer(
    serveAssets(entries, (request, response) => {
      if (request.url.split('?')[0] === removed) {
        requests += 1;
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200).end();
    })
  );
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl, NO_RETRY);

  assert.equal(result.code, 1, result.stdout + result.stderr);
  // One attempt is HEAD then a ranged GET. A retry would make it four or six.
  assert.ok(
    requests <= 2,
    `a 404 should settle in one attempt (HEAD + GET); saw ${requests} requests`
  );
});
