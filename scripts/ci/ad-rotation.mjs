#!/usr/bin/env node
/**
 * Creative rotation for the paid campaign (#1197 follow-up).
 *
 * WHY NOT JUST RUN TWO ADS. The ad group bids `maximize_clicks`. Put two creatives in it and the
 * optimiser shifts delivery toward whichever it PREDICTS will click, then keeps shifting as that
 * prediction firms up. The resulting CTR difference measures its allocation, not the copy. There is
 * no rotation or split setting on the ad group, and ad groups carry no budget of their own, so a
 * second group would not force a split either. Time-slicing is the only lever available: exactly
 * one creative active at a time, so the optimiser has no allocation decision left to make.
 *
 * WHY THERE IS NO LEDGER. The first design had a cron committing a rotation log. `main` is
 * protected and nothing here pushes to it from CI — the one attempt, monitor.yml:127-135, is
 * commented out as causing merge conflicts. More importantly
 * scripts/__tests__/frozen-ledger-cannot-report-coverage.test.js exists because a ledger that stops
 * being written goes on reporting a verified window. A cron-written ledger inherits that bug.
 *
 * So the schedule is a pure function of the clock, and `report` VERIFIES rather than assumes: it
 * recomputes each past window arithmetically, asks the API what every arm actually did in it, and
 * DISCARDS any window where an arm that should have been paused served impressions. A missed cron
 * or a failed pause cannot masquerade as a clean result — it shows up as an excluded window with a
 * reason, which is the whole difference between a measurement and a plausible number.
 *
 * THE API TRAP, found the hard way. `unix_range` insights REQUIRE `time_granularity=hourly`. With
 * `none` the identical query returns zero rows AND NO ERROR, which reads as "this arm got no
 * delivery" rather than "wrong parameter". Verified both ways against a bucket known to hold 3,400
 * impressions. Note also that `unix_range` takes start/end while date_range and hour_range take
 * since/until; mixing them 400s.
 *
 * REPORTS, NEVER GATES. Following actions-usage.yml and the stance in
 * supabase/functions/_shared/ad-conversions.ts:15-18 — measurement must never cost the thing it
 * measures. A rotation job that fails a build because an ad API had a bad minute is worse than no
 * rotation job.
 *
 * CREDENTIAL. OPENAI_ADS_API_KEY is the ad-account ADVERTISER key for api.ads.openai.com. It is NOT
 * the OPENAI_CONVERSIONS_API_KEY the edge function sends events with — different key, different
 * host, not interchangeable (ad-conversions.ts:46-50).
 */

const API = process.env.ADS_API || 'https://api.ads.openai.com';

/** The ad group whose creatives rotate. */
export const AD_GROUP_ID =
  process.env.ADS_AD_GROUP_ID || 'adgrp_770754febb0481a0b26462a416520f61';

/**
 * Rotation anchor, UTC. Windows are a grid laid from here, so every past window's bounds are
 * recomputable from the clock alone with nothing stored.
 */
export const EPOCH_MS = Date.UTC(2026, 8, 19, 0, 0, 0);

/** One arm per day. Alternating equal blocks cancel time-of-day and day-of-week; two single long
 *  blocks would confound the creative with whenever it happened to run. */
export const CADENCE_HOURS = 24;

/** Below this, `report` refuses to compare and says so. Two CTRs from a few hundred impressions
 *  differ by noise, and printing them invites a decision the data cannot support. */
export const MIN_IMPRESSIONS = 5000;

/**
 * May rotation touch anything at all, given the campaigns in this account? Pure.
 *
 * WHY THIS EXISTS. `rotate` decided which CREATIVE should be live and had no opinion about whether
 * the CAMPAIGN should be. On 2026-09-18 the campaign was paused deliberately — a billing dispute
 * with the provider, with "I have paused both ads and the campaign pending your response" in
 * writing to their support team. A scheduled rotation would have activated an arm regardless,
 * because nothing in the old path could even see the campaign: the ad object carries no campaign
 * reference at all. Its keys are id, name, status, review, review_status, creative,
 * landing_page_configuration, created_at, updated_at — verified against the live API, not assumed.
 * The result would have been an ad reading `active` while its owner had told the provider in
 * writing that everything was stopped, and spend re-arming the instant the campaign resumed.
 *
 * WHY IT ASKS ABOUT THE ACCOUNT RATHER THAN THIS AD'S CAMPAIGN. Because it cannot ask the narrower
 * question. With no campaign id on the ad, "is MY campaign running" is not answerable from the ads
 * endpoint, so the honest available question is "is ANY campaign running here". In a single-campaign
 * account those coincide. In a multi-campaign account this is more permissive than ideal, and the
 * note is here so that whoever adds the second campaign knows to tighten it rather than discovering
 * the looseness later.
 *
 * FAILS CLOSED. An empty list, a missing list, or a shape that is not an array all refuse. For a
 * verb that spends money, "I could not tell" must never read as "go ahead" — which is the same
 * asymmetry the insights trap above taught, where a silent zero read as a measurement.
 */
export function campaignsAllowRotation(campaigns) {
  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    return {
      ok: false,
      reason:
        'no campaigns returned by the API — refusing to activate anything',
    };
  }
  const active = campaigns.filter((c) => c?.status === 'active');
  if (active.length === 0) {
    const seen = campaigns
      .map((c) => `${c?.id ?? '?'}=${c?.status ?? 'unknown'}`)
      .join(', ');
    return {
      ok: false,
      reason: `no active campaign (${seen}) — a paused campaign is a deliberate stop, not a gap to fill`,
    };
  }
  return { ok: true, reason: `${active.length} active campaign(s)` };
}

const HOUR_MS = 3_600_000;

/* ------------------------------------------------------------------ pure ---- */

/** Which arm index owns the window containing `nowMs`. Pure. */
export function armForWindow(
  nowMs,
  armCount,
  epochMs = EPOCH_MS,
  cadenceHours = CADENCE_HOURS
) {
  if (armCount <= 0) throw new Error('armForWindow: armCount must be >= 1');
  const n = Math.floor((nowMs - epochMs) / (cadenceHours * HOUR_MS));
  // Negative before the epoch: a modulo that stays non-negative keeps the grid defined either way
  // rather than producing a negative index nobody checks for.
  return ((n % armCount) + armCount) % armCount;
}

/** The window containing `nowMs`, snapped to the grid. Pure. */
export function windowBounds(
  nowMs,
  epochMs = EPOCH_MS,
  cadenceHours = CADENCE_HOURS
) {
  const span = cadenceHours * HOUR_MS;
  const n = Math.floor((nowMs - epochMs) / span);
  const start = epochMs + n * span;
  return { start, end: start + span, index: n };
}

/** Every window that has CLOSED between the epoch and `nowMs`. Pure. */
export function closedWindows(
  nowMs,
  epochMs = EPOCH_MS,
  cadenceHours = CADENCE_HOURS
) {
  const span = cadenceHours * HOUR_MS;
  const out = [];
  for (let s = epochMs; s + span <= nowMs; s += span) {
    out.push({
      start: s,
      end: s + span,
      index: Math.floor((s - epochMs) / span),
    });
  }
  return out;
}

/** Sum hourly insight buckets. Pure. The API nests metrics inconsistently, so accept both shapes. */
export function sumBuckets(rows) {
  let impressions = 0;
  let clicks = 0;
  for (const r of rows ?? []) {
    const m = r?.metrics ?? r ?? {};
    impressions += Number(m.impressions || 0);
    clicks += Number(m.clicks || 0);
  }
  return { impressions, clicks };
}

/**
 * A window is contaminated when an arm that should have been PAUSED served impressions in it.
 * That is a missed cron or a failed pause, and its numbers are a blend of both creatives. Pure.
 */
export function isContaminated(expectedArmId, perArm) {
  return Object.entries(perArm).some(
    ([adId, m]) => adId !== expectedArmId && m.impressions > 0
  );
}

/**
 * An arm is servable only once the platform has APPROVED it. Rotating onto an arm still
 * `in_review` pauses the one that works and activates one that cannot serve, which stops delivery
 * outright -- a worse outcome than not rotating. Pure.
 */
export function isServable(arm) {
  return arm?.review === 'approved';
}

/** CTR as a percentage, or null when there is nothing to divide. Pure. */
export function ctr({ impressions, clicks }) {
  return impressions > 0 ? (clicks / impressions) * 100 : null;
}

/**
 * Turn per-window results into the printed verdict. Pure, so the arithmetic and the refusal are
 * both testable without a network.
 */
export function summarise(windows, arms, minImpressions = MIN_IMPRESSIONS) {
  const totals = {};
  for (const a of arms)
    totals[a.id] = { impressions: 0, clicks: 0, windows: 0 };
  let excluded = 0;
  for (const w of windows) {
    if (w.contaminated) {
      excluded += 1;
      continue;
    }
    const t = totals[w.expectedArmId];
    if (!t) continue;
    const m = w.perArm[w.expectedArmId] ?? { impressions: 0, clicks: 0 };
    t.impressions += m.impressions;
    t.clicks += m.clicks;
    t.windows += 1;
  }
  const grand = Object.values(totals).reduce((n, t) => n + t.impressions, 0);
  return {
    totals,
    excluded,
    totalImpressions: grand,
    verdict: grand < minImpressions ? 'NOT ENOUGH DATA' : 'COMPARABLE',
  };
}

/* --------------------------------------------------------------- network ---- */

async function api(path, init = {}) {
  const key = process.env.OPENAI_ADS_API_KEY;
  if (!key) throw new Error('OPENAI_ADS_API_KEY is not set');
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok)
    throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status}`);
  return res.json();
}

/** Arms, in a STABLE order. Sorted by created_at then id so the grid never reshuffles. */
export async function listArms() {
  const d = await api('/v1/ads?limit=50');
  return (d.data ?? [])
    .filter((a) => a.status !== 'archived')
    .sort(
      (x, y) =>
        (x.created_at ?? 0) - (y.created_at ?? 0) ||
        String(x.id).localeCompare(String(y.id))
    )
    .map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      review: a.review?.status ?? null,
      title: a.creative?.title,
    }));
}

/** Campaigns in this ad account, id/status/name only. */
export async function listCampaigns() {
  const d = await api('/v1/campaigns?limit=50');
  return (d.data ?? []).map((c) => ({
    id: c.id,
    status: c.status,
    name: c.name,
  }));
}

async function insights(adId, startMs, endMs) {
  const tr = JSON.stringify({
    type: 'unix_range',
    start: Math.floor(startMs / 1000),
    end: Math.floor(endMs / 1000),
  });
  const qs = new URLSearchParams();
  // hourly is REQUIRED with unix_range -- `none` returns zero rows and no error. See the header.
  qs.set('time_granularity', 'hourly');
  qs.append('time_ranges[]', tr);
  for (const f of ['impressions', 'clicks']) qs.append('fields[]', f);
  const d = await api(`/v1/ads/${adId}/insights?${qs}`);
  return sumBuckets(d.data);
}

/* ----------------------------------------------------------------- verbs ---- */

async function rotate(now = Date.now()) {
  const arms = await listArms();
  if (arms.length < 2) {
    console.log(`::notice::only ${arms.length} arm(s) — nothing to rotate`);
    return 0;
  }
  // A paused campaign is a decision. Check it BEFORE any pause or activate, because the first
  // write is the one that contradicts it. See campaignsAllowRotation for why the question is
  // account-wide rather than per-campaign.
  const gate = campaignsAllowRotation(await listCampaigns());
  if (!gate.ok) {
    const msg = `rotation skipped: ${gate.reason}`;
    console.log(`::notice::${msg}`);
    emit(`### Ad rotation\n\n${msg}`);
    return 0;
  }

  const { start, end } = windowBounds(now);
  const want = arms[armForWindow(now, arms.length)];

  // Do NOT pause a working arm to activate one the platform will not serve.
  if (!isServable(want)) {
    const msg = `rotation skipped: ${want.id} is review=${want.review ?? 'unknown'}, not approved — leaving the current arm active`;
    console.log(`::notice::${msg}`);
    emit(`### Ad rotation\n\n${msg}`);
    return 0;
  }

  for (const a of arms) {
    if (a.id === want.id) continue;
    if (a.status === 'active')
      await api(`/v1/ads/${a.id}/pause`, { method: 'POST' });
  }
  if (want.status !== 'active')
    await api(`/v1/ads/${want.id}/activate`, { method: 'POST' });

  // VERIFY, do not assume. A pause that silently failed restores bandit mode and poisons every
  // window after it, which is exactly the failure this whole design exists to avoid.
  const after = await listArms();
  const active = after.filter((a) => a.status === 'active');
  const lines = [
    '### Ad rotation',
    '',
    `window \`${new Date(start).toISOString()}\` → \`${new Date(end).toISOString()}\``,
    '',
    '| arm | title | status |',
    '| --- | --- | --- |',
    ...after.map(
      (a) => `| \`${a.id.slice(0, 14)}…\` | ${a.title ?? '—'} | ${a.status} |`
    ),
  ];
  if (active.length !== 1 || active[0].id !== want.id) {
    lines.push(
      '',
      `**ROTATION DID NOT TAKE** — ${active.length} arm(s) active, expected exactly \`${want.id}\`.`
    );
    console.log(`::error::rotation did not take: ${active.length} active`);
  } else {
    lines.push('', `Active: **${want.title ?? want.id}**`);
  }
  emit(lines.join('\n'));
  return 0;
}

async function report(now = Date.now()) {
  const arms = await listArms();
  const windows = [];
  for (const w of closedWindows(now)) {
    const expectedArmId = arms[armForWindow(w.start, arms.length)]?.id;
    const perArm = {};
    for (const a of arms) perArm[a.id] = await insights(a.id, w.start, w.end);
    windows.push({
      ...w,
      expectedArmId,
      perArm,
      contaminated: isContaminated(expectedArmId, perArm),
    });
  }
  const s = summarise(windows, arms);

  const lines = ['### Creative rotation', '', `Verdict: **${s.verdict}**`, ''];
  lines.push('| arm | title | windows | impressions | clicks | CTR |');
  lines.push('| --- | --- | ---: | ---: | ---: | ---: |');
  for (const a of arms) {
    const t = s.totals[a.id] ?? { impressions: 0, clicks: 0, windows: 0 };
    const c = ctr(t);
    lines.push(
      `| \`${a.id.slice(0, 14)}…\` | ${a.title ?? '—'} | ${t.windows} | ${t.impressions} | ${t.clicks} | ${c === null ? '—' : c.toFixed(3) + '%'} |`
    );
  }
  if (s.excluded > 0) {
    lines.push(
      '',
      `${s.excluded} window(s) EXCLUDED — an arm that should have been paused served impressions in them. A missed rotation, not a result.`
    );
  }
  if (s.verdict === 'NOT ENOUGH DATA') {
    lines.push(
      '',
      `Under the ${MIN_IMPRESSIONS} impression floor (${s.totalImpressions} so far). Two CTRs from this little traffic differ by noise; no comparison is offered on purpose.`
    );
  }
  emit(lines.join('\n'));
  return 0;
}

function emit(summary) {
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    import('node:fs').then(({ appendFileSync }) =>
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`)
    );
  }
}

async function main() {
  const verb = process.argv[2] ?? 'report';
  if (verb === 'rotate') return rotate();
  if (verb === 'report') return report();
  console.error(`unknown verb: ${verb} (expected rotate|report)`);
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // A REPORT, NOT A GATE. Even an unexpected throw exits 0 -- see the header.
  main()
    .then((code) => process.exit(code ?? 0))
    .catch((err) => {
      console.log(`::notice::ad-rotation skipped: ${err.message}`);
      process.exit(0);
    });
}
