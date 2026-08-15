import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import styles from './pricing.module.css';

// FONT FACES ARE VENDORED (#730). These were fetched from Google at BUILD time, which
// killed the production deploy of an unrelated hotfix. The @font-face rules now live in
// src/app/fonts.generated.css — copied verbatim from the generated output, so the
// unicode-range splits and size-adjust fallback metrics are unchanged.
//
// Shaped as `{ className }` so all 19 call sites below are untouched.
const display = { className: 'sh-font-special-elite' };
const body = { className: 'sh-font-plex-sans' };
const mono = { className: 'sh-font-plex-mono' };

export const metadata: Metadata = {
  // This route claims its own URL (#668).
  alternates: { canonical: '/pricing/' },
  openGraph: { url: '/pricing/' },
  title: 'Pricing - ScriptHammer',
  description:
    "We don't sell business portals without running one. Fixed-scope, fixed-price builds for local businesses, and productized packs for developers.",
};

/**
 * Pricing storefront — feature 050, screen 01.
 *
 * Ported from docs/design/commerce/pricing-demo.html, which is the actual design.
 * An earlier pass built this from the wireframe alone and got it badly wrong: it
 * dropped Care Plan Pro, invented three developer tiers that do not exist, lost
 * every SKU and tagline, and rendered in the default DaisyUI theme. The wireframe
 * is a layout abstraction; the demo is the design. Read the demo.
 *
 * BACKEND-FREE ON PURPOSE. #557 (050 Phase 1) is blocked on Supabase, but that
 * blocker is the `products` table and the create-order Edge Function — not the
 * storefront. Products are literals here; when the catalog lands they move to it
 * and the markup does not change. The SKUs below are the ones the demo names, so
 * they can be matched to catalog rows directly.
 */

/**
 * Buy actions route to /checkout?sku= — a real URL, not a drawer and not the
 * booking page. 01-pricing.svg:163 specified this from the start; the first
 * implementation sent all nine buttons to /schedule, which books a call and
 * takes no money.
 */
const checkoutHref = (sku: string) =>
  `/checkout?sku=${encodeURIComponent(sku)}`;

type Product = {
  sku: string;
  name: string;
  tagline: string;
  price: string;
  per?: string;
  billing: string;
  features: string[];
  cta: string;
  href: string;
  tag?: string;
  featured?: boolean;
  primary?: boolean;
  /**
   * Advertise the package, but do not offer a way to buy it.
   *
   * Set for every SKU whose catalog row is `active = false`. `/checkout` refuses
   * an inactive SKU with "That package is not available", so a Buy button here
   * was a dead end — reported from production for `svc-care` and `svc-care-pro`,
   * and true of `prd-foundry` too, which nobody had clicked yet. Three of the
   * eight buttons on this page went nowhere, and they were every subscription.
   *
   * These three are inactive DELIBERATELY, not by oversight. A recurring SKU
   * needs a plan registered at the payment provider, and the database enforces
   * it (`products_recurring_provider_check`: an active recurring row must carry
   * a `stripe_price_id` or a `paypal_plan_id`). All three carry neither, so they
   * literally cannot be activated until those plans exist. See src/types/commerce.ts:77.
   *
   * Clearing this flag without creating the plans first does not make the
   * package sellable — it moves the failure from an honest "not available",
   * shown BEFORE the buyer invests anything, to a declined charge AFTER they
   * have filled in the intake form and entered a card.
   *
   * Enforced by tests/e2e/commerce/pricing-links.spec.ts, which walks every
   * checkout link on this page and fails if one dead-ends.
   */
  comingSoon?: boolean;
};

const BUSINESS: Product[] = [
  {
    sku: 'svc-discovery',
    name: 'Discovery',
    tagline: 'Prove it works before you commit.',
    price: '$250',
    billing: 'One-time',
    features: [
      'Deployed staging page on a real URL',
      'Working contact form',
      'Mobile + Lighthouse pass',
      'Credited in full toward any build within 30 days',
    ],
    cta: 'Select',
    href: '',
    primary: true,
  },
  {
    sku: 'svc-landing',
    name: 'Landing Page',
    tagline: 'One page. Live on your domain. Leads in your inbox.',
    price: '$1,200',
    billing: 'One-time · 50% deposit',
    features: [
      'Single page, your domain, SSL',
      'Form wired to your inbox and phone',
      'Click-to-call + LocalBusiness schema',
      'Lighthouse ≥ 90, OG tags, favicon',
      '2 revision rounds',
    ],
    cta: 'Select',
    href: '',
    tag: 'Most common',
    featured: true,
    primary: true,
  },
  {
    sku: 'svc-site',
    name: 'Business Site',
    tagline: 'The full presence, built to rank locally.',
    price: '$3,500',
    billing: 'One-time · 50% deposit',
    features: [
      '5–7 pages incl. service pages',
      'Project gallery',
      'Local SEO + structured data',
      'Blog scaffold + analytics',
      '3 revision rounds',
    ],
    cta: 'Select',
    href: '',
    primary: true,
  },
  {
    sku: 'svc-care',
    name: 'Care Plan',
    tagline: 'Someone answers when it breaks.',
    price: '$99',
    per: '/ month',
    billing: 'Recurring',
    features: [
      'Hosting, SSL, daily backups',
      'Dependency + security updates',
      'Uptime monitoring',
      '30 min of edits per month',
    ],
    cta: 'Subscribe',
    href: '',
    primary: true,
    comingSoon: true,
  },
  {
    sku: 'svc-care-pro',
    name: 'Care Plan Pro',
    tagline: 'Care Plan, plus someone who keeps it current.',
    price: '$249',
    per: '/ month',
    billing: 'Recurring',
    features: [
      'Everything in Care Plan',
      'Content updates',
      'Monthly performance report',
      '2 hrs of edits, priority turnaround',
    ],
    cta: 'Subscribe',
    href: '',
    primary: true,
    comingSoon: true,
  },
];

const DEVELOPERS: Product[] = [
  {
    sku: 'prd-forge',
    name: 'Forge',
    tagline: 'The starter. Take it, ship it, keep it.',
    price: 'Free',
    billing: 'Open source',
    features: [
      'Next.js 15 + React 19 + TypeScript',
      '680+ tests, PWA, 34 themes',
      'Auth, payments, encrypted messaging',
      'MIT licensed, community support',
    ],
    cta: 'Clone the repo',
    href: 'https://github.com/TortoiseWolfe/ScriptHammer',
  },
  {
    sku: 'prd-anvil',
    name: 'Anvil',
    tagline: 'A vertical, productized.',
    price: '$149',
    billing: 'One-time',
    features: [
      'One industry template (Roofer, HVAC, Plumber, Landscaper)',
      'Copy, layout, and schema tuned for the trade',
      'Commercial license, unlimited client sites',
      'Lifetime updates to that pack',
    ],
    cta: 'Select',
    href: '',
    tag: 'Best value',
    featured: true,
    primary: true,
  },
  {
    sku: 'prd-foundry',
    name: 'Foundry',
    tagline: 'Every pack, and the ones not built yet.',
    price: '$49',
    per: '/ month',
    billing: 'Recurring',
    features: [
      'All vertical packs',
      'New packs as they ship',
      'Private channel',
      'Priority issue triage',
    ],
    cta: 'Subscribe',
    href: '',
    primary: true,
    comingSoon: true,
  },
  {
    sku: 'prd-office-hours',
    name: 'Office Hours',
    tagline: 'Bring a goal. Leave with something running.',
    price: '$99',
    billing: 'One-time',
    features: [
      '90-minute live 1:1 session',
      'Bring a goal, leave with something running',
      'Screen-share, real code, your questions',
      'Recording is yours to keep',
    ],
    cta: 'Select',
    href: '',
    primary: true,
  },
  {
    sku: 'prd-field-study',
    name: 'Field Study',
    tagline: 'Your first client site, built with you, on stream.',
    price: '$2,500',
    billing: 'One-time',
    features: [
      'Two weeks, done-with-you',
      'Real client, real deployment',
      'Recorded and yours to keep',
      'Pricing and scoping coaching included',
    ],
    cta: 'Select',
    href: '',
    primary: true,
  },
];

function Card({ p }: { p: Product }) {
  // An empty href means "this is a buy action" — derive the checkout URL from the
  // SKU so the data cannot drift out of step with the route.
  const href = p.href || checkoutHref(p.sku);
  const external = href.startsWith('http');
  const btn = `${styles.btn} ${p.primary ? styles.btnPrimary : ''} ${mono.className}`;
  // Never gets .btnPrimary — a copper-filled slab reads as the primary action of
  // the card, which is the opposite of what this says.
  const btnSoon = `${styles.btnSoon} ${mono.className}`;

  // No Tailwind padding on .card — the module sets 24px 20px to match the demo.
  // A `p-5` utility would fight it and win.
  return (
    <div className={`${styles.card} ${p.featured ? styles.feat : ''}`}>
      {p.tag && (
        <span className={`${styles.tag} ${mono.className}`}>{p.tag}</span>
      )}

      <p className={`${styles.sku} ${mono.className} mb-3`}>{p.sku}</p>
      {/* text-[1.16rem] is NOT redundant with .name's font-size. globals.css:688 has
          `h3:not([class*='text-']) { font-size: var(--text-2xl) }` — specificity
          (0,1,1), which beats a CSS-module class (0,1,0). Without a `text-` class in
          the list this renders at 36px and every two-word name wraps. The :not() is
          the escape hatch that rule is built around; this is how you opt out. */}
      <h3 className={`${styles.name} ${display.className} mb-2 text-[1.16rem]`}>
        {p.name}
      </h3>
      <p className={`${styles.tagline} mb-4`}>{p.tagline}</p>

      <p className={styles.price}>
        <span className={`${styles.amt} ${display.className}`}>{p.price}</span>
        {p.per && <span className={styles.per}>{p.per}</span>}
      </p>
      <p className={`${styles.billing} ${mono.className} mb-5`}>{p.billing}</p>

      <ul className={styles.feats}>
        {p.features.map((f) => (
          <li key={f}>
            <span className="min-w-0 break-words">{f}</span>
          </li>
        ))}
      </ul>

      {/* .feats carries flex:1, which is what pins every CTA to the same baseline
          across cards with different bullet counts. */}
      <div>
        {p.comingSoon ? (
          // No <a> and no <button> — see Product.comingSoon. Emitting a disabled
          // control would still invite the click that discovers the dead end, and
          // emitting a link is the bug this replaces.
          <span className={btnSoon} data-testid="coming-soon">
            Coming soon
          </span>
        ) : external ? (
          <a className={btn} href={href} target="_blank" rel="noreferrer">
            {p.cta}
          </a>
        ) : (
          <Link className={btn} href={href}>
            {p.cta}
          </Link>
        )}
      </div>
    </div>
  );
}

function Lane({ products, note }: { products: Product[]; note: string }) {
  return (
    <>
      <p className={`${styles.laneNote} mt-4 mb-8 text-center`}>{note}</p>
      <div className={styles.grid}>
        {products.map((p) => (
          <Card key={p.sku} p={p} />
        ))}
      </div>
    </>
  );
}

export default function PricingPage() {
  return (
    <div className={`${styles.root} ${body.className}`}>
      <main className={`${styles.wrap} w-full py-10 md:py-14`}>
        <header className="mb-10 text-center">
          <p className={`${styles.eyebrow} ${mono.className} mb-5`}>
            Two lanes, one checkout
          </p>
          <h1
            className={`${styles.headline} ${display.className} mx-auto mb-5 max-w-3xl !text-3xl sm:!text-4xl md:!text-5xl`}
          >
            We don&apos;t sell business portals without running one.
          </h1>
          <p className={`${styles.lede} mx-auto max-w-xl`}>
            Every package below is a row in the{' '}
            <code className={mono.className}>products</code> table. Pricing is
            resolved server-side at checkout — the browser never sets the
            amount.
          </p>
        </header>

        {/*
          Radio inputs, not role="tab". DaisyUI's documented radio-tabs snippet puts
          role="tab" on <input type=radio> and nests the panels inside the tablist;
          axe rejects that on three counts, one CRITICAL (aria-required-children),
          measured live on this page. These genuinely are radios choosing a lane, so
          a fieldset + legend states that honestly and needs no client JS.
        */}
        <fieldset className="mb-2 text-center">
          <legend className="sr-only">Choose a pricing lane</legend>
          <div className={styles.lanes}>
            <input
              type="radio"
              name="lane"
              className={`${styles.lane} ${mono.className}`}
              aria-label="For your business"
              defaultChecked
            />
            <input
              type="radio"
              name="lane"
              className={`${styles.lane} ${mono.className}`}
              aria-label="For developers"
            />
          </div>
        </fieldset>

        {/* Both lanes render; CSS shows the one whose radio is checked. Keeps this
            a server component with zero JS. */}
        <div className={styles.laneBusiness}>
          <h2 className="sr-only">For your business</h2>
          <Lane
            products={BUSINESS}
            note="Done-for-you builds for local businesses. Fixed scope, fixed price, no hourly surprises."
          />
        </div>
        <div className={styles.laneDevelopers}>
          <h2 className="sr-only">For developers</h2>
          <Lane
            products={DEVELOPERS}
            note="Build it yourself on the same rails this storefront runs on."
          />
        </div>

        <section className={`${styles.panel} mt-10 p-8 text-center`}>
          <h2 className={`${display.className} mb-2 text-xl`}>
            Not sure which one?
          </h2>
          <p className={`${styles.laneNote} mb-6`}>
            Book 15 minutes. Bring a screenshot of what you have in mind.
          </p>
          <Link
            href="/schedule"
            className={`${styles.btn} ${mono.className} mx-auto max-w-xs`}
          >
            Book a call
          </Link>
        </section>

        {/* The demo carried this three-column note and it is the most honest thing
            on the page — it states what exists, what this feature adds, and the cap
            that currently blocks the two largest packages. Keeping it. */}
        <section
          className={`${styles.footNote} mt-12 grid gap-8 pt-8 md:grid-cols-3`}
        >
          <div>
            <h2 className="mb-2 text-[0.86rem]">Already built</h2>
            <p>
              13 Supabase Edge Functions, Stripe + PayPal, webhooks, offline
              queue, subscription retry with grace period, GDPR consent gate,
              admin dashboard.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-[0.86rem]">This PRD adds</h2>
            <p>
              <code className={mono.className}>products</code> and{' '}
              <code className={mono.className}>orders</code> tables, a{' '}
              <code className={mono.className}>create-order</code> Edge
              Function, guest checkout via anonymous auth, and the storefront
              you&apos;re looking at.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-[0.86rem]">Blocker it removes</h2>
            <p>
              <code className={mono.className}>payment_intents.amount</code> is
              capped at{' '}
              <span className={`${styles.danger} font-semibold`}>$999.99</span>{' '}
              in both config and schema. Nothing above Discovery can be sold
              until that ships.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
