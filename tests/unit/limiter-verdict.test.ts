import { describe, it, expect } from 'vitest';
import { limiterVerdict } from '../../supabase/functions/_shared/limiter-verdict';

/**
 * What the two anonymous Edge Functions do with the limiter's answer (#1245 A3, #1237).
 *
 * The handlers used to test `limit && limit.allowed === false`, so a null answer, or one without
 * `allowed`, let the request through — a limiter that fails OPEN on exactly the answers nobody
 * expects, in files whose own comments insist it must fail closed. The decision lives here,
 * import-free, because a rule written inside `Deno.serve` is a rule nothing tests.
 */
describe('limiterVerdict (#1245 A3)', () => {
  const cases: [string, { data: unknown; error: unknown }, string][] = [
    ['an RPC error', { data: null, error: { message: 'boom' } }, 'unavailable'],
    [
      'an error beside an allowing answer',
      { data: { allowed: true }, error: { code: '42501' } },
      'unavailable',
    ],
    ['no answer at all', { data: null, error: null }, 'unavailable'],
    ['an answer without `allowed`', { data: {}, error: null }, 'unavailable'],
    [
      '`allowed` as a string',
      { data: { allowed: 'true' }, error: null },
      'unavailable',
    ],
    [
      'a refusal',
      { data: { allowed: false, locked_until: 'x' }, error: null },
      'refused',
    ],
    [
      'an allowance',
      { data: { allowed: true, remaining: 4 }, error: null },
      'proceed',
    ],
  ];

  for (const [name, input, want] of cases) {
    it(`${name} → ${want}`, () => {
      expect(limiterVerdict(input)).toBe(want);
    });
  }
});
