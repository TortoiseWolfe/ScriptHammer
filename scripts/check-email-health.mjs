#!/usr/bin/env node
// Email-health gate (#361).
//
// WHY THIS EXISTS
// For six weeks the E2E suite signed up a non-existent Gmail address against the
// cloud project on every push. Supabase sent a real confirmation through Resend
// each time, it hard-bounced ("Recipient not found"), and Resend suppressed it.
// By the time anyone looked, 121 of 154 sends had bounced — a 78.6% bounce rate.
// Every test was green throughout, because nothing in CI knew what a bounce was.
//
// ESPs warn above 2-5% and suspend accounts over sustained rates, so this was a
// live risk to the project's ability to send mail at all — including the sign-up
// confirmations real users depend on.
//
// This turns "someone eventually opens the Resend dashboard" into a check that
// runs on a schedule and fails loudly. It is the same shape as the auth-config
// drift gate (#350): ask the live provider what is actually true, compare it to
// what we require, and fail when they diverge.
//
// USAGE
//   RESEND_API_KEY=re_... node scripts/check-email-health.mjs
//   ... --window-days 7 --max-bounce-rate 5 --min-sample 10 --mode block|annotate
//
// EXIT CODES
//   0  healthy, or annotate mode, or too small a sample to judge
//   1  bounce rate over threshold in block mode
//   2  could not reach Resend / misconfigured

// Overridable ONLY so the gate itself can be tested: `email-health-gate-can-fail`
// points this at a local stub and asserts that block mode really does exit 1 on a
// bad bounce rate. Without a seam the only way to check that is to wait for a real
// bounce spike, which means the enforcing branch ships unobserved (#572).
const API = process.env.EMAIL_HEALTH_API || 'https://api.resend.com';

// Resend sits behind Cloudflare, which 403s unrecognised User-Agents. Node's
// fetch sends a sane one, but set it explicitly so this does not silently start
// failing if that changes — a 403 here would otherwise look like an auth problem
// and send someone hunting the wrong bug (it cost an hour when it happened).
const UA = 'scripthammer-email-health/1.0';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const WINDOW_DAYS = Number(arg('window-days', '7'));
const MAX_BOUNCE_RATE = Number(arg('max-bounce-rate', '5'));
// Below this many sends the rate is noise — one bounce out of three is 33% and
// means nothing. Pass rather than cry wolf.
const MIN_SAMPLE = Number(arg('min-sample', '10'));
const MODE = arg('mode', process.env.EMAIL_HEALTH_MODE || 'annotate');

const KEY = process.env.RESEND_API_KEY;
if (!KEY) {
  console.error(
    'check-email-health: RESEND_API_KEY is not set.\n' +
      '  Create one at https://resend.com/api-keys (Full access) and add it to\n' +
      '  the repo secrets, or export it locally.'
  );
  process.exit(2);
}

async function get(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${KEY}`, 'User-Agent': UA },
  });
  if (!res.ok) {
    throw new Error(`GET ${path} -> HTTP ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Page through /emails until we fall out of the window. */
async function recentEmails(sinceIso) {
  const out = [];
  let after = null;
  for (let page = 0; page < 50; page++) {
    const q = `/emails?limit=100${after ? `&after=${after}` : ''}`;
    const body = await get(q);
    const batch = body.data ?? [];
    if (batch.length === 0) break;
    out.push(...batch);
    // created_at is descending; stop once the page's oldest predates the window.
    const oldest = batch[batch.length - 1]?.created_at ?? '';
    if (!body.has_more || oldest < sinceIso) break;
    after = batch[batch.length - 1].id;
  }
  return out.filter((e) => (e.created_at ?? '') >= sinceIso);
}

const since = new Date(Date.now() - WINDOW_DAYS * 864e5)
  .toISOString()
  .replace('T', ' ')
  .slice(0, 19);

let emails;
try {
  emails = await recentEmails(since);
} catch (err) {
  console.error(`check-email-health: ${err.message}`);
  process.exit(2);
}

const total = emails.length;
const bounced = emails.filter((e) => e.last_event === 'bounced').length;
const complained = emails.filter((e) => e.last_event === 'complained').length;
const rate = total ? (100 * bounced) / total : 0;

console.log(`Email health — last ${WINDOW_DAYS} day(s), since ${since}`);
console.log(`  sent:      ${total}`);
console.log(`  bounced:   ${bounced}`);
console.log(`  complaints:${complained}`);
console.log(`  bounce rate: ${rate.toFixed(1)}%  (threshold ${MAX_BOUNCE_RATE}%)`);

if (bounced > 0) {
  // Name the recipients. A bounce rate alone does not tell you WHAT is bouncing,
  // and that was the whole difficulty last time — the number was visible in the
  // dashboard, but nobody could tell it was one test rather than real users.
  const worst = {};
  for (const e of emails.filter((x) => x.last_event === 'bounced')) {
    const to = (e.to ?? [''])[0] ?? '';
    const key = to.includes('+')
      ? `${to.split('+')[0]}+…@${to.split('@')[1] ?? ''}`
      : to;
    worst[key] = (worst[key] ?? 0) + 1;
  }
  console.log('  bouncing recipients:');
  for (const [k, v] of Object.entries(worst).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${v.toString().padStart(4)}  ${k}`);
  }
}

if (total < MIN_SAMPLE) {
  console.log(
    `\n✅ email-health: only ${total} send(s) in the window (min ${MIN_SAMPLE} to judge) — nothing to report.`
  );
  process.exit(0);
}

if (rate <= MAX_BOUNCE_RATE) {
  console.log(`\n✅ email-health: ${rate.toFixed(1)}% bounce rate is within budget.`);
  process.exit(0);
}

const msg =
  `email-health: ${rate.toFixed(1)}% bounce rate over the last ${WINDOW_DAYS} day(s) ` +
  `(${bounced}/${total}), above the ${MAX_BOUNCE_RATE}% threshold. ` +
  `Sustained bounces get a sending domain throttled and an ESP account suspended.`;

if (MODE === 'block') {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

// annotate mode: report without failing. Used while a known backlog of old
// bounces is still inside the window — flip to block once it has rolled past,
// exactly as FLAKY_GATE_MODE did for the flaky-count gate (#300).
console.log(`\n⚠️  ${msg}`);
console.log('   (mode=annotate — not failing the build; set mode=block to enforce)');
process.exit(0);
