/**
 * Record that a visitor asked to book a call, before they have bought anything (#562 T038).
 *
 * WHY AN EDGE FUNCTION AND NOT AN RPC. `leads` has no client write path at all — `anon` and
 * `authenticated` are REVOKEd, and the only policy that permits anything is a SELECT for an
 * admin. This function holds the service-role key and is the sole writer. The alternative, a
 * `SECURITY DEFINER` RPC callable by `anon`, would put a bypass of RLS in the database where
 * every future reader has to notice it; this repo's standing position is that SECURITY
 * DEFINER to get around RLS is a hack, not a design.
 *
 * IT IS BROWSER-CALLED, SO IT NEEDS CORS — unlike the payment webhooks, which are
 * server-to-server and must not import the helper at all. And per #1153: `corsHeaders` is a
 * FUNCTION. `{ ...corsHeaders }` spreads a function, emits zero headers, type-checks
 * cleanly, and shipped that way in `sweep-intake-orphans` for months. Call it.
 *
 * EVERY DECISION LIVES IN `resolve.ts`, which imports nothing, so `tests/unit/` can load it
 * under Vitest. Nothing in CI executes an Edge Function: tsconfig excludes `supabase/`,
 * Vitest excludes `supabase/functions/**`, and `deno check` is deliberately not a required
 * check. A rule written inside this handler is a rule nothing tests.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { limiterVerdict } from '../_shared/limiter-verdict.ts';
import { ATTEMPT_TYPE, clientIp, resolveLead } from './resolve.ts';

/** Service-role client — `leads` has no other writer, and the limiter RPC is DEFINER. */
function adminClient() {
  const url =
    Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key);
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed' }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON body' }, 400);
  }

  const resolved = resolveLead(body);
  if (!resolved.ok) {
    return jsonResponse(req, { error: resolved.problems.join('; ') }, 400);
  }

  // ── rate limit ─────────────────────────────────────────────────────────────
  // AFTER validation, so malformed junk cannot burn a real visitor's budget, and BEFORE the
  // insert, so a limited caller costs us no rows. The same limiter contact-message uses.
  //
  // ONE CALL THAT COUNTS AND DECIDES (#1245 stage A3, #1237). This used to check before the
  // insert and record only after a successful one — two round trips, so a concurrent burst
  // all passed the check, and a record error was ignored outright. Now the attempt is spent
  // up front: an insert that then fails (a reused id, a SKU missing from `products`) still
  // counts. Legitimate clients never hit either — `record-lead.ts` mints a fresh id per call
  // and never retries — and the insert path itself is now capped, where it used to do
  // unlimited database work on failures.
  const ip = clientIp(req.headers);
  const admin = adminClient();

  if (!ip || !admin) {
    // FAIL CLOSED. An unlimited anonymous INSERT endpoint is the thing the limiter exists
    // to prevent, and "we could not check" is not a reason to skip the check — that is how
    // a limiter becomes decorative.
    console.error('create-lead cannot rate limit', {
      hasIp: Boolean(ip),
      hasAdmin: Boolean(admin),
    });
    return jsonResponse(req, { error: 'Could not record that' }, 503);
  }

  const limit = await admin.rpc('consume_rate_limit', {
    p_identifier: ip,
    p_attempt_type: ATTEMPT_TYPE,
    p_ip_address: ip,
  });
  const verdict = limiterVerdict(limit);

  if (verdict === 'unavailable') {
    console.error('create-lead rate limit unavailable', limit.error);
    return jsonResponse(req, { error: 'Could not record that' }, 503);
  }

  if (verdict === 'refused') {
    return jsonResponse(
      req,
      { error: 'Too many requests. Please try again shortly.' },
      429
    );
  }

  const { data: inserted, error: insertError } = await admin
    .from('leads')
    .insert(resolved.row)
    .select('id')
    .single();

  if (insertError) {
    // 23505 means the caller reused an id. Nothing is wrong with the click and the lead it
    // names already exists, so answering 409 lets the caller distinguish it from a real
    // failure without inventing a second row (#1166).
    if (insertError.code === '23505') {
      return jsonResponse(req, { error: 'That lead id already exists' }, 409);
    }
    console.error('create-lead insert failed', insertError);
    return jsonResponse(req, { error: 'Could not record that' }, 500);
  }

  // The id goes back so a later booking could be joined to this lead. Nothing can do that
  // join on Cal.com today — it does not deliver a correlation identifier in its webhook
  // payload (see #562) — so the caller currently ignores it. Returning it is what keeps
  // that option open without the caller having to change.
  return jsonResponse(req, { id: inserted.id }, 201);
});
