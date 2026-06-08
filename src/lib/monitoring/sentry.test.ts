import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the SDK; the scrub fn is real (covered by scrub.test.ts).
const init = vi.fn();
const captureException = vi.fn();
const close = vi.fn(() => Promise.resolve(true));
const getClient = vi.fn(() => ({ close }));

vi.mock('@sentry/react', () => ({
  init: (...a: unknown[]) => init(...a),
  captureException: (...a: unknown[]) => captureException(...a),
  getClient: () => getClient(),
}));

// `SENTRY_DSN` is read at module load, so each test re-imports after setting env.
async function freshModule() {
  vi.resetModules();
  return import('./sentry');
}

const DSN = 'https://abc123@o1.ingest.us.sentry.io/42';

describe('sentry module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  it('does NOT init and reports disabled when DSN is empty', async () => {
    const m = await freshModule();
    m.initSentry();
    expect(init).not.toHaveBeenCalled();
    expect(m.isSentryEnabled()).toBe(false);
  });

  it('captureAppError is a no-op when not enabled', async () => {
    const m = await freshModule();
    m.captureAppError(new Error('boom'));
    expect(captureException).not.toHaveBeenCalled();
  });

  it('inits exactly once when DSN is set (idempotent)', async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
    const m = await freshModule();
    m.initSentry();
    m.initSentry();
    expect(init).toHaveBeenCalledTimes(1);
    expect(m.isSentryEnabled()).toBe(true);
    // Replay/tracing must be disabled and beforeSend wired.
    const cfg = init.mock.calls[0][0] as Record<string, unknown>;
    expect(cfg.dsn).toBe(DSN);
    expect(cfg.tracesSampleRate).toBe(0);
    expect(cfg.replaysSessionSampleRate).toBe(0);
    expect(cfg.sendDefaultPii).toBe(false);
    expect(typeof cfg.beforeSend).toBe('function');
    expect(cfg.integrations).toEqual([]);
  });

  it('captureAppError forwards to Sentry when enabled, with extra context', async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
    const m = await freshModule();
    m.initSentry();
    const err = new Error('kaboom');
    m.captureAppError(err, { category: 'system' });
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][0]).toBe(err);
    expect(captureException.mock.calls[0][1]).toEqual({
      extra: { category: 'system' },
    });
  });

  it('closeSentry closes the client and flips enabled to false; re-init works', async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
    const m = await freshModule();
    m.initSentry();
    expect(m.isSentryEnabled()).toBe(true);
    await m.closeSentry();
    expect(close).toHaveBeenCalled();
    expect(m.isSentryEnabled()).toBe(false);
    // Re-consent → re-init creates a fresh client.
    m.initSentry();
    expect(init).toHaveBeenCalledTimes(2);
    expect(m.isSentryEnabled()).toBe(true);
  });

  it('beforeSend scrubs PII out of the event', async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = DSN;
    const m = await freshModule();
    m.initSentry();
    const cfg = init.mock.calls[0][0] as {
      beforeSend: (e: unknown) => unknown;
    };
    const scrubbed = cfg.beforeSend({
      message: 'failure for user@example.com',
    }) as { message: string };
    expect(scrubbed.message).toBe('failure for [REDACTED]');
  });
});
