'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/** Cents. These mirror the seeded `tip-jar` row and the bounds the server enforces. */
export const TIP_PRESETS = [500, 1500, 5000] as const;
export const TIP_MIN_CENTS = 100;
export const TIP_MAX_CENTS = 50_000;

export interface TipJarProps {
  className?: string;
  /**
   * Compact renders the presets alone, for placing at the moment value lands --
   * beside "Clone the starter", not on a page of its own. A jar on its own page
   * is a jar in an empty room: nobody navigates in order to give. One click goes
   * straight to checkout; "another amount" is the only thing that needs /tip.
   */
  compact?: boolean;
}

/**
 * Pay-what-you-want, for a template that is free and stays free (T050).
 *
 * THE AMOUNT IS VALIDATED HERE AND AGAIN ON THE SERVER, AND ONLY THE SERVER'S ANSWER
 * MATTERS. `resolveChargeAmount` re-checks integer-ness, finiteness and the row's own
 * min/max before a provider is ever called, because `tip-jar` is the ONE SKU where a
 * client number is honoured at all. This component validates first purely so the
 * visitor is told what is wrong before a round trip -- never as the gate.
 *
 * WHOLE DOLLARS ONLY, which is a product decision rather than a technical one: the
 * seeded metadata says `whole_dollars_only`, and a cents field on a tip invites a
 * typo that reads as an insult in either direction.
 *
 * THE SHAKE IS GATED BEFORE IT STARTS. `useReducedMotion()` decides whether the class
 * is applied at all, rather than applying it and relying on CSS to suppress it -- the
 * in-app toggle and the OS media query are two different triggers and the kill-switch
 * in reduced-motion.css covers only Tailwind's built-in animate-* names, so a custom
 * utility is not covered by inheritance (T049).
 */
export default function TipJar({
  className = '',
  compact = false,
}: TipJarProps) {
  const router = useRouter();
  const prefersReduced = useReducedMotion();
  const [dollars, setDollars] = useState<string>('15');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const validate = useCallback((raw: string): number | null => {
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
    const cents = n * 100;
    if (cents < TIP_MIN_CENTS || cents > TIP_MAX_CENTS) return null;
    return cents;
  }, []);

  const onGive = useCallback(() => {
    const cents = validate(dollars);
    if (cents === null) {
      setError(
        `Whole dollars, $${TIP_MIN_CENTS / 100} to $${TIP_MAX_CENTS / 100}.`
      );
      if (!prefersReduced) {
        setShake(true);
        window.setTimeout(() => setShake(false), 400);
      }
      return;
    }
    setError(null);
    router.push(`/checkout?sku=tip-jar&amount=${cents}`);
  }, [dollars, prefersReduced, router, validate]);

  const goDirect = useCallback(
    (cents: number) => router.push(`/checkout?sku=tip-jar&amount=${cents}`),
    [router]
  );

  if (compact) {
    return (
      <div className={className}>
        <p className="text-base-content mb-2 text-sm">
          Free forever. If it saved you a weekend:
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {TIP_PRESETS.map((cents) => (
            <button
              key={cents}
              type="button"
              onClick={() => goDirect(cents)}
              className="btn btn-outline btn-sm min-h-11 min-w-11"
            >
              ${cents / 100}
            </button>
          ))}
          <Link href="/tip" className="link link-hover text-sm">
            another amount
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-4 flex flex-wrap gap-2">
        {TIP_PRESETS.map((cents) => (
          <button
            key={cents}
            type="button"
            className="btn btn-outline min-h-11 min-w-11"
            onClick={() => {
              setDollars(String(cents / 100));
              setError(null);
            }}
          >
            ${cents / 100}
          </button>
        ))}
      </div>

      <label className="form-control w-full max-w-xs">
        <span className="label-text mb-1">Amount in whole dollars</span>
        <div className="flex gap-2">
          <input
            id="tip-amount"
            type="number"
            inputMode="numeric"
            step={1}
            min={TIP_MIN_CENTS / 100}
            max={TIP_MAX_CENTS / 100}
            value={dollars}
            aria-describedby={error ? 'tip-error' : undefined}
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setDollars(e.target.value);
              setError(null);
            }}
            className={`input input-bordered min-h-11 w-32 ${shake ? 'sh-shake' : ''}`}
          />
          <button
            type="button"
            onClick={onGive}
            className="btn btn-primary min-h-11 min-w-11"
          >
            Send a tip
          </button>
        </div>
      </label>

      {error && (
        <p id="tip-error" role="alert" className="text-error mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
