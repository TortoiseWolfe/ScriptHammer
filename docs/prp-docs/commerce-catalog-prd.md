# PRD 050 — Commerce Catalog & Storefront

**Repo path:** `features/payments/050-commerce-catalog/spec.md`
**Status:** Draft — corrected against verified code 2026-08-06
**Author:** Jonathan Pohlner (TortoiseWolfe)
**Date:** 2026-08-06
**Depends on:** `features/payments/038–042`

> **Numbering.** This was drafted as 016 targeting `specs/`. Both were wrong.
> `specs/` is the dead tree — `.specify/scripts/bash/config.sh` sets
> `SPEC_KIT_FEATURES_ROOT="features"`. 016 collides with
> `features/auth-oauth/016-messaging-critical-fixes/`, and 049 is reserved for
> Model City at `features/IMPLEMENTATION_ORDER.md:274`. 048 is the ceiling, so
> this is **050**. Note `create-new-feature.sh` auto-numbering picks 049 and must
> be overridden with `--number 50`.
>
> **Corrections applied.** Two audits checked every claim below against the code.
> Where this document was wrong, it has been fixed in place and the correction is
> marked `[CORRECTED]`. The design decisions in §5–§10 that changed are marked
> `[DECIDED]`.

---

## 1. Summary

ScriptHammer has production payment **rails** — Stripe and PayPal, one-time and
recurring, Supabase Edge Functions, webhooks, offline queue, retry schedule,
admin dashboard, RLS. What it does not have is a **catalog**: there is no
concept of a product, a package, or a price list. Every amount is authored by
the caller at the call site.

This PRD adds the missing layer: a server-authoritative product catalog, a
public `/pricing` storefront, guest checkout, and an order record that says
_what was bought_ alongside the existing record of _what was paid_.

**The dogfooding argument:** ScriptHammer's business model is selling business
portals. Selling business portals from a repo that cannot take an order for a
$1,200 website is not a credible position. The storefront is simultaneously the
product demo, the reference implementation forkers copy, and the thing that
collects the money.

---

## 2. Why now

A real inbound lead is the forcing function. Warrior Roofing Inc (Chattanooga,
TN) wants a landing page finished. Quoting that job requires a price list.
Collecting on it requires checkout. Today the repo can do neither — and the
`payment_intents` amount ceiling is **$999.99**, so it literally cannot accept
payment for the job being quoted.

Warrior Roofing is also field study #2 (after RaisedPaws). Storm-restoration
roofing has hundreds of near-identical businesses within 100 miles of
Chattanooga. Building the vertical template once makes the second sale a
four-hour job. That repeatability is the actual asset — and it only compounds
if there is a storefront to sell it through.

---

## 3. What already exists (audit)

This is the good news, and it is substantial. **Do not rebuild any of it.**

### Supabase Edge Functions — `supabase/functions/`

| Function                                                             | Purpose                                           |
| -------------------------------------------------------------------- | ------------------------------------------------- |
| `create-stripe-checkout`                                             | One-time Checkout Session from a `payment_intent` |
| `create-stripe-subscription`                                         | Recurring subscription from a Stripe Price        |
| `verify-stripe-session`                                              | Redirect-path verification                        |
| `stripe-webhook`                                                     | Signature-verified event ingest                   |
| `create-paypal-order` / `capture-paypal-order`                       | PayPal one-time                                   |
| `create-paypal-subscription`                                         | PayPal recurring                                  |
| `paypal-webhook`                                                     | PayPal event ingest                               |
| `cancel-subscription` / `resume-subscription` / `retry-subscription` | Lifecycle                                         |
| `send-payment-email`                                                 | Resend-backed receipts                            |

### Tables — `supabase/migrations/20251006_complete_monolithic_setup.sql`

`payment_intents`, `payment_results`, `subscriptions`, `webhook_events`,
`payment_provider_config`, `edge_idempotency_keys` — all with RLS policies.
Intents are immutable (`FOR UPDATE USING (false)`) and undeletable by users.

### Components — `src/components/payment/` `[CORRECTED]`

`src/components/payment/` is a **standalone domain folder, not an atomic tier** —
a sibling of `atomic/`, `molecular/`, `organisms/`. It holds **eight**
components, not the five originally listed here:

`PaymentButton`, `PaymentHistory`, `PaymentStatusDisplay`,
`PaymentConsentModal`, `PaymentQueuePanel`, **`SubscriptionManager`**,
**`SwitchProviderPanel`**, **`OfflineRetryBanner`**.

Genuinely tiered elsewhere: `AdminPaymentPanel` (`organisms/`),
`PaymentTrendChart` (`molecular/`), `CalendarEmbed` (`atomic/`).

`SubscriptionManager` is the omission that matters — it is the Care Plan cancel
path, so the Care Plan work in Phase 3 extends it rather than building new.

All follow the mandatory 5-file pattern.

### Supporting

- `src/lib/payments/{stripe.ts, payment-service.ts}` — note the path: there is no
  `src/services/payment/`; `src/services/` holds only `admin/` and `messaging/`
- `src/lib/offline-queue/payment-adapter.ts` — queued payments survive offline
- `src/hooks/{usePaymentButton, usePaymentConsent, usePaymentRealtime, usePaymentRetryStatus, usePaymentResultsRealtime}`
- `src/config/payment.ts` — provider config, feature flags, validation
- `src/types/payment.ts` — full type surface
- Routes: `/payment`, `/payment-demo`, `/payment-result`, `/admin/payments`
- GDPR payment consent gating before any provider SDK loads
- Subscription retry schedule (days 1/3/7) + 7-day grace period

### Scheduling — already built (Feature 013)

- `/schedule` route, live
- `src/components/atomic/CalendarEmbed/` — supports
  `mode: 'inline' | 'popup'`, `url` override, and **`prefill: { name, email }`**
- `src/components/calendar/providers/{CalendlyProvider, CalComProvider}.tsx`
- `src/components/calendar/CalendarConsent.tsx` — gates the embed on
  `useConsent().consent.functional`; no third-party script loads before consent.
  **`[CORRECTED]` The gate is unconditional and is evaluated at
  `CalendarEmbed.tsx:64-76`, _before_ `mode` is read at line 90.** It applies to
  `popup` exactly as it applies to `inline`. See §7.
- `src/config/calendar.config.ts` — `NEXT_PUBLIC_CALENDAR_URL`,
  `NEXT_PUBLIC_CALENDAR_PROVIDER`, and a `utm` block typed at `:5-9` as
  `source`/`medium`/`campaign` — **with no `content` field**, so the
  `utm_content={order_id}` this PRD asks for has nowhere to live (see §7)
- `src/hooks/useEmbedThemeColor.ts` — embed inherits the active DaisyUI theme

### File upload — already built (Feature 022)

- `avatars` storage bucket with `file_size_limit` (5MB) and
  `allowed_mime_types` enforced **at the bucket**, not just client-side
- Four RLS policies on `storage.objects` scoped by first path segment
- `src/components/molecular/AvatarUpload/` + `useAvatarUpload.ts`
- `src/lib/avatar/validation.ts` — MIME check, size check, real-image decode via
  `createImageBitmap`, dimension floor

**Verdict: the hard part is done.** This PRD is a catalog on top, not a payment
system — and neither the uploader nor the scheduler needs to be built from
scratch. Both get a second configured instance.

---

## 4. Gaps (verified against code, not assumed)

### GAP 1 — $999.99 ceiling `[BLOCKER]` `[CORRECTED]`

Enforced in **three** places, not two:

```
migration:38                  amount INTEGER NOT NULL CHECK (amount >= 100 AND amount <= 99999)
src/config/payment.ts:189-192 paymentLimits = { minAmount: 100, maxAmount: 99999 }
src/types/payment.ts:34       amount: number; // Cents (100-99999)
```

**Only the migration CHECK is a real control.** `validatePaymentAmount`
(`src/config/payment.ts:209-220`) is called from `payment-service.ts:134`, which
runs in the browser — a tampered client skips it entirely. Treat the other two as
documentation that must not drift, not as enforcement.

It also does **not** validate integer-ness, `NaN`, or `Number.isFinite`. Nothing
today feeds it user input, so that has never mattered. A pay-what-you-want field
is precisely what makes it matter (see §5, tip jar).

Separately: **the ceiling was never on subscriptions at all.**
`subscriptions.plan_amount` is `CHECK (plan_amount >= 100)` with **no upper
bound**. Care Plan Pro at $249/mo was never blocked; Care Plan was never capped.

Every service package except Discovery is unsellable. Fixing config alone
produces a DB constraint violation.

### GAP 2 — No product catalog `[CORRECTED]`

**Seventeen** tables, not nineteen; none is `products` or `prices`.
`PaymentButton` takes a raw `amount` prop. There is nowhere to define
"Landing Page = $1,200."

The "19" came from `src/lib/supabase/types.ts`, which declares two tables the
migration never creates. **The generated type surface and the schema are already
out of sync by two tables** — worth its own ticket, independent of this feature.

### GAP 3 — Prices originate client-side `[SECURITY]` `[CORRECTED — worse than described]`

The one-time path is as described. `create-stripe-checkout` is careful: it
receives only `{ payment_intent_id }`, re-reads the row via service-role, and
uses `intent.amount`. But the _row_ is inserted by the browser under RLS
`INSERT WITH CHECK (auth.uid() = template_user_id)`, so nothing constrains the
amount beyond the CHECK range. A buyer inserts `amount: 100` with
`description: "Business Site — $3,500"` and checks out for a dollar.

**Two things this PRD originally missed.**

**(a) The recurring path has no allowlist whatsoever.**
`create-stripe-subscription/index.ts:80` accepts a **client-supplied `price_id`**
and passes it through with no validation. `create-paypal-subscription` does the
same with `plan_id`. A buyer can subscribe to _any_ Price in the Stripe account,
including a $1 test Price. A catalog that only covers one-time checkout would
ship Care Plan with this hole still open.

**(b) There are three client WRITE sites, not one.** Verified by enumerating
every `.from('payment_intents')` in `src/` and filtering to write operations —
seven call sites exist, four of which are reads:

```
src/lib/payments/payment-service.ts:179-180        createPaymentIntent  (.insert)
src/lib/payments/payment-service.ts:371-372        retryFailedPayment   (.upsert)
src/lib/offline-queue/payment-adapter.ts:166-167   offline-queue drain  (.upsert)
```

All three must move behind `create-order` before the client INSERT can be
revoked. That is why closing this gap is its own phase (2c) and not a footnote on
the catalog work.

**The trust boundary must move:** the client sends a `product_id`; the Edge
Function resolves the price server-side and ignores any client-supplied amount.
For recurring, it resolves `stripe_price_id` / `paypal_plan_id` **from the
catalog row**, never from the request. Once all three INSERT sites are behind the
function, revoke the client INSERT policy **and** the `INSERT` in
`GRANT SELECT, INSERT, UPDATE ON payment_intents TO authenticated`
(`migration:1661`).

Two dead-code findings surfaced while verifying this, both worth their own small
tickets:

- **The `UPDATE` in that GRANT is already dead.** `"Payment intents are
immutable"` is `FOR UPDATE USING (false)`, so nothing can ever use it. It reads
  as a live capability and is not one.
- **Resolved in #565: `cancelPaymentIntent` was removed.** It had issued a
  `.delete()` against a `FOR DELETE USING (false)` policy, which no-oped without
  erroring. A future cancellation flow needs a real server-side state
  transition rather than a client delete.
- **`create-stripe-subscription`'s own header comment is untrue.** Lines 32-39
  state "the `price_id` is operator-configured in Stripe Dashboard", but `:80`
  reads it straight from the request body. The comment describes the intended
  design; the code implements a different one. Fixing the code (2b above) makes
  the comment true — do not fix the comment alone.

### GAP 4 — No guest checkout `[CONVERSION]`

```sql
template_user_id UUID NOT NULL REFERENCES auth.users(id)
```

plus RLS `auth.uid() = template_user_id`.

A roofer must create an account, confirm an email, and log in before paying an
invoice. This is a conversion killer for the exact buyer this storefront
targets.

### GAP 5 — One subscription price

`NEXT_PUBLIC_STRIPE_PRICE_ID` is singular. Two care-plan tiers need a
catalog-driven mapping from product → provider price ID.

### GAP 6 — No order record

`payment_results` records that money moved. Nothing records what was purchased,
what is owed, or where fulfillment stands. Post-purchase there is no answer to
"what did this person buy."

### GAP 7 — No intake capture

There is nowhere for a buyer to say what they actually want. The single highest-
value input for a website build is **the screenshot or sketch of what they have
in mind** — the Warrior Roofing lead arrived as four screenshots in a WhatsApp
thread, and determining whether they were the existing site or the target took
real work. That belongs on the order, not in a messaging app.

The `avatars` bucket proves the pattern but is the wrong instance: it is
`public: true`, capped at 5MB, images only, and single-file. Intake needs
private, multi-file, larger, and PDF-capable.

`[CORRECTED]` An earlier draft also listed "one object per user" as a constraint
to relax. **It is not enforced anywhere** — no unique index, no policy, no
trigger. It is a client-side convention in `AvatarUpload` only. Do not write a
ticket to relax a constraint that does not exist.

### GAP 8 — Purchase does not lead to a conversation

`/schedule` exists and works, but nothing connects it to an order. A buyer pays
$1,200 and lands on a receipt. The next step — "when are we talking?" — falls
back to email tag. Booking should be the confirmation screen's primary action,
prefilled, and correlated to the order.

`[CORRECTED]` The _mechanism_ originally proposed for this does not work. See §7
— `mode="popup"` does not avoid the consent gate, and the shipped design is a
plain prefilled outbound link.

---

## 5. The catalog

Two lanes, one checkout. Different buyers get different language: business
buyers get plain names, developers get the ScriptHammer flavor.

### Lane A — Services (sold to local businesses)

| SKU             | Name          | Price       | Billing   | Contents                                                                                                                                                |
| --------------- | ------------- | ----------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `svc-discovery` | Discovery     | **$250**    | one-time  | Deployed staging page on a real URL, working contact form, mobile pass. Credited in full toward any build within 30 days.                               |
| `svc-landing`   | Landing Page  | **$1,200**  | one-time  | Single page, live on your domain. Form wired to your inbox and phone. Click-to-call, LocalBusiness schema, OG tags, Lighthouse ≥ 90. 2 revision rounds. |
| `svc-site`      | Business Site | **$3,500**  | one-time  | 5–7 pages, service pages, project gallery, local SEO, blog scaffold, analytics. 3 revision rounds.                                                      |
| `svc-care`      | Care Plan     | **$99/mo**  | recurring | Hosting, SSL, backups, dependency updates, uptime monitoring, 30 min of edits per month.                                                                |
| `svc-care-pro`  | Care Plan Pro | **$249/mo** | recurring | Care Plan plus content updates, monthly performance report, 2 hr of edits, priority turnaround.                                                         |

**Rules encoded in the catalog, not in prose:**

- Discovery credit: `metadata.credits_toward: ["svc-landing", "svc-site"]`, 30-day window
- Deposit split: builds bill 50% at checkout, 50% on delivery →
  `metadata.deposit_pct: 50`
- Care Plan is offered as an attach at checkout on any build SKU

### Lane B — Product (sold to developers)

| SKU               | Name        | Price                 | Billing   | Contents                                                                                                           |
| ----------------- | ----------- | --------------------- | --------- | ------------------------------------------------------------------------------------------------------------------ |
| `prd-forge`       | Forge       | **Free**              | —         | The starter. MIT. 680+ tests, PWA, auth, payments, themes. Community support.                                      |
| `prd-anvil`       | Anvil       | **$149**              | one-time  | One productized vertical template (Roofer, HVAC, Plumber, Landscaper). Commercial license, unlimited client sites. |
| `prd-foundry`     | Foundry     | **$49/mo**            | recurring | Every vertical pack, new ones as they ship, private channel, priority issue triage.                                |
| `prd-field-study` | Field Study | **$2,500**            | one-time  | Done-with-you. Your first client site built alongside you, on stream, over two weeks.                              |
| `tip-jar`         | Tip Jar     | **pay what you want** | one-time  | Not a product. A way to say thanks for the MIT template. Suggested $5 / $15 / $50.                                 |

### The tip jar `[DECIDED]`

The tip jar is the _only_ variable-amount SKU, and it exists to serve the open
source lane — Forge is free, and some people want to pay for free things.

It is deliberately **not** built as an exception to the catalog. Making it one
would mean keeping the browser's ability to author an arbitrary amount, which is
exactly GAP 3. Instead, pay-what-you-want becomes a first-class catalog concept
(`amount_mode` in §6), so the tip jar resolves through the same server-side
`create-order` path as a $3,500 build. That is what allows the client INSERT on
`payment_intents` to be revoked outright rather than merely narrowed.

**There is no existing amount input to replace.** `[CORRECTED]` An earlier reading
of the codebase described `/payment` as a route where the client authors an
arbitrary amount. That is wrong about the UI: there is no number field, slider or
`customAmount` state anywhere in the repo. `/payment-demo` renders three
`PaymentButton`s with hardcoded literals (2000, 999, 1500) at
`payment-demo/page.tsx:194-230`, and `/payment` is a tabbed account hub with no
amount control. The client-authored amount is an **API shape** — a prop that
reaches `payment_intents` via a browser INSERT — not a screen. So the tip jar
removes nothing; it is the first genuine amount-input UI in the product.

**Presentation.** A tip cup that shakes, with a hand-lettered sign. The copy
"will work for bitcoin" is a joke on the sign, **not a payment rail** — the repo
has Stripe and PayPal providers only. An actual crypto rail is out of scope here.

**The animation is the hard requirement, not the fun part.** Every guarded
animation in the codebase animates opacity only, and `globals.css:706-707` says
why: "Held to opacity so it cannot cause layout shift." A shake is a
`transform: translateX` by definition, making it the first motion in the product
to break that rule, and squarely the vestibular-trigger class WCAG 2.3.3 targets.
It must therefore:

- follow the `@utility` + nested media-query idiom of `sh-pulse`
  (`globals.css:708-724`) — there is **no `tailwind.config`**, this is Tailwind 4
  CSS-first and keyframes live in `globals.css`;
- honour **both** reduced-motion triggers: the OS media query _and_ the in-app
  toggle, which writes `data-reduce-motion="true"` onto `<html>`
  (`AccessibilityContext.tsx:94-98`). The global kill-switch in
  `src/styles/reduced-motion.css` covers only `animate-{spin,bounce,pulse,ping}`,
  so a custom `sh-shake` is **not** covered unless explicitly added — and
  `reduced-motion.test.ts` pins those class names;
- gate the JS trigger on `useReducedMotion()` (`src/hooks/useReducedMotion.ts:35`)
  so the shake never starts, rather than starting and being suppressed.

**Two open items for `/speckit.clarify`:**

1. Archived docs already specify a `/donate` route and a `DonateButton` that were
   never built (`docs/prp-docs/archive/completed/payment-integration-prp.md`,
   `docs/specs/015-payment-integration/`), and a QA plan even carries a test row
   for "preset amount selection." Adopt that vocabulary or explicitly supersede
   it — do not quietly create a second name for the same thing.
2. ~~Whether the tip jar uses the unconsumed Cash App / Chime links.~~
   **`[DECIDED]` Yes — offered alongside card.** `getCashAppLink(amount?)` and
   `getChimeLink()` at `src/config/payment.ts:149-165` become their own first
   consumer, and `featureFlags.cashAppEnabled` / `chimeEnabled` stop being dead
   code. Both are outbound handoffs with no callback, so a tip paid that way
   produces **no order row and no receipt** — the UI must say so before the
   tipper leaves the page. See §13.9.

### Positioning note

The market floor for a roofer website in 2026 is $1,500–$3,500 for a basic
build; growth tier runs $4,000–$8,500. Landing Page at $1,200 sits deliberately
just under the floor as an entry point, and Business Site at $3,500 lands at the
top of tier 1. Neither is a race to the bottom, and both leave the anchor intact
for a $5,000+ conversation later.

A `$100` price point does not appear anywhere in this catalog. If a discount is
needed, it is applied as a **visible, reasoned markdown** against a real list
price (see §11, promo codes), never as the list price itself.

---

## 6. Data model

### New table: `products`

```sql
CREATE TABLE IF NOT EXISTS products (
  id                TEXT PRIMARY KEY,              -- 'svc-landing'
  lane              TEXT NOT NULL CHECK (lane IN ('service','product')),
  name              TEXT NOT NULL,
  tagline           TEXT,
  description       TEXT,
  amount            INTEGER NOT NULL CHECK (amount >= 0),   -- cents, server-authoritative
                                                            -- for amount_mode='variable' this is the SUGGESTED default
  -- [DECIDED] pay-what-you-want as a first-class catalog concept, so the tip
  -- jar needs no bypass. See §5.
  amount_mode       TEXT NOT NULL DEFAULT 'fixed'
                      CHECK (amount_mode IN ('fixed','variable')),
  min_amount        INTEGER,
  max_amount        INTEGER,
  currency          TEXT NOT NULL DEFAULT 'usd'
                      CHECK (currency IN ('usd','eur','gbp','cad','aud')),
  type              TEXT NOT NULL CHECK (type IN ('one_time','recurring')),
  interval          TEXT CHECK (interval IN ('month','year') OR interval IS NULL),
  stripe_price_id   TEXT,      -- required when type='recurring'
  paypal_plan_id    TEXT,      -- required when type='recurring'
  features          JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  active            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- a variable SKU without bounds is an unbounded charge
  CHECK (amount_mode = 'fixed'
         OR (min_amount IS NOT NULL AND max_amount IS NOT NULL
             AND min_amount <= max_amount)),
  -- a recurring SKU without a provider price is an unresolvable subscription
  CHECK (type = 'one_time' OR stripe_price_id IS NOT NULL OR paypal_plan_id IS NOT NULL)
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public read of active products; nobody writes from the client.
CREATE POLICY "Anyone can view active products" ON products
  FOR SELECT USING (active = true);
CREATE POLICY "Products are not client-writable" ON products
  FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX idx_products_lane_sort ON products(lane, sort_order) WHERE active;
```

Seeded via migration. Edited only by service-role or the admin panel.

### New table: `orders`

```sql
CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id         UUID REFERENCES payment_intents(id),
  subscription_id   UUID REFERENCES subscriptions(id),
  product_id        TEXT NOT NULL REFERENCES products(id),
  buyer_user_id     UUID REFERENCES auth.users(id),   -- nullable: guest checkout
  buyer_email       TEXT NOT NULL,
  quantity          INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  amount_charged    INTEGER NOT NULL,                 -- cents, resolved server-side
  promo_code        TEXT,
  discount_amount   INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','paid','fulfilling','delivered','refunded','canceled')),
  fulfillment_notes TEXT,
  intake_data       JSONB NOT NULL DEFAULT '{}'::jsonb,  -- domain, business name, etc.
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (intent_id IS NOT NULL OR subscription_id IS NOT NULL)
);
```

`status` is advanced only by the webhook handler and the admin panel — never by
the client.

`intake_data` shape:

```jsonc
{
  "business": "Warrior Roofing Inc",
  // [CORRECTED] The original intake shape had no phone, while §5 promises every
  // build ships with click-to-call and "form wired to your inbox and phone".
  // For a contractor the phone IS the primary channel, and the product cannot
  // deliver what the catalog sells without asking for it. Added in Phase 1.
  "phone": "+14235550137",
  "domain": "warriorroofingtn.com",
  "notes": "Want it to look like the carrd but higher end",
  "reference_url": "https://warriorroofing.carrd.co",
  "attachments": [
    {
      "path": "a3f9c21/6b1e-hero-mockup.png",
      "name": "hero-mockup.png",
      "bytes": 812443,
      "mime": "image/png",
      "kind": "target",
    }, // "current" | "target" | "unspecified"
  ],
  "booking": { "scheduled": true, "event_uri": "https://api.calendly.com/…" },
}
```

The `kind` field is doing real work. A buyer uploading screenshots is answering
a question the operator would otherwise have to ask: _is this what you have, or
what you want?_ Make them tag it at upload time — one radio per file — and that
round-trip disappears.

### New storage bucket: `intake-uploads`

Copies the `avatars` pattern with four deliberate differences: **private**,
**10MB**, **PDF allowed**, **multi-file per user**.

```sql
-- Forward-fill for local initdb ordering (same reason as the avatars bucket:
-- the postgres image creates storage.buckets without these columns, and the
-- storage service's own migrations can't have run yet).
ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS public             boolean DEFAULT false;
ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS file_size_limit    bigint;
ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS allowed_mime_types text[];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'intake-uploads',
  'intake-uploads',
  false,        -- PRIVATE. Customer sketches are not public assets.
  10485760,     -- 10MB — screenshots of full pages and phone photos of
                -- sketches routinely exceed the avatars bucket's 5MB.
  ARRAY['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Path scheme: {auth.uid()}/{uuid}-{safe-filename}
--
-- split_part(name,'/',1), NOT storage.foldername(name). The avatars policies
-- carry a long comment on this and it applies verbatim here: foldername()
-- creates a pg_depend edge that blocks storage-api's own
-- DROP FUNCTION foldername(text) on a fresh local initdb, and storage-api
-- crash-loops forever. split_part is pg_catalog-only and equivalent for
-- policy purposes.
CREATE POLICY "Users can upload own intake files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'intake-uploads' AND
  auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can view own intake files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'intake-uploads' AND
  auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can delete own intake files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'intake-uploads' AND
  auth.uid()::text = split_part(name, '/', 1)
);

-- No public SELECT policy. Operator reads via service-role in /admin/orders.
```

`TO authenticated` is compatible with guest checkout: `signInAnonymously()`
issues a genuine authenticated session, so an anonymous buyer can upload and
read back their own files, and cannot touch anyone else's.

**Orphan cleanup.** Files uploaded by visitors who abandon checkout never get
attached to an order. A scheduled job deletes objects in `intake-uploads` older
than 7 days whose path does not appear in any `orders.intake_data.attachments`.

### Changed: amount ceiling

```sql
ALTER TABLE payment_intents DROP CONSTRAINT IF EXISTS payment_intents_amount_check;
ALTER TABLE payment_intents ADD CONSTRAINT payment_intents_amount_check
  CHECK (amount >= 100 AND amount <= 2500000);   -- $25,000.00
```

Matching `src/config/payment.ts`:

```ts
export const paymentLimits = {
  minAmount: 100, // $1.00
  maxAmount: 2_500_000, // $25,000.00 — covers Field Study, Business Site,
  // and a full custom build without a schema change
} as const;
```

$25,000 is chosen deliberately: above the largest catalog SKU with headroom,
below the point where a typo becomes catastrophic.

`[CORRECTED]` Two more edits belong with this one:

```ts
// src/types/payment.ts:34 — the documented bound on the type surface, which
// would otherwise still assert $999.99 while the DB accepts $25,000.
```

```sql
-- subscriptions.plan_amount was NEVER capped: CHECK (plan_amount >= 100) only.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_amount_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_amount_check
  CHECK (plan_amount >= 100 AND plan_amount <= 2500000);
```

### New table: `leads` `[DECIDED]`

Tracks a "book a call" conversation that has not (yet) become an order, so an
unconverted lead is visible rather than invisible.

```sql
CREATE TABLE IF NOT EXISTS leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT,                  -- null until the Calendly webhook backfills it
  name              TEXT,
  source_path       TEXT,                  -- '/pricing'
  interest_sku      TEXT REFERENCES products(id),
  utm               JSONB NOT NULL DEFAULT '{}'::jsonb,
  booking_status    TEXT NOT NULL DEFAULT 'link_opened'
                      CHECK (booking_status IN ('link_opened','scheduled','canceled')),
  calendly_invitee_uri TEXT UNIQUE,        -- join key from invitee.created
  scheduled_at      TIMESTAMPTZ,
  converted_order_id UUID REFERENCES orders(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- No client-side write path at all. Rows are created by an Edge Function under
-- service role and updated by the Calendly webhook.
CREATE POLICY "Leads are not client-writable" ON leads
  FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "Admin can view all leads" ON leads
  FOR SELECT USING (is_admin());

CREATE INDEX idx_leads_created ON leads(created_at DESC);
CREATE INDEX idx_leads_status ON leads(booking_status, created_at DESC);
```

Structure follows `auth_audit_logs` (`migration:265-292`); `is_admin()` reads
`user_profiles.is_admin` (`migration:815-831`). `updated_at` uses the existing
`update_updated_at_column()` trigger (`migration:359-370`). Add
`DROP TABLE IF EXISTS leads CASCADE;` to `999_drop_all_tables.sql`.

**Why no anonymous INSERT policy.** The repo's only precedent for an anonymous
write is a `SECURITY DEFINER` RPC (`log_auth_event`, `migration:726-763`).
Using SECURITY DEFINER to get around RLS is a hack we do not want. The
`/pricing` CTA instead calls a small Edge Function that inserts under service
role and returns the id; the browser then redirects with
`utm_content=lead_<id>`. No anon policy, no SECURITY DEFINER, no open write
endpoint. It still needs **rate limiting** and a **cleanup job** for
`link_opened` rows that never convert.

**Attribution on this table is deliberately limited `[DECIDED]` — see §13.8.**
The repo gates tracking at four points: the calendar embed on
`consent.functional` (`CalendarEmbed.tsx:64-76`), `useAnalytics` on
`consent.analytics` (early return in all eight functions), the GA script plus
Google Consent Mode, and Sentry. A server-side `invitee.created` handler writing
`utm_*` would bypass every one of them — a browser gate cannot constrain a
server-to-server webhook.

**The handler therefore writes booking facts only**: `name`, `email`,
`calendly_invitee_uri`, `scheduled_at`, `booking_status`. It never writes `utm`.
The `utm` column holds only what the pre-sale click already knew, and
`utm_content` is used to _locate_ the row rather than being retained as
attribution. No consent-snapshot column is added.

### Changed: `webhook_events` for a third provider `[DECIDED]`

`invitee.created` needs idempotency, and the existing table is the right home —
but its provider column is closed:

```sql
-- migration:212-214 — CREATE TABLE webhook_events, provider CHECK on :214,
-- currently CHECK (provider IN ('stripe','paypal'))
ALTER TABLE webhook_events DROP CONSTRAINT IF EXISTS webhook_events_provider_check;
ALTER TABLE webhook_events ADD CONSTRAINT webhook_events_provider_check
  CHECK (provider IN ('stripe','paypal','calendly'));
```

Worth knowing before editing: **four tables carry a `provider` CHECK and they
already disagree with each other.** `payment_results` (:84) and
`payment_provider_config` (:178) allow `('stripe','paypal','cashapp','chime')`;
`subscriptions` (:122) and `webhook_events` (:214) allow only
`('stripe','paypal')`. Widen deliberately — do not assume the four are in sync.

Note `signature` and `event_data` are both `NOT NULL`, and **there is no SELECT
policy on `webhook_events` at all** — so surfacing Calendly deliveries in the
admin console needs a net-new policy plus a `GRANT SELECT`, not a copy of an
existing one.

### Changed: guest checkout

```sql
ALTER TABLE payment_intents ALTER COLUMN template_user_id DROP NOT NULL;
```

**Recommended mechanism: Supabase anonymous sign-in.** At checkout, if no
session exists, call `supabase.auth.signInAnonymously()`. The buyer gets a real
`auth.uid()` without an email/password step, every existing RLS policy keeps
working unmodified, and the anonymous user can be upgraded to a permanent
account later by linking an email.

This is the least invasive option and the one that does not require a
transitional shim — the alternative (nullable user id + email-keyed claim
tokens) forks every payment RLS policy into two branches and would have to be
unwound later.

---

## 7. Checkout flow

```
/pricing
  ├─ select SKU ───────────────────────────────────────────────┐
  └─ "Not sure? Book a 15-min call" → inline CalendarEmbed      │
     (consent card shown first — there is room for it here)     │
  ┌────────────────────────────────────────────────────────────┘
  ▼
/checkout?sku=svc-landing
  1. session check → signInAnonymously() if none
  2. GDPR payment consent gate (existing PaymentConsentModal)
  3. intake form
       • email, business name, domain, reference URL, notes
       • ATTACHMENTS: drag-drop into intake-uploads          ◄── NEW
         – uploads directly to Supabase Storage under {uid}/
         – each file tagged: "what I have" | "what I want"
         – client validation mirrors lib/avatar/validation.ts
         – bucket enforces MIME + size server-side regardless
  4. POST create-order Edge Function                          ◄── NEW
       • resolves price from products table (client amount ignored)
       • applies promo code server-side
       • verifies every attachment path starts with the caller's uid
       • inserts payment_intents row (service-role)
       • inserts orders row, status='pending', intake_data populated
       • returns { order_id, intent_id }
  5. existing create-stripe-checkout(intent_id) → redirect to Stripe
  ▼
Stripe Checkout (hosted)
  ▼
/payment-result?order={id}
  • optimistic UI from verify-stripe-session
  • authoritative state from stripe-webhook → orders.status='paid'
  • send-payment-email → receipt to buyer, intake summary + attachment
    links to operator
  • PRIMARY CTA: "Book your kickoff call"                     ◄── NEW
    plain <a> to calendarConfig.url with name, email and
    utm_content={order_id} prefilled in the query string.
    NO third-party script. See the corrected rationale below.
```

**New Edge Function: `create-order`.** This is the only genuinely new
server-side piece. Everything downstream of step 5 already exists.

Recurring SKUs branch at step 5 to `create-stripe-subscription` using
`products.stripe_price_id`, and write `orders.subscription_id` instead of
`intent_id`.

### Scheduling placement — and why it is not an embed at confirmation `[CORRECTED]` `[DECIDED]`

**The problem is real.** `CalendarEmbed` gates on
`useConsent().consent.functional`. The checkout drawer has _just_ collected
payment consent via a different mechanism (`usePaymentConsent`). A second,
differently-worded consent card seconds after someone paid reads as a dark
pattern and buries the one action that matters.

**But the fix originally proposed here does not work.** An earlier draft claimed
`mode="popup"` avoids the gate. It does not:

```tsx
// src/components/atomic/CalendarEmbed/CalendarEmbed.tsx:64-76
const { consent } = useConsent();
if (!consent.functional) {
  return <CalendarConsent provider={provider} ... />;   // ← unconditional
}
...
// line 90 — `mode` is not read until AFTER the gate has already returned
```

The gate is evaluated **before `mode` is ever read**, and `mode="popup"` renders
react-calendly's `PopupWidget`, which loads their script anyway. The popup fires
exactly the card §11 forbids.

The same ordering breaks a second acceptance criterion: the "Calendar URL not
configured" warning sits at `:78`, _after_ the gate — so with functional consent
unset you get the consent card, never the warning.

**Decision: a plain prefilled outbound link.** A normal `<a>` to
`calendarConfig.url` with name, email and `utm_content` in the query string. No
third-party script loads, so no functional-consent gate applies, the CTA stays a
single button, and both acceptance criteria become true as written. Reserve the
inline embed for `/pricing` and `/schedule`, where the consent card has room to
breathe and the visitor has not just completed a transaction.

This also sidesteps a third defect: `calendar.config.ts:5-9` types `utm` as
`{source, medium, campaign}` with **no `content` field**, so `utm_content` had
nowhere to live. The outbound link builds its own query string and does not touch
that type.

**Correlating bookings to orders.** The link carries `utm_content={order_id}` for
a purchase, or `utm_content=lead_{lead_id}` for a pre-sale conversation from
`/pricing`. Prefill `name` and `email` from `intake_data` — the buyer already
typed them once and should not type them again.

**The Calendly webhook is wired now, not later `[DECIDED]`.** Because the CTA is
an outbound link, the webhook is the _only_ way to learn a booking happened.
`invitee.created` matches on `utm_content`, sets `orders.intake_data.booking`
(or the `leads` row), and advances `orders.status` to `fulfilling`. Three
constraints from the existing handlers:

- **Signature verification must use async `crypto.subtle`** — the sync form
  throws under Deno (`stripe-webhook/index.ts:38-40`). Copy the async shape or
  the handler dies in production only.
- **The status convention is load-bearing**: 400 for a bad signature, but
  business-logic rejections return **200** with `{ handled: false, reason }`,
  never 5xx — because Calendly, like Stripe, retries on 5xx.
- **No CORS.** This is server-to-server; do not import `_shared/cors.ts`.

The signing key goes in `scripts/supabase/edge-function-secrets.example.json` as
`CALENDLY_WEBHOOK_SIGNING_KEY`, read via `Deno.env.get` — never `.env`.

---

## 8. Security requirements

1. **Server-authoritative pricing.** `create-order` resolves `amount` from
   `products` by `product_id`. Any client-supplied amount is discarded, not
   validated. This closes GAP 3.
2. **No direct client INSERT on `payment_intents` at all.** `[CORRECTED]` `[DECIDED]`
   The original wording hedged — "keep the existing path if a custom-amount flow
   is still wanted." It is not needed: the tip jar routes through `create-order`
   as a `amount_mode='variable'` SKU (§5), so **every** lane is
   server-authoritative and the client write can go entirely.

   This is three call sites, not one — `payment-service.ts:178`, `:370-389`
   (retry), and `offline-queue/payment-adapter.ts:165-182` (queue drain). All
   three move behind `create-order` first. Only then drop the policy **and** the
   `INSERT` from `GRANT SELECT, INSERT, UPDATE ON payment_intents TO authenticated`
   (`migration:1661`). A policy change alone leaves the grant advertising a
   capability.

2b. **Recurring price IDs come from the catalog, never the request.**
`create-stripe-subscription/index.ts:80` currently accepts a client-supplied
`price_id` with no allowlist, and `create-paypal-subscription` the same with
`plan_id`. Resolve both from `products.stripe_price_id` /
`products.paypal_plan_id` server-side. Without this, Care Plan ships with GAP 3
still open on the recurring path. 3. **Promo codes validated server-side** against a `promo_codes` table with
expiry, max redemptions, and SKU applicability. Never trust a client-applied
discount. 4. **Idempotency.** Reuse `edge_idempotency_keys`. A double-submitted intake
form must not create two orders. 5. **`orders.status` transitions are webhook-driven.** Client can read its own
orders; it can never write status. 6. **Anonymous sessions are still sessions.** Existing RLS is unchanged, so a
guest cannot read another guest's order. 7. **Consent before SDK load** — existing behavior, must be preserved on the new
routes, for both the payment SDKs and the calendar embed. 8. **Upload abuse controls.** Anonymous visitors can write to storage, so the
limits are load-bearing rather than cosmetic:

- MIME allowlist and 10MB cap enforced **at the bucket**, not only in the
  client validator — a client check is a UX affordance, not a control
- Max 8 files per session, enforced in `create-order` and in the uploader
- Reuse the existing `rate_limit_attempts` table to throttle uploads per IP
- Never render an uploaded file as HTML; serve via signed URLs with a short
  TTL, never from a public bucket
- `create-order` rejects any attachment path whose first segment is not the
  caller's `auth.uid()` — do not trust paths echoed back by the client

9. **Attachments are private.** No public SELECT policy on `intake-uploads`.
   The operator reads them through service-role in `/admin/orders`, and the
   buyer reads only their own.

---

## 9. Routes and components

### New routes

| Route           | Auth    | Purpose                                       |
| --------------- | ------- | --------------------------------------------- |
| `/pricing`      | public  | Two-lane storefront. The demo.                |
| `/checkout`     | anon-ok | Intake + consent + provider selection         |
| `/orders`       | session | Buyer's own orders and subscriptions          |
| `/admin/orders` | admin   | Fulfillment queue, status advance, notes      |
| `/admin/leads`  | admin   | Unconverted booking conversations `[DECIDED]` |
| `/tip`          | public  | Tip jar — pay what you want `[DECIDED]`       |

`/payment-result` already exists — extend it to read `orders`.

> **`[CORRECTED]` The admin-navigation E2E test cannot see new sections.**
> `tests/e2e/admin/admin-dashboard.spec.ts` (the `Navigation` describe) asserts
> "should navigate between all admin tabs" against a **hardcoded five-entry
> array** — `Payments`, `Audit Trail`, `Users`, `Messaging`, `Overview`. Adding
> `/admin/orders` and `/admin/leads` leaves them silently unmeasured while the
> test name still claims "all admin tabs." That is the #396 shape: a gate is only
> as wide as what it points at. Either enumerate the tabs from the nav, or extend
> the array in the same PR that adds the routes.
>
> Separately, check the **names** for substring collisions before choosing them —
> `.first()` follows document order and nav markup precedes page content, which is
> how #378 and #408 happened.

### New components (5-file pattern, `pnpm run generate:component`)

```
src/components/commerce/
├── PricingTable/        # lane tabs + card grid, reads catalog
├── PricingCard/         # one SKU: name, price, features, CTA
├── LaneToggle/          # "For Your Business" | "For Developers"
├── CheckoutSummary/     # selected SKU, promo, deposit split, total
├── IntakeForm/          # email, business, domain, reference URL, notes
├── IntakeUploader/      # drag-drop → intake-uploads, thumbnails,
│                        # per-file have/want tag, remove, progress
├── BookingCta/          # plain prefilled <a>, no third-party script  [CORRECTED]
├── OrderStatusBadge/    # pending | paid | fulfilling | delivered
├── OrderList/           # buyer-facing order history
└── TipJar/              # variable amount + sh-shake cup             [DECIDED]
```

Reuse unchanged: `PaymentButton`, `PaymentConsentModal`, `PaymentStatusDisplay`,
`PaymentHistory`, `AdminPaymentPanel`, `SubscriptionManager` (the Care Plan
cancel path), `CalendarEmbed` and `CalendarConsent` (on `/pricing` and
`/schedule` only — **not** at confirmation, see §7).

`IntakeUploader` is a sibling of `AvatarUpload`, not a rewrite of it — same
`useXUpload` hook shape, same validate-then-upload sequence, different bucket
and multi-file state. `AvatarUpload`'s single-object assumption is why it is
copied rather than parameterized; forcing one component to serve both would put
a mode flag through every branch.

### New lib

- `src/lib/commerce/catalog.ts` — typed catalog fetch + cache
- `src/lib/commerce/intake-upload.ts` — validation + upload, mirroring
  `src/lib/avatar/{validation,upload}.ts`; adds PDF handling and drops the
  minimum-dimension check (a sketch photo is not an avatar)
- `src/types/commerce.ts` — `Product`, `Order`, `OrderStatus`, `Lane`,
  `IntakeAttachment`
- `supabase/functions/create-order/index.ts`

---

## 10. Phases

### Phase 1 — Unblock (≈5 hrs) `[do this before quoting Warrior Roofing]`

- Raise the amount ceiling in all **three** places: migration CHECK,
  `src/config/payment.ts:189-192`, `src/types/payment.ts:34` `[CORRECTED]`
- Add the missing upper bound to `subscriptions.plan_amount` `[CORRECTED]`
- `products` table (with `amount_mode` / `min_amount` / `max_amount`) + seed
  migration with all **ten** SKUs
- `orders` table
- Enable Supabase anonymous sign-in

**Exit:** a $1,200 charge can be created without a constraint violation.

### Phase 2 — Storefront (≈12 hrs)

- `create-order` Edge Function with server-side price resolution, branching on
  `amount_mode` (fixed ignores the client amount; variable validates into
  `[min_amount, max_amount]` and rejects outside) `[DECIDED]`
- `/pricing` + `PricingTable` + `PricingCard` + `LaneToggle`
- `/checkout` + `IntakeForm` + `CheckoutSummary`
- `BookingCta` — inline embed on `/pricing`, **plain outbound link** at
  confirmation `[CORRECTED]`
- Wire to existing `create-stripe-checkout`
- Extend `/payment-result` to resolve orders

**Exit:** a stranger can buy Landing Page end-to-end with no account, and book a
kickoff call from the receipt.

### Phase 2b — Intake attachments (≈6 hrs)

- `intake-uploads` bucket + three RLS policies (migration)
- `src/lib/commerce/intake-upload.ts`
- `IntakeUploader` component — drag-drop, thumbnails, per-file have/want tag,
  progress, remove
- `create-order` path ownership verification + 8-file cap
- Signed-URL rendering of attachments in `/admin/orders`
- Orphan cleanup job

**Exit:** a buyer can drop four screenshots into checkout and tag which are
"what I have" versus "what I want."

### Phase 2c — Close GAP 3 completely (≈6 hrs) `[NEW]`

The catalog alone leaves two holes open. This phase shuts them.

- Resolve `stripe_price_id` / `paypal_plan_id` from the catalog in
  `create-stripe-subscription` and `create-paypal-subscription` — never from the
  request body
- Move all **three** client INSERT sites behind `create-order`:
  `payment-service.ts:178`, `:370-389` (retry), and
  `offline-queue/payment-adapter.ts:165-182` (queue drain)
- Only then: drop the client INSERT policy and remove `INSERT` from the GRANT at
  `migration:1661`

**Exit:** no browser can write a row to `payment_intents`, and no request can
name its own Stripe Price. Verify by attempting both and pinning the refusal
status (403/400, never 5xx) — a row-state-only assertion cannot prove the server
refused anything.

### Phase 3 — Fulfillment (≈6 hrs)

- `/orders` buyer view
- `/admin/orders` queue with status advance, intake summary, attachment gallery
- Receipt + intake-summary email via existing `send-payment-email`
- Subscription attach flow for Care Plan

**Exit:** operator runs the business from the admin panel.

### Phase 3b — Booking automation + leads (≈5 hrs) `[NEW]`

- `calendly-webhook` Edge Function: async `crypto.subtle` signature verification,
  no CORS, 400 on bad signature, 200 + `{ handled: false, reason }` on
  business-logic rejection
- Widen `webhook_events.provider` to include `'calendly'` (`migration:294-311`)
- `leads` table + policies + a service-role Edge Function to create rows
- `/admin/leads` view
- Rate limiting on the lead endpoint, and a cleanup job for `link_opened` rows
  that never convert

**Exit:** a booking advances its order without an operator, and a conversation
that never became a sale is still visible.

### Phase 4 — Commerce polish (≈8 hrs)

- `promo_codes` table + server-side validation
- Deposit split (50/50) on build SKUs
- Discovery-credit redemption
- Annual toggle on recurring SKUs
- `PaymentTrendChart` extended to revenue-by-SKU

### Phase 4b — Tip jar (≈5 hrs) `[NEW]`

- `TipJar` component (5-file pattern), `/tip` route
- Card payment via `create-order`, plus the two fee-free direct methods with an
  explicit "no receipt for this one" notice at the point of choice (§13.9)
- `sh-shake` keyframe as an `@utility` in `globals.css`, honouring **both** the
  `prefers-reduced-motion` media query and `[data-reduce-motion='true']`
- `useReducedMotion()` gate on the JS trigger
- Integer / `Number.isFinite` validation on the amount, which
  `validatePaymentAmount` does not currently do
- Accessibility test asserting the shake is suppressed under both triggers

**Exit:** someone can pay what they want for a free template, and nobody gets
motion sickness doing it.

**Total: ≈53 hrs** (was ≈36). The additional 17 hrs are the four decisions
recorded in §13, the GAP 3 expansion in Phase 2c, and the third client INSERT
site the original draft did not know about.

---

## 11. Acceptance criteria

- [ ] A logged-out visitor completes purchase of `svc-landing` ($1,200) and
      receives a receipt, with no account creation step.
- [ ] Tampering with the client payload to send `amount: 100` for `svc-landing`
      results in a $1,200 charge — the client amount is ignored, not rejected.
- [ ] `orders.status` reaches `paid` only via verified webhook, never via the
      redirect path alone.
- [ ] A double-submitted intake form creates exactly one order.
- [ ] Care Plan subscribes, appears in `/orders`, and cancels via the existing
      `cancel-subscription` function.
- [ ] `/pricing` scores ≥ 95 Lighthouse accessibility and passes Pa11y.
- [ ] All new components pass the 5-file structure validation in CI.
- [ ] Payment consent modal still gates SDK load on every new route.
- [ ] With no Stripe keys configured, `/pricing` renders and CTAs show the
      existing "not configured" state rather than erroring.
- [ ] With `NEXT_PUBLIC_CALENDAR_URL` unset, booking CTAs render a "not
      configured" state instead of a dead button. `[CORRECTED]` Note this is
      **not** free from `CalendarEmbed` — its warning at `:78` sits _after_ the
      consent gate at `:64-76`, so with functional consent unset you get the
      consent card, never the warning. The outbound-link CTA must check the URL
      itself.
- [ ] A tampered request naming an arbitrary Stripe `price_id` for a Care Plan
      subscription is refused with a 4xx — not a 5xx, and not silently accepted.
- [ ] A browser cannot INSERT into `payment_intents` at all after Phase 2c;
      the attempt is refused with a pinned status, verified by asserting the
      refusal rather than only the absent row.
- [ ] The tip jar accepts $5, rejects $0.50 and $9,999, and rejects `NaN`,
      `Infinity` and `12.34` before any provider call.
- [ ] The tip cup does not shake under `prefers-reduced-motion: reduce` **or**
      under the in-app `data-reduce-motion="true"` toggle.
- [ ] A guest uploads four files, tags each have/want, completes checkout, and
      all four appear in `/admin/orders` behind signed URLs.
- [ ] A guest cannot read another session's uploads by guessing a path.
- [ ] A 12MB file and a `.exe` are both rejected — and are still rejected when
      the client-side validator is bypassed, because the bucket enforces it.
- [ ] Abandoned uploads are gone after 7 days.
- [ ] The confirmation screen's booking CTA opens Calendly prefilled with the
      buyer's name and email and carries `utm_content={order_id}`.
- [ ] The confirmation screen does **not** trigger a second consent card.
      `[CORRECTED]` This is only true with the outbound-link design; it was
      **false** under the `mode="popup"` design originally proposed in §7,
      because the consent gate runs before `mode` is read.
- [ ] A `/pricing` "book a call" click creates exactly one `leads` row, and a
      completed Calendly booking advances it to `scheduled` via the webhook.
- [ ] Replaying a `calendly-webhook` delivery twice advances the order once.

---

## 12. Out of scope

- Multi-item cart. One SKU per order; attaches (Care Plan) are a second order.
- Tax calculation. Stripe Tax is a Phase 5 decision. US-only services for now.
- Merchant-of-record migration (Lemon Squeezy / Polar). Revisit only if
  international digital-product sales become the primary line.
- Net-30 terms. (A Stripe Invoice for the deposit remainder _is_ in scope — see
  §13.1 — but open credit terms are not.)
- Affiliate or referral tracking.
- **An actual cryptocurrency payment rail.** The tip jar's "will work for
  bitcoin" is copy on a sign, not a provider. Stripe and PayPal are the only
  rails; adding a third is its own feature.
- Server-side HEIC conversion (§13.5).

---

## 13. Decisions — all seven original questions are closed `[DECIDED 2026-08-06]`

1. **Deposit mechanics** → **Stripe Invoice** for the 50% remainder. More
   professional than a second Checkout Session, and the buyer gets a document
   they can hand to a bookkeeper.
2. **Does the custom-amount path survive?** → **It becomes the tip jar.** See §5.
   Note the premise of the original question was wrong: there is no
   arbitrary-amount UI today, only a client-trusted `amount` prop. So nothing is
   removed; the tip jar is greenfield and routes through `create-order` like
   every other SKU, which is what lets the client INSERT be revoked entirely.
3. **Vertical packs** → **one `prd-anvil` SKU with a pack-selection field.**
   Simpler catalog, and per-vertical revenue can come from `orders.intake_data`
   without four near-identical SKUs.
4. **Does Care Plan gate hosting?** → **No.** Cancelling the Care Plan stops
   maintenance, backups, monitoring and edits; the deployed site stays up. This
   must be stated plainly in the checkout terms, because the opposite is what
   buyers fear and what competitors do.
5. **HEIC** → **accept and store without preview.** No server-side conversion in
   v1. The uploader shows a generic file chip instead of a thumbnail.
6. **Calendly webhook** → **wire `invitee.created` now**, not later. Because the
   booking CTA is a plain outbound link (§7), the webhook is the _only_ way to
   learn a booking happened — the manual-flag fallback would mean no booking data
   at all. Phase 3b.
7. **Booking before buying** → **create a `leads` row.** §6. The lead is created
   on click by a service-role Edge Function and backfilled with name and email by
   the same `invitee.created` webhook, so there is no form in front of the click
   and "unconverted" is simply a lead row that never reached `scheduled`.

### Surfaced by the code audit — two closed, two for `/speckit.clarify`

**8. May a server-side webhook write `utm_*` when four browser consent gates
would have blocked it?** → **No. Booking facts only; the `leads` row carries no
consent snapshot.** `[DECIDED]`

The reasoning matters more than the answer, because the answer is easy to
"correct" later by someone who assumes the wrong premise. The four gates all
govern **third-party code running in the browser** — that is the ePrivacy
surface, storing or reading something on a device. A server-side record of where
a booking came from is a different question, and first-party attribution on a
conversion event is normally lawful under legitimate interest when disclosed.

So this was probably **permissible**. It is dropped on **value**, not legality:
there are no campaigns running, volume is low enough that the operator knows each
booking's source without a database, and the alternative costs a stored consent
state, a write, a read-back, and a position to defend. Revisit when campaign
volume makes the gap visible.

Consequence for §6: `leads.utm` holds only what the pre-sale click knows, and the
webhook never adds to it. `utm_content` is used to _find_ the row and is not
retained as attribution.

**9. Use the unconsumed Cash App / Chime links as a zero-fee tip path?** →
**Yes, alongside card.** `[DECIDED]`

On a $5 tip the processor fee is a meaningful fraction, and
`getCashAppLink(amount?)` / `getChimeLink()` already exist at
`src/config/payment.ts:149-165` with flags computed at `:250-255` and no
consumer. The tip jar becomes their first consumer.

**The trade-off is accepted explicitly:** both are outbound handoffs with no
callback, so a tip paid that way produces **no `orders` row and no receipt** — it
is visible only in the respective app. The UI must say so at the point of choice
rather than let the tipper assume a receipt is coming. This also means
`featureFlags.cashAppEnabled` / `chimeEnabled` stop being dead code.

### Still open

10. **Widen `webhook_events.provider`, or give Calendly its own table?** §6
    assumes widening. Implementation-level; resolve in `plan.md`.
11. **Adopt or supersede the pre-existing `/donate` + `DonateButton`
    vocabulary?** §5. Naming only; resolve in `plan.md`.

---

## Appendix — Warrior Roofing as the first order

The first real row in `orders` should be `svc-landing`, so the storefront is
proven by the job that motivated it.

| Field                       | Value                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `product_id`                | `svc-landing`                                                                                          |
| `amount_charged`            | `120000`                                                                                               |
| `intake_data.business`      | Warrior Roofing Inc                                                                                    |
| `intake_data.domain`        | _(confirm — `warriorroofing.com` belongs to Warrior Roofing Manufacturing, Tuscaloosa AL, since 1978)_ |
| `intake_data.reference_url` | `https://warriorroofing.carrd.co`                                                                      |
| `intake_data.attachments`   | The four screenshots, each tagged `kind: "target"`                                                     |
| Deposit                     | $600 at checkout, $600 on delivery                                                                     |
| Attach                      | Care Plan $99/mo                                                                                       |

Those four screenshots are the argument for the uploader. They arrived in a
WhatsApp thread with no indication of whether they showed the current site or
the desired one, and answering that took a side-by-side against the live carrd
page: the screenshots have a top nav and a phone number, the carrd has neither,
and the mockup's contact form carries the line _"This form is a design mockup
and does not submit anywhere yet."_ They were the target, generated from the
carrd copy.

A radio button next to the upload — **what I have** / **what I want** — makes
that entire investigation unnecessary for the next fifty customers.

Estimated build: 11–20 hrs against a 15 hr target. Scope, revision count (2),
and exclusions (photography, logo design, long-form copywriting, SEO campaigns)
are fixed at checkout by the SKU definition — which is the second reason the
catalog exists. A package defined in a table is a package that cannot be
scope-crept in a WhatsApp thread.
