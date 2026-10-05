'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import CaptchaWidget, {
  type CaptchaWidgetHandle,
} from '@/components/auth/CaptchaWidget';
import { captchaConfig } from '@/config/captcha.config';
import { projectConfig } from '@/config/project.config';
import { getQueueSize } from '@/utils/offline-queue';
import {
  QUEUE_CHANGED_EVENT,
  discardNextQueued,
  sendNextQueued,
} from '@/utils/background-sync';

type Phase = 'idle' | 'sending' | 'sent' | 'failed';

/** How long "sent" stays on screen before the card goes away. */
const SENT_NOTICE_MS = 8000;

/**
 * Sends contact messages that were saved while the visitor was offline (#1321).
 *
 * WHY IT LIVES IN THE ROOT LAYOUT. A visitor saves a message offline and then goes
 * anywhere: another page, or a later visit. A sender on the contact page alone would miss
 * exactly the case it exists for. Same reasoning as `PaymentQueueSync`. With an empty queue
 * it costs one IndexedDB read and renders nothing.
 *
 * WHY THE PAGE AND NOT THE SERVICE WORKER. Each send needs a fresh single-use Turnstile
 * token, and only a rendered page can get one. The widget runs `interaction-only`, so for
 * most visitors the send is invisible apart from this card. If Cloudflare wants a human
 * check, the checkbox appears inside the card.
 *
 * A message that won't send stays saved. The visitor sees why, and can try again, email
 * instead, or discard it. Nothing is dropped silently, which is what the old path did.
 */
export default function ContactQueueSender() {
  const [pending, setPending] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const captchaRef = useRef<CaptchaWidgetHandle>(null);
  const busy = useRef(false);

  // Look for saved messages when the page loads, when the connection returns, when the
  // tab comes back into view, and whenever the queue changes.
  const check = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const size = await getQueueSize();
    setPending(size);
    if (size > 0) {
      setPhase((p) => (p === 'idle' || p === 'sent' ? 'sending' : p));
    }
  }, []);

  useEffect(() => {
    void check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    window.addEventListener('online', check);
    window.addEventListener(QUEUE_CHANGED_EVENT, check);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', check);
      window.removeEventListener(QUEUE_CHANGED_EVENT, check);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  const attempt = useCallback(async (token: string | null) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const result = await sendNextQueued(token);
      // The token is spent whatever happened. Re-issue one for the next message.
      captchaRef.current?.reset();
      if (result.outcome === 'failed') {
        setError(result.message);
        setPhase('failed');
        return;
      }
      const remaining = result.outcome === 'sent' ? result.remaining : 0;
      setPending(remaining);
      setPhase(
        remaining > 0 ? 'sending' : result.outcome === 'sent' ? 'sent' : 'idle'
      );
    } finally {
      busy.current = false;
    }
  }, []);

  // Without a site key there is no token to wait for, so send straight away.
  useEffect(() => {
    if (phase === 'sending' && !captchaConfig.enabled) void attempt(null);
  }, [phase, pending, attempt]);

  useEffect(() => {
    if (phase !== 'sent') return;
    const timer = setTimeout(() => setPhase('idle'), SENT_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const onToken = useCallback(
    (token: string | null) => {
      if (token) void attempt(token);
    },
    [attempt]
  );

  // The check itself failed (blocked script, no network, wrong domain). Without this the
  // card would say "Sending…" forever, waiting for a token that is never coming.
  const onCaptchaError = useCallback(() => {
    setError("The spam check couldn't load, so it's still saved.");
    setPhase('failed');
  }, []);

  const retry = () => {
    setError(null);
    setPhase('sending');
    captchaRef.current?.reset();
  };

  const discard = async () => {
    await discardNextQueued();
    setError(null);
    setPhase('idle');
  };

  if (phase === 'idle') return null;

  return (
    <div
      className="card bg-base-100 border-base-300 fixed right-4 bottom-4 z-40 w-[min(22rem,calc(100vw-2rem))] border shadow-lg"
      data-testid="contact-queue-sender"
    >
      <div className="card-body gap-3 p-4" role="status" aria-live="polite">
        {phase === 'sending' && (
          <p className="text-sm">
            Sending the message you saved while offline
            {pending > 1 ? ` (${pending} saved)` : ''}…
          </p>
        )}
        {phase === 'sent' && (
          <p className="text-sm">Your saved message was sent.</p>
        )}
        {phase === 'failed' && (
          <>
            <p className="text-sm">
              A message you saved while offline hasn&apos;t been sent yet.{' '}
              {error}
              {projectConfig.supportEmail && (
                <>
                  {' '}
                  You can also email{' '}
                  <a
                    href={`mailto:${projectConfig.supportEmail}`}
                    className="link font-semibold"
                  >
                    {projectConfig.supportEmail}
                  </a>
                  .
                </>
              )}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm min-h-11"
                onClick={() => void discard()}
              >
                Discard
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm min-h-11"
                onClick={retry}
              >
                Try again
              </button>
            </div>
          </>
        )}
      </div>
      {phase === 'sending' && (
        <div className="px-4 pb-4">
          <CaptchaWidget
            ref={captchaRef}
            onToken={onToken}
            onError={onCaptchaError}
            appearance="interaction-only"
          />
        </div>
      )}
    </div>
  );
}
