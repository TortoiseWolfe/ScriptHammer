'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { AdminAuthService } from '@/services/admin';

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
 * - Dep array `[user, authLoading, router]`: a `user` change re-runs the
 *   check against the new user. Removing `user` from deps reintroduces a
 *   stale-state bug where the previous user's admin verdict persists.
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
 * it locates `nav[aria-label="Admin navigation"]` and then each tab by name
 * ('Payments', 'Audit Trail', 'Users', 'Messaging', 'Email'). Do not rename
 * them without updating that spec.
 */
const SECTIONS = [
  { href: '/admin', label: 'Overview', title: 'Admin Dashboard' },
  // Title is 'Payment Activity', not 'Payments' — that is the text the page
  // already shipped, and admin-dashboard.spec.ts:156 matches a heading against
  // /payment/i. Renaming it here would have been a silent copy change.
  { href: '/admin/payments', label: 'Payments', title: 'Payment Activity' },
  { href: '/admin/orders', label: 'Orders', title: 'Orders' },
  { href: '/admin/audit', label: 'Audit Trail', title: 'Audit Trail' },
  { href: '/admin/users', label: 'Users', title: 'User Management' },
  { href: '/admin/messaging', label: 'Messaging', title: 'Messaging Overview' },
  { href: '/admin/email', label: 'Email', title: 'Email Provider Health' },
] as const;

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

  useEffect(() => {
    if (authLoading) return;
    if (!user) return; // ProtectedRoute renders the sign-in card path
    let cancelled = false;
    (async () => {
      const service = new AdminAuthService(supabase);
      const admin = await service.checkIsAdmin(user.id);
      if (cancelled) return;
      setIsAdmin(admin);
      if (!admin && !wasAdmin.current) router.push('/');
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  if (authLoading || isAdmin === null) {
    return (
      <main className="container mx-auto p-6 lg:px-8">
        <div className="flex min-h-[50vh] items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
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

          The `aria-label` and all six link TEXTS are pinned by
          tests/e2e/admin/admin-dashboard.spec.ts:470-476, which locates
          `nav[aria-label="Admin navigation"]` and then each tab by name.
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
