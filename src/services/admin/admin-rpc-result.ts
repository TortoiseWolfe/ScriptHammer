/**
 * Refuse an admin RPC response that carries no data (#1029).
 *
 * WHY THIS EXISTS. Every admin RPC answers an authorisation refusal the same way:
 *
 *     IF NOT is_admin() THEN
 *       RETURN '{}'::json;
 *     END IF;
 *
 * — a SUCCESSFUL response containing nothing. Seven functions in the monolithic
 * migration do it. The services then `data as SomeType`, which is a compile-time
 * assertion and no check at all, so `{}` becomes an object whose every field is
 * `undefined`. The page sets `users = undefined`, renders its empty state, leaves
 * `error` null, and the console stays clean.
 *
 * The cost is not the empty table. It is that "you are not an admin", "the RPC
 * changed shape" and "there are genuinely no rows" are one indistinguishable
 * outcome, at the database boundary and in every consumer above it — which is how
 * four E2E tests failed for months with nothing anywhere naming a cause (#914).
 *
 * This does not fix the SQL. Making those seven functions RAISE is the other half
 * and is deliberately not bundled here: it is production DDL that changes refusal
 * semantics on seven endpoints, and it deserves its own decision. Until then, this
 * is the layer that can tell the difference and say so.
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
