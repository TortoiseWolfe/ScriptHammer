/**
 * Idempotency for money-moving Edge Functions (#106, reworked for #558).
 *
 * WHAT CHANGED AND WHY. The previous version exported `checkIdempotencyKey` /
 * `recordIdempotencyKey`. Both are gone. They had **zero call sites** in the two
 * years they existed, so nothing breaks — and they had three properties that made
 * them unsafe for the first function that actually needed them:
 *
 *   1. FAIL-OPEN. A lookup error was indistinguishable from a cache miss, so the
 *      guard silently stopped guarding at exactly the moment something was
 *      already wrong.
 *   2. The insert's `{ error }` was DISCARDED, and the call was also wrapped in a
 *      bare `catch {}` — a failed write was silent through two independent paths.
 *   3. CHECK-THEN-WORK. Two concurrent requests with the same key could both pass
 *      the check before either wrote, which is precisely the double-submit case
 *      the key exists to prevent.
 *
 * THE PROTOCOL NOW IS CLAIM-THEN-WORK. The key row is inserted BEFORE the work,
 * so the unique constraint on (idempotency_key, function_name) is the arbiter:
 * one request wins the insert, any other reads the winner's row. The result is
 * written back afterwards.
 *
 * FAILURE POLICY IS THE CALLER'S. These functions report what happened —
 * `unavailable` is a distinct state from `miss` — and the caller decides whether
 * to refuse or proceed. create-order refuses (it writes its own orders and
 * payment_intents rows before any provider is involved, so nothing downstream
 * would collapse a duplicate). A function whose provider dedupes downstream, as
 * Stripe does on its own Idempotency-Key, may reasonably proceed.
 */

/** Structural type covering exactly the chains used below. */
interface MinimalSupabase {
  from(table: string): {
    insert(row: Record<string, unknown>): Promise<{ error: unknown }>;
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
    update(row: Record<string, unknown>): {
      eq(
        col: string,
        val: string
      ): {
        eq(col: string, val: string): Promise<{ error: unknown }>;
      };
    };
  };
}

const TABLE = 'edge_idempotency_keys';

/** Postgres unique_violation. A conflict here is expected, not exceptional. */
const UNIQUE_VIOLATION = '23505';

export type IdempotencyClaim =
  /** The key is ours. Do the work. */
  | { state: 'miss' }
  /** Someone already completed this key. Replay `result`. */
  | {
      state: 'hit';
      result: Record<string, unknown>;
      fingerprint: string | null;
    }
  /**
   * We could not establish either. Includes the in-flight case: another request
   * holds the claim but has not written its result yet, so there is nothing to
   * replay AND it is not safe to proceed.
   */
  | { state: 'unavailable'; reason: string };

function errCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null
    ? ((error as { code?: string }).code ?? undefined)
    : undefined;
}

function errMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const m = (error as { message?: string }).message;
    if (typeof m === 'string') return m;
  }
  return String(error);
}

/**
 * Stake a claim on (key, fnName) before doing any work.
 *
 * Returns `miss` when the claim was won, `hit` when a completed result already
 * exists, and `unavailable` for every ambiguous case — including a claim held by
 * an in-flight request.
 */
export async function claimIdempotencyKey(
  supabase: MinimalSupabase,
  key: string,
  fnName: string,
  requestFingerprint: string
): Promise<IdempotencyClaim> {
  try {
    const { error } = await supabase.from(TABLE).insert({
      idempotency_key: key,
      function_name: fnName,
      request_fingerprint: requestFingerprint,
      result: {},
    });

    if (!error) return { state: 'miss' };

    if (errCode(error) !== UNIQUE_VIOLATION) {
      // NOT swallowed. A missing table, an RLS denial or a network fault all
      // land here, and the caller must be able to tell that apart from a miss.
      return {
        state: 'unavailable',
        reason: `idempotency claim failed: ${errMessage(error)}`,
      };
    }

    // Someone else holds the key. Read their row.
    const { data, error: readError } = await supabase
      .from(TABLE)
      .select('result, request_fingerprint')
      .eq('idempotency_key', key)
      .eq('function_name', fnName)
      .maybeSingle();

    if (readError || !data) {
      return {
        state: 'unavailable',
        reason: `idempotency row unreadable after conflict: ${errMessage(readError)}`,
      };
    }

    const row = data as {
      result?: Record<string, unknown> | null;
      request_fingerprint?: string | null;
    };
    const result = row.result ?? {};

    // An empty result means the winner claimed but has not finished. Replaying
    // `{}` would hand the caller a successful-looking response describing no
    // order at all, so this is explicitly not a hit.
    if (Object.keys(result).length === 0) {
      return {
        state: 'unavailable',
        reason: 'a request with this Idempotency-Key is still in flight',
      };
    }

    return {
      state: 'hit',
      result,
      fingerprint: row.request_fingerprint ?? null,
    };
  } catch (err) {
    return {
      state: 'unavailable',
      reason: `idempotency claim threw: ${errMessage(err)}`,
    };
  }
}

/**
 * Write the result back against a claim already held.
 *
 * Returns rather than throws, and never swallows: the caller logs it. This is
 * deliberately non-fatal at the call site — by the time it runs the order exists,
 * and telling the buyer otherwise would be worse than losing the replay.
 */
export async function completeIdempotencyKey(
  supabase: MinimalSupabase,
  key: string,
  fnName: string,
  result: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from(TABLE)
      .update({ result })
      .eq('idempotency_key', key)
      .eq('function_name', fnName);
    if (error) return { ok: false, error: errMessage(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMessage(err) };
  }
}
