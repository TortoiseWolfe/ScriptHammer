#!/usr/bin/env node
/**
 * Prove the deployed bundle books calls at the calendar we intend.
 *
 * WHY THIS EXISTS. `/schedule` is where the pricing page's "Book a call" link lands, and
 * the whole page is env-driven: `src/config/calendar.config.ts:21` reads
 * `process.env.NEXT_PUBLIC_CALENDAR_URL || ''`, and an empty value makes
 * `CalendarEmbed.tsx:78` render "Calendar URL not configured" where a booking widget
 * should be. Clear that repo Variable and the deploy still goes green, the link still
 * works, and only the destination degrades.
 *
 * `smoke.yml` already carries two checks of exactly this shape — the deployed bundle must
 * point at the intended Supabase project, and must carry the intended Stripe key mode. Both
 * exist because production once shipped a wrong `NEXT_PUBLIC_*` behind entirely green
 * checks (smoke.yml:142-151 records the 2026-08-07 incident: the deploy read `vars.*` while
 * the operator was setting `gh secret set` — same names, two stores, and secrets are
 * write-only so the divergence was invisible). The calendar had no equivalent.
 *
 * EQUALITY, NOT PRESENCE. It would be easier to grep for any `calendly.com` URL, and that
 * would be a smoke signal rather than an assertion: it passes on a stale literal, on a URL
 * left behind by a previous owner, and on a fork that never changed the default — all
 * green, all pointing at somebody else's booking page. The configured value must be the one
 * that reached the bundle.
 *
 * WHICH PAGES IT WALKS, AND WHY BOTH. `/schedule` loads `CalendarEmbed` through
 * `next/dynamic` with `ssr: false` (src/app/schedule/page.tsx:6-16), so its calendar chunk
 * is NOT referenced in that page's HTML — a check that walked only `/schedule` would find
 * nothing on a perfectly healthy site and had to be either red always or vacuous always.
 * `/checkout` reaches the same `calendarConfig` through `BookingStep.tsx:36` and its chunk
 * IS enumerable. Both are walked so the check survives either page changing shape.
 *
 * Reporting only. It never writes anything.
 *
 * USAGE
 *   SITE=https://scripthammer.com WANT=https://calendly.com/you/30min \
 *     node scripts/ci/check-calendar-configured.mjs
 */

/** Pages whose chunk graph is expected to contain the calendar config. */
export const PAGES = ['/checkout/?sku=svc-site', '/schedule/'];

/**
 * Minimum chunks the walk must see before any verdict is trusted.
 *
 * A 404, a redirect, or a markup change that breaks the chunk regex yields zero chunks —
 * and "I looked at nothing and found no problem" must be a failure, not a pass. This is the
 * assertion the check exists to make about itself.
 */
export const MIN_CHUNKS = 5;

const CHUNK_RE = /\/_next\/static\/[A-Za-z0-9._/-]+\.js/g;
/**
 * Any third-party BOOKING page, used only to make a mismatch legible.
 *
 * Deliberately excludes `.js` and the Cal.com embed loader: the live bundle legitimately
 * contains `https://app.cal.com/embed/embed.js`, and reporting "it books at embed.js
 * instead" on a mismatch would send the reader after the wrong thing.
 */
const BOOKING_RE =
  /https:\/\/(?:calendly\.com|(?:app\.)?cal\.com)\/(?!embed\/)[A-Za-z0-9._/-]+/g;
const isBookingPage = (u) => !u.endsWith('.js');

async function text(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Walk the pages, fetch every chunk once, and look for `want` verbatim. */
export async function observe(site, want) {
  const pages = [];
  const chunks = new Set();

  for (const path of PAGES) {
    try {
      const html = await text(`${site}${path}`);
      const found = html.match(CHUNK_RE) ?? [];
      found.forEach((c) => chunks.add(c));
      pages.push({ path, ok: true, chunks: found.length });
    } catch (err) {
      pages.push({ path, ok: false, error: err.message, chunks: 0 });
    }
  }

  let found = false;
  const others = new Set();
  for (const chunk of chunks) {
    let body;
    try {
      body = await text(`${site}${chunk}`);
    } catch {
      continue;
    }
    if (want && body.includes(want)) found = true;
    for (const u of body.match(BOOKING_RE) ?? [])
      if (isBookingPage(u)) others.add(u);
  }

  return {
    pages,
    chunksScanned: chunks.size,
    found,
    otherBookingUrls: [...others].sort(),
  };
}

/**
 * Compare an observation against the intended URL. Pure — no network — so a test can drive
 * every branch, which is the only way to know this can report failure at all.
 *
 * Returns human-readable problems. Empty means configured correctly.
 */
export function evaluate(observed, want) {
  const problems = [];

  // FIRST, AND THE REASON THE WHOLE CHECK IS NOT A NO-OP. If the repo Variable is unset,
  // `want` is empty here — and an empty expectation would match an empty bundle, so the
  // check would pass in exactly the situation it exists to catch.
  if (!want) {
    problems.push(
      'vars.NEXT_PUBLIC_CALENDAR_URL is empty. /schedule renders "Calendar URL not ' +
        'configured" where the booking widget belongs, and the pricing page links there. ' +
        'Set it under Settings > Secrets and variables > Actions > VARIABLES — the tab ' +
        'matters, a value on the Secrets tab arrives as an empty string and deploys green.'
    );
    return problems;
  }

  for (const p of observed.pages ?? []) {
    if (!p.ok) problems.push(`${p.path} could not be fetched: ${p.error}`);
  }

  if ((observed.chunksScanned ?? 0) < MIN_CHUNKS) {
    problems.push(
      `only ${observed.chunksScanned ?? 0} chunks scanned (floor ${MIN_CHUNKS}) — the walk ` +
        'found almost nothing, so a "configured" verdict would mean nothing. Either the ' +
        'pages moved or the chunk pattern stopped matching.'
    );
    return problems;
  }

  if (!observed.found) {
    const others = observed.otherBookingUrls ?? [];
    problems.push(
      `the deployed bundle does not contain ${want}.` +
        (others.length
          ? ` It books at ${others.join(', ')} instead — a stale or foreign booking URL is ` +
            'live, which a presence-only check would have called healthy.'
          : ' No booking URL of any kind is in the bundle, so /schedule shows the ' +
            '"not configured" alert to anyone following the pricing CTA.')
    );
  }

  return problems;
}

async function main() {
  const site = process.env.SITE;
  const want = process.env.WANT ?? '';
  if (!site) {
    console.error('::error::[calendar] SITE is required');
    process.exit(1);
  }

  // The empty-WANT case is a verdict, not a reason to skip: report it without a network
  // round trip that cannot change the answer.
  if (!want) {
    for (const p of evaluate({}, want))
      console.error(`::error::[calendar] ${p}`);
    process.exit(1);
  }

  const observed = await observe(site, want);
  const problems = evaluate(observed, want);

  console.log('Calendar configuration in the deployed bundle');
  for (const p of observed.pages) {
    console.log(
      `  ${p.path} — ${p.ok ? `${p.chunks} chunks` : `FAILED: ${p.error}`}`
    );
  }
  console.log(`  unique chunks scanned .. ${observed.chunksScanned}`);
  console.log(`  intended ............... ${want}`);
  console.log(`  found in bundle ........ ${observed.found}`);
  if (observed.otherBookingUrls.length) {
    console.log(
      `  booking URLs present ... ${observed.otherBookingUrls.join(', ')}`
    );
  }

  if (!problems.length) {
    console.log('  verdict ................ configured');
    return;
  }
  for (const p of problems) console.error(`::error::[calendar] ${p}`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`::error::[calendar] ${err.message}`);
    process.exit(1);
  });
}
