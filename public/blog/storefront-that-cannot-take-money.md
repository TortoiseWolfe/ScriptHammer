---
title: The Storefront That Could Not Take Money
author: TortoiseWolfe
date: 2026-08-07
slug: storefront-that-cannot-take-money
tags:
  - stripe
  - payments
  - testing
  - ci-cd
  - postmortem
categories:
  - engineering
featuredImage: /blog-images/storefront-that-cannot-take-money/featured-og.png
featuredImageAlt: A storefront with a closed sign, illustrating a checkout that cannot take payment
ogImage: /blog-images/storefront-that-cannot-take-money/featured-og.png
excerpt: Our pricing page had five working buy buttons and three that said "Coming soon". The five were the problem. A test-mode Stripe key had been live in production the whole time, and every internal signal said sold.
---

Our pricing page shipped eight buy buttons. Five of them worked. Three of them said
"Coming soon."

The five were the problem.

## 🔍 How it surfaced

It surfaced sideways, which is the only way this class of bug ever does. Somebody
clicked a Care Plan and got a dead end:

```text
That package is not available
```

Three of the eight links did that, and all three were the subscription products. The
cause was mundane. The pricing page is a hand-maintained array of products, while the
checkout route resolves the SKU (Stock Keeping Unit — the product's stable id) against
the database and refuses anything marked inactive. Nothing connected the two, so a
product could be deactivated in the database and go on being advertised with a
working-looking button indefinitely.

The obvious fix is to activate them. The database refused:

```sql
-- A recurring product must have somewhere to bill, or it cannot go active
products_recurring_provider_check
CHECK (
  type = 'one_time'
  OR NOT active
  OR stripe_price_id IS NOT NULL
  OR paypal_plan_id IS NOT NULL
)
```

All three carried neither identifier, so the update was rejected outright. That
constraint turned out to be the only thing on the entire page telling the truth.

## 💳 The actual finding

Chasing those missing identifiers meant looking at the [Stripe](https://stripe.com/)
credentials. They started with `sk_test_`.

That could have been a local-only artifact, so the next question is the only one that
matters: what does **production** ship? Not what a configuration file says, not what a
deploy workflow claims to set — what is in the JavaScript a customer's browser
downloads.

```bash
# Read the deployed bundle itself, not the config that was supposed to produce it
html=$(curl -fsS 'https://example.com/checkout/?sku=svc-site')
for c in $(printf '%s' "$html" | grep -oE '/_next/static/chunks/[^"]+\.js' | sort -u); do
  curl -fsS "https://example.com$c" | grep -oE 'pk_(test|live)_[A-Za-z0-9]{6}'
done
```

The answer came back `pk_test_`.

Stripe will not pair a test publishable key with a live secret key, so one test key in
the bundle means the entire flow is test mode end to end. Every purchasable product was
affected — a 3,500 dollar build, a 1,200 dollar landing page, a 2,500 dollar workshop.

A buyer could complete the intake form, enter a card, and reach a success screen. No
money moved.

## ⚠️ Why nothing caught it

This is the part worth internalising, because the failure is not "somebody used the
wrong key". The failure is that **every available signal said it was working**:

- ✅ The checkout page rendered correctly.
- ✅ The order row was written to the database.
- ✅ A payment intent record was created.
- ✅ The webhook fired and marked the order paid.
- ✅ The success screen appeared.
- ✅ The test suite was green.

Test mode is not an error state. It is a fully functional parallel universe that Stripe
provides precisely so everything behaves normally. Every internal signal reported "sold"
because, within test mode, the sale genuinely succeeded. The only place the difference
becomes observable is a bank account, and software does not check bank accounts.

There is a name for this shape: a gate that verifies the thing where it passes rather
than where it fails. We had checks that the payment flow completes. We had no check that
the payment flow completes **against a live account**.

## 💡 The irony

The three "Coming soon" cards were the honest ones, and they were honest by accident.

Nobody wrote a rule saying "do not advertise a product you cannot charge for". A
database CHECK constraint written for a much narrower reason — a recurring product needs
somewhere to bill — happened to also encode the broader truth. The one-time products had
no equivalent guard, so they advertised themselves as sellable.

That is worth noticing about constraints generally. A rule that makes an invalid state
unrepresentable keeps paying out in situations its author never considered. A rule
enforced by convention pays out until the first person who does not know the convention.

## 🧪 The same bug four hours later, wearing a different hat

The same day, the identical shape turned up somewhere entirely unrelated.

We were moving the E2E (End-to-End) test suite off a shared cloud database onto a
throwaway one created per CI (Continuous Integration) runner. The new configuration ran
the full matrix: three browsers, twenty-four parallel jobs.

All twenty-four went green.

They had also been set up to compare **counts** against a known-good baseline from the
old suite, rather than merely checking that everything passed. That comparison failed:

```text
passed    589  vs baseline 1807
skipped  1402  vs baseline  194
```

Firefox and WebKit had executed **zero tests** — 667 skipped each, no reason recorded.
Two of three browsers ran nothing at all, and every job reported success.

The cause was one line. Each job installed only its own browser, but the authentication
setup step runs in Chromium regardless of which browser is under test. Without Chromium
present, setup could not launch — and [Playwright](https://playwright.dev/) **skips**
tests whose dependency failed rather than failing them. A skipped test is not a failure,
so the job exits zero, so the tick is green.

Nothing about "twenty-four jobs passed" was false. It simply did not mean what a person
reading it would assume.

Had that comparison been "did all the jobs pass?" instead of "do the numbers match?",
the new suite would have been declared equivalent to the old one and switched over, and
two thirds of the browser coverage would have quietly evaporated.

A count is falsifiable. "It passed" is not.

## 🔧 How to check your own

Three steps, none of which need access to anything but the public site.

**1. Find out what key production actually serves.**

Read the deployed bundle, not the configuration. The configuration is what you intended;
the bundle is what shipped. Those differ more often than anyone expects, and the gap is
invisible precisely because both look correct in isolation.

```bash
curl -fsS https://your-site.com/checkout/ \
  | grep -oE '/_next/static/chunks/[^"]+\.js' | sort -u \
  | while read -r chunk; do
      curl -fsS "https://your-site.com$chunk" | grep -oE 'pk_(test|live)_[A-Za-z0-9]{6}'
    done
```

**2. Check whether the payment account is even activated.**

If the Stripe dashboard says "Sandbox" or shows a "Verify your business" button, live
keys do not exist yet. They are not hidden behind a toggle — Stripe will not issue them
until business verification completes: legal entity, bank account, tax details.

⚠️ **Worth checking first.** We spent time hunting for credentials that had never been
created.

**3. Make something assert the answer.**

Almost certainly nothing does. Adding it is a few lines in whatever job already runs
against production after a deploy:

```bash
found=$(curl -fsS "$SITE/checkout/" \
  | grep -oE '/_next/static/chunks/[^"]+\.js' | sort -u \
  | xargs -I{} curl -fsS "$SITE{}" \
  | grep -oE 'pk_(test|live)_' | sort -u)

case "$found" in
  *pk_live_*) echo "live key confirmed" ;;
  *) echo "::error::production is serving $found"; exit 1 ;;   # ⚠️ fail the deploy
esac
```

Then do the step most people skip: **make it fail on purpose.** Point it at a test-mode
value and confirm it goes red.

💡 A guard you have never seen fail is not a guard, it is a line in a log. Four probes
written during this same investigation could not report failure at all — one parsed a
colour format that never appears in the output it read, one printed its success line
unconditionally, one was piped through `tail` and silently lost the rows that mattered.
Each was caught by a number that looked impossible, never by the tool announcing a
problem.

## 🎯 The general rule

Verify against the condition that fails, not the one that is convenient.

Checking that the backend answers proves the backend answers. It says nothing about
which backend the deployed bundle is calling. Checking that checkout completes proves
checkout completes. It says nothing about whether money moved.

The convenient check is almost always the one you already have infrastructure for. The
one that matters is usually a layer further out, closer to what a customer actually
experiences, and almost always more annoying to write.

Write it anyway. A store that looks like it sells and does not is worse than a store
that says "Coming soon."
