/**
 * Retention chaining across a deploy burst (#548).
 *
 * check-stale-html.mjs proves a browser renders correctly WHEN assets are
 * chained. It models the deploy itself, so it cannot prove the deploy actually
 * does the chaining — with the old ordering it would still have passed, because
 * the harness did the copying.
 *
 * This is the other half: drive the real `retain-previous-assets.mjs` against a
 * real HTTP server twice, and assert an asset introduced by generation A is
 * still published by generation C. That is exactly the property whose absence
 * rendered production with no CSS.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { createServer } = require('node:http');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

// MUST be async. The stub server lives in this process, so a synchronous
// execFileSync would block the event loop and the server could never answer —
// the script then reported "cannot read ... retention is a NO-OP", which is a
// true message about a harness bug rather than about the code under test.
const run = promisify(execFile);

const REPO = path.resolve(__dirname, '../..');
const WORK = path.join(__dirname, '.retain-work');

/** A generation: `n` CSS files with generation-specific names, plus a shared chunk. */
function makeGeneration(dir, tag) {
  const css = path.join(dir, '_next/static/css');
  fs.mkdirSync(css, { recursive: true });
  fs.writeFileSync(
    path.join(css, `${tag}.css`),
    `/* ${tag} */ body{color:red}`
  );
  fs.mkdirSync(path.join(dir, '_next/static/chunks'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '_next/static/chunks', `${tag}.js`),
    `console.log('${tag}')`
  );
  // The HTML crawl fallback needs something to read if there is no manifest.
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    `<link rel="stylesheet" href="/_next/static/css/${tag}.css"/>` +
      `<script src="/_next/static/chunks/${tag}.js"></script>`
  );
  return dir;
}

/**
 * Run the real script: retain from `liveDir` (served over HTTP) into `outDir`.
 *
 * `days` is the retention window (#751). It used to be a generation count; the
 * default is deliberately wide so the chaining tests below exercise chaining rather
 * than expiry, which is what they are about.
 */
async function retain(outDir, liveDir, days = 14) {
  const server = createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const file = path.join(liveDir, rel === '/' ? 'index.html' : rel);
    // READ BEFORE writeHead. Writing the 200 first and letting readFileSync
    // throw sends headers, then the catch calls writeHead again —
    // ERR_HTTP_HEADERS_SENT kills the server on the FIRST 404, and every later
    // fetch hangs forever because nothing is listening. The script then printed
    // "cannot read <base> — retention is a NO-OP", a message that is true about
    // the harness and reads as a verdict on the code under test.
    let body;
    try {
      body = fs.readFileSync(file);
    } catch {
      res.writeHead(404);
      res.end('nope');
      return;
    }
    res.writeHead(200);
    res.end(body);
  });
  // Port 0 = whatever is free. A fixed port made every test after the first fail
  // with EADDRINUSE, because the close below deliberately does not wait.
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    const { stdout } = await run(
      process.execPath,
      [
        path.join(REPO, 'scripts/retain-previous-assets.mjs'),
        outDir,
        `http://127.0.0.1:${port}`,
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, RETAIN_DAYS: String(days) },
      }
    );
    return stdout;
  } finally {
    // `server.close()` alone WAITS for keep-alive sockets to drain, and the
    // child's fetch leaves one open — awaiting it hung the whole suite with no
    // output. Drop the connections first, and do not await the close.
    server.closeAllConnections?.();
    server.close();
  }
}

const manifestOf = (dir) =>
  fs
    .readFileSync(path.join(dir, '_next/static/ASSET_MANIFEST.txt'), 'utf8')
    .split('\n')
    .filter(Boolean);

/** Path -> generation count. The generation number is now a diagnostic (#751). */
const agesOf = (dir) =>
  new Map(
    fs
      .readFileSync(path.join(dir, '_next/static/ASSET_AGES.txt'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const m = l.match(/^(\d+)\s+(\S+T\S+Z)\s+(.+)$/);
        return [m[3], Number(m[1])];
      })
  );

/** Path -> first-seen epoch ms. This is what retention actually decides on. */
const bornOf = (dir) =>
  new Map(
    fs
      .readFileSync(path.join(dir, '_next/static/ASSET_AGES.txt'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const m = l.match(/^(\d+)\s+(\S+T\S+Z)\s+(.+)$/);
        return [m[3], Date.parse(m[2])];
      })
  );

/**
 * Rewrite one entry's first-seen timestamp in a built directory's ledger.
 *
 * Retention is now measured in days, and a test cannot wait days. Backdating the
 * ledger is the only thing being simulated — the script reads it exactly as it would
 * read a genuinely old one.
 */
function backdate(dir, rel, days) {
  const p = path.join(dir, '_next/static/ASSET_AGES.txt');
  const when = new Date(Date.now() - days * 86400000).toISOString();
  const out = fs
    .readFileSync(p, 'utf8')
    .split('\n')
    .map((l) => {
      const m = l.match(/^(\d+)\s+(\S+T\S+Z)\s+(.+)$/);
      return m && m[3] === rel ? `${m[1]} ${when} ${m[3]}` : l;
    })
    .join('\n');
  assert.ok(
    out.includes(when),
    `backdate() failed to match ${rel} in the ledger`
  );
  fs.writeFileSync(p, out);
}

describe('retain-previous-assets: chaining across a burst (#548)', () => {
  before(() => {
    fs.rmSync(WORK, { recursive: true, force: true });
  });
  after(() => {
    fs.rmSync(WORK, { recursive: true, force: true });
  });

  it('publishes a manifest that includes what it retained, not just its own output', async () => {
    // This is the ordering fix stated as an assertion. With the manifest written
    // BEFORE the retain step it listed only generation B's own files, and B's
    // successor could never learn that A's CSS existed.
    const a = makeGeneration(path.join(WORK, 'a'), 'gen-a');
    const b = makeGeneration(path.join(WORK, 'b'), 'gen-b');

    await retain(b, a);

    const m = manifestOf(b);
    assert.ok(
      m.includes('_next/static/css/gen-a.css'),
      `B's manifest must list the asset it retained from A.\ngot:\n  ${m.join('\n  ')}`
    );
    assert.ok(
      m.includes('_next/static/css/gen-b.css'),
      "B's manifest must list its own CSS"
    );
  });

  it("carries generation A's asset through TWO deploys — the #548 case", async () => {
    // A -> B -> C. Under the old one-generation behaviour gen-a.css is absent
    // from C, and a visitor still holding A's HTML gets no CSS. That visitor is
    // the production screenshot.
    const a = makeGeneration(path.join(WORK, 'a2'), 'gen-a');
    const b = makeGeneration(path.join(WORK, 'b2'), 'gen-b');
    const c = makeGeneration(path.join(WORK, 'c2'), 'gen-c');

    await retain(b, a); // deploy 1
    await retain(c, b); // deploy 2 — reads B's manifest, which now names A's file

    assert.ok(
      fs.existsSync(path.join(c, '_next/static/css/gen-a.css')),
      "generation C must still publish A's stylesheet after two deploys (#548)"
    );
    assert.ok(manifestOf(c).includes('_next/static/css/gen-a.css'));
  });

  it('ages a retained asset by one generation per deploy', async () => {
    const a = makeGeneration(path.join(WORK, 'a3'), 'gen-a');
    const b = makeGeneration(path.join(WORK, 'b3'), 'gen-b');
    const c = makeGeneration(path.join(WORK, 'c3'), 'gen-c');

    await retain(b, a);
    assert.strictEqual(agesOf(b).get('_next/static/css/gen-a.css'), 1);
    assert.strictEqual(
      agesOf(b).get('_next/static/css/gen-b.css'),
      0,
      "B's own files are age 0"
    );

    await retain(c, b);
    assert.strictEqual(
      agesOf(c).get('_next/static/css/gen-a.css'),
      2,
      'A is two deploys old in C'
    );
    assert.strictEqual(agesOf(c).get('_next/static/css/gen-b.css'), 1);
  });

  it('ramps cleanly from a live build that has a manifest but no age table', async () => {
    // THE ACTUAL PRODUCTION TRANSITION, measured on prod before this shipped:
    //
    //   GET /_next/static/ASSET_MANIFEST.txt -> 200 (107 lines, written by the
    //                                          old pre-retention step)
    //   GET /_next/static/ASSET_AGES.txt     -> 404 (this change introduces it)
    //
    // The other tests start from a live build with NEITHER file, so none of them
    // covers the one state the next deploy is guaranteed to hit. A retained file
    // must simply start at age 1 here rather than throwing or being skipped.
    const a = makeGeneration(path.join(WORK, 'a5'), 'gen-a');
    const b = makeGeneration(path.join(WORK, 'b5'), 'gen-b');

    // An old-style manifest: this build's own files only, and no age table.
    fs.writeFileSync(
      path.join(a, '_next/static/ASSET_MANIFEST.txt'),
      ['_next/static/css/gen-a.css', '_next/static/chunks/gen-a.js'].join(
        '\n'
      ) + '\n'
    );
    assert.ok(!fs.existsSync(path.join(a, '_next/static/ASSET_AGES.txt')));

    await retain(b, a);

    assert.ok(
      fs.existsSync(path.join(b, '_next/static/css/gen-a.css')),
      'a live build with no age table must still have its assets retained'
    );
    assert.strictEqual(
      agesOf(b).get('_next/static/css/gen-a.css'),
      1,
      'with no age table to read from, a retained file starts at age 1'
    );
  });

  it('still publishes a manifest when the live site is unreachable', async () => {
    // THE REGRESSION THIS FIX NEARLY INTRODUCED.
    //
    // Writing the manifest used to be its own workflow step that always ran.
    // Folding it into this script — so it could describe what was retained —
    // put it behind four `process.exit(1)`s. Because the workflow step is
    // `continue-on-error`, a transient network problem would then ship a build
    // with NO manifest and still succeed, and the NEXT deploy would fall back to
    // crawling HTML: 33 of 106 static files. One bad moment, two degraded
    // deploys, and nothing red anywhere.
    //
    // The build's own output is knowable regardless of the network, so failing
    // to retain must never mean failing to publish.
    const b = makeGeneration(path.join(WORK, 'b6'), 'gen-b');

    // Port 1 is reserved and nothing listens there: the live site is unreachable.
    let exitCode = 0;
    try {
      await run(
        process.execPath,
        [
          path.join(REPO, 'scripts/retain-previous-assets.mjs'),
          b,
          'http://127.0.0.1:1',
        ],
        { encoding: 'utf8' }
      );
    } catch (err) {
      exitCode = err.code;
    }

    assert.notStrictEqual(
      exitCode,
      0,
      'an unreachable live site must exit non-zero'
    );
    assert.ok(
      fs.existsSync(path.join(b, '_next/static/ASSET_MANIFEST.txt')),
      'the manifest must be published even when retention could not run'
    );
    const m = manifestOf(b);
    assert.ok(
      m.includes('_next/static/css/gen-b.css'),
      `the manifest must still list this build's own files.\ngot:\n  ${m.join('\n  ')}`
    );
    assert.strictEqual(
      agesOf(b).get('_next/static/css/gen-b.css'),
      0,
      "this build's own files are age 0 even on the failure path"
    );
  });

  it('drops an asset once it is older than RETAIN_DAYS, so _next/static stays bounded', async () => {
    // The window is the only thing bounding chained retention. Without it every
    // deploy would accumulate forever, which is the obvious failure mode of the
    // fix and therefore worth a test of its own.
    const dirs = ['a4', 'b4', 'c4'].map((n, i) =>
      makeGeneration(path.join(WORK, n), `gen-${'abc'[i]}`)
    );
    await retain(dirs[1], dirs[0], 14);
    assert.ok(fs.existsSync(path.join(dirs[1], '_next/static/css/gen-a.css')));

    // Age A's stylesheet past the window in B's published ledger, exactly as real
    // elapsed time would. B's own file stays new.
    backdate(dirs[1], '_next/static/css/gen-a.css', 40);

    await retain(dirs[2], dirs[1], 14);
    assert.ok(
      !fs.existsSync(path.join(dirs[2], '_next/static/css/gen-a.css')),
      'an asset older than RETAIN_DAYS must not be carried forward'
    );
    assert.ok(
      fs.existsSync(path.join(dirs[2], '_next/static/css/gen-b.css')),
      'an asset still inside the window must survive'
    );
  });

  it('keeps an asset across MANY deploys while it is still inside the window', async () => {
    // The whole point of #751: deploy COUNT must not decide expiry. Under the old
    // generation cap this asset died on deploy 6; here it survives ten because it
    // is only a day old.
    const dirs = Array.from({ length: 11 }, (_, i) =>
      makeGeneration(path.join(WORK, `burst${i}`), `burst-${i}`)
    );
    for (let i = 1; i < dirs.length; i++)
      await retain(dirs[i], dirs[i - 1], 14);

    const last = dirs[dirs.length - 1];
    assert.ok(
      fs.existsSync(path.join(last, '_next/static/css/burst-0.css')),
      'a one-day-old asset must survive ten deploys — expiring it on a deploy ' +
        'count is exactly the #751 defect'
    );
    assert.strictEqual(
      agesOf(last).get('_next/static/css/burst-0.css'),
      10,
      'the generation counter should still be counting, as a diagnostic'
    );
  });

  it('carries the ORIGINAL first-seen date forward, never restamping it', async () => {
    // If a retained asset were redated on each deploy its age would reset every
    // time and the window would never expire anything — retention would grow
    // without bound while looking healthy.
    const dirs = ['a6', 'b6', 'c6'].map((n, i) =>
      makeGeneration(path.join(WORK, n), `gen-${'abc'[i]}`)
    );
    await retain(dirs[1], dirs[0], 14);
    backdate(dirs[1], '_next/static/css/gen-a.css', 10);
    const before = bornOf(dirs[1]).get('_next/static/css/gen-a.css');

    await retain(dirs[2], dirs[1], 14);
    const after = bornOf(dirs[2]).get('_next/static/css/gen-a.css');
    assert.strictEqual(
      after,
      before,
      'the first-seen timestamp must survive a deploy unchanged'
    );
  });

  it('reads the pre-#751 two-field ledger and stamps those entries now', async () => {
    // The live ledger on the deploy that ships this has no timestamps. Refusing to
    // parse it would reset retention to zero on the very deploy meant to fix it.
    const dirs = ['a7', 'b7'].map((n, i) =>
      makeGeneration(path.join(WORK, n), `gen-${'ab'[i]}`)
    );
    fs.writeFileSync(
      path.join(dirs[0], '_next/static/ASSET_AGES.txt'),
      '3 _next/static/css/gen-a.css\n'
    );

    const out = await retain(dirs[1], dirs[0], 14);
    assert.match(out, /without a timestamp/, 'the ramp should announce itself');
    assert.ok(
      fs.existsSync(path.join(dirs[1], '_next/static/css/gen-a.css')),
      'an undated legacy entry must be carried, not dropped'
    );
    const born = bornOf(dirs[1]).get('_next/static/css/gen-a.css');
    assert.ok(
      Date.now() - born < 5 * 60_000,
      'a legacy entry should be stamped now, giving it a full window'
    );
  });
});

/**
 * THE WINDOW IS A DURATION, AND MUST BE EXPRESSED AS ONE (#650, #751).
 *
 * This was `RETAIN_GENERATIONS` and it was mis-sized twice, both times by stating
 * the window in deploys while the risk is in days:
 *
 *   5  — sized against "deploys per 10 minutes", the HTML cache-control window.
 *        #650 identified that as the wrong quantity when production went unstyled a
 *        sixth time on 2026-08-09.
 *   30 — its replacement, justified as "a normal working week even at an unusually
 *        high merge rate". 40 deploys landed in the next 6 days, 19 in one day, so
 *        it was really ~3.5 days. Production went unstyled an eighth time.
 *
 * The unit is the fix. A day is a day no matter how often anyone merges, so these
 * assertions pin the UNIT as much as the number — a value in generations cannot
 * satisfy them at all.
 */
describe('RETAIN_DAYS is sized for a returning visitor', () => {
  const deployYml = fs.readFileSync(
    path.join(__dirname, '..', '..', '.github', 'workflows', 'deploy.yml'),
    'utf8'
  );

  it('is set in deploy.yml at all', () => {
    assert.match(
      deployYml,
      /RETAIN_DAYS:\s*'?\d+'?/,
      'deploy.yml no longer sets RETAIN_DAYS — retention would fall back to the ' +
        'script default and nothing would say so'
    );
  });

  it('covers a fortnight, so a holiday-length absence is inside the window', () => {
    const m = deployYml.match(/RETAIN_DAYS:\s*'?(\d+)'?/);
    const n = Number(m[1]);
    assert.ok(
      n >= 14,
      `RETAIN_DAYS is ${n}. Below 14 a visitor returning from a week or two away ` +
        `loses their stylesheets — that is #635, reported from production eight ` +
        `times. Raise it back, or make the case in the issue first.`
    );
  });

  it('has not reverted to counting deploys', () => {
    assert.ok(
      !/RETAIN_GENERATIONS:/.test(deployYml),
      'deploy.yml sets RETAIN_GENERATIONS again. That unit is the #751 defect: it ' +
        'converts to a duration only via a merge rate nobody measures. Express the ' +
        'window in days.'
    );
  });
});
