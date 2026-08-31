import { describe, it, expect } from 'vitest';
import {
  success,
  failure,
  isSuccess,
  isFailure,
  tryCatch,
  type ServiceResult,
} from './result';
import * as barrel from './index';

/**
 * `src/types/result.ts` shipped untested (#907).
 *
 * The module is small, but every service in the app funnels its errors through
 * it, so the things worth pinning are the ones a reader would assume rather
 * than check:
 *
 *   1. `failure` PASSES AN `Error` THROUGH BY IDENTITY — it does not re-wrap.
 *      Losing that loses the stack, the subclass and any custom fields the
 *      caller attached (Supabase's `PostgrestError`-shaped objects included).
 *   2. `failure('')` substitutes `'Unknown error'`, but `failure(new Error(''))`
 *      does NOT. The `|| 'Unknown error'` fallback sits inside the string
 *      branch only.
 *   3. `isSuccess`/`isFailure` are decided by `error`, NEVER by `data`. That
 *      distinction is invisible until `data` is legitimately `null`/`0`/`''`.
 *   4. `tryCatch` catches a SYNCHRONOUS throw too, because `fn()` is invoked
 *      inside the `try`, and it coerces a non-Error rejection with `String()`.
 *
 * SURPRISE, tested as-is rather than "fixed": the type's documented invariant
 * ("exactly one of data or error is non-null") is not enforced at runtime.
 * `success(null)` yields `{ data: null, error: null }` and reports as a
 * success. That is the correct behaviour for `ServiceResult<User | null>`
 * — "the lookup ran, there was no row" — so it is asserted, not changed.
 */

describe('success', () => {
  it('returns the exact { data, error: null } tuple', () => {
    const user = { id: '123', name: 'Ada' };
    expect(success(user)).toStrictEqual({ data: user, error: null });
  });

  it('keeps the payload by reference rather than cloning it', () => {
    // Services return live Supabase rows through this; a clone would break
    // identity comparisons and silently drop class instances.
    const payload = { nested: { count: 1 } };
    const result = success(payload);
    expect(result.data).toBe(payload);
  });

  it.each([
    ['zero', 0],
    ['empty string', ''],
    ['false', false],
    ['NaN', NaN],
  ])(
    'preserves the falsy value %s instead of treating it as absent',
    (_l, v) => {
      const result = success(v);
      expect(result.data).toEqual(v);
      expect(result.error).toBeNull();
      expect(isSuccess(result)).toBe(true);
    }
  );

  it('reports null data as a SUCCESS, not a failure (see file header)', () => {
    const result = success(null);
    expect(result).toStrictEqual({ data: null, error: null });
    expect(isSuccess(result)).toBe(true);
    expect(isFailure(result)).toBe(false);
  });

  it('reports undefined data as a success with error still null', () => {
    const result = success(undefined);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeNull();
    expect(isSuccess(result)).toBe(true);
  });
});

describe('failure', () => {
  it('returns the exact { data: null, error } tuple for a string', () => {
    const result = failure('User not found');
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('User not found');
  });

  it('passes an Error through by identity, keeping its stack', () => {
    const original = new Error('already an error');
    const result = failure(original);
    expect(result.error).toBe(original);
    expect(result.error?.stack).toBe(original.stack);
  });

  it('preserves an Error subclass and its custom fields', () => {
    class NotFoundError extends Error {
      constructor(public readonly code: number) {
        super('not found');
        this.name = 'NotFoundError';
      }
    }
    const original = new NotFoundError(404);
    const result = failure(original);
    expect(result.error).toBeInstanceOf(NotFoundError);
    expect((result.error as NotFoundError).code).toBe(404);
    expect(result.error?.name).toBe('NotFoundError');
  });

  it('substitutes "Unknown error" for an empty string', () => {
    // Documented special case: `new Error(error || 'Unknown error')`.
    expect(failure('').error?.message).toBe('Unknown error');
  });

  it('does NOT substitute for an Error whose message is empty', () => {
    // The `||` fallback lives in the string branch only. Collapsing the two
    // branches into `new Error(String(error) || 'Unknown error')` would make
    // this read 'Unknown error' — and would also destroy the identity above.
    const original = new Error('');
    const result = failure(original);
    expect(result.error).toBe(original);
    expect(result.error?.message).toBe('');
  });

  it.each([
    ['whitespace', ' '],
    ['zero-ish text', '0'],
    ['unicode', 'Ошибка: 数据库 ❌'],
  ])('keeps the truthy string %s verbatim', (_label, message) => {
    expect(failure(message).error?.message).toBe(message);
  });

  it('keeps a very long message intact', () => {
    const long = 'e'.repeat(10_000);
    const result = failure(long);
    expect(result.error?.message).toHaveLength(10_000);
    expect(result.error?.message).toBe(long);
  });

  it('reports as a failure and never as a success', () => {
    const result = failure('boom');
    expect(isFailure(result)).toBe(true);
    expect(isSuccess(result)).toBe(false);
  });
});

describe('isSuccess / isFailure', () => {
  it('decides on error, not on data — falsy data is still a success', () => {
    // If either guard were rewritten as `result.data !== null`, this line and
    // the null-data case below would flip.
    expect(isSuccess(success(0))).toBe(true);
    expect(isSuccess(success(''))).toBe(true);
    expect(isSuccess(success(null))).toBe(true);
    expect(isFailure(success(null))).toBe(false);
  });

  it('treats a malformed tuple carrying both fields as a failure', () => {
    // Not reachable through the helpers, but hand-built results exist in
    // services that construct the tuple literally. `error` wins.
    const malformed = {
      data: 'partial',
      error: new Error('boom'),
    } as unknown as ServiceResult<string>;
    expect(isFailure(malformed)).toBe(true);
    expect(isSuccess(malformed)).toBe(false);
  });

  it('is exactly complementary across every result the helpers produce', () => {
    const results: ServiceResult<unknown>[] = [
      success('ok'),
      success(0),
      success(null),
      success(undefined),
      failure('boom'),
      failure(new Error('boom')),
    ];
    for (const result of results) {
      expect(isSuccess(result)).toBe(!isFailure(result));
    }
    expect(results.filter(isSuccess)).toHaveLength(4);
    expect(results.filter(isFailure)).toHaveLength(2);
  });

  it('narrows the union so data/error are usable without a further check', () => {
    const result: ServiceResult<{ name: string }> = success({ name: 'Ada' });
    if (isSuccess(result)) {
      // Compiles only because the predicate narrows away `data: null`.
      expect(result.data.name).toBe('Ada');
    } else {
      throw new Error('isSuccess should have narrowed to the success arm');
    }

    const bad: ServiceResult<string> = failure('nope');
    if (isFailure(bad)) {
      expect(bad.error.message).toBe('nope');
    } else {
      throw new Error('isFailure should have narrowed to the failure arm');
    }
  });
});

describe('tryCatch', () => {
  it('resolves to a success carrying the resolved value by reference', async () => {
    const payload = { id: 7 };
    const result = await tryCatch(async () => payload);
    expect(result).toStrictEqual({ data: payload, error: null });
    expect(result.data).toBe(payload);
  });

  it('treats a resolved falsy value as a success', async () => {
    const zero = await tryCatch(async () => 0);
    expect(zero).toStrictEqual({ data: 0, error: null });
    expect(isSuccess(zero)).toBe(true);

    const nothing = await tryCatch(async () => undefined);
    expect(nothing.error).toBeNull();
    expect(isSuccess(nothing)).toBe(true);
  });

  it('calls fn exactly once', async () => {
    let calls = 0;
    await tryCatch(async () => {
      calls += 1;
      return calls;
    });
    expect(calls).toBe(1);
  });

  it('converts a rejection into a failure, keeping the Error identity', async () => {
    const boom = new Error('fetch failed');
    const result = await tryCatch(async () => {
      throw boom;
    });
    expect(result.data).toBeNull();
    expect(result.error).toBe(boom);
    expect(isFailure(result)).toBe(true);
  });

  it('preserves an Error subclass thrown by fn', async () => {
    class TimeoutError extends Error {}
    const original = new TimeoutError('too slow');
    const result = await tryCatch(async () => {
      throw original;
    });
    expect(result.error).toBeInstanceOf(TimeoutError);
    expect(result.error).toBe(original);
  });

  it('catches a SYNCHRONOUS throw, because fn() is invoked inside the try', async () => {
    // A non-async `fn` that throws before returning a promise would escape a
    // naive `fn().catch(...)` implementation and reject the caller instead.
    const boom = new Error('threw before awaiting');
    const thrower = (): Promise<string> => {
      throw boom;
    };
    const result = await tryCatch(thrower);
    expect(result.error).toBe(boom);
    expect(result.data).toBeNull();
  });

  const nonErrorRejections: Array<[string, unknown, string]> = [
    ['a string', 'plain string throw', 'plain string throw'],
    ['a number', 404, '404'],
    ['null', null, 'null'],
    ['undefined', undefined, 'undefined'],
    ['a plain object', { code: 'PGRST116' }, '[object Object]'],
  ];

  it.each(nonErrorRejections)(
    'wraps %s rejection in a real Error via String()',
    async (_label, thrown, expectedMessage) => {
      const result = await tryCatch(async () => {
        throw thrown;
      });
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe(expectedMessage);
      expect(result.data).toBeNull();
    }
  );

  it('never rejects — the returned promise always settles as a ServiceResult', async () => {
    // The whole point of the wrapper: callers must not need their own catch.
    await expect(
      tryCatch(async () => {
        throw new Error('boom');
      })
    ).resolves.toMatchObject({ data: null });
  });

  it('awaits the promise rather than returning it as the data', async () => {
    const result = await tryCatch(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return 'resolved value';
    });
    expect(result.data).toBe('resolved value');
    expect(result.data).not.toBeInstanceOf(Promise);
  });
});

describe('barrel re-export from @/types', () => {
  it('exposes the same function references as ./result', () => {
    // `src/types/index.ts` re-exports these by name; dropping one from the
    // barrel is invisible to this module's own tests but breaks every
    // `import { success } from '@/types'` caller.
    expect(barrel.success).toBe(success);
    expect(barrel.failure).toBe(failure);
    expect(barrel.isSuccess).toBe(isSuccess);
    expect(barrel.isFailure).toBe(isFailure);
    expect(barrel.tryCatch).toBe(tryCatch);
  });
});
