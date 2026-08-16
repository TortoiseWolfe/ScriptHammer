'use client';

import React, { useState, useEffect } from 'react';
import SignInForm from '@/components/auth/SignInForm';
import OAuthButtons from '@/components/auth/OAuthButtons';
import { LayeredScriptHammerLogo } from '@/components/atomic/SpinningLogo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function isSafeRedirectUrl(url: string): boolean {
  if (!url || !url.startsWith('/')) return false;
  if (url.startsWith('//')) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Three claims the design puts on the left panel. Every one is backed by
 * something in this repo — checked, not assumed, because a badge with nothing
 * behind it is the #422/#383 failure:
 *
 *   Rate limited     `checkRateLimit` is called on submit (SignInForm, 3 sites)
 *   Session refresh  `autoRefreshToken: true` (lib/supabase/client.ts)
 *   WCAG AA          config/pa11yci-auth.json gates /sign-in at WCAG2AA
 *
 * If one of those ever stops being true, delete the pill rather than keep a
 * decorative claim on the page where users hand over a password.
 */
const TRUST = ['Rate limited', 'Session refresh', 'WCAG AA'] as const;

export default function SignInPage() {
  const router = useRouter();
  const [returnUrl, setReturnUrl] = useState('/profile');
  // Block onSuccess navigation until the returnUrl effect has run. On a
  // fast network or already-authenticated user, sign-in can resolve before
  // the URL-parsing effect finishes, sending the user to the default
  // /profile instead of the intended /messages?conversation=xyz.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read query params client-side for static export compatibility
    const params = new URLSearchParams(window.location.search);
    const url = params.get('returnUrl');
    if (url && isSafeRedirectUrl(decodeURIComponent(url))) {
      setReturnUrl(url);
    }
    setMounted(true);
  }, []);

  const signUpHref = `/sign-up${
    returnUrl !== '/profile'
      ? `?returnUrl=${encodeURIComponent(returnUrl)}`
      : ''
  }`;

  return (
    // 3e (#384). Two panels: the pitch on the left, the form floating on a
    // raised plate on the right. The radial wash is the design's own value.
    //
    // Single column below `lg` — the left panel is supporting copy, so it
    // stacks ABOVE the form rather than being hidden. A `hidden lg:block`
    // panel would also be invisible to every gate we run at 390px (#411).
    <main
      className="relative isolate overflow-hidden"
      style={{
        // The design writes this stop as the literal `oklch(28.51% 0.067
        // 281.32)`, which is scripthammer-dark's own `--color-base-300` — the
        // mock's wrapper carried `data-theme="scripthammer-dark"`, so that
        // value was theme-SPECIFIC. Lifting it as a literal put a dark purple
        // blob in the middle of the light theme, dragging the headline's
        // contrast down with it. Referencing the token instead makes the wash
        // follow whichever theme is active, which is the same correction #415
        // made to the semantic colours.
        background:
          'radial-gradient(90% 90% at 22% 40%, var(--color-base-300) 0%, var(--color-base-100) 60%)',
      }}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-[1fr_520px] lg:items-center lg:gap-14 lg:px-8">
        {/* ── Left: the pitch ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3">
            {/* Same medallion recipe as the home page — a circular WELL holding
                the three layered SVGs. Reused rather than re-authored so the
                brand mark cannot drift between the two surfaces. */}
            <div
              className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
              style={{
                background: 'var(--color-base-100)',
                boxShadow: 'inset 0 3px 9px rgba(0,0,0,.85)',
              }}
            >
              <div className="h-[76%] w-[76%]">
                <LayeredScriptHammerLogo pauseOnHover />
              </div>
            </div>
            <span className="font-display text-base-content text-lg tracking-[-0.01em]">
              SCRIPTHAMMER
            </span>
          </div>

          <div className="flex max-w-[44ch] flex-col gap-5">
            {/* The page's h1. The design draws this as the large statement and
                puts a smaller "Sign in" over the form; keeping the h1 here
                means the heading order matches the visual order instead of
                fighting it. */}
            <h1 className="font-display text-base-content text-4xl leading-[0.98] tracking-[-0.035em] sm:text-5xl lg:text-[56px]">
              Same auth
              <br />
              your users get.
            </h1>
            {/* Solid `text-base-content`, not the design's 74% mix: opacity-
                suffixed text fails the AAA gate (#411, #425). */}
            <p className="text-base-content text-[17px] leading-relaxed text-pretty">
              This form is the shipped component — sessions, password strength,
              rate limits and error states all included in the starter.
            </p>
            <ul className="flex list-none flex-wrap gap-2.5 p-0">
              {TRUST.map((claim) => (
                <li
                  key={claim}
                  className="sh-groove bg-base-100 text-base-content rounded-[9px] px-3 py-2 font-mono text-[11px] tracking-[.1em] uppercase"
                >
                  {claim}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Right: the form on a plate ──────────────────────────────────── */}
        <div className="sh-plate rounded-[26px] px-6 py-8 sm:px-8">
          <div className="mb-6 flex flex-col gap-1.5">
            <p className="font-display text-base-content text-2xl tracking-[-0.02em]">
              Sign in
            </p>
            <p className="text-base-content text-sm">
              New here?{' '}
              {/* NOT link-secondary (#778). Measured against the hero gradient:
                  6.07:1 on scripthammer-light, under the 7:1 this text needs.
                  text-base-content measures 10.1 light / 11.81 dark. `link`
                  stays, so the UNDERLINE marks it as a link rather than colour
                  alone — which WCAG prefers regardless. */}
              <Link href={signUpHref} className="link text-base-content">
                Create an account
              </Link>
            </p>
          </div>

          <SignInForm
            onSuccess={() => {
              if (!mounted) return;
              router.push(decodeURIComponent(returnUrl));
            }}
          />

          <div className="divider my-6 font-mono text-[10.5px] tracking-[.16em] uppercase">
            or
          </div>

          <OAuthButtons />
        </div>
      </div>
    </main>
  );
}
