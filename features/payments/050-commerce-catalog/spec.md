# Feature Specification: Commerce Catalog & Storefront

**Feature Branch**: `050-commerce-catalog`
**Created**: 2026-08-06
**Status**: Draft
**Source PRD**: [`docs/prp-docs/commerce-catalog-prd.md`](../../../docs/prp-docs/commerce-catalog-prd.md)
**Design prototype**: [`docs/design/commerce/pricing-demo.html`](../../../docs/design/commerce/pricing-demo.html)
**Depends on**: features 038–042 (payment rails, shipped)
**Input**: A server-authoritative product catalog, a public storefront, guest checkout, an order record, job intake with attachments, booking, and a pay-what-you-want tip jar.

---

## Why this exists

The product sells business websites. It cannot currently accept an order for one.
A real inbound lead — a roofing company that wants a landing page — is blocked on
two things: there is no price list to quote from, and the largest payment the
system will accept is $999.99, which is less than the job costs.

Everything underneath is already built. Taking payments, two payment providers,
confirming them reliably, surviving a dropped connection, retrying a failed
charge, and keeping each customer's records private to them — all of that shipped
in features 038–042. What is missing is the layer that says _what is for sale_
and _what someone bought_.

The storefront is also the product demo. People evaluating the template see the
checkout they would themselves fork.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — A local business buys a package without creating an account (Priority: P1)

A roofing contractor gets a link to the pricing page, picks the $1,200 Landing
Page, pays, and receives a receipt. At no point are they asked to invent a
password or confirm an email before handing over money.

**Why this priority**: This is the whole feature. Nothing else matters if a
stranger cannot buy the thing. It is also the exact transaction currently blocked
by the amount ceiling, so it is what unblocks revenue.

**Independent Test**: Open the storefront in a fresh private window, buy the
Landing Page package, and confirm a receipt arrives — without ever signing up.

**Acceptance Scenarios**:

1. **Given** a visitor with no account and no session, **When** they select a
   package and complete payment, **Then** they receive a receipt and an order
   exists recording what they bought.
2. **Given** a tampered request claiming the $1,200 package costs $1.00, **When**
   checkout is attempted, **Then** the buyer is charged $1,200 — the submitted
   amount is ignored rather than validated.
3. **Given** no payment provider is configured, **When** the storefront loads,
   **Then** it renders normally and the buy actions show the existing
   "not configured" state instead of failing.
4. **Given** a buyer double-submits the checkout form, **When** both submissions
   are processed, **Then** exactly one order exists and one charge is made.

---

### User Story 2 — The operator runs fulfillment from one place (Priority: P2)

After money arrives, the operator needs to know what was bought, by whom, what
the buyer asked for, and what stage the work is at — without reading a payment
ledger and guessing.

**Why this priority**: An order that arrives with no process attached is a
liability, not revenue. This is what makes the first sale repeatable.

**Independent Test**: With one paid order present, open the fulfillment queue and
advance it through its stages; confirm the buyer sees the change.

**Acceptance Scenarios**:

1. **Given** a paid order, **When** the operator opens the fulfillment queue,
   **Then** they see the buyer, the package, what the buyer asked for, and the
   current stage.
2. **Given** an order in progress, **When** the operator advances its stage,
   **Then** the buyer sees the new stage in their own order history.
3. **Given** a buyer viewing their orders, **When** they attempt to change an
   order's stage, **Then** the change is refused.
4. **Given** payment succeeded but the buyer closed the browser before
   redirecting, **When** the provider confirms the payment, **Then** the order
   still reaches the paid stage.

---

### User Story 3 — The buyer describes the job at checkout (Priority: P3)

The single most useful thing a website buyer can provide is a picture of what
they have and what they want. Today that arrives as screenshots in a messaging
app and has to be sorted out by hand.

**Why this priority**: It removes the highest-friction step of every build, but
the sale can complete without it, so it follows the transaction itself.

**Independent Test**: Complete a purchase while attaching several images, tagging
each as "what I have" or "what I want", and confirm all of them appear against
the order in the fulfillment queue.

**Acceptance Scenarios**:

1. **Given** a buyer at checkout, **When** they attach up to eight files and tag
   each one, **Then** all files and tags are recorded against the order.
2. **Given** an oversized file or a disallowed file type, **When** it is
   attached, **Then** it is refused — and still refused when the browser-side
   check is bypassed.
3. **Given** a buyer's attachments, **When** another buyer guesses the storage
   location, **Then** they cannot read them.
4. **Given** files uploaded during an abandoned checkout, **When** a week passes,
   **Then** they are removed.
5. **Given** a photo in a format the browser cannot preview, **When** it is
   attached, **Then** it uploads successfully and is shown as a file rather than
   a thumbnail.

---

### User Story 4 — Booking the kickoff call is the receipt's main action (Priority: P4)

A buyer who has just paid should be one click from "when are we talking?",
prefilled, without being asked to agree to anything again.

**Why this priority**: It converts a payment into a project. Lower than intake
because the conversation can still happen by email.

**Independent Test**: Complete a purchase and click the booking action on the
receipt; confirm the scheduler opens with name and email already filled and that
the booking is traceable back to the order.

**Acceptance Scenarios**:

1. **Given** a completed purchase, **When** the buyer uses the booking action,
   **Then** the scheduler opens prefilled with their name and email and the
   booking can be traced back to that order.
2. **Given** a completed purchase, **When** the receipt is displayed, **Then** no
   second consent prompt appears.
3. **Given** no scheduler is configured, **When** the receipt is displayed,
   **Then** the booking action shows a "not configured" state rather than a dead
   control.
4. **Given** a buyer schedules a call, **When** the scheduler confirms it,
   **Then** the order advances without operator action.
5. **Given** the same booking confirmation is delivered twice, **When** both are
   processed, **Then** the order advances once.

---

### User Story 5 — A developer subscribes and can leave (Priority: P5)

Two recurring plans exist — a maintenance plan for business clients and a
subscription for developers. Both must be joinable and, more importantly,
leavable.

**Why this priority**: Recurring revenue matters, but a one-time sale is the
thing currently blocked. Cancellation is grouped here because a plan nobody can
leave is a plan nobody should join.

**Independent Test**: Subscribe to a plan, confirm it appears in order history,
then cancel it and confirm it stops.

**Acceptance Scenarios**:

1. **Given** a buyer on the storefront, **When** they subscribe to a recurring
   plan, **Then** it appears in their order history.
2. **Given** an active subscription, **When** the buyer cancels, **Then** the
   subscription ends and the buyer keeps their deployed site — cancellation stops
   maintenance, not hosting.
3. **Given** a tampered request naming a plan price that is not in the catalog,
   **When** the subscription is attempted, **Then** it is refused with a clear
   client error rather than a server failure or a silent acceptance.
4. **Given** a buyer at checkout for a recurring plan, **When** they review the
   terms, **Then** what happens on cancellation is stated before they pay.

---

### User Story 6 — A visitor books a call before buying anything (Priority: P6)

Not every conversation starts with a purchase. Someone unsure which package they
need should be able to book a call, and that conversation should not vanish if it
never becomes a sale.

**Why this priority**: Valuable for understanding demand, but it is measurement
rather than revenue.

**Independent Test**: Use the pre-sale booking action, then complete a booking;
confirm the conversation is visible to the operator both before and after.

**Acceptance Scenarios**:

1. **Given** a visitor on the storefront, **When** they use the pre-sale booking
   action, **Then** exactly one conversation record is created.
2. **Given** that record, **When** the visitor completes a booking, **Then** the
   record shows it as scheduled, with their name and email.
3. **Given** a visitor who opens the booking link and never books, **When** the
   operator reviews conversations, **Then** the unconverted one is still visible.
4. **Given** repeated automated use of the booking action, **When** the rate
   exceeds a threshold, **Then** further records are refused.

---

### User Story 7 — Someone pays what they want for the free template (Priority: P7)

The template is free. Some people want to pay for it anyway. A tip jar accepts
whatever they choose, within sane bounds.

**Why this priority**: Genuinely optional revenue and the smallest slice, but it
is also the only variable-amount path, which is why it is specified rather than
improvised later.

**Independent Test**: Enter a custom amount and complete payment; then confirm
out-of-range and nonsense amounts are refused.

**Acceptance Scenarios**:

1. **Given** a visitor at the tip jar, **When** they choose a suggested amount or
   enter their own within the allowed range, **Then** payment completes.
2. **Given** an amount below the minimum, above the maximum, fractional, or not a
   number at all, **When** it is submitted, **Then** it is refused before any
   payment provider is contacted.
3. **Given** a visitor who has asked their device or the app to reduce motion,
   **When** the tip jar is displayed, **Then** nothing on it animates.
4. **Given** a tampered request naming an amount outside the allowed range,
   **When** checkout is attempted, **Then** it is refused rather than clamped
   silently.
5. **Given** a visitor who would rather not pay processor fees, **When** they view
   the tip jar, **Then** the two fee-free direct methods are offered alongside
   card payment.
6. **Given** a visitor choosing a fee-free direct method, **When** they select it,
   **Then** they are told before leaving that no receipt or order record will
   follow.

---

### Edge Cases

- A guest buys, then later creates a real account with the same email — their
  earlier order must still be reachable.
- A payment succeeds at the provider but the confirmation never arrives. The
  order must not be stranded, and a later confirmation must still resolve it.
- The catalog is empty or every item is inactive. The storefront must say so
  rather than render a blank page.
- A buyer cancels a recurring plan on the same day they are billed.
- Someone submits an amount of `0`, a negative number, or a value with more
  precision than the currency supports.
- An attachment is a valid image that is also enormous, or a file whose name
  claims one type and whose contents are another.
- Two orders are created for the same buyer moments apart — each must be
  independently trackable rather than merged.

---

## UI Mockup

Wireframe gate (#556) **PASSED 2026-08-06** — all five screens validate with 0 errors, and
the repo-wide sweep is 70/71 (the one failure, `animated-logo.svg`, predates this work).

| Screen            | Wireframe                                                     | Stories          | Review                                             |
| ----------------- | ------------------------------------------------------------- | ---------------- | -------------------------------------------------- |
| `/pricing`        | [`01-pricing.svg`](./wireframes/01-pricing.svg)               | US-1, US-5, US-6 | [issues](./wireframes/01-pricing.issues.md)        |
| `/checkout`       | [`02-checkout.svg`](./wireframes/02-checkout.svg)             | US-1, US-3, US-5 | [issues](./wireframes/02-checkout.issues.md)       |
| `/payment-result` | [`03-payment-result.svg`](./wireframes/03-payment-result.svg) | US-1, US-2, US-4 | [issues](./wireframes/03-payment-result.issues.md) |
| `/admin/orders`   | [`04-admin-orders.svg`](./wireframes/04-admin-orders.svg)     | US-2, US-3, US-4 | [issues](./wireframes/04-admin-orders.issues.md)   |
| `/tip`            | [`05-tip-jar.svg`](./wireframes/05-tip-jar.svg)               | US-1, US-2, US-7 | [issues](./wireframes/05-tip-jar.issues.md)        |

All seven user stories are represented across the set.

**One design decision was settled here rather than in the spec**, because the two source
documents disagreed. `docs/design/commerce/pricing-demo.html` implements checkout as a
**drawer** over `/pricing`; the PRD §9 and this spec say `/checkout` is a **route**. The
wireframes draw the route, and the prototype's stepper and visual language carry over
unchanged — only the container differs.

Route wins on five grounds specific to this product: a quote can be emailed as
`…/checkout?sku=`; checkout should remove navigation rather than keep the grid visible
behind a scrim; the provider redirect leaves and returns, and a URL costs nothing to return
to; a drawer is a modal, carrying focus-trap, scroll-lock and focus-restore obligations
against a hard a11y gate; and at 390px the drawer becomes a full-screen overlay anyway —
all of the cost, none of the benefit.

## Requirements _(mandatory)_

### Functional Requirements

**Catalog and pricing**

- **FR-001**: System MUST hold a catalog of purchasable items, each with a name,
  description, price, currency, and whether it is one-time or recurring.
- **FR-002**: System MUST treat the catalog as the only authority on price. Any
  price supplied by the buyer's device MUST be discarded, not validated.
- **FR-003**: System MUST support items whose price is chosen by the buyer within
  a defined minimum and maximum, and MUST reject amounts outside that range,
  amounts that are not whole units of currency, and values that are not numbers.
- **FR-004**: System MUST allow the maximum acceptable payment to cover the
  largest catalog item with headroom, and MUST apply that same bound everywhere
  it is currently asserted so the bounds cannot disagree with each other.
- **FR-005**: System MUST resolve recurring plan identifiers from the catalog and
  MUST refuse any supplied by the buyer's device.
- **FR-006**: System MUST present the catalog to two audiences — services for
  businesses, products for developers — without duplicating the underlying items.

**Purchase**

- **FR-007**: Users MUST be able to complete a purchase without creating an
  account.
- **FR-008**: System MUST record an order for every purchase, capturing what was
  bought, by whom, for how much, and its fulfillment stage.
- **FR-009**: System MUST advance an order to paid only on confirmation from the
  payment provider, never on the buyer returning from a redirect alone.
- **FR-010**: System MUST ensure a repeated or duplicated checkout submission
  results in exactly one order and one charge.
- **FR-011**: System MUST prevent buyers from writing an order's fulfillment
  stage.
- **FR-012**: System MUST refuse any attempt to create a payment record from the
  buyer's device, and MUST express that refusal as a client error with a
  determinate status rather than a server failure.

**Intake**

- **FR-013**: Users MUST be able to describe the job at checkout, including a
  business name, a **phone number**, a destination, a reference, and free text.
  The phone number is not optional politeness: the catalog promises every build
  ships with click-to-call and a form wired to the buyer's phone, and the product
  cannot deliver that without asking for the number.
- **FR-014**: Users MUST be able to attach up to eight files and tag each as
  something they have or something they want.
- **FR-015**: System MUST enforce file size and type limits in a place the
  buyer's device cannot bypass.
- **FR-016**: System MUST keep attachments private to the buyer and the operator.
- **FR-017**: System MUST remove attachments from abandoned checkouts after seven
  days.
- **FR-018**: System MUST accept photo formats it cannot preview, storing them
  without a thumbnail rather than rejecting them.

**Booking**

- **FR-019**: System MUST offer booking as the primary action after purchase,
  prefilled with the buyer's name and email.
- **FR-020**: System MUST NOT present a second consent prompt on the confirmation
  screen.
- **FR-021**: System MUST make every booking traceable to the order or
  conversation that produced it.
- **FR-022**: System MUST advance an order automatically when a booking is
  confirmed, and MUST advance it only once no matter how many times the
  confirmation is delivered.
- **FR-023**: System MUST verify that booking confirmations genuinely originate
  from the scheduler before acting on them.
- **FR-024**: System MUST record a conversation when a visitor uses the pre-sale
  booking action, and MUST keep it visible when it never becomes a sale.
- **FR-024a**: System MUST NOT store marketing attribution on a booking
  confirmation received from the scheduler. Only the booking facts — name, email,
  scheduler reference and scheduled time — are retained.
- **FR-024b**: System MUST use the identifier linking a booking to its
  conversation solely to locate that record, and MUST NOT retain it as
  attribution data.
- **FR-025**: System MUST limit how often conversation records can be created.

**Tipping**

- **FR-029**: System MUST offer, alongside card payment, the two direct payment
  methods that carry no processor fee.
- **FR-030**: System MUST state plainly, at the point of choice, that a tip paid
  by a fee-free direct method produces no receipt and no order record — because
  those methods hand off without confirming back.

**Throughout**

- **FR-026**: System MUST continue to obtain consent before loading any
  third-party payment or scheduling code, on every new screen.
- **FR-027**: System MUST render every new screen usefully when no payment
  provider and no scheduler are configured.
- **FR-028**: System MUST suppress non-essential motion when the visitor's device
  or the application's own accessibility setting asks for reduced motion.

### Key Entities

- **Product** — something for sale. Has a name, description, price, currency,
  whether it recurs, whether its price is fixed or chosen by the buyer, and which
  audience it belongs to. Never editable from a buyer's device.
- **Order** — a record of a purchase. Links a buyer (who may not have an account)
  to a product, the amount actually charged, what they asked for, their
  attachments, and a fulfillment stage that only the operator and the payment
  provider can advance.
- **Attachment** — a file supplied with an order, tagged as something the buyer
  has or something they want. Private.
- **Conversation** — a booking interest that has not become an order. Records
  where it came from, and later the name, email and scheduled time once a booking
  is confirmed.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A person who has never visited before can go from the pricing page
  to a paid receipt in under three minutes without creating an account.
- **SC-002**: The largest catalog item can be purchased. Today the ceiling makes
  every item except the cheapest impossible; this is the blocker being removed.
- **SC-003**: Submitting a falsified price results in the correct amount being
  charged, in 100% of attempts, for every item in the catalog — including the
  variable-price one and both recurring plans.
- **SC-004**: No purchase path anywhere in the product allows a buyer's device to
  originate a payment record.
- **SC-005**: The operator can determine what a buyer bought and what they asked
  for from a single screen, without opening a payment ledger.
- **SC-006**: The storefront scores at least 95 on accessibility audit and passes
  the project's automated accessibility gate.
- **SC-007**: Every new interface element meets the project's component structure
  requirements on the first CI run.
- **SC-008**: With no payment provider and no scheduler configured, every new
  screen still renders and explains itself — zero blank pages, zero dead
  controls, zero errors.
- **SC-009**: A booking made after purchase advances its order with no operator
  action, and a duplicated confirmation advances it exactly once.
- **SC-010**: No motion plays for a visitor who has asked for reduced motion,
  under either the device setting or the in-app setting.
- **SC-011**: Attachment size and type limits still hold when the browser-side
  check is removed.
- **SC-012**: A booking confirmation stores no marketing attribution — verifiable
  by inspecting a stored conversation record after a booking made from a link
  carrying campaign parameters.
- **SC-013**: Every tipping method that does not produce a receipt says so before
  the visitor commits to it.

---

## Assumptions

Recorded from decisions already made in the source PRD (§13), so they are not
re-litigated during planning:

1. The remaining balance on a split-payment build is collected by invoice, not by
   a second checkout.
2. Vertical templates are one catalog item with a selectable variant, not four
   separate items.
3. Cancelling a maintenance plan stops maintenance. The deployed site stays up.
   This is stated in the terms before purchase.
4. Photos in formats the browser cannot preview are stored as-is. No conversion.
5. Booking confirmations are wired from the start rather than flagged by hand,
   because the booking action is an outbound link and the confirmation is
   therefore the only signal that a booking happened.
6. Pre-sale conversations are recorded. The record is created without asking the
   visitor for anything, and is completed by the booking confirmation.
7. One item per order. Add-ons are a separate order.
8. Tax calculation, credit terms, referral tracking, and any cryptocurrency
   payment rail are out of scope. The tip jar's "will work for bitcoin" is copy
   on a sign, not a provider.

---

## Clarifications

Both open questions were resolved on 2026-08-06. No `[NEEDS CLARIFICATION]`
markers remain.

### Q1 — Consent and attribution on a server-received booking confirmation

**Resolved: the confirmation handler records booking facts only. No marketing
attribution is stored, and the conversation record carries no consent snapshot.**

Reasoning, because this one is easy to get wrong later:

The product's existing consent gates all govern _third-party code running in the
visitor's browser_. That is the ePrivacy question — storing or reading something
on someone's device. A server recording where a booking came from is a different
question, governed by data-protection law rather than ePrivacy, and first-party
attribution on a conversion event is normally lawful under legitimate interest
when it is disclosed and not used for cross-site profiling.

So attribution here would probably have been _permissible_. It is being dropped
anyway, on the grounds that it is not _worth_ it: there are no campaigns running,
booking volume is low enough that the operator knows the source of each one
without a database, and the alternative costs a stored consent state, a write, a
read-back, and a privacy position that would have to be defended. If a visitor
has declined analytics, storing attribution also reads as routing around a stated
preference even under a different lawful basis.

Revisit when campaign volume makes the gap visible. Until then the identifier
that links a booking to its conversation is used to find the record and is not
retained as marketing data.

**Consequent requirements**: see FR-024a and FR-024b.

### Q2 — Zero-fee tipping

**Resolved: the tip jar offers the two fee-free direct methods alongside card
payment.**

On a small tip the processor fee is a meaningful fraction of the amount, and the
product already contains unused support for both methods.

**The trade-off is accepted explicitly**: these methods are outbound handoffs
with no confirmation coming back, so a tip paid that way produces **no order
record**. It is visible only in the respective payment app. The interface must
say so at the point of choice rather than leaving the tipper to assume a receipt
is coming.

**Consequent requirements**: see FR-029 and FR-030.

---

## Out of Scope

- Buying more than one item at a time.
- Tax calculation.
- Acting as merchant of record.
- Credit terms.
- Referral or affiliate tracking.
- Any cryptocurrency payment rail.
- Converting photo formats on the server.
