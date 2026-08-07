'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { featureFlags } from '@/config/payment';
import { getInternalUrl } from '@/config/project.config';
import {
  createCheckoutSession,
  handleStripeRedirect,
} from '@/lib/payments/stripe';
import { getPaymentStatus } from '@/lib/payments/payment-service';
import { UUID_RE } from '@/lib/payments/payment-return';
import { PaymentConsentModal } from '@/components/payment/PaymentConsentModal';
import { usePaymentConsent } from '@/hooks/usePaymentConsent';
import CheckoutSummary, {
  previewAmountDue,
} from '@/components/payment/CheckoutSummary';
import BookingStep from '@/components/payment/BookingStep';
import IntakeForm, { type IntakeFormData } from '@/components/forms/IntakeForm';
import type { Product } from '@/types/commerce';

/**
 * /checkout?sku=… — details, intake, payment, then booking, on one URL.
 *
 * NOT WRAPPED IN ProtectedRoute, and that is the point. Every other payment page
 * in this repo is, which is exactly what makes guest checkout impossible there
 * (FR-007: no account required to buy). A guest gets an anonymous Supabase
 * session, which is a real auth.uid() — so every RLS policy keeps working
 * unmodified — without an email or a password.
 *
 * THE BUYER DOES LEAVE FOR STRIPE. That is unavoidable with hosted Checkout.
 * What keeps this one page is where they come back to: create-stripe-checkout
 * returns them to /payment-result, so this page ALSO accepts `?session_id=` and
 * resolves it here, using the same contract #596 built. The booking step then
 * renders in place rather than on another route.
 *
 * A REDIRECT IS NOT PROOF OF PAYMENT. Returning from Stripe proves the buyer came
 * back, nothing more; the webhook is what makes an order paid. So the booking
 * step waits on getPaymentStatus() reading our own records, never on the
 * redirect alone.
 */

type Stage =
  | { kind: 'loading' }
  | { kind: 'no-sku' }
  | { kind: 'unknown-sku'; sku: string }
  | { kind: 'not-configured' }
  | { kind: 'form'; product: Product }
  | { kind: 'submitting'; product: Product }
  | { kind: 'paid'; orderId: string; product: Product | null }
  | { kind: 'error'; message: string };

/**
 * Read `sku` synchronously for the first paint. An effect-based read renders the
 * page once with no product and then swaps the price in — a visible flash on the
 * one number the buyer is deciding on.
 */
function skuFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('sku');
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const sku = searchParams?.get('sku') ?? skuFromLocation();
  const sessionId = searchParams?.get('session_id') ?? null;

  const [stage, setStage] = useState<Stage>({ kind: 'loading' });
  const [buyer, setBuyer] = useState<{ name?: string; email?: string }>({});
  const { hasConsent, ready: consentReady } = usePaymentConsent();

  /**
   * One nonce per page load, folded into the Idempotency-Key.
   *
   * The key was `${product}:${email}:${Date.now()}`, which made every submit
   * unique and therefore made the idempotency guard inert. That matters here and
   * not in theory: the Stripe leg can fail AFTER create-order has already written
   * the order, so the buyer sees an error next to a real order and presses the
   * button again — and a fresh timestamp meant a second order every time.
   *
   * Keying on (product, email, nonce) gets all three cases right:
   *   retry after a failure  → same key      → create-order replays, no duplicate
   *   buyer fixes their email → different key → new order, no spurious 409
   *   a genuine repeat purchase later → new page load, new nonce → new order
   *
   * A bare `${product}:${email}` would have been wrong for the last one: the key
   * row lives in the database forever, so buying the same package again next year
   * would replay a stale order.
   */
  const [attemptNonce] = useState(() =>
    Math.random().toString(36).slice(2, 12)
  );

  const noProviders =
    !featureFlags.stripeEnabled && !featureFlags.paypalEnabled;

  // ---- returning from Stripe -------------------------------------------
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    (async () => {
      const { intentId, error } = await handleStripeRedirect(sessionId);
      if (cancelled) return;
      if (!intentId || !UUID_RE.test(intentId)) {
        setStage({
          kind: 'error',
          message: error ?? 'Could not verify that session',
        });
        return;
      }
      // Ask OUR records, not the redirect.
      const result = await getPaymentStatus(intentId);
      if (cancelled) return;
      const { data: order } = await supabase
        .from('orders')
        .select('id, buyer_email')
        .eq('intent_id', intentId)
        .maybeSingle();

      if (result && order) {
        setBuyer((b) => ({ ...b, email: order.buyer_email ?? b.email }));
        setStage({ kind: 'paid', orderId: order.id, product: null });
      } else {
        setStage({
          kind: 'error',
          message:
            'Your payment is still being confirmed. Refresh in a moment — nothing is lost.',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // ---- loading the catalog row -----------------------------------------
  useEffect(() => {
    if (sessionId) return; // the return leg owns the stage
    if (noProviders) {
      setStage({ kind: 'not-configured' });
      return;
    }
    if (!sku) {
      setStage({ kind: 'no-sku' });
      return;
    }

    let cancelled = false;
    (async () => {
      // Readable without a session — the anon SELECT grant added in #557 exists
      // precisely so a logged-out visitor can see prices.
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', sku)
        .eq('active', true)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setStage({ kind: 'error', message: 'Could not load that package' });
        return;
      }
      if (!data) {
        setStage({ kind: 'unknown-sku', sku });
        return;
      }
      setStage({ kind: 'form', product: data as Product });
    })();

    return () => {
      cancelled = true;
    };
  }, [sku, sessionId, noProviders]);

  // ---- submit -----------------------------------------------------------
  const onSubmit = useCallback(
    async (intake: IntakeFormData) => {
      if (stage.kind !== 'form') return;
      const product = stage.product;
      setStage({ kind: 'submitting', product });
      setBuyer({ name: intake.name, email: intake.email });

      try {
        // A guest needs a session before create-order will talk to them. An
        // anonymous user is a real auth.users row, so nothing downstream changes.
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          const { error } = await supabase.auth.signInAnonymously();
          if (error)
            throw new Error(
              `Could not start a guest session: ${error.message}`
            );
        }
        const { data: fresh } = await supabase.auth.getSession();
        const token = fresh.session?.access_token;
        if (!token) throw new Error('Could not start a guest session');

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-order`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              // Survives a double-click and a retry. create-order claims the key
              // BEFORE doing work, so two in flight cannot both proceed.
              'Idempotency-Key': `${product.id}:${intake.email}:${attemptNonce}`,
            },
            body: JSON.stringify({
              product_id: product.id,
              buyer_email: intake.email,
              // Intake goes to orders.intake_data, never to payment metadata —
              // that is capped at 1KB serialised and a job description blows it.
              intake: {
                name: intake.name,
                phone: intake.phone,
                business: intake.business,
                domain: intake.domain || undefined,
                reference_url: intake.reference_url || undefined,
                notes: intake.notes || undefined,
              },
            }),
          }
        );

        const body = await res.json();
        // create-order's own errors ARE safe to show — they are curated, short
        // and actionable ("a valid buyer_email is required"). The provider leg
        // below is the opposite, which is why the two are not handled alike.
        if (!res.ok)
          throw new Error(body.error ?? 'Could not create your order');

        // Hand off to the existing Stripe leg, unchanged.
        try {
          await createCheckoutSession(body.intent_id);
        } catch (providerErr) {
          // NEVER render a provider's error text to a buyer. With no secret key
          // configured, Stripe's message is a paragraph of API documentation
          // ending in "Authorization: Bearer YOUR_SECRET_KEY" — shown verbatim
          // on the checkout page during this feature's first end-to-end run. It
          // is confusing to a customer, it advertises our configuration state,
          // and it is not something they can act on.
          console.error('checkout: provider session failed', providerErr);
          throw new Error(
            // The order exists at this point, so say so. Telling someone their
            // purchase failed when it is sitting in the database is worse than
            // saying nothing.
            'We saved your details but could not reach the payment provider. ' +
              'Nothing has been charged — please try again in a moment.'
          );
        }
      } catch (err) {
        setStage({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Something went wrong',
        });
      }
    },
    [stage, attemptNonce]
  );

  // ---- render ------------------------------------------------------------
  const shell = (children: React.ReactNode) => (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:py-12">
      {children}
    </main>
  );

  if (stage.kind === 'not-configured') {
    return shell(
      <div role="alert" className="alert alert-warning">
        <div>
          <p className="font-semibold">Payment is not configured</p>
          <p className="text-sm">
            Set <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> and/or{' '}
            <code>NEXT_PUBLIC_PAYPAL_CLIENT_ID</code>.
          </p>
        </div>
      </div>
    );
  }

  if (stage.kind === 'no-sku' || stage.kind === 'unknown-sku') {
    return shell(
      <div className="flex flex-col items-center gap-6 text-center">
        <div role="status" className="alert alert-info max-w-lg">
          <div>
            <p className="font-semibold">
              {stage.kind === 'no-sku'
                ? 'Nothing selected yet'
                : 'That package is not available'}
            </p>
            <p className="text-sm">
              Pick a package and we will take it from there.
            </p>
          </div>
        </div>
        <Link
          href={getInternalUrl('/pricing')}
          className="btn btn-primary min-h-11 min-w-11"
        >
          See pricing
        </Link>
      </div>
    );
  }

  if (stage.kind === 'paid') {
    return shell(
      <BookingStep
        orderId={stage.orderId}
        buyerName={buyer.name}
        buyerEmail={buyer.email}
        productName={stage.product?.name}
      />
    );
  }

  if (stage.kind === 'error') {
    return shell(
      <div className="flex flex-col items-center gap-6 text-center">
        <div role="alert" className="alert alert-error max-w-lg">
          <p>{stage.message}</p>
        </div>
        <Link
          href={getInternalUrl('/pricing')}
          className="btn btn-ghost min-h-11 min-w-11"
        >
          Back to pricing
        </Link>
      </div>
    );
  }

  if (stage.kind === 'loading') {
    return shell(
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  const product = stage.product;
  const busy = stage.kind === 'submitting';
  const due = previewAmountDue(product);

  return shell(
    <>
      {/* Self-driven off usePaymentConsent — it decides its own visibility. */}
      <PaymentConsentModal />

      <header className="mb-8">
        <h1 className="mb-2 !text-2xl font-bold sm:!text-3xl">Checkout</h1>
        <p className="text-base-content">
          No account needed. Terms are shown before payment.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="order-2 min-w-0 lg:order-1">
          <IntakeForm
            onSubmit={onSubmit}
            busy={busy}
            submitLabel={`Pay ${(due / 100).toLocaleString('en-US', {
              style: 'currency',
              currency: product.currency.toUpperCase(),
            })}`}
          />
          {consentReady && !hasConsent && (
            <p role="status" className="text-base-content mt-4 text-sm">
              You will be asked to accept payment processing before we continue.
            </p>
          )}
        </div>

        <div className="order-1 min-w-0 lg:order-2">
          <CheckoutSummary product={product} amountDueNow={due} />
        </div>
      </div>
    </>
  );
}

export default function CheckoutPage() {
  // useSearchParams needs a Suspense boundary or Next 15 fails the build.
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-5xl px-4 py-8">
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" />
          </div>
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
