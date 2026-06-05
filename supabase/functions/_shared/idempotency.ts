/**
 * Shared idempotency helper for outbound payment Edge Functions (#106).
 *
 * Payment operations must not double-charge on retry (network blips, the
 * offline queue replaying a request, a user double-clicking). These helpers
 * give a function a cheap "have I already done this exact operation?" check
 * keyed on a caller-supplied Idempotency-Key header.
 *
 * Storage: the existing `payment_intents.idempotency_key` column is per-intent,
 * not general-purpose, so this uses a dedicated `edge_idempotency_keys` table
 * (created idempotently by the monolithic migration). A row records the key,
 * the function name, and the JSON result that was returned, so a replay can
 * return the SAME response instead of re-calling the provider.
 *
 * Usage in a function:
 *   const key = req.headers.get('Idempotency-Key');
 *   if (key) {
 *     const hit = await checkIdempotencyKey(supabase, key, 'create-paypal-order');
 *     if (hit.cached) return jsonResponse(req, hit.result, 200);
 *   }
 *   ... do the work, build `result` ...
 *   if (key) await recordIdempotencyKey(supabase, key, 'create-paypal-order', result);
 *   return jsonResponse(req, result);
 *
 * The check is best-effort: if the idempotency table is unavailable the
 * function should still proceed (correctness of the provider call is owned by
 * the provider's own idempotency where available, e.g. Stripe's Idempotency-Key).
 */

// Minimal structural type — avoids importing the full supabase-js types here;
// the caller passes a real SupabaseClient created with the service-role key.
interface MinimalSupabase {
  from(table: string): {
    select(cols: string): {
      eq(
        col: string,
        val: string
      ): {
        eq(
          col: string,
          val: string
        ): {
          maybeSingle(): Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
    insert(row: Record<string, unknown>): Promise<{ error: unknown }>;
  };
}

const TABLE = 'edge_idempotency_keys';

export interface IdempotencyHit {
  /** true when this (key, fnName) pair was already recorded. */
  cached: boolean;
  /** the previously-returned result body, when cached. */
  result?: Record<string, unknown>;
}

/**
 * Look up a prior result for (key, fnName). Returns { cached:false } on miss
 * OR on any error (fail-open — never block a real payment on the idempotency
 * store being unavailable).
 */
export async function checkIdempotencyKey(
  supabase: MinimalSupabase,
  key: string,
  fnName: string
): Promise<IdempotencyHit> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('result')
      .eq('idempotency_key', key)
      .eq('function_name', fnName)
      .maybeSingle();
    if (error || !data) return { cached: false };
    const row = data as { result?: Record<string, unknown> };
    return { cached: true, result: row.result ?? {} };
  } catch {
    return { cached: false };
  }
}

/**
 * Record the result for (key, fnName). Best-effort: a unique-violation (a
 * concurrent request recorded first) or any other error is swallowed — the
 * worst case is we don't dedupe a rare race, never a thrown payment error.
 */
export async function recordIdempotencyKey(
  supabase: MinimalSupabase,
  key: string,
  fnName: string,
  result: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from(TABLE).insert({
      idempotency_key: key,
      function_name: fnName,
      result,
    });
  } catch {
    // swallow — see doc comment
  }
}
