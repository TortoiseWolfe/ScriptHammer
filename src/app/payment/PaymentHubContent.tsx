'use client';

import React, { Suspense, useCallback, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { PaymentHistory } from '@/components/payment/PaymentHistory';
import { PaymentQueuePanel } from '@/components/payment/PaymentQueuePanel';
import { SubscriptionManager } from '@/components/payment/SubscriptionManager';
import { featureFlags } from '@/config/payment';
import SearchParamsReader from './SearchParamsReader';

type HubTab = 'overview' | 'subscriptions';

const TAB_H1: Record<HubTab, string> = {
  overview: 'Payments',
  subscriptions: 'Subscriptions',
};

function isHubTab(value: string | null): value is HubTab {
  return value === 'overview' || value === 'subscriptions';
}

/** Read the initial tab synchronously from the URL so the correct h1 paints on
 * the first render (avoids a flash of the overview h1 on a deep link to
 * ?tab=subscriptions). The SearchParamsReader effect is the SSR-safe fallback. */
function initialTabFromUrl(): HubTab {
  if (typeof window === 'undefined') return 'overview';
  const tab = new URLSearchParams(window.location.search).get('tab');
  return isHubTab(tab) ? tab : 'overview';
}

/** Shared "providers not configured" warning (mirrors /payment-demo). */
function NotConfiguredAlert() {
  return (
    <div role="alert" className="alert alert-warning">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6 shrink-0 stroke-current"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <div>
        <p className="font-semibold">Payment providers not configured</p>
        <p className="text-sm">
          No payments can be processed until Stripe or PayPal is set up. Set{' '}
          <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> and/or{' '}
          <code>NEXT_PUBLIC_PAYPAL_CLIENT_ID</code> in <code>.env</code>. See{' '}
          <code>docs/PAYMENT-DEPLOYMENT.md</code>.
        </p>
      </div>
    </div>
  );
}

/**
 * Unified payment hub body. Two tabs (Overview / Subscriptions) consolidating
 * the former /payment/dashboard and /account/subscriptions pages, deep-linkable
 * via `?tab=`. The per-tab <h1> keeps stable level-1 anchors for E2E tests.
 */
export default function PaymentHubContent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<HubTab>(initialTabFromUrl);

  const noProvidersConfigured =
    !featureFlags.stripeEnabled && !featureFlags.paypalEnabled;

  const selectTab = useCallback((tab: HubTab) => {
    setActiveTab(tab);
    window.history.pushState({}, '', `/payment?tab=${tab}`);
  }, []);

  // URL → state sync (back/forward + initial SSR hydration fallback).
  const handleParams = useCallback((tab: string | null) => {
    if (isHubTab(tab)) setActiveTab(tab);
  }, []);

  return (
    <main className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <Suspense fallback={null}>
        <SearchParamsReader onParams={handleParams} />
      </Suspense>

      <div className="mx-auto max-w-3xl">
        {/* `flex-wrap` is load-bearing — see the note in account/page.tsx (#511). */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">{TAB_H1[activeTab]}</h1>
          <Link href="/account" className="sh-btn sh-btn-ghost">
            Back to Account
          </Link>
        </div>

        {/* A rail rather than DaisyUI `tabs`: the same vocabulary as the
            /docs sidebar, the /blog chips and the admin console. `.tab` gets
            no depth from #427, and dropping the DaisyUI border variant would
            leave the current tab with no cue at all - so `sh-rail-active`
            lands in the same edit. Both tab TEXTS are unchanged; they are
            pinned by tests/e2e/payment/. */}
        <div
          role="tablist"
          className="sh-rail mb-6 flex-wrap"
          aria-label="Payment sections"
        >
          {(
            [
              ['overview', 'Overview'],
              ['subscriptions', 'Subscriptions'],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              className={`text-base-content flex min-h-11 items-center rounded-full px-4 font-mono text-[11px] tracking-wider uppercase transition-colors ${
                activeTab === tab ? 'sh-rail-active' : 'hover:bg-base-200'
              }`}
              onClick={() => selectTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div role="tabpanel" className="flex flex-col gap-6">
            {noProvidersConfigured && <NotConfiguredAlert />}

            {/* Offline payment queue (#4) — only meaningful where payments can
                be made, so provider-gated; the queue itself works regardless. */}
            {!noProvidersConfigured && (
              <section aria-labelledby="payment-queue-heading">
                <h2 id="payment-queue-heading" className="sr-only">
                  Offline payment queue
                </h2>
                <PaymentQueuePanel />
              </section>
            )}

            <section aria-labelledby="payment-history-heading">
              {/* PaymentHistory.tsx:315 renders its own visible h2 with this
                  same text, so /payment showed "Payment History" twice - a
                  strict-mode locator hazard as well as a duplicate. The
                  landmark still needs a name, so it goes to sr-only rather
                  than away. */}
              <h2 id="payment-history-heading" className="sr-only">
                Payment History
              </h2>
              <PaymentHistory initialLimit={20} showFilters />
            </section>
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <div role="tabpanel" className="flex flex-col gap-6">
            {noProvidersConfigured && <NotConfiguredAlert />}
            {user && <SubscriptionManager userId={user.id} />}
          </div>
        )}
      </div>
    </main>
  );
}
