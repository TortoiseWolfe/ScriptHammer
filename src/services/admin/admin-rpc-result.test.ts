import { describe, it, expect } from 'vitest';
import { requireRpcData } from './admin-rpc-result';

/**
 * The case that matters is the FIRST one: an empty object is what every admin RPC
 * returns when `is_admin()` is false, and casting it with `as T` produced an
 * object whose every field was `undefined`. Four E2E tests failed on that for
 * months with nothing naming a cause (#1029, found via #914).
 */
describe('requireRpcData', () => {
  it('names the refusal when the RPC returns an empty object', () => {
    // The exact shape of `RETURN '{}'::json`.
    expect(() =>
      requireRpcData({}, 'admin_list_users', ['total', 'users'])
    ).toThrow(/EMPTY object.*not an admin/s);
  });

  it('says which fields are missing when the shape has merely diverged', () => {
    // Distinct message on purpose: a partial response is a contract drift, not an
    // authorisation problem, and conflating them sends the reader to the wrong place.
    expect(() =>
      requireRpcData({ total: 3 }, 'admin_list_users', ['total', 'users'])
    ).toThrow(/missing `users`.*diverged/s);
  });

  it('rejects null and undefined', () => {
    expect(() =>
      requireRpcData(null, 'admin_user_stats', ['total_users'])
    ).toThrow(/returned no data/);
    expect(() =>
      requireRpcData(undefined, 'admin_user_stats', ['total_users'])
    ).toThrow(/returned no data/);
  });

  it('rejects an array, which is a different RPC contract entirely', () => {
    expect(() => requireRpcData([], 'admin_list_users', ['total'])).toThrow(
      /returned an array/
    );
  });

  it('names the RPC in every message, so the error points somewhere', () => {
    expect(() => requireRpcData({}, 'admin_payment_stats', ['gross'])).toThrow(
      /admin_payment_stats/
    );
  });

  it('PASSES a genuinely empty result set through', () => {
    // The distinction the old code could not make: zero rows is a valid answer and
    // must not be treated as a refusal.
    const empty = { total: 0, users: [] };
    expect(requireRpcData(empty, 'admin_list_users', ['total', 'users'])).toBe(
      empty
    );
  });

  it('passes a populated result through unchanged', () => {
    const full = { total: 61, users: [{ id: 'u1' }] };
    expect(requireRpcData(full, 'admin_list_users', ['total', 'users'])).toBe(
      full
    );
  });

  it('accepts a present-but-falsy field', () => {
    // `in`, not truthiness: `total: 0` is present and meaningful. A truthiness
    // check here would reject the empty-but-valid page this exists to allow.
    expect(() =>
      requireRpcData({ total: 0, users: [] }, 'x', ['total', 'users'])
    ).not.toThrow();
  });
});
