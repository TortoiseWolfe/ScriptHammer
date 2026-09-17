#!/usr/bin/env node
/**
 * Payment webhook liveness (#1183).
 *
 * WHY. The live Stripe webhook was dead for 31 days — 2026-08-17 to 2026-09-17 — and nothing here
 * noticed. It read the TEST endpoint's signing secret, so every live delivery failed HMAC and
 * returned 400 (#1180). The only signal that ever arrived was Stripe's own "we are about to disable
 * this endpoint" email, nine days after the first failure. Every other lane has a watchdog
 * (auth-config-drift, prod-schema-drift, email-health, intake-orphan-sweep, supabase-keepalive);
 * the one path by which money becomes a database row had none.
 *
 * WHY NOT STALENESS. The obvious check — "no webhook_events row in N days" — is the wrong one, and
 * it is worth writing down so nobody adds it later. This endpoint sees roughly one live event a
 * month, so quiet is indistinguishable from dead by row age alone: pick a threshold tight enough to
 * have caught #1180 and it cries wolf every quiet fortnight; pick one loose enough to stay quiet
 * and it would not have caught #1180 either. Staleness is reported as INFO and never fails.
 *
 * WHAT IS UNAMBIGUOUS. The function's own logs. A rejected delivery writes
 * "Signature verification failed"; a thrown handler writes a 5xx. Neither can be produced by an
 * endpoint nobody is calling, so silence is genuinely good news and noise is genuinely bad news.
 * That asymmetry is the whole design. It also needs NO Stripe credential — CI holds none, and
 * putting a live payment key in Actions is a decision with a far larger blast radius than this
 * check is worth (see #1185).
 *
 * WHAT IT WOULD HAVE CAUGHT, on day one rather than day 31:
 *   signature_failures   #1180 — the wrong signing secret
 *   server_errors        the .single()-on-zero-rows 500, which Stripe retries for three days
 *   permanently_failed   anything the retry ledger has given up on
 *
 * REPORTS ONLY. It issues no writes and touches no Stripe object.
 *
 * `evaluate()` is pure and is driven in both directions — including the real pre-fix #1180 state —
 * by scripts/__tests__/webhook-liveness.test.js, under the required `Test (20.x)` check. A checker
 * whose verdict function is never exercised is the defect this file exists to end.
 */

const MGMT = 'https://api.supabase.com';

/** Hours of logs to consider. Supabase free-tier log retention is ~24h, so this is the ceiling. */
export const WINDOW_HOURS = 24;

/** Row age at which we merely MENTION quiet. Never fails — see "WHY NOT STALENESS" above. */
export const STALE_INFO_DAYS = 30;

/**
 * Decide, from already-gathered facts. Pure: no clock, no network, no env.
 *
 * @param {object} f
 * @param {number} f.signatureFailures  HMAC mismatches (wrong secret), in-window
 * @param {number} [f.staleSignatures]   correct secret, stale payload — replay, skew, or our probe
 * @param {number} f.serverErrors       5xx responses from a payment webhook, in-window
 * @param {number} f.permanentlyFailed  webhook_events rows the retry ledger gave up on
 * @param {number} f.unprocessed        webhook_events rows still not processed
 * @param {number|null} f.newestEventAgeDays  age of the newest webhook_events row, or null if none
 * @returns {{verdict: 'PASS'|'FAIL', failures: string[], notes: string[]}}
 */
export function evaluate(f) {
  const failures = [];
  const notes = [];

  if (f.signatureFailures > 0) {
    failures.push(
      `${f.signatureFailures} signature rejection(s) in the last ${WINDOW_HOURS}h. ` +
        `A provider is signing with a secret this function does not hold — the #1180 failure. ` +
        `Deliveries are being refused RIGHT NOW.`
    );
  }

  // The HMAC matched, so the secret is right. Worth seeing — it is a replay, a clock skew, or
  // somebody running the #1180 diagnostic probe — but it is not a delivery failure.
  if (f.staleSignatures > 0) {
    notes.push(
      `${f.staleSignatures} payload(s) rejected for age with a VALID signature ` +
        `(replay, clock skew, or the #1180 diagnostic probe). The secret is correct.`
    );
  }

  if (f.serverErrors > 0) {
    failures.push(
      `${f.serverErrors} server error(s) from a payment webhook in the last ${WINDOW_HOURS}h. ` +
        `A 5xx is retried by Stripe for three days and counts toward the endpoint being disabled.`
    );
  }

  if (f.permanentlyFailed > 0) {
    failures.push(
      `${f.permanentlyFailed} webhook_events row(s) marked permanently_failed. ` +
        `These are deliveries the retry ledger has given up on.`
    );
  }

  // Unprocessed is NOT a failure on its own. A handler that legitimately returns
  // {handled:false} — an event carrying no template_user_id, say — leaves the row processed,
  // so a growing unprocessed count means something threw before the update. Reported so the
  // number is visible, not gated, because the count includes historical rows nobody will revisit.
  if (f.unprocessed > 0) {
    notes.push(`${f.unprocessed} unprocessed webhook_events row(s) (historical included).`);
  }

  if (f.newestEventAgeDays === null) {
    notes.push('No webhook_events rows at all — no provider traffic has ever been recorded.');
  } else if (f.newestEventAgeDays >= STALE_INFO_DAYS) {
    notes.push(
      `Newest webhook_events row is ${f.newestEventAgeDays} day(s) old. ` +
        `Informational only: quiet is not dead, and row age cannot tell them apart here.`
    );
  }

  return { verdict: failures.length ? 'FAIL' : 'PASS', failures, notes };
}

/* ------------------------------------------------------------------ I/O */

async function mgmt(path, token, body) {
  const res = await fetch(`${MGMT}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    throw new Error(`${path} -> HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

const sql = (ref, token, query) =>
  mgmt(`/v1/projects/${ref}/database/query`, token, { query });

async function logs(ref, token, query, sinceIso, untilIso) {
  const qs = new URLSearchParams({
    sql: query,
    iso_timestamp_start: sinceIso,
    iso_timestamp_end: untilIso,
  });
  const out = await mgmt(`/v1/projects/${ref}/analytics/endpoints/logs.all?${qs}`, token);
  if (out?.error) throw new Error(`log query rejected: ${JSON.stringify(out.error).slice(0, 200)}`);
  return out?.result ?? [];
}

async function gather(ref, token, nowMs) {
  const since = new Date(nowMs - WINDOW_HOURS * 3600_000).toISOString();
  const until = new Date(nowMs).toISOString();

  const logRows = await logs(
    ref,
    token,
    "select t.timestamp, m.level, t.event_message from function_logs t " +
      'cross join unnest(t.metadata) as m limit 1000',
    since,
    until
  );

  // Match the message the Stripe SDK produces, not our own wording — the surrounding
  // console.error text is ours to change, the SDK's is not.
  //
  // AND DISTINGUISH THE TWO SDK REJECTIONS, because they mean opposite things and our own
  // console.error prefixes BOTH with "Signature verification failed":
  //
  //   "No signatures found matching…"     the computed HMAC did not match — WRONG SECRET (#1180)
  //   "Timestamp outside the tolerance…"  the HMAC DID match, the payload is just old — RIGHT secret
  //
  // The second is what the diagnostic probe in #1180 deliberately produces to prove a secret
  // without writing anything, so a broad matcher would make that probe trip this gate for 24h.
  // It is also what a replay looks like, so it is surfaced rather than ignored.
  const msg = (r) => r.event_message ?? '';
  const signatureFailures = logRows.filter(
    (r) =>
      /No signatures found matching|Unable to extract timestamp and signatures/i.test(msg(r))
  ).length;
  const staleSignatures = logRows.filter((r) =>
    /Timestamp outside the tolerance zone/i.test(msg(r))
  ).length;

  let serverErrors = 0;
  try {
    const edge = await logs(
      ref,
      token,
      'select t.timestamp, r.url, res.status_code from function_edge_logs t ' +
        'cross join unnest(t.metadata) as m ' +
        'cross join unnest(m.request) as r ' +
        'cross join unnest(m.response) as res ' +
        "where res.status_code >= 500 and (r.url like '%stripe-webhook%' or r.url like '%paypal-webhook%') " +
        'limit 200',
      since,
      until
    );
    serverErrors = edge.length;
  } catch (err) {
    // Edge-log schema has moved before. A shape change must not silently zero this signal.
    console.log(`::warning::edge-log query failed, 5xx signal unavailable: ${err.message}`);
    serverErrors = 0;
  }

  const [counts] = await sql(
    ref,
    token,
    "select count(*) filter (where permanently_failed) as permanently_failed, " +
      'count(*) filter (where not processed) as unprocessed, ' +
      'max(created_at) as newest from webhook_events'
  );

  const newest = counts?.newest ? Date.parse(counts.newest) : null;

  return {
    signatureFailures,
    staleSignatures,
    serverErrors,
    permanentlyFailed: Number(counts?.permanently_failed ?? 0),
    unprocessed: Number(counts?.unprocessed ?? 0),
    newestEventAgeDays:
      newest === null ? null : Math.floor((nowMs - newest) / 86_400_000),
  };
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;

  // A missing credential FAILS. A liveness check that reports success because it could not
  // look is the exact defect this file exists to end — and it is how #1180 stayed invisible.
  if (!token || !ref) {
    console.log('::error::SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are both required.');
    process.exit(1);
  }

  const nowMs = Date.now();
  const facts = await gather(ref, token, nowMs);
  const { verdict, failures, notes } = evaluate(facts);

  const lines = [
    '## Payment webhook liveness',
    '',
    `Window: last ${WINDOW_HOURS}h · project \`${ref}\``,
    '',
    '| signal | count |',
    '| --- | --- |',
    `| signature rejections (wrong secret) | ${facts.signatureFailures} |`,
    `| stale-but-valid signatures | ${facts.staleSignatures ?? 0} |`,
    `| 5xx from a payment webhook | ${facts.serverErrors} |`,
    `| permanently_failed rows | ${facts.permanentlyFailed} |`,
    `| unprocessed rows | ${facts.unprocessed} |`,
    `| newest event age (days) | ${facts.newestEventAgeDays ?? 'n/a'} |`,
    '',
    `**${verdict}**`,
    ...(failures.length ? ['', ...failures.map((f) => `- ❌ ${f}`)] : []),
    ...(notes.length ? ['', ...notes.map((n) => `- ${n}`)] : []),
  ];
  const summary = lines.join('\n');
  console.log(summary);

  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }

  for (const f of failures) console.log(`::error::${f}`);
  process.exit(verdict === 'FAIL' ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.log(`::error::webhook liveness check could not run: ${err.message}`);
    process.exit(1);
  });
}
