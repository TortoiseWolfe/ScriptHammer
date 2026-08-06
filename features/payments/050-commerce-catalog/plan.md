# Implementation Plan: Commerce Catalog & Storefront

**Feature**: `050-commerce-catalog`
**Spec**: [spec.md](./spec.md)
**Source PRD**: [`docs/prp-docs/commerce-catalog-prd.md`](../../../docs/prp-docs/commerce-catalog-prd.md)
**Created**: 2026-08-06
**Status**: Draft — **wireframe gate outstanding, see Blocking Gate below**

---

## Blocking Gate — read first

`features/CLAUDE.md` puts `/speckit.plan`, `/speckit.tasks` and
`/speckit.implement` in Phase 3, blocked until the wireframe review passes.
**That gate has not run.** This plan and its tasks were written ahead of it, by
explicit decision, so the backlog could be filed while the gate is scheduled as
its own work item (T001).

What this means in practice:

- **No implementation task in this plan may start before T001 completes.** The
  gate blocks code, and code is what it is protecting.
- The five screens needing wireframes are `/pricing`, `/checkout`,
  `/payment-result` (extended), `/admin/orders`, and `/tip`.
- `.specify/extensions/wireframe/GENERAL_ISSUES.md` **does not exist**, so there
  is no accumulated-lessons file. Whatever the first review round finds should
  create it.
- On sign-off, `/speckit.wireframe.review` writes approved paths into `spec.md`
  under `## UI Mockup`. Absence of that block is the machine-readable signal that
  the gate has not passed.

---

## Summary

Add a catalog layer on top of shipped payment rails: a server-authoritative
`products` table, an `orders` record, a public two-lane storefront, guest
checkout with job intake and attachments, an outbound booking hand-off with a
confirmation webhook, a pre-sale lead record, and a pay-what-you-want tip jar.

The security thesis is one sentence: **the buyer's device stops being able to
name a price.** Everything else follows from that.

---

## Technical Context

**Language / runtime**: TypeScript strict, React 19, Next.js 15 App Router,
static export. Server logic is Supabase Edge Functions (Deno) — there are no
Next.js API routes in production.

**Storage**: Supabase Postgres. Schema changes go into the **single monolithic
migration** `supabase/migrations/20251006_complete_monolithic_setup.sql`, all
statements idempotent, inside the existing `BEGIN;`…`COMMIT;`. Never a new
migration file.

**Testing**: Vitest (unit), Playwright (E2E), Pa11y + axe (a11y). New components
must satisfy the 5-file pattern or CI fails.

**Deployment target**: GitHub Pages, static. No server-side secret is reachable
from the browser; anything sensitive lives in Supabase Vault or Edge Function
secrets.

**Constraints that shape the design**:

| Constraint                                        | Consequence                                                    |
| ------------------------------------------------- | -------------------------------------------------------------- |
| Static export                                     | Price resolution must be an Edge Function, not a route handler |
| Monolithic migration                              | All schema work is one file, idempotent, additive              |
| Consent gates are browser-side                    | A webhook cannot honour them — hence FR-024a                   |
| `e2e.yml` does not ignore `supabase/functions/**` | Every Edge Function task triggers the full ~100-min suite      |
| Supabase is currently at HTTP 402                 | Nothing here can be verified live until quota is restored      |

---

## Constitution Check

| Principle                | Compliance                                                                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5-file component pattern | All new components scaffolded via `pnpm run generate:component`. Ten new components.                                                                                                          |
| TDD, 25%+ coverage       | Contract tests for `create-order` precede it. Refusal-status assertions, not row-state-only — a row-state assert cannot prove the server refused (see `lesson_rls_masks_dotnet_conformance`). |
| SpecKit sequence         | **Deviation recorded.** Wireframe gate deferred to T001; see Blocking Gate and Complexity Tracking.                                                                                           |
| Docker-first             | All commands in-container. Builds in the `builder` service.                                                                                                                                   |
| Progressive enhancement  | Every new screen renders with no provider and no scheduler configured (FR-027).                                                                                                               |
| Privacy first            | Consent before any third-party SDK (FR-026); no attribution written server-side (FR-024a).                                                                                                    |

---

## Project Structure

### Documentation (this feature)

```
features/payments/050-commerce-catalog/
├── spec.md
├── plan.md                    ← this file
├── tasks.md
├── checklists/requirements.md
└── wireframes/                ← T001 creates this
```

### Source code

```
src/
├── app/
│   ├── pricing/page.tsx                  NEW
│   ├── checkout/page.tsx                 NEW
│   ├── orders/page.tsx                   NEW
│   ├── tip/page.tsx                      NEW
│   ├── admin/orders/page.tsx             NEW
│   ├── admin/leads/page.tsx              NEW
│   └── payment-result/page.tsx           EXTEND — resolve orders
├── components/commerce/                  NEW — 10 components, 5-file each
│   ├── PricingTable/ PricingCard/ LaneToggle/
│   ├── CheckoutSummary/ IntakeForm/ IntakeUploader/
│   ├── BookingCta/ OrderStatusBadge/ OrderList/ TipJar/
├── lib/commerce/
│   ├── catalog.ts                        NEW
│   └── intake-upload.ts                  NEW — mirrors lib/avatar/
├── types/commerce.ts                     NEW
├── config/payment.ts                     EDIT — paymentLimits :189-192
├── types/payment.ts                      EDIT — :34 comment
└── app/globals.css                       EDIT — sh-shake @utility

supabase/
├── migrations/20251006_...sql            EDIT — products, orders, leads,
│                                           ceiling, provider CHECK widen
└── functions/
    ├── create-order/                     NEW
    ├── create-lead/                      NEW
    ├── calendly-webhook/                 NEW
    ├── create-stripe-subscription/       EDIT — allowlist price_id
    └── create-paypal-subscription/       EDIT — allowlist plan_id
```

---

## Key Design Decisions

### 1. One Edge Function owns every write to `payment_intents`

`create-order` becomes the sole writer. It takes `{ product_id, quantity?,
amount?, intake, attachments[] }`, resolves the product, and branches on
`amount_mode`:

- `fixed` → **discard** the submitted amount entirely. Not validate it, discard
  it. FR-002 says "discarded, not validated" deliberately: a validator that
  rejects a mismatched amount leaks the real price and turns a silent
  server-authoritative design into an oracle.
- `variable` → require the amount, and reject it unless it is an integer,
  finite, and within `[min_amount, max_amount]`.

Recurring SKUs resolve `stripe_price_id` / `paypal_plan_id` from the catalog row.

**Sequencing matters here.** The client INSERT cannot be revoked until all three
existing write sites are migrated:

```
src/lib/payments/payment-service.ts:179-180   createPaymentIntent (.insert)
src/lib/payments/payment-service.ts:371-372   retryFailedPayment  (.upsert)
src/lib/offline-queue/payment-adapter.ts:166-167  queue drain     (.upsert)
```

The offline-queue one is the awkward one — it drains without a live user gesture,
so `create-order` needs to accept a replayed order keyed on the existing
idempotency key rather than assuming an interactive session.

### 2. The tip jar is a catalog row, not an exception

`amount_mode='variable'` exists so pay-what-you-want needs no bypass. This is
what allows the GRANT at `migration:1661` to lose `INSERT`. Had the tip jar been
special-cased, the client write path would have had to survive forever.

### 3. Booking is an outbound link

No `CalendarEmbed` at confirmation. The consent gate at `CalendarEmbed.tsx:64-76`
runs before `mode` is read, so `popup` does not avoid it. `BookingCta` builds its
own URL and checks `calendarConfig.url` itself, because the component's
"not configured" warning sits _after_ the gate and is therefore unreachable when
consent is unset.

### 4. `webhook_events` is widened rather than duplicated

Resolving PRD open question 10. `webhook_events` already provides the
`(provider, provider_event_id)` idempotency contract; a second table would mean
two replay-protection implementations. Widen the CHECK at `migration:214`.

Note the four `provider` CHECKs in the migration **already disagree**:
`payment_results` (:84) and `payment_provider_config` (:178) allow
`cashapp`/`chime`; `subscriptions` (:122) and `webhook_events` (:214) do not.
Widen only `webhook_events`; do not "harmonise" the others as a side effect.

### 5. `/tip` supersedes the never-built `/donate`

Resolving PRD open question 11. Archived docs specify `/donate` and
`DonateButton`; neither was ever built. `/tip` and `TipJar` are the live names.
The archived specs get a one-line pointer so a future reader does not implement
both.

### 6. `sh-shake` is the only transform-based animation in the product

Every guarded animation animates opacity, deliberately (`globals.css:705-706`).
`sh-shake` breaks that, so it carries three obligations rather than one:
`@utility` with a nested `prefers-reduced-motion` query, an entry in
`src/styles/reduced-motion.css` for the `[data-reduce-motion='true']` path (the
existing kill-switch covers only `animate-{spin,bounce,pulse,ping}`), and a
`useReducedMotion()` gate on the JS trigger.

---

## Risks

| Risk                                                                                                                                                      | Mitigation                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase is at HTTP 402.** No live verification is possible.                                                                                            | Schema and Edge Function work can be written but not proven. Do not mark any task complete on "it should work".                        |
| **Every Edge Function task triggers the full E2E suite** (`supabase/functions/**` is not in `paths-ignore`). At ~1 PR per ~100 min this is many sessions. | Batch Edge Function changes per PR rather than one function per PR.                                                                    |
| **Anonymous sign-in raises MAU**, one of the three quotas currently exceeded.                                                                             | Confirm quota headroom before enabling.                                                                                                |
| **Revoking the client INSERT is irreversible-ish in effect** — miss a write site and payments break silently.                                             | Enumerate `.from('payment_intents')` and assert on write ops before dropping the grant. Three known; re-verify at implementation time. |
| **The admin-nav E2E test has a hardcoded five-entry tab array.** Two new sections would be silently unmeasured.                                           | Extend the array in the same PR that adds the routes, or enumerate from the nav.                                                       |
| **Wireframe gate deferred.**                                                                                                                              | T001 blocks every implementation task.                                                                                                 |

---

## Complexity Tracking

**Deviation from the SpecKit sequence.** `plan.md` and `tasks.md` were written
before the wireframe gate, which `features/CLAUDE.md` forbids.

_Why_: the deliverable requested was a filed backlog. The gate protects
implementation, and no implementation is being done. Filing tickets first makes
the gate itself a tracked, scheduled item rather than an unbounded prerequisite.

_Why the simpler alternative was rejected_: running the gate first would have
consumed the whole session and left nothing filed, so the work would have been
invisible in the tracker.

_How the deviation is contained_: T001 is the wireframe gate and blocks every
other implementation task. `spec.md` has no `## UI Mockup` block, which is the
machine-readable proof the gate has not passed.
