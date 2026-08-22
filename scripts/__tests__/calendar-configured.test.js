/**
 * The calendar smoke comparator must be able to report failure.
 *
 * A check that has only ever run against a correctly-configured production prints
 * "configured" and tells you nothing — you have observed that it does not crash, not that
 * it can see. `evaluate()` is pure so every branch is driven here with no network.
 *
 * The case that matters most is EQUALITY vs PRESENCE. Grepping for any `calendly.com` URL
 * would pass on a stale literal, on a URL left behind by a previous owner, and on a fork
 * that never changed the default — all green, all booking calls into somebody else's
 * calendar. `books at a different URL` below is the test that forbids that.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const MODULE = path.resolve(
  __dirname,
  '..',
  'ci',
  'check-calendar-configured.mjs'
);
const load = () => import(`file://${MODULE}`);

const WANT = 'https://calendly.com/us/30min';

/** A healthy observation — the fixture every case below mutates one field of. */
const healthy = () => ({
  pages: [
    { path: '/checkout/?sku=svc-site', ok: true, chunks: 18 },
    { path: '/schedule/', ok: true, chunks: 15 },
  ],
  chunksScanned: 18,
  found: true,
  otherBookingUrls: [WANT],
});

describe('calendar configuration comparator', () => {
  it('reports nothing when the intended URL is in the bundle', async () => {
    // The control proving it can PASS. Without it every assertion below is satisfied by a
    // function that always returns problems.
    const { evaluate } = await load();
    assert.deepStrictEqual(evaluate(healthy(), WANT), []);
  });

  it('fails when the bundle books at a DIFFERENT url, and names it', async () => {
    // Equality, not presence. This observation would satisfy any "is there a calendly URL"
    // check — there is one, it is just not ours.
    const { evaluate } = await load();
    const obs = healthy();
    obs.found = false;
    obs.otherBookingUrls = ['https://calendly.com/previous-owner/15min'];
    const problems = evaluate(obs, WANT).join('\n');
    assert.match(
      problems,
      /does not contain https:\/\/calendly\.com\/us\/30min/
    );
    assert.match(
      problems,
      /previous-owner/,
      'did not name the URL actually live'
    );
    assert.match(problems, /presence-only check would have called healthy/);
  });

  it('fails when no booking url is in the bundle at all, with a different message', async () => {
    // The unconfigured-build case. It must read differently from the wrong-URL case: one
    // means the page is empty, the other means it books the wrong person.
    const { evaluate } = await load();
    const obs = healthy();
    obs.found = false;
    obs.otherBookingUrls = [];
    const problems = evaluate(obs, WANT).join('\n');
    assert.match(problems, /No booking URL of any kind/);
    assert.doesNotMatch(problems, /presence-only/);
  });

  it('fails when the intended value itself is empty, before looking at anything', async () => {
    // THE DEGENERATE CASE THIS CHECK EXISTS FOR. An unset repo Variable makes `want` empty,
    // and an empty expectation would match an empty bundle — passing in exactly the
    // situation being guarded. It must also point at the right TAB: a value on Secrets
    // arrives as an empty string and deploys green.
    const { evaluate } = await load();
    const problems = evaluate(healthy(), '').join('\n');
    assert.match(problems, /vars\.NEXT_PUBLIC_CALENDAR_URL is empty/);
    assert.match(problems, /VARIABLES/);
    assert.match(problems, /the tab matters/);
  });

  it('an empty expectation is not rescued by a healthy-looking bundle', async () => {
    // Belt and braces on the same trap: even when `found` is true, an empty want is a
    // failure. Otherwise a leftover literal in the bundle would mask the unset Variable.
    const { evaluate } = await load();
    assert.ok(evaluate(healthy(), '').length > 0);
  });

  it('fails on too few chunks rather than declaring victory', async () => {
    // A 404, a redirect, or a markup change that breaks the chunk regex yields nothing to
    // search. "I looked at nothing and found no problem" must be red.
    const { evaluate, MIN_CHUNKS } = await load();
    const obs = healthy();
    obs.chunksScanned = MIN_CHUNKS - 1;
    obs.found = false;
    const problems = evaluate(obs, WANT).join('\n');
    assert.match(problems, /chunks scanned/);
    assert.match(problems, /would mean nothing/);
  });

  it('the chunk floor outranks a lucky hit', async () => {
    // If almost nothing was scanned, `found: true` is not evidence — it could come from a
    // single unrelated chunk while the calendar chunk was never fetched.
    const { evaluate, MIN_CHUNKS } = await load();
    const obs = healthy();
    obs.chunksScanned = MIN_CHUNKS - 1;
    obs.found = true;
    assert.ok(evaluate(obs, WANT).length > 0, 'a tiny scan reported success');
  });

  it('reports a page that could not be fetched', async () => {
    const { evaluate } = await load();
    const obs = healthy();
    obs.pages[1] = {
      path: '/schedule/',
      ok: false,
      error: 'HTTP 404',
      chunks: 0,
    };
    assert.match(
      evaluate(obs, WANT).join('\n'),
      /\/schedule\/ could not be fetched/
    );
  });

  it('walks more than one page, and has a real floor', async () => {
    // Anti-vacuity on the module's own constants. `/schedule` alone cannot work — its
    // embed is an ssr:false dynamic import, so the calendar chunk is absent from that
    // page's HTML and a single-page walk would find nothing on a healthy site.
    const { PAGES, MIN_CHUNKS } = await load();
    assert.ok(
      PAGES.length >= 2,
      'PAGES must include a page whose chunks are enumerable'
    );
    assert.ok(
      PAGES.some((p) => p.startsWith('/checkout')),
      'the /checkout walk is what actually reaches calendarConfig — see BookingStep.tsx:36'
    );
    assert.ok(MIN_CHUNKS > 0, 'the anti-vacuity floor was removed');
  });
});
