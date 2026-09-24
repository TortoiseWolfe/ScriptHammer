/**
 * What an anonymous Edge Function does with the rate limiter's answer (#1245 stage A3, #1237).
 *
 * `consume_rate_limit` counts the request and decides in one statement, so the answer is final:
 * `{ allowed: true }` means this request is inside the budget and has already been counted.
 * Anything else is not permission. The handlers used to test `limit && limit.allowed === false`,
 * which let a null answer — or one without `allowed` — straight through: a limiter failing OPEN
 * on exactly the answers nobody expects, in files whose comments insist it must fail closed.
 *
 * Imports nothing, so `tests/unit/limiter-verdict.test.ts` can load it directly — a rule written
 * inside `Deno.serve` is a rule nothing tests.
 */
export type LimiterVerdict = 'proceed' | 'refused' | 'unavailable';

export function limiterVerdict(result: {
  data: unknown;
  error: unknown;
}): LimiterVerdict {
  if (result.error) return 'unavailable';
  const allowed = (result.data as { allowed?: unknown } | null)?.allowed;
  if (allowed === true) return 'proceed';
  if (allowed === false) return 'refused';
  return 'unavailable';
}
