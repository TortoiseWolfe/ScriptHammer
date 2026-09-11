import { createLogger } from '@/lib/logger';

const logger = createLogger('lib:leads');

/**
 * Where a visitor asked to book from.
 *
 * Must stay in step with `leads_source_check` in the migration and `LEAD_SOURCES` in
 * `create-lead/resolve.ts`. A value the database refuses arrives in the browser as a 500.
 */
export type LeadSource = 'pricing' | 'schedule' | 'checkout';

/**
 * Record that somebody asked to book, and return the id that identifies them (#562).
 *
 * THE ID IS MINTED HERE, NOT BY THE SERVER, and that is the whole shape of this function.
 * It has to be available to the caller *immediately* — it becomes the booking's hidden
 * `lead_ref`, which is the only thing tying a booking back to the click that started it.
 * Waiting for `create-lead` to answer meant waiting on an Edge Function cold start, and a
 * cold start silently lost the attribution for the first visitor after any quiet period
 * (#1166). Returning the id synchronously and recording in the background removes the race
 * entirely.
 *
 * NOTHING HERE IS ALLOWED TO COST A VISITOR THEIR BOOKING. Every failure — unconfigured,
 * offline, rate-limited, no `crypto.randomUUID` — returns null or logs and moves on. The
 * worst outcome is an unattributed booking, which is what happened for every booking before
 * any of this existed.
 *
 * `keepalive` is load-bearing for the callers that navigate immediately afterwards: without
 * it the request is cancelled the moment the page starts unloading, which is exactly when
 * it is sent.
 */
export function recordLead(
  source: LeadSource,
  productId?: string
): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anon) return null;
  if (typeof crypto?.randomUUID !== 'function') return null;

  const id = crypto.randomUUID();

  void fetch(`${base}/functions/v1/create-lead`, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({
      id,
      source,
      ...(productId ? { product_id: productId } : {}),
    }),
  }).catch((error) => {
    // Logged, never surfaced. A 429 here is the rate limiter working as designed, not
    // something a visitor should be told about.
    logger.info('Lead not recorded', { source, error: String(error) });
  });

  return id;
}

/** Where `/schedule` remembers the lead it minted, so a refresh is not a second visitor. */
export const SCHEDULE_LEAD_KEY = 'sh:lead:schedule';

/**
 * The lead id for a direct arrival at the booking page, minted once per browser session.
 *
 * WHY A SESSION, NOT A PAGE LOAD. Reloading the calendar is the same person still deciding,
 * not a new enquiry. Keying on `sessionStorage` makes a refresh reuse the id — which keeps
 * the count honest AND keeps the booking attributable, because the embed carries the same
 * `lead_ref` either way.
 *
 * Every access is guarded: `sessionStorage` throws outright in some privacy modes, and a
 * booking page that crashes because it could not do its bookkeeping would be a poor trade.
 */
export function scheduleLeadId(): string | null {
  try {
    const existing = window.sessionStorage.getItem(SCHEDULE_LEAD_KEY);
    if (existing) return existing;
  } catch {
    // Storage unavailable. Record anyway — an occasional duplicate on refresh is a much
    // smaller problem than losing the attribution entirely.
  }

  const id = recordLead('schedule');
  if (!id) return null;

  try {
    window.sessionStorage.setItem(SCHEDULE_LEAD_KEY, id);
  } catch {
    // Recorded but not remembered. The booking is still attributable this time round.
  }
  return id;
}
