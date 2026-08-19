/**
 * Sweep orphaned intake uploads (#560, T023).
 *
 * A buyer uploads attachments to `intake-uploads` and only afterwards submits the
 * order that references them. Abandon the form and the files stay forever: nothing
 * else in the system ever removes them, so the bucket grows without bound and holds
 * customer material long past any reason to keep it.
 *
 * DEFAULTS TO REPORT-ONLY, AND THAT IS NOT TIMIDITY. This endpoint deletes files a
 * customer sent and cannot resend. If the orphan rule is wrong by one join, the
 * first live run destroys them with no undo. So `mode=report` — the default, and
 * what the schedule sends — lists exactly what it WOULD delete and deletes nothing.
 * Turning on `mode=delete` is a separate, deliberate act after those reports have
 * been read.
 *
 * SERVICE ROLE ONLY. It enumerates and removes other people's files, so it must
 * never be reachable with a user's token. It checks the caller's key against
 * `SUPABASE_SERVICE_ROLE_KEY` and refuses anything else.
 *
 * The decision itself is in `_shared/intake-orphans.ts` as a pure function, unit
 * tested at `tests/unit/intake-orphans.test.ts`. This file is the plumbing.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { findOrphans, referencedPaths } from '../_shared/intake-orphans.ts';

const BUCKET = 'intake-uploads';
/**
 * Uploads younger than this are never touched. FLOORED AT ONE DAY, deliberately.
 *
 * Now that the schedule actually deletes, this number is the only thing standing
 * between the sweep and a file a buyer uploaded seconds ago while still filling in
 * the form. `Number('')`, `Number('abc')` and `Number('0')` all produce a value that
 * would delete everything unreferenced in the bucket — the first two silently, via
 * NaN comparisons. A misconfigured or empty secret must degrade to the safe default,
 * not to zero.
 */
const GRACE_DAYS = (() => {
  const raw = Number(Deno.env.get('INTAKE_ORPHAN_GRACE_DAYS') ?? '7');
  return Number.isFinite(raw) && raw >= 1 ? raw : 7;
})();
/** Storage lists a page at a time; bounded so one run cannot spin forever. */
const PAGE = 100;
const MAX_PAGES = 200;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const presented = (req.headers.get('Authorization') ?? '').replace(
    /^Bearer\s+/i,
    ''
  );
  // Constant work regardless of outcome is not the concern here; being reachable
  // by a signed-in user would be. Anything but the service role is refused.
  if (!serviceKey || presented !== serviceKey) {
    return json({ error: 'service role required' }, 401);
  }

  const url = new URL(req.url);
  const mode = (url.searchParams.get('mode') ?? 'report').toLowerCase();
  if (mode !== 'report' && mode !== 'delete') {
    return json({ error: `unknown mode '${mode}' (report|delete)` }, 400);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);

  // EVERY order, not just recent ones: a file referenced by a two-year-old order is
  // not an orphan, and a bounded query here would quietly make it one.
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('intake_data');
  if (ordersError) {
    return json(
      { error: `could not read orders: ${ordersError.message}` },
      500
    );
  }
  const referenced = referencedPaths((orders ?? []).map((o) => o.intake_data));

  // Storage lists per prefix; intake paths are `<user-id>/<file>`, so walk the
  // top level and then each user folder.
  const objects: { name: string; created_at?: string | null }[] = [];
  const { data: folders, error: rootError } = await supabase.storage
    .from(BUCKET)
    .list('', { limit: PAGE });
  if (rootError) {
    return json({ error: `could not list bucket: ${rootError.message}` }, 500);
  }

  let truncated = false;
  for (const folder of folders ?? []) {
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data: files, error } = await supabase.storage
        .from(BUCKET)
        .list(folder.name, { limit: PAGE, offset: page * PAGE });
      if (error) {
        return json(
          { error: `could not list ${folder.name}: ${error.message}` },
          500
        );
      }
      for (const f of files ?? []) {
        objects.push({
          name: `${folder.name}/${f.name}`,
          created_at: f.created_at ?? null,
        });
      }
      if ((files ?? []).length < PAGE) break;
      if (page === MAX_PAGES - 1) truncated = true;
    }
  }

  const result = findOrphans({
    objects,
    referenced,
    graceDays: GRACE_DAYS,
    now: new Date(),
  });

  const summary = {
    mode,
    bucket: BUCKET,
    graceDays: GRACE_DAYS,
    scanned: objects.length,
    referenced: result.referenced.length,
    tooYoung: result.tooYoung.length,
    // Never silently dropped: an object we could not date is reported so somebody
    // can look, rather than being guessed about in either direction.
    undated: result.undated.map((o) => o.name),
    orphans: result.orphans.map((o) => o.name),
    // A truncated listing means the sweep did NOT see everything, so "0 orphans"
    // would be a claim it has not earned.
    truncated,
    deleted: [] as string[],
  };

  if (mode === 'report') {
    return json({ ...summary, note: 'report mode — nothing was deleted' });
  }

  if (result.orphans.length > 0) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove(result.orphans.map((o) => o.name));
    if (error) {
      return json(
        { ...summary, error: `delete failed: ${error.message}` },
        500
      );
    }
    summary.deleted = summary.orphans;
  }
  return json(summary);
});
