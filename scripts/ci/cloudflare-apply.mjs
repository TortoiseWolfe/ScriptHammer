#!/usr/bin/env node
/**
 * Make Cloudflare match the intent this repository declares (#393, #822).
 *
 * WHY THIS EXISTS. Three controls with real security weight live in a Cloudflare dashboard
 * rather than in this tree — the cache headers (#635), the CSP header (#393) and the mail
 * DNS (#822). Each has a checker that asserts production still matches. NOTHING here could
 * CHANGE them, so every tightening was a hand-edit in a browser, recorded nowhere, that then
 * needed a second edit in this repo to keep the checker honest. Two steps, two systems, and
 * nothing catching a half-done pair.
 *
 * The `CLOUDFLARE_API_TOKEN` in `.env` already reads the exact DNS record and the exact
 * transform rule those tickets ask a human to edit by hand.
 *
 * NO IDENTIFIERS ARE STORED. Not the zone id, not the ruleset id, not the rule id — even
 * though all three are known for this repo. They are discovered by name and by CONTENT:
 *
 *   - the zone, by the domain from `NEXT_PUBLIC_DEPLOY_URL` (or `MAIL_DOMAIN`);
 *   - the DMARC record, as the TXT at `_dmarc.<domain>` beginning `v=DMARC1`;
 *   - the CSP rule, as the rule in the `http_response_headers_transform` phase whose action
 *     sets a Content-Security-Policy header — in EITHER mode, so the rule is still found
 *     after it has been flipped;
 *   - the cache rules (#1199), as the rewrite rule in that same phase that sets
 *     `cache-control`, and the `set_cache_settings` rule whose expression names the
 *     hashed-asset prefix.
 *
 * WHY #1199 WIDENS AN EXISTING RULE RATHER THAN ADDING ONE. Discovery by content is what
 * makes the line above possible, and it is also what forbids a second cache-control rule:
 * the planner would find two, refuse as designed, and stay refusing — the "fallback"
 * would permanently disable the planner. So the error condition joins the #635 document
 * rule, and `cloudflare-intent.mjs` owns the whole expression so that reverting #1199 is
 * passing `null` for the error ranges rather than re-deriving #635 from memory.
 *
 * A stored id would work here and break in every fork, which is the #1014 / #987 shape: a
 * template default silently pointing a fork's tooling at the template's infrastructure. It
 * would also break for THIS repo the moment the zone moved, and it would break silently.
 *
 * SAFETY. Dry run by DEFAULT — `--apply` is required to write anything. No token, no zone,
 * or nothing to change all SKIP with a message and exit 0; none of them fail, and none of
 * them pass silently. Every change prints before and after, in full, before it is made.
 *
 * PROPAGATION IS NOT INSTANT. Cloudflare ruleset edits take roughly 45 seconds to take
 * effect, and a probe fired immediately after a write reads the PREVIOUS value. That
 * produced three confident, wrong conclusions in one session on #635 — it is written into
 * CLAUDE.md for that reason. So verification here waits, and says that it is waiting.
 *
 * USAGE
 *   node scripts/ci/cloudflare-apply.mjs                 # dry run: show the diff
 *   node scripts/ci/cloudflare-apply.mjs --apply         # write, wait, verify
 *   node scripts/ci/cloudflare-apply.mjs --only=csp      # or --only=dmarc, --only=cache
 *   node scripts/ci/cloudflare-apply.mjs --selftest      # planners, no network
 */
import {
  resolveDomain,
  intendedFor,
  parseDmarc,
} from './check-mail-policy.mjs';
import {
  CSP_MODE,
  CSP_HEADER_NAMES,
  intendedCspHeader,
  cspPolicy,
  calendarProvider,
  cacheIntent,
  revalidateExpression,
} from './cloudflare-intent.mjs';

const API = 'https://api.cloudflare.com/client/v4';

/** How long a ruleset edit takes to reach the edge. See the header — this is load-bearing. */
export const PROPAGATION_MS = 45_000;

async function cf(token, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const errs = (body.errors ?? [])
      .map((e) => `${e.code}: ${e.message}`)
      .join('; ');
    throw new Error(
      `Cloudflare ${init.method ?? 'GET'} ${path} → ${res.status} ${errs || ''}`
    );
  }
  return body.result;
}

/* ---------------------------------------------------------------- planners (pure) ------ */

/**
 * Rewrite one DMARC tag set, preserving every other tag and its order.
 *
 * Rebuilding the record from the tags this repo knows about would DROP the ones it does not
 * — `sp`, `adkim`, `aspf`, `fo`, `ruf` — silently loosening a policy while appearing to
 * tighten it. So this edits in place and leaves everything it was not asked about alone.
 */
export function rewriteDmarc(record, { policy, pct }) {
  const parts = record
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  let sawPolicy = false;
  let sawPct = false;
  for (const part of parts) {
    const [k, ...rest] = part.split('=');
    const key = k.trim();
    if (key === 'p') {
      out.push(`p=${policy}`);
      sawPolicy = true;
    } else if (key === 'pct') {
      sawPct = true;
      // A null pct means "not declared" — drop the tag rather than pinning it to 100.
      if (pct != null) out.push(`pct=${pct}`);
    } else {
      out.push(`${key}=${rest.join('=').trim()}`);
    }
  }
  if (!sawPolicy) out.unshift(`p=${policy}`);
  if (!sawPct && pct != null) {
    // `pct` belongs after `p` by convention; receivers do not care, humans reading it do.
    const i = out.findIndex((t) => t.startsWith('p='));
    out.splice(i + 1, 0, `pct=${pct}`);
  }
  return out.join('; ');
}

/** What, if anything, the DMARC record needs. */
export function planDmarc(records, intended) {
  const found = (records ?? []).filter((r) =>
    String(r.content ?? '').includes('v=DMARC1')
  );
  if (found.length === 0) {
    return {
      kind: 'dmarc',
      action: 'skip',
      reason: `no DMARC TXT record at _dmarc.${intended.domain}`,
    };
  }
  if (found.length > 1) {
    // Receivers treat multiple DMARC records as none at all; picking one to edit would
    // leave the zone broken and looking fixed.
    return {
      kind: 'dmarc',
      action: 'skip',
      reason: `${found.length} DMARC records published — resolve that by hand first, receivers ignore all of them`,
    };
  }
  const rec = found[0];
  const tags = parseDmarc(rec.content);
  const want = rewriteDmarc(rec.content, {
    policy: intended.dmarcPolicy,
    pct: intended.dmarcPct ?? null,
  });
  if (want === rec.content) {
    return {
      kind: 'dmarc',
      action: 'none',
      current: rec.content,
      note: `already p=${tags.p}`,
    };
  }
  return {
    kind: 'dmarc',
    action: 'update',
    id: rec.id,
    name: rec.name,
    from: rec.content,
    to: want,
  };
}

/** What, if anything, the CSP transform rule needs. */
export function planCsp(rules, mode = CSP_MODE, policy = cspPolicy()) {
  const want = intendedCspHeader(mode);
  const matches = (rules ?? []).filter((r) => {
    const headers = r.action_parameters?.headers ?? {};
    return Object.keys(headers).some((h) =>
      CSP_HEADER_NAMES.some((n) => n.toLowerCase() === h.toLowerCase())
    );
  });
  if (matches.length === 0) {
    return {
      kind: 'csp',
      action: 'skip',
      reason:
        'no response-header rule sets a Content-Security-Policy; this script edits an existing rule, it does not create one',
    };
  }
  if (matches.length > 1) {
    return {
      kind: 'csp',
      action: 'skip',
      reason: `${matches.length} rules set a CSP header — two policies would race, resolve that by hand first`,
    };
  }
  const rule = matches[0];
  const headers = rule.action_parameters.headers;
  const currentName = Object.keys(headers).find((h) =>
    CSP_HEADER_NAMES.some((n) => n.toLowerCase() === h.toLowerCase())
  );
  const currentValue = headers[currentName]?.value;

  // THE POLICY VALUE IS NOW PART OF THE PLAN (#1110).
  //
  // This function used to compare the header NAME only and copy the value across untouched —
  // it printed "policy value unchanged" and meant it. So the one copy of the live policy was
  // the dashboard, and adding an origin was a human editing a text box: unreviewable,
  // unversioned, and invisible to `git log`. `cloudflare-intent.mjs` always promised "the same
  // value can drive both the check and the change"; it only held the mode.
  const wantValue = policy ?? currentValue;

  if (currentName === want && currentValue === wantValue) {
    return {
      kind: 'csp',
      action: 'none',
      current: currentName,
      note: `already ${mode}, policy matches intent`,
    };
  }

  // Rename the key and/or set the value, keeping every other header on the rule.
  const next = {};
  for (const [k, v] of Object.entries(headers))
    next[k === currentName ? want : k] =
      k === currentName ? { ...v, value: wantValue } : v;
  return {
    kind: 'csp',
    action: 'update',
    id: rule.id,
    from: currentName,
    to: want,
    value: currentValue,
    nextValue: wantValue,
    valueChanged: currentValue !== wantValue,
    headers: next,
    actionParameters: { headers: next },
    // The rule's OWN Cloudflare fields, carried through because the PATCH is rejected
    // without them — see the call site. Named `rule` so `action` here cannot be confused
    // with `action` above, which is this planner's verdict.
    rule: {
      action: rule.action,
      expression: rule.expression,
      description: rule.description,
      enabled: rule.enabled,
    },
  };
}

/**
 * THE BROWSER HALF of the cache contract (#1199): the rule that sets `cache-control`.
 *
 * Widening this rule rather than adding a second one is deliberate, and the reason is
 * this planner. Discovery here is by CONTENT — "a rewrite rule that sets cache-control" —
 * because the module header forbids hardcoded rule ids. Add a second cache-control rule
 * and this finds two, refuses, and stays refusing: the fallback would permanently
 * disable the planner it exists to serve. The cost of widening (a bad revert has to
 * re-derive #635's expression) is paid off by `cloudflare-intent.mjs` owning the whole
 * expression, so reverting is passing `null` for the error ranges.
 */
export function planErrorHeaders(rules, intent = cacheIntent()) {
  const isCacheControl = (h) => h.toLowerCase() === 'cache-control';
  const matches = (rules ?? []).filter((r) => {
    if (r.action !== 'rewrite') return false;
    return Object.keys(r.action_parameters?.headers ?? {}).some(isCacheControl);
  });
  if (matches.length === 0) {
    return {
      kind: 'cache-browser',
      action: 'skip',
      reason:
        'no response-header rule sets cache-control; this script edits an existing rule, it does not create one',
    };
  }
  if (matches.length > 1) {
    return {
      kind: 'cache-browser',
      action: 'skip',
      reason:
        `${matches.length} rules set cache-control — in this phase EVERY match runs and the ` +
        'last one wins, which is not declared here; resolve that by hand first',
    };
  }
  const rule = matches[0];
  const headers = rule.action_parameters.headers;
  const key = Object.keys(headers).find(isCacheControl);
  const currentValue = headers[key]?.value;
  const wantValue = intent.revalidateCacheControl;
  const wantExpression = intent.revalidateExpression;
  const wantDescription = intent.descriptions.revalidate;

  if (
    currentValue === wantValue &&
    rule.expression === wantExpression &&
    rule.description === wantDescription
  ) {
    return {
      kind: 'cache-browser',
      action: 'none',
      current: rule.expression,
      note: 'already covers documents and error responses',
    };
  }

  // Keep every other header on the rule, replacing only the cache-control entry.
  const next = {};
  for (const [k, v] of Object.entries(headers))
    next[k] = isCacheControl(k) ? { ...v, value: wantValue } : v;

  return {
    kind: 'cache-browser',
    action: 'update',
    id: rule.id,
    changes: [
      { field: 'expression', from: rule.expression, to: wantExpression },
      { field: 'cache-control', from: currentValue, to: wantValue },
      { field: 'description', from: rule.description, to: wantDescription },
    ].filter((c) => c.from !== c.to),
    headers: next,
    actionParameters: { headers: next },
    rule: {
      action: rule.action,
      expression: wantExpression,
      description: wantDescription,
      enabled: rule.enabled,
    },
  };
}

/**
 * THE EDGE HALF (#1199): per-status TTLs on the existing hashed-asset Cache Rule.
 *
 * `edge_ttl.default` is compared as well as `status_code_ttl`, so this catches #635
 * DRIFT and not merely the absence of #1199. Without that, a planner that never looked
 * at the one-year value would satisfy every test about the new one.
 */
export function planErrorEdgeTtl(rules, intent = cacheIntent()) {
  const matches = (rules ?? []).filter(
    (r) =>
      r.action === 'set_cache_settings' &&
      String(r.expression ?? '').includes(intent.hashedAssetPrefix)
  );
  if (matches.length === 0) {
    return {
      kind: 'cache-edge',
      action: 'skip',
      reason: `no cache rule matches ${intent.hashedAssetPrefix}; this script edits an existing rule, it does not create one`,
    };
  }
  if (matches.length > 1) {
    return {
      kind: 'cache-edge',
      action: 'skip',
      reason: `${matches.length} cache rules match ${intent.hashedAssetPrefix} — only the FIRST match applies in this phase, so which one wins is not declared here; resolve that by hand first`,
    };
  }
  const rule = matches[0];
  const params = rule.action_parameters ?? {};
  const edge = params.edge_ttl ?? {};
  const currentTtl = edge.status_code_ttl ?? null;
  const wantTtl = intent.statusCodeTtl;
  const same =
    JSON.stringify(currentTtl) === JSON.stringify(wantTtl) &&
    edge.default === intent.assetMaxAge;

  if (same) {
    return {
      kind: 'cache-edge',
      action: 'none',
      current: JSON.stringify(currentTtl),
      note: 'error TTLs already capped, and the one-year default is intact',
    };
  }

  // SPREAD, NEVER REBUILD. The live rule may carry serve_stale, cache_key,
  // respect_strong_etags and the browser_ttl this change must not touch. Regenerating
  // action_parameters from declared intent would drop every one of them while reading
  // like a tightening — the loosening trap `rewriteDmarc` documents, in a new costume.
  const nextParams = {
    ...params,
    edge_ttl: {
      ...edge,
      default: intent.assetMaxAge,
      status_code_ttl: wantTtl,
    },
  };

  return {
    kind: 'cache-edge',
    action: 'update',
    id: rule.id,
    changes: [
      {
        field: 'edge_ttl.status_code_ttl',
        from: JSON.stringify(currentTtl),
        to: JSON.stringify(wantTtl),
      },
      {
        field: 'edge_ttl.default',
        from: String(edge.default),
        to: String(intent.assetMaxAge),
      },
    ].filter((c) => c.from !== c.to),
    actionParameters: nextParams,
    rule: {
      action: rule.action,
      expression: rule.expression,
      description: rule.description,
      enabled: rule.enabled,
    },
  };
}

/**
 * Both halves, browser first.
 *
 * ORDER IS LOAD-BEARING. `http.response.code` in a response-header expression is the one
 * part of this change not yet proven against the live API. A rules PATCH is validated
 * and atomic, so if Cloudflare rejects it the rule is left byte-identical and the loop
 * aborts BEFORE the edge write — leaving the zone wholly unchanged rather than half
 * changed. That rejection is the measurement; it is not a cue to improvise a fallback.
 */
export function planCache({ headers, cache }, intent = cacheIntent()) {
  return [planErrorHeaders(headers, intent), planErrorEdgeTtl(cache, intent)];
}

/* ---------------------------------------------------------------- execution ------------ */

function describe(plan) {
  if (plan.action === 'skip')
    return `  ${plan.kind.toUpperCase()}: skipped — ${plan.reason}`;
  if (plan.action === 'none')
    return `  ${plan.kind.toUpperCase()}: no change (${plan.note})`;
  if (plan.kind === 'dmarc') {
    return `  DMARC: ${plan.name}\n    from: ${plan.from}\n    to:   ${plan.to}`;
  }
  if (plan.kind === 'cache-browser' || plan.kind === 'cache-edge') {
    // Rendered from `changes`, so a cache plan never touches the CSP fields below. The
    // expressions print IN FULL and untokenised: they are ~250 characters, not 950, and
    // the token-diff machinery would actively obscure a boolean restructuring — which
    // is the one thing an operator approving this has to be able to read.
    const label =
      plan.kind === 'cache-browser' ? 'CACHE (browser)' : 'CACHE (edge)';
    const lines = plan.changes.flatMap((c) => [
      `    ${c.field}:`,
      `      from: ${c.from}`,
      `      to:   ${c.to}`,
    ]);
    return [`  ${label}: rule ${plan.id}`, ...lines].join('\n');
  }
  // CSP is now explicit rather than the fall-through: any future `kind` reaching this
  // branch printed garbage, because it reads valueChanged/value/nextValue.
  if (plan.kind !== 'csp') {
    return `  ${plan.kind.toUpperCase()}: update (no renderer for this kind)`;
  }
  const head = `  CSP: rule ${plan.id}\n    from: ${plan.from}\n    to:   ${plan.to}`;
  if (!plan.valueChanged)
    return `${head}\n    (policy value unchanged, ${String(plan.value ?? '').length} chars)`;
  // Print the DIFFERENCE, not the two 950-character strings. An operator approving a policy
  // change has to be able to see what it is; two walls of text are not a diff.
  const toks = (v) =>
    new Set(
      String(v ?? '')
        .split(/[;\s]+/)
        .filter(Boolean)
    );
  const before = toks(plan.value);
  const after = toks(plan.nextValue);
  const added = [...after].filter((t) => !before.has(t));
  const removed = [...before].filter((t) => !after.has(t));
  return (
    `${head}\n    policy: ${String(plan.value ?? '').length} -> ${String(plan.nextValue ?? '').length} chars` +
    `\n      + ${added.join(' ') || '(nothing)'}` +
    `\n      - ${removed.join(' ') || '(nothing)'}`
  );
}

async function main(argv) {
  if (argv.includes('--selftest')) return selftest();

  const apply = argv.includes('--apply');
  const only =
    (argv.find((a) => a.startsWith('--only=')) ?? '').split('=')[1] || null;
  // An unknown --only used to select nothing and exit 0 reporting "nothing to do" — a
  // typo reading as "Cloudflare already matches intent". Name the known set instead.
  const KNOWN_ONLY = ['dmarc', 'csp', 'cache'];
  if (only && !KNOWN_ONLY.includes(only)) {
    console.error(
      `[cf-apply] unknown --only=${only}. Expected one of: ${KNOWN_ONLY.join(', ')}.`
    );
    process.exitCode = 1;
    return;
  }
  // WHICH SCHEDULER'S ORIGINS GO IN THE POLICY IS DECIDED BY AN ENV VAR, SO IT MUST BE
  // EXPLICIT BEFORE WE WRITE (#1110).
  //
  // `calendarProvider()` defaults to 'calendly' to match `calendar.config.ts`. That default
  // is right for reading and WRONG for writing: run `--apply` on a machine that has not set
  // the variable and this would push Calendly's origins into the policy of a site that
  // embeds Cal.com — silently, because both are valid-looking policies. That is the #1054
  // family, where a template default quietly points tooling at the wrong thing.
  //
  // Reading stays unguarded: a dry run with the default still shows a useful diff. This
  // sits before the token lookup so it refuses without making a single network call.
  if (
    apply &&
    (!only || only === 'csp') &&
    !process.env.NEXT_PUBLIC_CALENDAR_PROVIDER
  ) {
    console.error(
      '[cf-apply] refusing to write the CSP: NEXT_PUBLIC_CALENDAR_PROVIDER is not set.\n' +
        '  The policy embeds the scheduler origins for ONE provider, and the default is\n' +
        "  'calendly' — applying that to a Cal.com deployment would block its own embed.\n" +
        '  Set it to the value this site deploys with (gh variable list) and re-run.'
    );
    process.exitCode = 1;
    return;
  }

  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!token) {
    // Skip, not fail: most runs legitimately have no token, and a fork has none at all.
    console.log(
      '[cf-apply] skipped — CLOUDFLARE_API_TOKEN is not set, so there is nothing to read or change.'
    );
    return;
  }

  const { domain, source, reason } = resolveDomain(argv, process.env);
  if (!domain) {
    console.log(`[cf-apply] skipped — ${reason}`);
    return;
  }

  const zones = await cf(token, `/zones?name=${encodeURIComponent(domain)}`);
  if (!zones?.length) {
    console.log(
      `[cf-apply] skipped — ${domain} (from ${source}) is not a zone this token can see.`
    );
    return;
  }
  const zone = zones[0];
  console.log(
    `[cf-apply] zone ${zone.name} (discovered by name, from ${source})`
  );
  console.log(
    `[cf-apply] mode: ${apply ? 'APPLY' : 'dry run — pass --apply to write'}`
  );
  console.log(
    `[cf-apply] scheduler: ${calendarProvider()}` +
      (process.env.NEXT_PUBLIC_CALENDAR_PROVIDER
        ? ''
        : ' (DEFAULT — not set in this env)')
  );

  const intended = intendedFor(domain, process.env);
  const plans = [];

  if (!only || only === 'dmarc') {
    const records = await cf(
      token,
      `/zones/${zone.id}/dns_records?type=TXT&name=${encodeURIComponent(`_dmarc.${domain}`)}`
    );
    plans.push(planDmarc(records, intended));
  }
  const wantCsp = !only || only === 'csp';
  const wantCache = !only || only === 'cache';
  if (wantCsp || wantCache) {
    // One list call shared by both intents: the CSP rule and the #1199 browser rule
    // live in the SAME ruleset, and fetching it twice invites them to disagree.
    const rulesets = await cf(token, `/zones/${zone.id}/rulesets`);
    const loadPhase = async (phase) => {
      const rs = rulesets.find((r) => r.phase === phase);
      if (!rs) return null;
      const full = await cf(token, `/zones/${zone.id}/rulesets/${rs.id}`);
      return { id: rs.id, rules: full.rules ?? [] };
    };
    const withRulesetId = (plan, rs) =>
      plan.action === 'update' ? { ...plan, rulesetId: rs.id } : plan;
    const missing = (kind, phase) => ({
      kind,
      action: 'skip',
      reason: `this zone has no ${phase} ruleset`,
    });

    const TRANSFORM = 'http_response_headers_transform';
    const CACHE_SETTINGS = 'http_request_cache_settings';
    const transform = await loadPhase(TRANSFORM);
    const cacheRs = wantCache ? await loadPhase(CACHE_SETTINGS) : null;

    if (wantCsp) {
      plans.push(
        transform
          ? withRulesetId(planCsp(transform.rules, CSP_MODE), transform)
          : missing('csp', TRANSFORM)
      );
    }
    if (wantCache) {
      // Browser half FIRST — see planCache: a rejected expression must abort before
      // the edge write, so the zone is left wholly unchanged rather than half changed.
      const [browserPlan, edgePlan] = planCache({
        headers: transform?.rules ?? [],
        cache: cacheRs?.rules ?? [],
      });
      plans.push(
        transform
          ? withRulesetId(browserPlan, transform)
          : missing('cache-browser', TRANSFORM)
      );
      plans.push(
        cacheRs
          ? withRulesetId(edgePlan, cacheRs)
          : missing('cache-edge', CACHE_SETTINGS)
      );
    }
  }

  console.log('\n[cf-apply] plan:');
  for (const p of plans) console.log(describe(p));

  const changes = plans.filter((p) => p.action === 'update');
  if (!changes.length) {
    console.log(
      '\n[cf-apply] nothing to do — Cloudflare already matches the declared intent.'
    );
    return;
  }
  if (!apply) {
    console.log(
      '\n[cf-apply] dry run only. Re-run with --apply to make these changes.'
    );
    return;
  }

  for (const p of changes) {
    if (p.kind === 'dmarc') {
      await cf(token, `/zones/${zone.id}/dns_records/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: p.to }),
      });
      console.log(`[cf-apply] wrote DMARC ${p.name}`);
    } else {
      await cf(
        token,
        `/zones/${zone.id}/rulesets/${p.rulesetId}/rules/${p.id}`,
        {
          method: 'PATCH',
          // A RULE PATCH REPLACES THE RULE, so it must carry the rule's own fields back.
          // Sending only `action_parameters` is rejected twice over — first
          // `400 action is required for action parameters`, then
          // `400 20125 '' is not a valid value for expression because the expression cannot
          // be blank`. So this write has NEVER once succeeded, which also means #393's
          // documented flip procedure ("change CSP_MODE, run --apply") would have failed the
          // first time anyone tried it. Only the DMARC path, a different endpoint, was ever
          // exercised. Found by running it (#1110).
          // `actionParameters` rather than a headers-only literal: a cache rule's
          // parameters are edge_ttl/browser_ttl, not headers, and each planner is the
          // thing that knows how to preserve the keys it did not set.
          body: JSON.stringify({
            ...p.rule,
            action_parameters: p.actionParameters,
          }),
        }
      );
      console.log(`[cf-apply] wrote ${p.kind} rule ${p.id}`);
    }
  }

  // The wait is the point. Probing immediately reads the previous rule and reports the
  // change as failed — three wrong root causes came from exactly that on #635.
  console.log(
    `\n[cf-apply] waiting ${PROPAGATION_MS / 1000}s for propagation before verifying...`
  );
  await new Promise((r) => setTimeout(r, PROPAGATION_MS));
  console.log('[cf-apply] applied. Verify with:');
  console.log(`  node scripts/ci/check-mail-policy.mjs ${domain}`);
  console.log(
    `  SITE=https://${domain} REQUIRE_CSP=true node scripts/ci/check-csp-header.mjs`
  );
  console.log(
    `  REQUIRE_EDGE=true node scripts/ci/check-cache-headers.mjs https://${domain}`
  );
  console.log(
    '  — and read the header off a REAL missing path, not the rule: Browser TTL\n' +
      '    accepts values it then ignores, so a rule that reads back correctly can\n' +
      '    still do nothing. Keep a control that you know works.'
  );
}

function selftest() {
  const cases = [];
  const check = (label, got, want) =>
    cases.push([
      label,
      JSON.stringify(got) === JSON.stringify(want),
      got,
      want,
    ]);

  // rewriteDmarc keeps tags it was not asked about — the loosening trap.
  check(
    'preserves other tags',
    rewriteDmarc('v=DMARC1; p=none; sp=none; rua=mailto:a@b.c; adkim=s', {
      policy: 'quarantine',
      pct: 25,
    }),
    'v=DMARC1; p=quarantine; pct=25; sp=none; rua=mailto:a@b.c; adkim=s'
  );
  check(
    'replaces an existing pct',
    rewriteDmarc('v=DMARC1; p=none; pct=100; rua=mailto:a@b.c', {
      policy: 'reject',
      pct: 50,
    }),
    'v=DMARC1; p=reject; pct=50; rua=mailto:a@b.c'
  );
  check(
    'drops pct when undeclared',
    rewriteDmarc('v=DMARC1; p=none; pct=25', { policy: 'none', pct: null }),
    'v=DMARC1; p=none'
  );
  check(
    'is a no-op when already correct',
    rewriteDmarc('v=DMARC1; p=none; rua=mailto:a@b.c', {
      policy: 'none',
      pct: null,
    }),
    'v=DMARC1; p=none; rua=mailto:a@b.c'
  );

  const intent = { domain: 'x.test', dmarcPolicy: 'quarantine', dmarcPct: 25 };
  check(
    'plans no DMARC change when it matches',
    planDmarc(
      [
        {
          id: '1',
          name: '_dmarc.x.test',
          content: 'v=DMARC1; p=quarantine; pct=25',
        },
      ],
      intent
    ).action,
    'none'
  );
  check(
    'plans a DMARC update when it differs',
    planDmarc(
      [{ id: '1', name: '_dmarc.x.test', content: 'v=DMARC1; p=none' }],
      intent
    ).action,
    'update'
  );
  check(
    'refuses a zone with two DMARC records',
    planDmarc(
      [
        { id: '1', content: 'v=DMARC1; p=none' },
        { id: '2', content: 'v=DMARC1; p=reject' },
      ],
      intent
    ).action,
    'skip'
  );
  check(
    'skips when there is no DMARC record',
    planDmarc([], intent).action,
    'skip'
  );

  const ro = [
    {
      id: 'r1',
      action_parameters: {
        headers: {
          'Content-Security-Policy-Report-Only': {
            operation: 'set',
            value: "default-src 'self'",
          },
        },
      },
    },
  ];
  const other = [
    {
      id: 'r0',
      action_parameters: {
        headers: { 'cache-control': { operation: 'set', value: 'no-cache' } },
      },
    },
  ];
  // The fixture's value is `default-src 'self'`, so these pass the INTENDED policy explicitly.
  // Passing none would compare that stub against the real 950-character policy and every case
  // below would read "update" for a reason unrelated to what it is testing.
  const FIXTURE_POLICY = "default-src 'self'";
  check(
    'finds the CSP rule among unrelated header rules',
    planCsp([...other, ...ro], 'enforcing', FIXTURE_POLICY).id,
    'r1'
  );
  check(
    'plans no CSP change when the mode AND the policy match',
    planCsp(ro, 'report-only', FIXTURE_POLICY).action,
    'none'
  );
  check(
    'plans an update when only the POLICY differs (#1110)',
    planCsp(
      ro,
      'report-only',
      "default-src 'self'; frame-src https://app.cal.com"
    ).action,
    'update'
  );
  check(
    'and reports that the value is what changed, so the dry run can show a diff',
    planCsp(
      ro,
      'report-only',
      "default-src 'self'; frame-src https://app.cal.com"
    ).valueChanged,
    true
  );
  check(
    'writes the intended policy, not the one already there (#1110)',
    planCsp(ro, 'report-only', 'default-src NEW').headers[
      'Content-Security-Policy-Report-Only'
    ].value,
    'default-src NEW'
  );
  check(
    'plans the flip to enforcing',
    planCsp(ro, 'enforcing', FIXTURE_POLICY).to,
    'Content-Security-Policy'
  );
  check(
    'finds the rule again AFTER the flip, so it can be reverted',
    planCsp(
      [
        {
          id: 'r1',
          action_parameters: {
            headers: {
              'Content-Security-Policy': { operation: 'set', value: 'x' },
            },
          },
        },
      ],
      'report-only',
      FIXTURE_POLICY
    ).to,
    'Content-Security-Policy-Report-Only'
  );
  check(
    'keeps the policy value across a rename when intent matches it',
    planCsp(ro, 'enforcing', FIXTURE_POLICY).headers['Content-Security-Policy']
      .value,
    "default-src 'self'"
  );
  check(
    'skips when no rule sets a CSP',
    planCsp(other, 'enforcing').action,
    'skip'
  );
  check(
    'refuses two competing CSP rules',
    planCsp(
      [
        ...ro,
        {
          id: 'r2',
          action_parameters: {
            headers: {
              'Content-Security-Policy': { operation: 'set', value: 'y' },
            },
          },
        },
      ],
      'enforcing'
    ).action,
    'skip'
  );

  /* ------------------------------------------------ the cache contract (#1199) ---- */

  // THE ROUND-TRIP PIN. Captured verbatim from the live rule on 2026-09-22, BEFORE any
  // of this ran. If `revalidateExpression(null)` ever stops reproducing it, #1199's
  // widening has silently rewritten #635's document condition — the one outcome this
  // whole design exists to make impossible. This replaces a citation in
  // cloudflare-intent.mjs that named a test file which has never existed.
  const LIVE_DOC_EXPRESSION =
    '(ends_with(http.request.uri.path, "/") or ends_with(http.request.uri.path, ".html")) and not starts_with(http.request.uri.path, "/_next/")';
  check(
    'the document condition round-trips byte-for-byte (#635 unchanged by #1199)',
    revalidateExpression(null),
    LIVE_DOC_EXPRESSION
  );
  check(
    'and the widened expression still CONTAINS it, rather than replacing it',
    revalidateExpression().includes(LIVE_DOC_EXPRESSION),
    true
  );

  const CACHE_INTENT = cacheIntent();
  check(
    'error TTLs use status_code_range, the documented shape (a bare status_code 400s)',
    CACHE_INTENT.statusCodeTtl,
    [
      { status_code_range: { from: 404, to: 404 }, value: 60 },
      { status_code_range: { from: 500, to: 599 }, value: 30 },
    ]
  );
  // The browser half and the edge half must cover the SAME codes. They are generated
  // from one array precisely so this cannot drift; assert it anyway, because "generated
  // from one array" is a property of today's code, not a guarantee about tomorrow's.
  check(
    'the expression and the TTL array agree on which codes are errors',
    CACHE_INTENT.statusCodeTtl.every(
      (t) =>
        CACHE_INTENT.revalidateExpression.includes(
          String(t.status_code_range.from)
        ) &&
        CACHE_INTENT.revalidateExpression.includes(
          String(t.status_code_range.to)
        )
    ),
    true
  );

  const liveHeaderRules = [
    {
      id: 'h1',
      action: 'rewrite',
      enabled: true,
      expression: LIVE_DOC_EXPRESSION,
      description: '#635: HTML must revalidate',
      action_parameters: {
        headers: {
          'cache-control': { operation: 'set', value: 'no-cache' },
          'x-thing': { operation: 'set', value: 'keep me' },
        },
      },
    },
    ...ro,
  ];
  check(
    'finds the cache-control rule among unrelated header rules',
    planErrorHeaders(liveHeaderRules).id,
    'h1'
  );
  check(
    'does NOT match the CSP rule (cross-contamination, one direction)',
    planErrorHeaders(ro).action,
    'skip'
  );
  check(
    // 'enforcing' so the plan is an update and therefore carries an id: in 'report-only'
    // this fixture already matches intent and returns `none`, which has no id at all.
    'and planCsp still picks the CSP rule, not the cache-control one (other direction)',
    planCsp(liveHeaderRules, 'enforcing', FIXTURE_POLICY).id,
    'r1'
  );
  check(
    'plans an update while the expression still matches documents only',
    planErrorHeaders(liveHeaderRules).action,
    'update'
  );
  check(
    'and PRESERVES unrelated headers on that rule',
    planErrorHeaders(liveHeaderRules).headers['x-thing'].value,
    'keep me'
  );
  check(
    'plans no change once the rule already carries the widened expression',
    planErrorHeaders([
      {
        ...liveHeaderRules[0],
        expression: CACHE_INTENT.revalidateExpression,
        description: CACHE_INTENT.descriptions.revalidate,
      },
    ]).action,
    'none'
  );
  check(
    'skips when no rule sets cache-control',
    planErrorHeaders(ro).action,
    'skip'
  );
  check(
    'refuses two competing cache-control rules',
    planErrorHeaders([liveHeaderRules[0], { ...liveHeaderRules[0], id: 'h2' }])
      .action,
    'skip'
  );

  const liveCacheRules = [
    {
      id: 'c1',
      action: 'set_cache_settings',
      enabled: true,
      expression: 'starts_with(http.request.uri.path, "/_next/static/")',
      description: '#635: hashed assets are immutable',
      action_parameters: {
        cache: true,
        browser_ttl: { default: 31536000, mode: 'override_origin' },
        edge_ttl: { default: 31536000, mode: 'override_origin' },
        serve_stale: { disable_stale_while_updating: true },
      },
    },
  ];
  check(
    'plans an update when the cache rule has no status_code_ttl',
    planErrorEdgeTtl(liveCacheRules).action,
    'update'
  );
  // THE HIGHEST-VALUE CASE. Rebuilding action_parameters from declared intent would drop
  // browser_ttl, serve_stale and `cache` while reading like a tightening — the exact
  // loosening trap rewriteDmarc exists to document.
  check(
    'and PRESERVES browser_ttl, serve_stale and cache, which it never declared',
    (() => {
      const p = planErrorEdgeTtl(liveCacheRules).actionParameters;
      return [
        p.browser_ttl?.default,
        p.serve_stale?.disable_stale_while_updating,
        p.cache,
      ];
    })(),
    [31536000, true, true]
  );
  check(
    'keeps the one-year edge default for responses that are not errors',
    planErrorEdgeTtl(liveCacheRules).actionParameters.edge_ttl.default,
    31536000
  );
  check(
    'plans no change once the error TTLs are already capped',
    planErrorEdgeTtl([
      {
        ...liveCacheRules[0],
        action_parameters: {
          ...liveCacheRules[0].action_parameters,
          edge_ttl: {
            default: 31536000,
            mode: 'override_origin',
            status_code_ttl: CACHE_INTENT.statusCodeTtl,
          },
        },
      },
    ]).action,
    'none'
  );
  // NEGATIVE CONTROL for the case above: without it, a planner that compared only
  // status_code_ttl and never looked at the #635 one-year default would still pass.
  check(
    'but still updates when the TTLs are right and the one-year default has DRIFTED',
    planErrorEdgeTtl([
      {
        ...liveCacheRules[0],
        action_parameters: {
          ...liveCacheRules[0].action_parameters,
          edge_ttl: {
            default: 600,
            mode: 'override_origin',
            status_code_ttl: CACHE_INTENT.statusCodeTtl,
          },
        },
      },
    ]).action,
    'update'
  );
  check(
    'skips when no cache rule matches the hashed-asset prefix',
    planErrorEdgeTtl([]).action,
    'skip'
  );
  check(
    'refuses two competing cache rules',
    planErrorEdgeTtl([liveCacheRules[0], { ...liveCacheRules[0], id: 'c2' }])
      .action,
    'skip'
  );
  check(
    'planCache returns the browser half FIRST, so a rejected expression aborts early',
    planCache({ headers: liveHeaderRules, cache: liveCacheRules }).map(
      (p) => p.kind
    ),
    ['cache-browser', 'cache-edge']
  );

  let bad = 0;
  for (const [label, ok, got, want] of cases) {
    if (!ok) {
      console.error(
        `  FAILED: ${label}\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`
      );
      bad++;
    }
  }
  if (bad) process.exit(1);
  console.log(`selftest ok: ${cases.length} planner cases, no network`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(`[cf-apply] ${err.message}`);
    process.exit(1);
  });
}
