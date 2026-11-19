'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { AdminAuthService } from '@/services/admin';
import { ADMIN_SECTIONS } from '@/config/admin-sections';

/**
 * AdminGate
 *
 * Layered inside ProtectedRoute. Runs the admin RPC check and renders the
 * admin nav + children only for confirmed admins. The safety properties
 * below are load-bearing — see `AdminGate.test.tsx` for the regression
 * cases that pin them.
 *
 * - `wasAdmin` ref: once an admin check succeeded on this mount, a transient
 *   token-refresh flip (or any other non-redirecting auth blip) must not
 *   trigger router.push('/'). Mirrors ProtectedRoute's wasAuthenticated
 *   debounce against the same revert pattern (6b4c13a, 2c97e67, 259b38d).
 * - `cancelled` flag: the async `checkIsAdmin` resolution must not call
 *   setState after the effect cleaned up (different user signed in, or
 *   component unmounted).
 * - Dep array `[user, authLoading, router, attempt]`: a `user` change re-runs
 *   the check against the new user. Removing `user` from deps reintroduces a
 *   stale-state bug where the previous user's admin verdict persists.
 * - A failed `is_admin` request is not "not an admin" (#1520). Only a server
 *   answer may redirect to `/`. A failed request is retried a few times, then
 *   the page shows a "could not check" alert with a Try again button. This
 *   includes an expired-token 401: it shows the alert rather than redirecting,
 *   because the request failing says nothing about the role.
 */
/**
 * One source of truth for the console's nav labels AND its page titles (#430).
 *
 * Each of the six admin pages previously carried its own bare
 * `text-3xl font-bold` header, so the title and the nav label drifted apart and
 * every page repeated the same markup. Driving both from this array means a
 * label change lands in both places.
 *
 * The `label` strings are PINNED by tests/e2e/admin/admin-dashboard.spec.ts:
 * it locates `nav[aria-label="Admin navigation"]` and then each tab by name.
 * The names come from `ADMIN_SECTIONS`, which that spec now enumerates rather
 * than restating (#912) — so adding a section needs no test edit. Renaming a
 * label still changes an accessible name, which is an API in both directions:
 * grep tests/e2e for SUBSTRING collisions first (#378, #408).
 */
const SECTIONS = ADMIN_SECTIONS;

// How long to wait before each retry when the admin check request fails: three
// retries over 3.5 s, then the page says the check failed and offers a button.
const CHECK_RETRY_DELAYS_MS = [500, 1000, 2000];

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  // `/admin` needs an exact match — `startsWith` would mark it active on every
  // sub-route and light up two rail pills at once.
  //
  // `usePathname()` is typed nullable, so it is coalesced rather than asserted:
  // a null would otherwise throw inside `startsWith` and take the whole admin
  // console down. Empty string simply matches nothing, so the rail renders with
  // no active pill instead of crashing.
  const pathname = usePathname() ?? '';
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const wasAdmin = useRef(false);

  useEffect(() => {
    if (isAdmin === true) wasAdmin.current = true;
  }, [isAdmin]);

  // The check could not be completed (the request failed), as opposed to the
  // server saying "not an admin". Only a server answer may send someone away.
  const [checkFailed, setCheckFailed] = useState(false);
  // Bumped by the Retry button to run the check again.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return; // ProtectedRoute renders the sign-in card path
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const service = new AdminAuthService(supabase);
      setCheckFailed(false);
      for (let i = 0; i <= CHECK_RETRY_DELAYS_MS.length; i++) {
        try {
          const admin = await service.checkIsAdmin(user.id);
          if (cancelled) return;
          setIsAdmin(admin);
          if (!admin && !wasAdmin.current) router.push('/');
          return;
        } catch {
          // The request failed. That says nothing about the role, so it must
          // never redirect: try again a few times, then say so on the page.
          if (cancelled) return;
          if (i === CHECK_RETRY_DELAYS_MS.length) {
            setCheckFailed(true);
            return;
          }
          await new Promise((resolve) => {
            retryTimer = setTimeout(resolve, CHECK_RETRY_DELAYS_MS[i]);
          });
          if (cancelled) return;
        }
      }
    })();
    return () => {
      cancelled = true;
      // Drop a pending retry so it does not fire after unmount or a user change.
      clearTimeout(retryTimer);
    };
  }, [user, authLoading, router, attempt]);

  if (authLoading || (isAdmin === null && !checkFailed)) {
    return (
      <main className="container mx-auto p-6 lg:px-8">
        <div className="flex min-h-[50vh] items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      </main>
    );
  }

  if (checkFailed && isAdmin !== true) {
    return (
      <main className="container mx-auto p-6 lg:px-8">
        <div
          role="alert"
          className="alert alert-warning mx-auto flex max-w-xl flex-col items-start gap-3 sm:flex-row sm:items-center"
        >
          <span>
            We could not check your admin access because the request failed.
            Your account was not signed out.
          </span>
          <button
            type="button"
            className="btn btn-sm min-h-11 min-w-11"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!isAdmin && !wasAdmin.current) return null;

  const active = SECTIONS.find((s) =>
    s.href === '/admin' ? pathname === '/admin' : pathname.startsWith(s.href)
  );

  return (
    // The same explicit measure `/docs` uses, stated here rather than left to
    // `container` — whose value you have to go read `globals.css` to learn.
    //
    // It is NOT a clamp fix. An earlier version of this comment said `container`
    // throws away 43.9% of the viewport at 767px, citing #373. That was already
    // false when written: #373's §A1 fixed it with an `@utility container`
    // override, and `container` now computes to 1280px at every tier (#463).
    //
    // <main> since #475. None of the six /admin pages renders one, and neither
    // does any Admin* organism — so an actual signed-in admin had no main
    // landmark on any admin route. #475 filed all six under "auth gate", which
    // was only the anonymous half of the story: anonymously ProtectedRoute
    // answers first (admin/layout.tsx), so AdminGate is never reached and the
    // gap here stayed invisible.
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      {/* A rail, not DaisyUI `tabs`: `.tab` gets no depth from #427 and sits at
          ~40px, under the 44px touch floor. `sh-rail`/`sh-rail-active` is the
          same vocabulary as the /docs sidebar and the /blog chips.

          The `aria-label` is pinned by tests/e2e/admin/admin-dashboard.spec.ts,
          which locates this nav and then enumerates ADMIN_SECTIONS — it also
          asserts the links RENDERED here are exactly the sections defined, so
          dropping one fails rather than going unmeasured (#912).
          Restyled, never renamed. */}
      <nav
        className="sh-rail mb-6 flex flex-wrap gap-1 p-1"
        aria-label="Admin navigation"
      >
        {SECTIONS.map((s) => {
          const isActive = active?.href === s.href;
          return (
            <Link
              key={s.href}
              href={s.href}
              aria-current={isActive ? 'page' : undefined}
              className={`text-base-content flex min-h-11 items-center rounded-full px-4 text-sm transition-colors ${
                isActive ? 'sh-rail-active' : 'hover:bg-base-200'
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>

      {/* One h1 for the whole console, driven by the same array as the nav.
          Six pages each carried their own bare `text-3xl font-bold` header,
          which is why the titles never matched the nav labels. */}
      {active && (
        <h1 className="text-base-content font-display mb-6 text-3xl tracking-[-0.025em] sm:text-4xl">
          {active.title}
        </h1>
      )}

      {children}
    </main>
  );
}
