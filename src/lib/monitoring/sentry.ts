/**
 * Sentry client-only error monitoring.
 *
 * The app is a Next.js static export (GitHub Pages) — `@sentry/nextjs`,
 * `withSentryConfig`, and `instrumentation.ts` all require a Next server, so we
 * use the browser SDK directly (`@sentry/react` re-exports `@sentry/browser`)
 * and initialize purely on the client, mirroring the consent-gated
 * GoogleAnalytics integration.
 *
 * Initialization is:
 *  - a no-op when `NEXT_PUBLIC_SENTRY_DSN` is empty (so the integration ships
 *    inert until a DSN is provided — zero code change to go live);
 *  - gated on analytics consent by the `SentryMonitor` component;
 *  - idempotent, and reversible via `closeSentry()` on consent withdrawal.
 *
 * Replay and performance tracing are explicitly disabled so the SDK never
 * records the E2E-encrypted messaging UI, and every outgoing event is run
 * through `scrubEvent` (see scrub.ts) to strip PII.
 */

import * as Sentry from '@sentry/react';
import { scrubEvent } from './scrub';

/** Sentry DSN — public client key, safe in the browser. Empty = disabled. */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

let initialized = false;

/** True once Sentry has been initialized with a usable DSN. */
export function isSentryEnabled(): boolean {
  return initialized && !!SENTRY_DSN;
}

/** Initialize Sentry. Safe to call repeatedly; no-ops without a DSN or on SSR. */
export function initSentry(): void {
  if (typeof window === 'undefined') return; // never on the server/SSG
  if (initialized) return; // idempotent
  if (!SENTRY_DSN) return; // ship inert until a DSN exists

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // Static export on GitHub Pages: no source maps, no server. Opt OUT of all
    // default integrations (Replay, BrowserTracing) — Replay would record the
    // encrypted messaging UI, which we must never capture.
    integrations: [],
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    // scrubEvent operates on the broader Event type and mutates in place,
    // returning the same reference — safe to hand back as the ErrorEvent.
    beforeSend: (event) => scrubEvent(event) as typeof event | null,
  });
  initialized = true;
}

/**
 * Flush and shut down Sentry (called when analytics consent is withdrawn).
 * Resets state so a later re-consent re-initializes a fresh client.
 */
export async function closeSentry(): Promise<void> {
  if (!initialized) return;
  const client = Sentry.getClient();
  if (client) await client.close(2000);
  initialized = false;
}

/**
 * Capture an error. No-ops unless Sentry is initialized (consent + DSN), so it
 * is safe to call unconditionally from the central error handler.
 */
export function captureAppError(
  error: Error,
  context?: Record<string, unknown>
): void {
  if (!isSentryEnabled()) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
