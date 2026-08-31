/**
 * Refuse an admin RPC response that carries no data (#1029).
 *
 * WHY THIS EXISTS. Every admin RPC used to answer an authorisation refusal the same way — ten
 * functions in the monolithic migration:
 *
 *     IF NOT is_admin() THEN
 *       RETURN '{}'::json;
 *     END IF;
 *
 * — a SUCCESSFUL response containing nothing. The services then `data as SomeType`, which is a compile-time
 * assertion and no check at all, so `{}` becomes an object whose every field is
 * `undefined`. The page sets `users = undefined`, renders its empty state, leaves
 * `error` null, and the console stays clean.
 *
 * The cost is not the empty table. It is that "you are not an admin", "the RPC
 * changed shape" and "there are genuinely no rows" are one indistinguishable
 * outcome, at the database boundary and in every consumer above it — which is how
 * four E2E tests failed for months with nothing anywhere naming a cause (#914).
 *
 * THE SQL IS FIXED TOO, as of the same issue: all ten admin RPCs now
 * `RAISE EXCEPTION ... USING ERRCODE = '42501'` (insufficient_privilege, which
 * PostgREST returns as 403) instead of answering with an empty object. So a
 * refusal now arrives as an error and never reaches this function.
 *
 * This stays, and is not redundant. It catches the OTHER thing the blind cast
 * absorbed: an RPC whose shape has drifted from the type the client asserts. That
 * failure mode is unaffected by the SQL change, and `data as SomeType` is still a
 * compile-time assertion that checks nothing at runtime.
 */

/** Fields whose absence means the response carried nothing usable. */
export function requireRpcData<T>(
  data: unknown,
  rpc: string,
  requiredKeys: readonly (keyof T & string)[]
): T {
  if (data === null || data === undefined) {
    throw new Error(
      `${rpc} returned no data. The most likely cause is that the calling ` +
        'session is not recognised as an admin — these RPCs answer a refusal ' +
        'with an empty result rather than an error (#1029).'
    );
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(
      `${rpc} returned ${Array.isArray(data) ? 'an array' : typeof data}, expected an object.`
    );
  }

  const missing = requiredKeys.filter((k) => !(k in (data as object)));
  if (missing.length > 0) {
    // The empty-object refusal lands here, and so does a genuine shape change.
    // Both are worth stopping on; neither should be silently absorbed.
    throw new Error(
      `${rpc} returned an object missing ${missing.map((m) => `\`${m}\``).join(', ')}. ` +
        (missing.length === requiredKeys.length
          ? 'It returned an EMPTY object, which is how these RPCs signal "not an ' +
            'admin" — the calling session is probably not recognised as one (#1029).'
          : 'The RPC shape and this client have diverged.')
    );
  }

  return data as T;
}
