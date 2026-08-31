import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * `retry-utils.ts` had no test (#884). It is the thing standing between a
 * transient network blip and a signed-out user, so the interesting assertions
 * are about the SCHEDULE (how long it waits, and how many times it tries),
 * not merely "it eventually resolves".
 *
 * Everything here runs on fake timers. A test that really waits 1s + 2s to
 * watch a backoff is a seven-second flake generator; `advanceTimersByTimeAsync`
 * lets us assert the boundary — nothing at 999ms, a retry at 1000ms — which a
 * real-clock test could never do reliably.
 *
 * The logger is created at MODULE level (`const logger = createLogger(...)`),
 * so the mock has to exist before the module body runs — hence `vi.hoisted`.
 */

const mockLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => mockLogger),
}));

import { sleep, retryWithBackoff, retrySupabaseAuth } from './retry-utils';

/** Let pending microtasks (and any 0ms timers) settle without moving the clock. */
async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

type Settled<T> =
  | { status: 'fulfilled'; value: T }
  | { status: 'rejected'; reason: unknown };

/**
 * Attach handlers immediately. Advancing fake timers drives these promises to
 * completion, and a rejection with no handler yet attached surfaces as an
 * unhandled rejection that can fail an unrelated test file.
 */
function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  return promise.then(
    (value) => ({ status: 'fulfilled' as const, value }),
    (reason) => ({ status: 'rejected' as const, reason })
  );
}

/** The context object passed as the second arg of the Nth logger.warn call. */
function warnContext(index: number): Record<string, unknown> {
  const call = mockLogger.warn.mock.calls[index];
  expect(call, `expected a logger.warn call at index ${index}`).toBeDefined();
  return call[1] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sleep', () => {
  it('does not resolve one millisecond early', async () => {
    let resolved = false;
    void sleep(50).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(49);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(resolved).toBe(true);
  });

  it('schedules exactly one timer and clears it on resolve', async () => {
    const promise = settle(sleep(10));
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(10);
    expect(vi.getTimerCount()).toBe(0);
    expect(await promise).toEqual({ status: 'fulfilled', value: undefined });
  });

  it('resolves on the next tick for 0', async () => {
    let resolved = false;
    void sleep(0).then(() => {
      resolved = true;
    });

    // Not synchronous — it still goes through the timer queue.
    expect(resolved).toBe(false);

    await flush();
    expect(resolved).toBe(true);
  });

  it('treats a negative delay as 0 rather than never resolving', async () => {
    let resolved = false;
    void sleep(-1000).then(() => {
      resolved = true;
    });

    await flush();
    expect(resolved).toBe(true);
  });
});

describe('retryWithBackoff', () => {
  describe('the happy path', () => {
    it('returns the exact value the function resolved with, untouched', async () => {
      const session = { user: { id: 'abc' } };
      const fn = vi.fn().mockResolvedValue(session);

      await expect(retryWithBackoff(fn, 3, [1000, 2000])).resolves.toBe(
        session
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('passes an undefined resolution through instead of treating it as failure', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);

      await expect(retryWithBackoff(fn, 3)).resolves.toBeUndefined();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('neither sleeps nor warns when the first attempt succeeds', async () => {
      const fn = vi.fn().mockResolvedValue('ok');

      await retryWithBackoff(fn, 3, [1000, 2000]);

      expect(vi.getTimerCount()).toBe(0);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('the backoff schedule', () => {
    it('waits exactly delays[0] before the second attempt', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue('recovered');

      const promise = settle(retryWithBackoff(fn, 3, [1000, 2000]));

      await flush();
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(999);
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(fn).toHaveBeenCalledTimes(2);

      expect(await promise).toEqual({
        status: 'fulfilled',
        value: 'recovered',
      });
    });

    it('defaults to 3 attempts spaced 1000ms then 2000ms, with no delay after the last', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('down'));
      const promise = settle(retryWithBackoff(fn));

      await flush();
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(fn).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1999);
      expect(fn).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1);
      expect(fn).toHaveBeenCalledTimes(3);

      // The documented default third delay (4000) is never used at 3 attempts:
      // the loop sleeps between attempts, not after the final one.
      expect(vi.getTimerCount()).toBe(0);
      expect((await promise).status).toBe('rejected');
    });

    it('reuses the last delay when the array is shorter than the attempt count', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('down'));
      const promise = settle(retryWithBackoff(fn, 3, [100]));

      await flush();
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(100);
      expect(fn).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(99);
      expect(fn).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1);
      expect(fn).toHaveBeenCalledTimes(3);

      await promise;
    });

    it('SURPRISE: a delay of 0 is falsy, so it falls back to the LAST entry instead of not waiting', async () => {
      // `delays[attempt] || delays[delays.length - 1]` — a caller who writes
      // [0, 5000] meaning "retry immediately, then back off" gets 5000 for the
      // first wait too. Tested as-is; the module is not changed here.
      const fn = vi.fn().mockRejectedValue(new Error('down'));
      const promise = settle(retryWithBackoff(fn, 2, [0, 5000]));

      await flush();
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(4999);
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(fn).toHaveBeenCalledTimes(2);

      await promise;
    });

    it('SURPRISE: an empty delays array yields an undefined delay, which sleeps 0ms', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('down'))
        .mockResolvedValue('recovered');

      const promise = settle(retryWithBackoff(fn, 2, []));
      await vi.runAllTimersAsync();

      expect(fn).toHaveBeenCalledTimes(2);
      expect(await promise).toEqual({
        status: 'fulfilled',
        value: 'recovered',
      });

      const context = warnContext(0);
      expect('delayMs' in context).toBe(true);
      expect(context.delayMs).toBeUndefined();
    });
  });

  describe('logging', () => {
    it('logs one warning per retry, carrying the attempt number and the delay it is about to wait', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('flaky'))
        .mockResolvedValue('ok');

      const promise = settle(retryWithBackoff(fn, 3, [1000, 2000]));
      await vi.runAllTimersAsync();
      await promise;

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Auth operation failed, retrying',
        {
          attempt: 1,
          maxAttempts: 3,
          delayMs: 1000,
          errorMessage: 'flaky',
        }
      );
    });

    it('reports the escalating schedule across every retry, and stops before the final attempt', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('down'));
      const promise = settle(retryWithBackoff(fn, 3, [1000, 2000, 4000]));
      await vi.runAllTimersAsync();
      await promise;

      // Two warnings for three attempts — the last failure is thrown, not retried.
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
      expect(
        mockLogger.warn.mock.calls.map(
          (call) => (call[1] as Record<string, unknown>).delayMs
        )
      ).toEqual([1000, 2000]);
      expect(
        mockLogger.warn.mock.calls.map(
          (call) => (call[1] as Record<string, unknown>).attempt
        )
      ).toEqual([1, 2]);
    });
  });

  describe('exhaustion', () => {
    it('rejects with a message naming the attempt count and the last error', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('network down'));
      const promise = settle(retryWithBackoff(fn, 3, [1000, 2000]));
      await vi.runAllTimersAsync();

      const outcome = await promise;
      expect(outcome.status).toBe('rejected');
      expect(outcome).toMatchObject({ status: 'rejected' });
      expect((outcome as { reason: Error }).reason).toBeInstanceOf(Error);
      expect((outcome as { reason: Error }).reason.message).toBe(
        'Auth operation failed after 3 attempts: network down'
      );
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('quotes the LAST error, not the first', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('first'))
        .mockRejectedValueOnce(new Error('second'))
        .mockRejectedValueOnce(new Error('third'));

      const promise = settle(retryWithBackoff(fn, 3, [1000, 2000]));
      await vi.runAllTimersAsync();

      expect((await promise) as { reason: Error }).toHaveProperty(
        'reason.message',
        'Auth operation failed after 3 attempts: third'
      );
    });

    it('makes exactly one attempt and never sleeps when maxAttempts is 1', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('nope'));

      const outcome = await settle(retryWithBackoff(fn, 1));

      expect(fn).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect((outcome as { reason: Error }).reason.message).toBe(
        'Auth operation failed after 1 attempts: nope'
      );
    });

    it('SURPRISE: maxAttempts of 0 never calls the function at all, and blames "Unknown error"', async () => {
      // The loop body never runs, so lastError stays null and the `|| 'Unknown
      // error'` arm is the only thing the caller sees.
      const fn = vi.fn().mockResolvedValue('never reached');

      const outcome = await settle(retryWithBackoff(fn, 0));

      expect(fn).not.toHaveBeenCalled();
      expect((outcome as { reason: Error }).reason.message).toBe(
        'Auth operation failed after 0 attempts: Unknown error'
      );
    });

    it('behaves the same for a negative maxAttempts', async () => {
      const fn = vi.fn().mockResolvedValue('never reached');

      const outcome = await settle(retryWithBackoff(fn, -3));

      expect(fn).not.toHaveBeenCalled();
      expect((outcome as { reason: Error }).reason.message).toBe(
        'Auth operation failed after -3 attempts: Unknown error'
      );
    });

    it('falls back to "Unknown error" when the real error has an empty message', async () => {
      const fn = vi.fn().mockRejectedValue(new Error(''));

      const outcome = await settle(retryWithBackoff(fn, 1));

      expect((outcome as { reason: Error }).reason.message).toBe(
        'Auth operation failed after 1 attempts: Unknown error'
      );
    });

    it.each([
      ['a string', 'kaboom', 'kaboom'],
      ['null', null, 'null'],
      ['undefined', undefined, 'undefined'],
      ['a number', 0, '0'],
      ['a plain object', { code: 500 }, '[object Object]'],
    ])(
      'stringifies a non-Error rejection (%s) into the thrown message',
      async (_label, thrown, expected) => {
        const fn = vi.fn().mockRejectedValue(thrown);

        const outcome = await settle(retryWithBackoff(fn, 1));

        expect((outcome as { reason: Error }).reason).toBeInstanceOf(Error);
        expect((outcome as { reason: Error }).reason.message).toBe(
          `Auth operation failed after 1 attempts: ${expected}`
        );
      }
    );

    it('preserves a unicode, multi-hundred-character error message verbatim', async () => {
      const message = `セッション取得に失敗 ✨ ${'x'.repeat(500)}`;
      const fn = vi.fn().mockRejectedValue(new Error(message));

      const outcome = await settle(retryWithBackoff(fn, 1));

      expect((outcome as { reason: Error }).reason.message).toBe(
        `Auth operation failed after 1 attempts: ${message}`
      );
    });
  });
});

describe('retrySupabaseAuth', () => {
  const ok = (data: unknown) => ({ data, error: null });
  const failed = (error: Error) => ({ data: null, error });

  describe('success', () => {
    it('returns the response object itself when there is no error', async () => {
      const response = ok({ user: { id: 'u1' } });
      const fn = vi.fn().mockResolvedValue(response);

      await expect(retrySupabaseAuth(fn, 3, [1000, 2000])).resolves.toBe(
        response
      );
      expect(fn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('treats a null-data / null-error response as success rather than retrying it', async () => {
      const response = ok(null);
      const fn = vi.fn().mockResolvedValue(response);

      await expect(retrySupabaseAuth(fn, 3)).resolves.toBe(response);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('non-retryable errors short-circuit', () => {
    it.each([
      'Invalid login credentials',
      'INVALID GRANT',
      'Unauthorized',
      'unauthorized',
      'User not found',
      'Not Found',
    ])('returns immediately for %s without waiting or warning', async (msg) => {
      const response = failed(new Error(msg));
      const fn = vi.fn().mockResolvedValue(response);

      await expect(retrySupabaseAuth(fn, 3, [1000, 2000])).resolves.toBe(
        response
      );
      expect(fn).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('SURPRISE: matching is bare substring, so "invalidated" counts as "invalid"', async () => {
      // A genuinely transient "session invalidated by server" is classified as
      // permanent and never retried. Tested as-is.
      const response = failed(new Error('Session invalidated by server'));
      const fn = vi.fn().mockResolvedValue(response);

      await expect(retrySupabaseAuth(fn, 3, [1000, 2000])).resolves.toBe(
        response
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('does retry an error whose message contains none of the three keywords', async () => {
      const fn = vi.fn().mockResolvedValue(failed(new Error('rate limited')));

      const promise = settle(retrySupabaseAuth(fn, 3, [1000, 2000]));
      await vi.runAllTimersAsync();
      await promise;

      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('retrying', () => {
    it('waits delays[0] then returns the successful response', async () => {
      const success = ok({ user: { id: 'u1' } });
      const fn = vi
        .fn()
        .mockResolvedValueOnce(failed(new Error('network timeout')))
        .mockResolvedValueOnce(success);

      const promise = settle(retrySupabaseAuth(fn, 3, [1000, 2000]));

      await flush();
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(999);
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(fn).toHaveBeenCalledTimes(2);

      expect(await promise).toEqual({ status: 'fulfilled', value: success });
    });

    it('defaults to 3 attempts spaced 1000ms then 2000ms', async () => {
      const fn = vi.fn().mockResolvedValue(failed(new Error('rate limited')));
      const promise = settle(retrySupabaseAuth(fn));

      await flush();
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(fn).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1999);
      expect(fn).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1);
      expect(fn).toHaveBeenCalledTimes(3);

      expect(vi.getTimerCount()).toBe(0);
      await promise;
    });

    it('reuses the last delay when the array runs out', async () => {
      const fn = vi.fn().mockResolvedValue(failed(new Error('rate limited')));
      const promise = settle(retrySupabaseAuth(fn, 3, [250]));

      await flush();
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(250);
      expect(fn).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(249);
      expect(fn).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1);
      expect(fn).toHaveBeenCalledTimes(3);

      await promise;
    });

    it('logs a warning without the error message, unlike retryWithBackoff', async () => {
      const fn = vi.fn().mockResolvedValue(failed(new Error('rate limited')));
      const promise = settle(retrySupabaseAuth(fn, 2, [500]));
      await vi.runAllTimersAsync();
      await promise;

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Auth operation failed, retrying',
        { attempt: 1, maxAttempts: 2, delayMs: 500 }
      );
      // Pinned explicitly: toHaveBeenCalledWith ignores keys set to undefined,
      // so the key list is the assertion that would notice an added field.
      expect(Object.keys(warnContext(0)).sort()).toEqual([
        'attempt',
        'delayMs',
        'maxAttempts',
      ]);
    });
  });

  describe('exhaustion resolves rather than throwing', () => {
    it('returns null data and the LAST error object, by reference', async () => {
      const first = new Error('rate limited');
      const last = new Error('gateway timeout');
      const fn = vi
        .fn()
        .mockResolvedValueOnce(failed(first))
        .mockResolvedValueOnce(failed(new Error('service unavailable')))
        .mockResolvedValueOnce(failed(last));

      const promise = settle(retrySupabaseAuth(fn, 3, [1000, 2000]));
      await vi.runAllTimersAsync();
      const outcome = await promise;

      expect(outcome.status).toBe('fulfilled');
      const value = (
        outcome as { value: { data: unknown; error: Error | null } }
      ).value;
      expect(value.data).toBeNull();
      expect(value.error).toBe(last);
      expect(value.error).not.toBe(first);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('SURPRISE: maxAttempts of 0 never calls the function and synthesises its own error', async () => {
      const fn = vi.fn().mockResolvedValue(ok('never reached'));

      const result = await retrySupabaseAuth(fn, 0);

      expect(fn).not.toHaveBeenCalled();
      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe(
        'Auth operation failed after 0 attempts'
      );
    });
  });

  describe('thrown exceptions', () => {
    it('retries a rejection and returns its error after exhaustion', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('socket hang up'));

      const promise = settle(retrySupabaseAuth(fn, 2, [500]));
      await vi.runAllTimersAsync();
      const outcome = await promise;

      expect(fn).toHaveBeenCalledTimes(2);
      const value = (
        outcome as { value: { data: unknown; error: Error | null } }
      ).value;
      expect(value.data).toBeNull();
      expect(value.error?.message).toBe('socket hang up');
    });

    it('SURPRISE: a THROWN "Invalid login credentials" is retried, though a RETURNED one is not', async () => {
      // The non-retryable keyword check only runs on `result.error`. An SDK that
      // throws the same condition gets the full backoff instead of failing fast.
      const fn = vi
        .fn()
        .mockRejectedValue(new Error('Invalid login credentials'));

      const promise = settle(retrySupabaseAuth(fn, 3, [1000, 2000]));
      await vi.runAllTimersAsync();
      await promise;

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('recovers when a later attempt resolves successfully', async () => {
      const success = ok({ user: { id: 'u2' } });
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('socket hang up'))
        .mockResolvedValueOnce(success);

      const promise = settle(retrySupabaseAuth(fn, 3, [1000, 2000]));
      await vi.runAllTimersAsync();

      expect(await promise).toEqual({ status: 'fulfilled', value: success });
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('wraps a non-Error rejection into an Error before returning it', async () => {
      const fn = vi.fn().mockRejectedValue('boom');

      const result = await retrySupabaseAuth(fn, 1);

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('boom');
    });
  });
});
