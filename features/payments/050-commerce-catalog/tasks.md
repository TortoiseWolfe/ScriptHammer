# Tasks: Commerce Catalog & Storefront

**Feature**: `050-commerce-catalog`
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)
**PRD**: [`docs/prp-docs/commerce-catalog-prd.md`](../../../docs/prp-docs/commerce-catalog-prd.md)

## Format

`[ID] [P?] [Story] Description` — `[P]` means parallelisable with its siblings.
`[US-N]` names the user story the task serves.

## Filed issues

| Phase                   | Tasks     | Issue                                                                                    |
| ----------------------- | --------- | ---------------------------------------------------------------------------------------- |
| Epic                    | —         | [#555](https://github.com/TortoiseWolfe/ScriptHammer/issues/555)                         |
| 0 — Wireframe gate      | T001      | [#556](https://github.com/TortoiseWolfe/ScriptHammer/issues/556) ⛔ blocks all below     |
| 1 — Unblock the sale    | T002–T008 | [#557](https://github.com/TortoiseWolfe/ScriptHammer/issues/557)                         |
| 2 — Storefront          | T009–T017 | [#558](https://github.com/TortoiseWolfe/ScriptHammer/issues/558)                         |
| 2b — Intake attachments | T018–T023 | [#560](https://github.com/TortoiseWolfe/ScriptHammer/issues/560)                         |
| 2c — Close GAP 3        | T024–T028 | [#559](https://github.com/TortoiseWolfe/ScriptHammer/issues/559)                         |
| 3 — Fulfillment         | T029–T034 | [#561](https://github.com/TortoiseWolfe/ScriptHammer/issues/561)                         |
| 3b — Booking + leads    | T035–T042 | [#562](https://github.com/TortoiseWolfe/ScriptHammer/issues/562)                         |
| 4 — Polish              | T043–T047 | [#564](https://github.com/TortoiseWolfe/ScriptHammer/issues/564)                         |
| 4b — Tip jar            | T048–T053 | [#563](https://github.com/TortoiseWolfe/ScriptHammer/issues/563)                         |
| 5 — Cross-cutting       | T057–T059 | [#565](https://github.com/TortoiseWolfe/ScriptHammer/issues/565) — **not** gated by #556 |

T054–T056 (provider-unconfigured rendering, Pa11y, 5-file validation) are
verification steps that ride along with whichever phase introduces the screens,
so they have no issue of their own.

## Path conventions

Schema changes edit the **single monolithic migration**
`supabase/migrations/20251006_complete_monolithic_setup.sql`, idempotently,
inside the existing transaction. Never create a new migration file.
Components are scaffolded with `pnpm run generate:component` — never by hand.
All commands run in the container.

---

## Phase 0: Blocking gate

- [ ] **T001** — Wireframe gate. Generate, validate and review wireframes for
      `/pricing`, `/checkout`, `/payment-result`, `/admin/orders` and `/tip`.
      Copy `includes/` from the reference implementation at
      `features/foundation/003-user-authentication/wireframes/`. Run
      `.specify/extensions/wireframe/scripts/validate.py` until every SVG passes
      its 37 rules, then `/speckit.wireframe.review` to sign off into `spec.md`
      under `## UI Mockup`.
      Also create `.specify/extensions/wireframe/GENERAL_ISSUES.md` — it does not
      exist, so nothing is accumulating the lessons.
      **Blocks every task below.**

---

## Phase 1: Unblock the sale (≈5 hr) — clears the Warrior Roofing blocker

- [ ] **T002** Raise the payment ceiling to $25,000 in **all three** places:
      the CHECK at `migration:38`, `paymentLimits` at
      `src/config/payment.ts:189-192`, and the comment at
      `src/types/payment.ts:34`. Only the first is a real control; the other two
      are documentation that must not drift.
- [ ] **T003** Add the missing upper bound to `subscriptions.plan_amount`
      (`migration:125` is `CHECK (plan_amount >= 100)` with no ceiling — the
      $999.99 limit never applied to subscriptions at all).
- [ ] **T004** `products` table + RLS + indexes, including `amount_mode`,
      `min_amount`, `max_amount` and the two CHECK constraints from PRD §6.
- [ ] **T005** `orders` table + RLS + indexes. `intake_data` includes **`phone`** — the
      catalog sells click-to-call and "form wired to your inbox and phone" on every build,
      which the product cannot deliver without asking for the number. Added to Phase 1
      deliberately so the first sale carries it (#557).
- [ ] **T006** [P] Seed all ten SKUs, including `tip-jar` as the sole
      `amount_mode='variable'` row.
- [ ] **T007** [P] `src/types/commerce.ts` — `Product`, `Order`, `OrderStatus`,
      `Lane`, `AmountMode`, `IntakeAttachment`.
- [ ] **T008** Enable Supabase anonymous sign-in. **Check quota headroom first**
      — anonymous sessions raise MAU, one of the three quotas currently at 402.

**Exit**: a $1,200 charge can be created without a constraint violation.

---

## Phase 2: Storefront (≈12 hr) — US-1

- [ ] **T009** Contract tests for `create-order` **before** the function.
      Must assert the **refusal status** (4xx, never 5xx), not merely the absence
      of a row — a row-state-only assertion cannot prove the server refused
      anything, it only proves something failed.
- [ ] **T010** `create-order` Edge Function. Resolves price from the catalog;
      `fixed` discards the submitted amount outright, `variable` validates
      integer + finite + within bounds. Reuses `edge_idempotency_keys`.
- [ ] **T011** [P] `src/lib/commerce/catalog.ts` — typed fetch + cache.
- [ ] **T012** [P] `PricingTable`, `PricingCard`, `LaneToggle` components.
- [ ] **T013** `/pricing` route.
- [ ] **T014** [P] `CheckoutSummary`, `IntakeForm` components.
- [ ] **T015** `/checkout` route wired to `create-order` → `create-stripe-checkout`.
- [ ] **T016** Extend `/payment-result` to resolve and display orders.
- [ ] **T017** [P] `OrderStatusBadge`, `OrderList` components.

**Exit**: a stranger buys the Landing Page end to end with no account.

---

## Phase 2b: Intake attachments (≈6 hr) — US-3

- [ ] **T018** `intake-uploads` private bucket + three RLS policies. Size and
      MIME limits enforced **at the bucket**, so removing the browser check
      changes nothing.
- [ ] **T019** [P] `src/lib/commerce/intake-upload.ts`, mirroring
      `src/lib/avatar/{validation,upload}.ts`. Adds PDF handling; drops the
      minimum-dimension check (a whiteboard photo is not an avatar); accepts
      formats it cannot thumbnail rather than rejecting them.
- [ ] **T020** `IntakeUploader` component — drag-drop, per-file have/want tag,
      progress, remove, generic chip for un-previewable formats.
- [ ] **T021** Path-ownership verification and the 8-file cap in `create-order`.
      Reject any attachment path whose first segment is not the caller's id;
      never trust paths echoed back by the client.
- [ ] **T022** [P] Signed-URL rendering of attachments in `/admin/orders`.
- [ ] **T023** [P] Orphan cleanup for abandoned uploads after seven days.

---

## Phase 2c: Close GAP 3 completely (≈6 hr) — security

- [ ] **T024** Allowlist recurring identifiers: resolve `stripe_price_id` in
      `create-stripe-subscription` (currently takes a client-supplied `price_id`
      at `:80` with no validation) and `plan_id` in `create-paypal-subscription`.
      The function's own header comment at `:32-39` already claims this is how it
      works — fix the code, not the comment.
- [ ] **T025** Migrate all three client write sites behind `create-order`:
      `payment-service.ts:179-180`, `:371-372`, and
      `offline-queue/payment-adapter.ts:166-167`. The queue drain is the awkward
      one — it replays without a live gesture, so it needs an idempotency-keyed
      path rather than an interactive session.
- [ ] **T026** Re-enumerate `.from('payment_intents')` across `src/` and confirm
      **zero** remaining write operations before proceeding. Seven call sites
      exist; four are reads.
- [ ] **T027** Drop the client INSERT policy **and** remove `INSERT` from
      `GRANT SELECT, INSERT, UPDATE ON payment_intents TO authenticated`
      (`migration:1661`). A policy change alone leaves the grant advertising a
      capability that no longer exists.
- [ ] **T028** [P] E2E: a browser INSERT is refused with a pinned status, and a
      subscription request naming an off-catalog price is refused with 4xx.

**Exit**: no browser can write a payment record, and no request can name its own
price.

---

## Phase 3: Fulfillment (≈6 hr) — US-2, US-5

- [ ] **T029** `/orders` buyer view.
- [ ] **T030** `/admin/orders` queue — status advance, intake summary,
      attachment gallery.
- [ ] **T031** **Extend the admin-navigation E2E tab array** in
      `tests/e2e/admin/admin-dashboard.spec.ts` in the same change that adds the
      routes. It is a hardcoded five-entry list behind a test named "should
      navigate between all admin tabs", so new sections are silently unmeasured
      while the name still claims full coverage. Grep `tests/e2e` for substring
      collisions before choosing the labels.
- [ ] **T032** [P] Receipt + intake-summary email via existing
      `send-payment-email`.
- [ ] **T033** Care Plan attach flow — **extend `SubscriptionManager`**, which
      already owns the cancel path, rather than building a second one.
- [ ] **T034** [P] Checkout terms stating that cancelling the maintenance plan
      stops maintenance and leaves the site up (US-5 scenario 4).

---

## Phase 3b: Booking + leads (≈5 hr) — US-4, US-6

- [ ] **T035** `BookingCta` component — plain prefilled outbound anchor. Checks
      `calendarConfig.url` **itself**; do not rely on `CalendarEmbed`'s
      "not configured" warning, which sits after the consent gate and is
      unreachable when consent is unset.
- [ ] **T036** Widen `webhook_events.provider` to include `'calendly'`
      (`migration:214`). Do not touch the other three `provider` CHECKs — they
      already disagree with each other by design.
- [ ] **T037** `calendly-webhook` Edge Function. Signature verification via
      **async `crypto.subtle`** — the sync form throws under Deno. No CORS
      (server-to-server). 400 on bad signature; **200 with
      `{ handled: false, reason }` on business-logic rejection**, never 5xx,
      because Calendly retries on 5xx.
- [ ] **T038** `leads` table + policies (no client write path at all) +
      `create-lead` Edge Function running under service role.
      **No `SECURITY DEFINER` RPC** — the Edge Function is the reason none is
      needed.
- [ ] **T039** Webhook writes booking facts only — name, email, invitee URI,
      scheduled time. **Never `utm_*`** (FR-024a). The join identifier locates
      the row and is not retained as attribution.
- [ ] **T040** [P] Rate limiting on `create-lead`, reusing
      `rate_limit_attempts`.
- [ ] **T041** [P] Cleanup job for `link_opened` leads that never convert.
- [ ] **T042** [P] `/admin/leads` view. `webhook_events` has **no SELECT policy
      at all**, so surfacing deliveries needs a net-new policy plus a
      `GRANT SELECT` — not a copy of an existing one.

---

## Phase 4: Commerce polish (≈8 hr)

- [ ] **T043** `promo_codes` table + server-side validation (expiry, max
      redemptions, SKU applicability). Never trust a client-applied discount.
- [ ] **T044** Deposit split on build SKUs; remainder collected by **Stripe
      Invoice**, not a second Checkout Session.
- [ ] **T045** [P] Discovery-credit redemption, 30-day window.
- [ ] **T046** [P] Annual toggle on recurring SKUs.
- [ ] **T047** [P] `PaymentTrendChart` extended to revenue-by-SKU.

---

## Phase 4b: Tip jar (≈5 hr) — US-7

- [ ] **T048** `sh-shake` keyframe as an `@utility` in `globals.css`, following
      the `sh-pulse` idiom at `:708-724`. There is no `tailwind.config` — this is
      Tailwind 4 CSS-first.
- [ ] **T049** Add `sh-shake` to `src/styles/reduced-motion.css` for the
      `[data-reduce-motion='true']` path. The existing kill-switch covers only
      `animate-{spin,bounce,pulse,ping}`, so a custom utility is **not** covered
      by inheritance. `reduced-motion.test.ts` pins those names.
- [ ] **T050** `TipJar` component. Amount input validated for integer, finite and
      in-range **before** any provider call. `useReducedMotion()` gates the JS
      trigger so the shake never starts rather than starting and being
      suppressed.
- [ ] **T051** `/tip` route. Supersedes the never-built `/donate`; leave a
      pointer in the archived specs so nobody implements both.
- [ ] **T052** Cash App and Chime offered alongside card, using the existing
      `getCashAppLink(amount?)` / `getChimeLink()` at
      `src/config/payment.ts:149-165` — their first consumers.
      **Must state at the point of choice that these produce no receipt and no
      order record**, because they hand off with no callback (FR-030).
- [ ] **T053** [P] Accessibility test asserting no motion under **both** reduced
      motion triggers — the OS media query and the in-app toggle.

---

## Phase 5: Cross-cutting

- [ ] **T054** [P] Verify every new screen renders with no payment provider and
      no scheduler configured (FR-027, SC-008).
- [ ] **T055** [P] Pa11y + axe on all new routes; storefront ≥ 95 (SC-006).
- [ ] **T056** [P] Confirm all ten new components pass 5-file structure
      validation (SC-007).
- [x] **T057** Fix the type/schema drift found while writing this spec:
      `src/lib/supabase/types.ts` declares **two tables the migration never
      creates** (the source of the PRD's incorrect "19 tables"). Removed the
      stale `audit_logs` and `profiles` declarations in #565; independent of
      this feature but discovered by it.
- [ ] **T058** [P] Remove the dead `UPDATE` from the `payment_intents` GRANT —
      `"Payment intents are immutable"` is `FOR UPDATE USING (false)`, so nothing
      can ever use it.
- [x] **T059** [P] Remove `cancelPaymentIntent`, whose former implementation
      issued a `.delete()` against a `FOR DELETE USING (false)` policy and
      no-oped without erroring. Removed in #565; cancellation requires a real
      server-side state transition.

---

## Dependencies

```
T001 (wireframe gate) ──> blocks EVERYTHING below

Phase 1 (T002-T008) ──> Phase 2 (T009-T017) ──> Phase 2b (T018-T023)
                                             └─> Phase 3  (T029-T034)
Phase 2 ──> Phase 2c (T024-T028)          [T025 needs create-order to exist]
Phase 2 ──> Phase 3b (T035-T042)          [needs orders to exist]
Phase 1 ──> Phase 4b (T048-T053)          [needs the tip-jar catalog row]
```

**T027 must not run before T026 passes.** Dropping the grant with an unmigrated
write site breaks payments silently.

**Independently shippable slices**: Phase 1 alone unblocks quoting. Phase 1+2 is
the MVP — a stranger can buy something. Everything after is additive.

---

## Notes on verification

Three traps this repo has already paid for, restated because they apply directly:

1. **A row-state assertion cannot prove a refusal.** Deleting a server-side rule
   once left all 25 conformance cases green because RLS caught it downstream and
   the provider threw anyway. Pin the status.
2. **A green suite is not a working product.** Tests that mint users through
   admin APIs bypass the real path. Any acceptance claim here should be driven
   through the actual buyer flow.
3. **Supabase is at HTTP 402.** Nothing in this feature can be verified live
   until that is restored. Do not mark a task complete on inspection alone.
