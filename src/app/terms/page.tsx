import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  // This route claims its own URL (#668).
  alternates: { canonical: '/terms/' },
  openGraph: { url: '/terms/' },
  title: 'Terms of Service - ScriptHammer',
  description:
    'The terms that govern purchases of ScriptHammer services and products, including payment, refunds, cancellation and ownership of delivered work.',
};

export default function TermsOfServicePage() {
  // WHY THIS PAGE EXISTS (#773). The storefront sells one-time work up to $3,500
  // and monthly plans up to $249, and there were no published terms at all — no
  // refund policy, no scope definition, no cancellation or auto-renewal terms, no
  // limitation of liability. Worse, the payment consent modal already told every
  // buyer "By accepting, you agree to our payment processing terms" while linking
  // only to the Privacy Policy, so the product asserted agreement to a document
  // that did not exist.
  //
  // THIS IS A STARTING POINT, NOT LEGAL ADVICE. It is written to be accurate about
  // what this business actually does rather than to be comprehensive. Anyone
  // selling at these amounts should have it reviewed. Prices and plan names below
  // are stated in general terms on purpose — the `products` table is the only
  // authority on price, and duplicating figures here would create a second one
  // that drifts.
  const lastUpdated = '2026-08-16';

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8 md:py-12">
      <header>
        <h1 className="mb-6 !text-2xl font-bold sm:mb-8 sm:!text-4xl md:!text-5xl">
          Terms of Service
        </h1>
      </header>

      <article className="sh-doc">
        <p className="text-base-content mb-6 text-sm">
          Last updated: {lastUpdated}
        </p>

        <section className="mb-8">
          <h2>1. Who these terms are between</h2>
          <p>
            These terms govern your purchase and use of services and digital
            products from ScriptHammer (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By
            placing an order, or by accepting the payment consent prompt at
            checkout, you agree to them. If you are buying on behalf of a
            company, you confirm you are authorised to accept these terms for
            it.
          </p>
          <p>
            How we handle your personal information is covered separately in our{' '}
            <Link href="/privacy" className="link-hover link">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2>2. What we sell</h2>
          <p>
            We offer <strong>one-time project work</strong> — discovery
            sessions, landing pages and full business sites — alongside
            <strong> digital products</strong> and{' '}
            <strong>monthly plans</strong> covering hosting, updates and
            support. Current prices, inclusions and availability are shown on
            our{' '}
            <Link href="/pricing" className="link-hover link">
              pricing page
            </Link>
            , which is the authoritative statement of what a given item costs at
            the time you buy it.
          </p>
          <p>
            Some items are marked as not yet available. Those cannot be
            purchased, and nothing on this page should be read as an offer to
            sell them.
          </p>
        </section>

        <section className="mb-8">
          <h2>3. Payment</h2>
          <p>
            Prices are in US dollars unless stated otherwise. Card payments are
            processed by our payment providers; we never receive or store your
            full card details. One-time work is charged when you place the
            order. Where an item is offered on a deposit basis, the deposit is
            charged up front and the balance becomes due as described at
            checkout.
          </p>
          <p>
            <strong>The price shown at checkout is the price charged.</strong>{' '}
            Amounts are determined on our servers from our catalogue, not from
            anything your browser sends.
          </p>
        </section>

        <section className="mb-8">
          <h2>4. Subscriptions, renewal and cancellation</h2>
          <p>
            Monthly plans <strong>renew automatically</strong> each month at the
            then-current price until you cancel. We will tell you in advance of
            any price change, and you may cancel before it takes effect.
          </p>
          <p>
            You can cancel at any time from your account. Cancellation takes
            effect at the end of the billing period you have already paid for —
            you keep access until then, and you are not charged again. We do not
            pro-rate partial months.
          </p>
          <p>
            We may suspend or cancel a plan if payment fails repeatedly. Where
            that happens you will have a grace period to update your payment
            details before access ends.
          </p>
        </section>

        <section className="mb-8">
          <h2>5. Refunds</h2>
          <p>
            <strong>Before work begins</strong> on a one-time project, you may
            cancel for a full refund.
          </p>
          <p>
            <strong>Once work has begun</strong>, we refund the portion not yet
            performed. Deposits covering work already carried out are not
            refundable.
          </p>
          <p>
            <strong>Digital products</strong> delivered immediately are not
            refundable once downloaded or accessed, except where the product is
            faulty or not as described.
          </p>
          <p>
            <strong>Subscriptions</strong> are not refunded for the current
            period; cancelling stops the next charge.
          </p>
          <p>
            Voluntary contributions (for example the tip jar) are not
            refundable.
          </p>
          <p>
            None of this limits rights you have under consumer law that cannot
            be excluded by agreement.
          </p>
        </section>

        <section className="mb-8">
          <h2>6. Scope, changes and your input</h2>
          <p>
            Project work is delivered against the scope agreed in writing before
            it starts. Work outside that scope is a change: we will quote it,
            and it proceeds only once you approve the quote.
          </p>
          <p>
            Delivery depends on your input — content, access, credentials, and
            timely feedback. Where those are delayed, timelines move
            accordingly. If a project stalls on our side beyond an agreed date,
            you may cancel under section 5.
          </p>
        </section>

        <section className="mb-8">
          <h2>7. Ownership of delivered work</h2>
          <p>
            <strong>You own what you paid us to make</strong> — the code,
            content and configuration produced specifically for you — once the
            work is paid for in full.
          </p>
          <p>
            We retain ownership of our pre-existing and general-purpose
            materials: templates, libraries, tooling and know-how that existed
            before your project or that we develop for general use. You receive
            a perpetual, non-exclusive licence to use those as part of the
            delivered work.
          </p>
          <p>
            Third-party components keep their own licences. Open-source
            dependencies remain governed by those licences, not by this
            agreement.
          </p>
          <p>
            You retain ownership of everything you supply to us, and you confirm
            you have the right to supply it.
          </p>
        </section>

        <section className="mb-8">
          <h2>8. Acceptable use</h2>
          <p>
            You agree not to use our services to break the law, to infringe
            someone else&rsquo;s rights, or to send unsolicited bulk messages.
            We may decline or discontinue work that would require us to do any
            of those things.
          </p>
        </section>

        <section className="mb-8">
          <h2>9. Warranties and limitation of liability</h2>
          <p>
            We provide our services with reasonable skill and care. Beyond that,
            and to the extent the law allows, services and products are provided
            <strong> &ldquo;as is&rdquo;</strong> without further warranty —
            including any implied warranty of merchantability or fitness for a
            particular purpose.
          </p>
          <p>
            <strong>
              Our total liability for any claim is limited to the amount you
              paid us for the item the claim relates to
            </strong>
            , in the twelve months before the claim arose. We are not liable for
            indirect or consequential losses, including lost profits, lost
            revenue or lost data.
          </p>
          <p>
            Nothing here excludes liability that cannot lawfully be excluded,
            including for fraud or for death or personal injury caused by
            negligence.
          </p>
        </section>

        <section className="mb-8">
          <h2>10. Third-party services</h2>
          <p>
            Delivered work may rely on third-party services — hosting, payment
            processing, email delivery, analytics and similar. Those services
            are governed by their own terms, and we are not responsible for
            their availability or their changes. Where a third-party service we
            selected becomes unavailable, we will work with you on a
            replacement; that work is scoped under section 6.
          </p>
        </section>

        <section className="mb-8">
          <h2>11. Changes to these terms</h2>
          <p>
            We may update these terms. The version in force for a purchase is
            the one published when you placed that order. Material changes
            affecting an active subscription take effect at your next renewal,
            and we will tell you before that happens.
          </p>
        </section>

        <section className="mb-8">
          <h2>12. Governing law</h2>
          <p>
            These terms are governed by the laws of the State of Tennessee, USA,
            and the courts of that state have jurisdiction — without affecting
            any right you have to bring a claim where you live.
          </p>
        </section>

        <section className="mb-8">
          <h2>13. Contact</h2>
          <p>
            Questions about these terms, an order, or a refund should go through
            our{' '}
            <Link href="/contact" className="link-hover link">
              contact page
            </Link>
            . We would much rather hear from you directly than have you raise a
            dispute with your bank — we can usually fix things faster.
          </p>
        </section>
      </article>
    </main>
  );
}
