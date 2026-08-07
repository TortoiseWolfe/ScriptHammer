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
import { useAuth } from '@/contexts/AuthContext';
import SignInForm from '@/components/auth/SignInForm';
import SignUpForm from '@/components/auth/SignUpForm';
import CheckoutSummary, {
  previewAmountDue,
} from '@/components/payment/CheckoutSummary';
import BookingStep from '@/components/payment/BookingStep';
import IntakeForm, { type IntakeFormData } from '@/components/forms/IntakeForm';
import type { IntakeAttachment, Product } from '@/types/commerce';

/**
 * /checkout?sku=… — sign in, details, intake, payment, then booking, on one URL.
 *
 * A REAL ACCOUNT IS REQUIRED TO BUY, and this replaced an anonymous-session flow.
 * FR-007 originally said no account was needed, and the first implementation used
 * `signInAnonymously()`. The owner overruled it: money must be attached to an
 * account that cannot evaporate.
 *
 * That is not a preference, it closes a real defect (#611). An anonymous session
 * lives in localStorage and its auth.users row carries no email, so clearing the
 * browser or switching device orphaned a paid order with no way to sign in, no
 * address to recover from and no password to reset. Requiring an account dissolves
 * that rather than patching it — no guest orders can exist.
 *
 * STILL NOT WRAPPED IN ProtectedRoute. That would bounce to /sign-in and lose the
 * `?sku=`, dropping the buyer back on a page that has forgotten what they wanted.
 * The gate is rendered inline instead, so the URL never changes.
 *
 * SIGNING UP DOES NOT PRODUCE A SESSION. `mailer_autoconfirm` is off, so Supabase
 * returns a user with no session until the address is confirmed. The gate below
 * therefore keys off `session`, not off the form's `onSuccess` — a new account has
 * to confirm by email and come back before it can pay.
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
  const { session, isLoading: authLoading } = useAuth();
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [justSignedUp, setJustSignedUp] = useState(false);

  /**
   * Attachments live here, not in IntakeForm's zod schema (FR-014). A file is
   * uploaded the moment it is chosen, so by submit time it is already a storage
   * path — there is nothing left to validate. Holding it on the page also means a
   * failed create-order does not lose files the buyer already uploaded.
   */
  const [attachments, setAttachments] = useState<IntakeAttachment[]>([]);

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
        // The gate above guarantees a session before this form renders, so this
        // is a guard rather than a flow step. It replaced a `signInAnonymously()`
        // call: never mint an identity here, because an order must belong to an
        // account the buyer can sign back into.
        const { data: fresh } = await supabase.auth.getSession();
        const token = fresh.session?.access_token;
        if (!token)
          throw new Error('Your session expired — please sign in again.');

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
                // create-order re-derives ownership of every path from the
                // authenticated uid and drops anything that is not this buyer's
                // (sanitizeAttachments, T021). This list is a claim, not a grant.
                attachments,
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
    // `attachments` is NOT optional here. Without it this callback closes over the
    // list as it was on the render that created it — which is always the empty one,
    // because files are attached after the form first paints. The order would post
    // `attachments: []` no matter how many files the buyer uploaded, and nothing
    // would look wrong: the uploads succeed, the thumbnails appear, the order is
    // created. Only the operator, later, finds nothing attached.
    [stage, attemptNonce, attachments]
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

  // ---- the account gate -------------------------------------------------
  // Rendered in place of the intake form, never as a redirect, so `?sku=` and the
  // order summary stay on screen while they sign in. Someone who has chosen a
  // $3,500 package should not lose that choice to an auth bounce.
  if (!authLoading && !session) {
    return shell(
      <>
        <header className="mb-8">
          <h1 className="mb-2 !text-2xl font-bold sm:!text-3xl">Checkout</h1>
          <p className="text-base-content">
            Your order is tied to an account, so you can always come back to it.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="order-2 min-w-0 lg:order-1">
            <div
              role="tablist"
              aria-label="Sign in or create an account"
              className="tabs tabs-boxed mb-6"
            >
              {(['signin', 'signup'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  type="button"
                  aria-selected={authTab === t}
                  className={`tab min-h-11 ${authTab === t ? 'tab-active' : ''}`}
                  onClick={() => setAuthTab(t)}
                >
                  {t === 'signin' ? 'Sign in' : 'Create an account'}
                </button>
              ))}
            </div>

            {authTab === 'signin' ? (
              // No onSuccess handler needed: useAuth() publishes the new session
              // and this component re-renders past the gate on its own.
              <SignInForm />
            ) : (
              <>
                <SignUpForm onSuccess={() => setJustSignedUp(true)} />
                {justSignedUp && (
                  // Sign-up does NOT create a session while mailer_autoconfirm is
                  // off, so say what actually has to happen next rather than
                  // leaving them on a form that looks like it failed.
                  <div role="status" className="alert alert-info mt-4">
                    <div className="min-w-0">
                      <p className="font-semibold">Confirm your email</p>
                      <p className="text-sm">
                        We sent you a link. Open it, then return to this page —
                        your selection is kept in the address bar.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="order-1 min-w-0 lg:order-2">
            <CheckoutSummary product={product} amountDueNow={due} />
          </div>
        </div>
      </>
    );
  }

  return shell(
    <>
      {/* Self-driven off usePaymentConsent — it decides its own visibility. */}
      <PaymentConsentModal />

      <header className="mb-8">
        <h1 className="mb-2 !text-2xl font-bold sm:!text-3xl">Checkout</h1>
        {/* This said "No account needed. Terms are shown before payment." until
            2026-08-07. #613 replaced guest checkout with a required account and
            updated the copy on the GATE (see the signed-out branch above) but not
            here — so a buyer who had just been made to create an account was then
            told they did not need one. The two branches of this page must agree
            about whether an account is required. */}
        <p className="text-base-content">
          Signed in — your order is saved to your account. Terms are shown
          before payment.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_20rem]">
        {/* sh-plate is the raised panel the rest of the product puts a form on —
            /sign-in and /reset-password both use exactly this (sign-in/page.tsx:135).
            Without it the intake fields floated directly on the page background,
            which is the largest single reason this screen did not look like the
            rest of the app. */}
        <div className="sh-plate order-2 min-w-0 rounded-[26px] px-6 py-8 sm:px-8 lg:order-1">
          <IntakeForm
            onSubmit={onSubmit}
            busy={busy}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
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
