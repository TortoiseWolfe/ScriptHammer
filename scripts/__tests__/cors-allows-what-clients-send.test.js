/**
 * Every header the browser sends to an Edge Function must be in that function's CORS allow-list.
 *
 * WHY THIS EXISTS. `idempotency-key` was missing from `_shared/cors.ts` while `create-order`
 * documented it in its own contract (create-order/index.ts:8), read it, and enforced replay
 * protection on it — and both callers sent it. So `/checkout` could not complete a purchase from
 * a browser at all. The first real attempt after go-live died on "Failed to fetch".
 *
 * WHY NOTHING CAUGHT IT. curl does not enforce CORS. The preflight returns 204 with
 * correct-looking headers and the POST succeeds when you send it yourself, so every server-side
 * probe — including several run by hand during the go-live review — reported a healthy endpoint.
 * Only a browser refuses, and it refuses BEFORE sending the request, so there is no status, no
 * response body, and nothing in the function logs. The failure is invisible from both ends.
 *
 * This test is the client's side of that contract: it reads the headers the app actually sends
 * and checks them against the list the functions actually allow. It is a source scan rather than
 * a runtime check because the runtime check is the thing that cannot see the problem.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join, resolve } = require('node:path');

const REPO = resolve(__dirname, '..', '..');
const CORS = join(REPO, 'supabase/functions/_shared/cors.ts');

/**
 * Headers a browser may always send without asking permission. These never need to appear in
 * Access-Control-Allow-Headers, so they are not failures when a client sends them.
 * https://fetch.spec.whatwg.org/#cors-safelisted-request-header
 */
const CORS_SAFELISTED = new Set([
  'accept',
  'accept-language',
  'content-language',
  'content-type',
  'range',
]);

function allowedHeaders() {
  const src = readFileSync(CORS, 'utf8');
  const block = src.match(
    /export const ALLOWED_HEADER_LIST\s*=\s*\[([\s\S]*?)\]/
  );
  assert.ok(block, 'could not find ALLOWED_HEADER_LIST in _shared/cors.ts');
  return new Set(
    [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1].toLowerCase())
  );
}

/** Every .ts/.tsx under src/, excluding tests. */
function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Header keys inside a `headers: { … }` object literal, in files that also call an Edge Function.
 * Deliberately narrow: a false positive here fails a build for no reason, and the thing we are
 * guarding is specific — a header sent TO `/functions/v1/`.
 */
function headersSentToFunctions() {
  const found = new Map(); // header -> [file:line]
  for (const file of sourceFiles(join(REPO, 'src'))) {
    const raw = readFileSync(file, 'utf8');
    if (!raw.includes('functions/v1')) continue;
    // Blank out ${...} FIRST. `Bearer ${token}` contains a closing brace, which otherwise ends
    // the headers-object match early and hides every header after the first — which is exactly
    // how the first draft of this test passed while finding nothing.
    // Substitute a NON-LETTER: 'X' made `${a}:${b}` read as `X:X`, and `X:` then matched the
    // bare-key pattern. A digit cannot start a header name, so it cannot be mistaken for one.
    const src = raw.replace(/\$\{[^{}]*\}/g, '0');
    for (const m of src.matchAll(/headers:\s*\{([^}]*)\}/g)) {
      const body = m[1];
      const line = src.slice(0, m.index).split('\n').length;
      // Keys appear BOTH quoted ('Idempotency-Key') and bare (Authorization). Matching only
      // quoted ones was the other half of that same false pass.
      for (const h of body.matchAll(
        /(?:'([^']+)'|"([^"]+)"|\b([A-Za-z][A-Za-z0-9-]*))\s*:/g
      )) {
        const name = (h[1] || h[2] || h[3]).toLowerCase();
        if (CORS_SAFELISTED.has(name)) continue;
        const rel = file.slice(REPO.length + 1);
        if (!found.has(name)) found.set(name, []);
        found.get(name).push(`${rel}:${line}`);
      }
    }
  }
  return found;
}

test('the scan finds real client code, so the assertion below is not vacuous', () => {
  const sent = headersSentToFunctions();
  assert.ok(
    sent.size >= 2,
    `expected to find at least 2 custom headers sent to Edge Functions, found ${sent.size}: ${[...sent.keys()].join(', ')}`
  );
  assert.ok(
    sent.has('authorization'),
    'expected to find the Authorization header — if not, the scanner has stopped matching'
  );
});

test('the allow-list parses and is not empty', () => {
  const allowed = allowedHeaders();
  assert.ok(
    allowed.size >= 4,
    `allow-list looks wrong: ${[...allowed].join(', ')}`
  );
  assert.ok(allowed.has('authorization'));
});

test('every header the client sends is allowed by CORS', () => {
  const allowed = allowedHeaders();
  const sent = headersSentToFunctions();

  const missing = [...sent.entries()]
    .filter(([name]) => !allowed.has(name))
    .map(([name, where]) => `${name}  (sent from ${where.join(', ')})`);

  assert.deepEqual(
    missing,
    [],
    'These headers are sent to an Edge Function but are NOT in _shared/cors.ts ALLOWED_HEADER_LIST.\n' +
      'A browser will refuse the request before it is sent, and fetch() rejects with\n' +
      '"TypeError: Failed to fetch" — no status, no body, nothing in the function logs.\n' +
      'curl will NOT reproduce this; only a browser enforces CORS.\n'
  );
});

test('REGRESSION: idempotency-key specifically, because /checkout cannot take money without it', () => {
  // create-order documents it (create-order/index.ts), reads it, and enforces replay protection
  // on it; src/app/checkout/page.tsx and src/lib/offline-queue/payment-adapter.ts both send it.
  const allowed = allowedHeaders();
  assert.ok(
    allowed.has('idempotency-key'),
    'idempotency-key must stay in the CORS allow-list — without it every browser purchase fails at preflight'
  );
});
